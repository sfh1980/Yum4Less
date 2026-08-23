import type { CatalogIngredient } from "@/lib/ingredient-category";
import { getDbPool } from "@/lib/db";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import { isFixtureIngestMode } from "@/lib/fixture-ingest-policy";
import { logServerError } from "@/lib/server-log";
import { normalizeAliasLabel } from "@/lib/recipe-import/ingredient-normalization";
import type { WeeklyAdMatchCatalogSnapshot } from "@/lib/weekly-ad-ingestion/classify-weekly-ad-flyer-line";
import {
  classifyWeeklyAdFlyerLine,
  type WeeklyAdFlyerClassification,
} from "@/lib/weekly-ad-ingestion/classify-weekly-ad-flyer-line";
import type {
  WeeklyAdChain,
  WeeklyAdOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const WEEKLY_AD_ALIAS_SOURCE = "weekly-ad";

export function fallbackWeeklyAdMatchCatalog(): WeeklyAdMatchCatalogSnapshot {
  return {
    ingredients: INTERNAL_CATALOG_INGREDIENTS,
    skipLabels: new Set(),
    aliasesByLabel: new Map(),
    extraSearchTermsByIngredientId: {},
  };
}

export async function loadWeeklyAdMatchCatalog(): Promise<WeeklyAdMatchCatalogSnapshot> {
  if (isFixtureIngestMode()) {
    return fallbackWeeklyAdMatchCatalog();
  }

  if (!process.env.DATABASE_URL) {
    return fallbackWeeklyAdMatchCatalog();
  }

  try {
    const pool = getDbPool();
    const [ingredientsResult, aliasResult, skipResult] = await Promise.all([
      pool.query<{ id: string; name: string; category: CatalogIngredient["category"] }>(
        `select id, name, category from ingredients order by id`,
      ),
      pool.query<{ ingredient_id: string; source_name: string; external_label: string }>(
        `select ingredient_id, source_name, external_label from ingredient_aliases`,
      ),
      pool.query<{ normalized_label: string }>(
        `select normalized_label from ingredient_match_skips`,
      ),
    ]);

    if (ingredientsResult.rows.length === 0) {
      return fallbackWeeklyAdMatchCatalog();
    }

    const extraSearchTermsByIngredientId: Record<string, string[]> = {};
    const aliasesByLabel = new Map<string, string>();
    for (const row of aliasResult.rows) {
      const label = normalizeAliasLabel(row.external_label);
      if (row.source_name === WEEKLY_AD_ALIAS_SOURCE) {
        aliasesByLabel.set(label, row.ingredient_id);
      }
      const existing = extraSearchTermsByIngredientId[row.ingredient_id] ?? [];
      existing.push(row.external_label);
      extraSearchTermsByIngredientId[row.ingredient_id] = existing;
    }

    return {
      ingredients: ingredientsResult.rows,
      skipLabels: new Set(skipResult.rows.map((row) => row.normalized_label)),
      aliasesByLabel,
      extraSearchTermsByIngredientId,
    };
  } catch (error) {
    logServerError("weekly-ad-match-catalog.load", error);
    return fallbackWeeklyAdMatchCatalog();
  }
}

export function trackedIngredientIdsFromCatalog(
  catalog: WeeklyAdMatchCatalogSnapshot,
): string[] {
  return catalog.ingredients.map((ingredient) => ingredient.id);
}

export async function expandUnmatchedWeeklyAdOffers(input: {
  chain: WeeklyAdChain;
  offers: WeeklyAdOffer[];
  catalog: WeeklyAdMatchCatalogSnapshot;
  persist: boolean;
}): Promise<WeeklyAdOffer[]> {
  if (isFixtureIngestMode() || !input.persist) {
    return input.offers;
  }

  const catalog = input.catalog;
  const expanded: WeeklyAdOffer[] = [];

  for (const offer of input.offers) {
    if (offer.ingredientId) {
      expanded.push(offer);
      continue;
    }

    const classifications = classifyWeeklyAdFlyerLine({
      productName: offer.productName,
      chain: input.chain,
      catalog,
    });

    const resolvedOffers: WeeklyAdOffer[] = [];
    for (const classification of classifications) {
      const resolved = await applyClassification({
        offer,
        classification,
        catalog,
        persist: input.persist,
        chain: input.chain,
      });
      if (resolved) {
        resolvedOffers.push(resolved);
      }
    }

    if (resolvedOffers.length === 0) {
      expanded.push(offer);
    } else {
      expanded.push(...resolvedOffers);
    }
  }

  return expanded;
}

async function applyClassification(input: {
  offer: WeeklyAdOffer;
  classification: WeeklyAdFlyerClassification;
  catalog: WeeklyAdMatchCatalogSnapshot;
  persist: boolean;
  chain: WeeklyAdChain;
}): Promise<WeeklyAdOffer | undefined> {
  const { classification, offer, catalog } = input;

  if (classification.action === "skip") {
    if (classification.reason === "junk") {
      await insertSkipIfMissing({
        normalizedLabel: classification.normalizedLabel,
        rawProductName: offer.productName,
        reason: "junk-heuristic",
      });
      catalog.skipLabels.add(classification.normalizedLabel);
    }
    return undefined;
  }

  if (classification.action === "review") {
    await upsertPendingReview({
      normalizedLabel: classification.normalizedLabel,
      rawProductName: classification.rawProductName,
      chain: input.chain,
    });
    return undefined;
  }

  if (classification.action === "auto-create") {
    const ingredientId = await insertIngredientIfMissing(classification.ingredient);
    catalog.ingredients.push({
      ...classification.ingredient,
      id: ingredientId,
    });
    await insertWeeklyAdAlias({
      ingredientId,
      externalLabel: classification.nickname,
    });
    rememberCatalogAlias(catalog, ingredientId, classification.nickname, classification.normalizedLabel);
    return {
      ...offer,
      ingredientId,
      matchConfidence: 0.9,
      confidenceScore: 0.9,
    };
  }

  if (classification.saveAlias) {
    await insertWeeklyAdAlias({
      ingredientId: classification.ingredientId,
      externalLabel: offer.productName,
    });
    rememberCatalogAlias(
      catalog,
      classification.ingredientId,
      offer.productName,
      classification.normalizedLabel,
    );
  }

  return {
    ...offer,
    ingredientId: classification.ingredientId,
    matchConfidence: classification.matchConfidence,
    confidenceScore: classification.matchConfidence,
  };
}

function rememberCatalogAlias(
  catalog: WeeklyAdMatchCatalogSnapshot,
  ingredientId: string,
  externalLabel: string,
  normalizedLabel: string,
) {
  catalog.aliasesByLabel.set(normalizedLabel, ingredientId);
  const existing = catalog.extraSearchTermsByIngredientId[ingredientId] ?? [];
  existing.push(externalLabel);
  catalog.extraSearchTermsByIngredientId[ingredientId] = existing;
}

export async function insertSkipIfMissing(input: {
  normalizedLabel: string;
  rawProductName: string;
  reason: string;
}) {
  try {
    await getDbPool().query(
      `
        insert into ingredient_match_skips (normalized_label, raw_product_name, reason)
        values ($1, $2, $3)
        on conflict (normalized_label) do nothing
      `,
      [input.normalizedLabel, input.rawProductName, input.reason],
    );
  } catch (error) {
    logServerError("weekly-ad-match-catalog.insertSkip", error, {
      normalizedLabel: input.normalizedLabel,
    });
  }
}

async function upsertPendingReview(input: {
  normalizedLabel: string;
  rawProductName: string;
  chain: WeeklyAdChain;
}) {
  try {
    await getDbPool().query(
      `
        insert into ingredient_match_reviews (
          normalized_label,
          raw_product_name,
          chain,
          status,
          seen_at
        )
        values ($1, $2, $3, 'pending', now())
        on conflict (normalized_label) do update
          set seen_at = now(),
              raw_product_name = excluded.raw_product_name,
              chain = excluded.chain
          where ingredient_match_reviews.status = 'pending'
      `,
      [input.normalizedLabel, input.rawProductName, input.chain],
    );
  } catch (error) {
    logServerError("weekly-ad-match-catalog.upsertReview", error, {
      normalizedLabel: input.normalizedLabel,
    });
  }
}

export async function insertIngredientIfMissing(ingredient: CatalogIngredient): Promise<string> {
  const pool = getDbPool();
  const existing = await pool.query<{ id: string }>(
    `select id from ingredients where id = $1`,
    [ingredient.id],
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  await pool.query(
    `
      insert into ingredients (id, name, category, source_name, source_record_id)
      values ($1, $2, $3, 'weekly-ad-catalog', $4)
      on conflict (id) do nothing
    `,
    [ingredient.id, ingredient.name, ingredient.category, ingredient.name],
  );
  return ingredient.id;
}

export async function insertWeeklyAdAlias(input: {
  ingredientId: string;
  externalLabel: string;
}) {
  try {
    await getDbPool().query(
      `
        insert into ingredient_aliases (
          ingredient_id,
          source_name,
          external_label,
          match_confidence
        )
        values ($1, $2, $3, $4)
        on conflict (source_name, external_label) do nothing
      `,
      [input.ingredientId, WEEKLY_AD_ALIAS_SOURCE, input.externalLabel.trim(), 0.9],
    );
  } catch (error) {
    logServerError("weekly-ad-match-catalog.insertAlias", error, {
      ingredientId: input.ingredientId,
    });
  }
}
