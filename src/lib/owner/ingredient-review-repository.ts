import { getDbPool } from "@/lib/db";
import type { IngredientCategory } from "@/lib/ingredient-category";
import {
  isCanonicalIngredientId,
  slugifyIngredientId,
} from "@/lib/ingredient-id";
import { resolveCanonicalSimpleFood } from "@/lib/weekly-ad-ingestion/weekly-ad-simple-food";
import { isFixtureIngestMode } from "@/lib/fixture-ingest-policy";
import { flyerLineLooksLikeJunk } from "@/lib/weekly-ad-ingestion/weekly-ad-junk-heuristics";
import {
  insertIngredientIfMissing,
  insertSkipIfMissing,
  insertWeeklyAdAlias,
} from "@/lib/weekly-ad-ingestion/weekly-ad-match-catalog";
import { logServerError } from "@/lib/server-log";

export const INGREDIENT_REVIEW_LIMITS = {
  default: 50,
  max: 100,
} as const;

export type PublicIngredientReviewRow = {
  id: number;
  normalizedLabel: string;
  rawProductName: string;
  chain: string | null;
  seenAt: string;
  suggestedIngredientId: string | null;
  suggestedName: string | null;
  suggestedCategory: IngredientCategory | null;
};

export type IngredientReviewDecision = "yes" | "no";

export async function listPendingIngredientReviews(
  limit: number,
  offset: number,
): Promise<{ reviews: PublicIngredientReviewRow[]; hasMore: boolean }> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: string;
    normalized_label: string;
    raw_product_name: string;
    chain: string | null;
    seen_at: Date;
  }>(
    `
      select id, normalized_label, raw_product_name, chain, seen_at
      from ingredient_match_reviews
      where status = 'pending'
      order by seen_at desc, id desc
      limit $1 offset $2
    `,
    [limit + 1, offset],
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

  return {
    reviews: rows.map((row) => {
      const suggested = resolveCanonicalSimpleFood(row.normalized_label);
      return {
        id: Number(row.id),
        normalizedLabel: row.normalized_label,
        rawProductName: row.raw_product_name,
        chain: row.chain,
        seenAt: row.seen_at.toISOString(),
        suggestedIngredientId: suggested?.id ?? null,
        suggestedName: suggested?.name ?? null,
        suggestedCategory: suggested?.category ?? null,
      };
    }),
    hasMore,
  };
}

export async function resolveIngredientReview(input: {
  normalizedLabel: string;
  decision: IngredientReviewDecision;
  ingredientId?: string;
  ingredientName?: string;
  category?: IngredientCategory;
}): Promise<{ ok: true; ingredientId?: string } | { ok: false; error: string }> {
  const pool = getDbPool();
  const pending = await pool.query<{
    normalized_label: string;
    raw_product_name: string;
    status: string;
  }>(
    `
      select normalized_label, raw_product_name, status
      from ingredient_match_reviews
      where normalized_label = $1
      limit 1
    `,
    [input.normalizedLabel],
  );
  const row = pending.rows[0];
  if (!row) {
    return { ok: false, error: "That flyer line is not in the review queue." };
  }

  if (input.decision === "no") {
    await insertSkipIfMissing({
      normalizedLabel: row.normalized_label,
      rawProductName: row.raw_product_name,
      reason: "owner-rejected",
    });
    await pool.query(
      `
        update ingredient_match_reviews
        set status = 'rejected',
            resolved_ingredient_id = null,
            resolved_at = now()
        where normalized_label = $1
      `,
      [row.normalized_label],
    );
    return { ok: true };
  }

  const resolved = await resolveAcceptedIngredient({
    normalizedLabel: row.normalized_label,
    ingredientId: input.ingredientId,
    ingredientName: input.ingredientName,
    category: input.category,
  });
  if (!resolved.ok) {
    return resolved;
  }

  try {
    await insertWeeklyAdAlias({
      ingredientId: resolved.ingredientId,
      externalLabel: row.raw_product_name,
    });
    await pool.query(
      `
        update ingredient_match_reviews
        set status = 'accepted',
            resolved_ingredient_id = $2,
            resolved_at = now()
        where normalized_label = $1
      `,
      [row.normalized_label, resolved.ingredientId],
    );
    return { ok: true, ingredientId: resolved.ingredientId };
  } catch (error) {
    logServerError("owner.ingredient-review.accept", error, {
      normalizedLabel: row.normalized_label,
    });
    return { ok: false, error: "That flyer line could not be saved as a food." };
  }
}

export async function rejectPendingReviewsMatchingJunk(): Promise<{
  scanned: number;
  rejected: number;
}> {
  if (isFixtureIngestMode()) {
    return { scanned: 0, rejected: 0 };
  }

  const pool = getDbPool();
  const pending = await pool.query<{
    normalized_label: string;
    raw_product_name: string;
  }>(
    `
      select normalized_label, raw_product_name
      from ingredient_match_reviews
      where status = 'pending'
    `,
  );

  let rejected = 0;
  for (const row of pending.rows) {
    if (!flyerLineLooksLikeJunk(row.raw_product_name, row.normalized_label)) {
      continue;
    }

    await insertSkipIfMissing({
      normalizedLabel: row.normalized_label,
      rawProductName: row.raw_product_name,
      reason: "junk-heuristic",
    });
    await pool.query(
      `
        update ingredient_match_reviews
        set status = 'rejected',
            resolved_ingredient_id = null,
            resolved_at = now()
        where normalized_label = $1
          and status = 'pending'
      `,
      [row.normalized_label],
    );
    rejected += 1;
  }

  return { scanned: pending.rows.length, rejected };
}

async function resolveAcceptedIngredient(input: {
  normalizedLabel: string;
  ingredientId?: string;
  ingredientName?: string;
  category?: IngredientCategory;
}): Promise<{ ok: true; ingredientId: string } | { ok: false; error: string }> {
  const requestedId = input.ingredientId
    ? slugifyIngredientId(input.ingredientId)
    : "";
  if (requestedId) {
    if (!isCanonicalIngredientId(requestedId)) {
      return {
        ok: false,
        error:
          "Canonical food id must be lowercase kebab-case (letters, numbers, hyphens), 2-56 characters. Example: imitation-crab.",
      };
    }
    const existing = await getDbPool().query<{ id: string }>(
      `select id from ingredients where id = $1`,
      [requestedId],
    );
    if (existing.rows[0]?.id) {
      return { ok: true, ingredientId: existing.rows[0].id };
    }
    const createdName = input.ingredientName?.trim();
    if (createdName && input.category) {
      const createdId = await insertIngredientIfMissing({
        id: requestedId,
        name: createdName,
        category: input.category,
      });
      return { ok: true, ingredientId: createdId };
    }
    return {
      ok: false,
      error: "Unknown food id. Create it with a name and category, or pick an existing id.",
    };
  }

  const suggested = resolveCanonicalSimpleFood(input.normalizedLabel);
  if (!suggested) {
    return {
      ok: false,
      error: "Yes needs an existing food id, or a new food name and category.",
    };
  }

  const createdId = await insertIngredientIfMissing(suggested);
  return { ok: true, ingredientId: createdId };
}
