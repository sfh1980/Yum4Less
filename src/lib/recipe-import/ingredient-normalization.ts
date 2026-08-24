import { getDbPool } from "@/lib/db";
import type { IngredientCategory } from "@/lib/ingredient-category";
import { inferIngredientCategory } from "@/lib/ingredient-category";
import { slugifyIngredientId } from "@/lib/ingredient-id";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import { scoreProviderProductMatch } from "@/lib/providers/provider-price-matching";
import {
  AUTO_ALIAS_CONFIDENCE_THRESHOLD,
  THEMEALDB_SOURCE_NAME,
} from "@/lib/recipe-import/themealdb-types";
import { shouldRejectThemealdbIngredientLabel } from "@/lib/recipe-import/themealdb-reject-patterns";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { shouldRejectWeeklyAdIngredientMatch } from "@/lib/weekly-ad-ingestion/weekly-ad-match-guards";

export type IngredientNormalizationOutcome =
  | {
      status: "matched";
      ingredientId: string;
      matchConfidence: number;
      matchMethod: "alias" | "fuzzy" | "catalog-name";
    }
  | {
      status: "new-catalog";
      ingredientId: string;
      matchConfidence: number;
    }
  | {
      status: "skipped";
      reason: "rejected" | "unmappable";
    };

export type IngredientAliasRow = {
  ingredientId: string;
  externalLabel: string;
  matchConfidence: number | null;
};

type CatalogEntry = {
  id: string;
  name: string;
  category: IngredientCategory;
};

export class IngredientNormalizationService {
  private aliasByLabel = new Map<string, IngredientAliasRow>();
  private filterTermByIngredientId = new Map<string, string>();
  private catalogById = new Map<string, CatalogEntry>();
  private aliasSavedCount = 0;
  private newIngredientCount = 0;

  static async create() {
    const service = new IngredientNormalizationService();
    await service.loadFromDatabase();
    return service;
  }

  private constructor() {
    for (const ingredient of INTERNAL_CATALOG_INGREDIENTS) {
      this.catalogById.set(ingredient.id, ingredient);
    }
  }

  private async loadFromDatabase() {
    const pool = getDbPool();

    const [aliasResult, ingredientResult] = await Promise.all([
      pool.query<{
        ingredient_id: string;
        external_label: string;
        match_confidence: string | null;
      }>(
        `
          select ingredient_id, external_label, match_confidence
          from ingredient_aliases
          where source_name = $1
        `,
        [THEMEALDB_SOURCE_NAME],
      ),
      pool.query<{ id: string; name: string; category: IngredientCategory }>(
        `
          select id, name, category
          from ingredients
        `,
      ),
    ]);

    for (const row of ingredientResult.rows) {
      this.catalogById.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
      });
    }

    for (const row of aliasResult.rows) {
      const normalizedLabel = normalizeAliasLabel(row.external_label);
      this.aliasByLabel.set(normalizedLabel, {
        ingredientId: row.ingredient_id,
        externalLabel: row.external_label,
        matchConfidence:
          row.match_confidence !== null ? Number(row.match_confidence) : null,
      });

      const existingTerm = this.filterTermByIngredientId.get(row.ingredient_id);
      const confidence = row.match_confidence !== null ? Number(row.match_confidence) : 0;
      if (!existingTerm || confidence >= 0.85) {
        this.filterTermByIngredientId.set(row.ingredient_id, row.external_label);
      }
    }
  }

  getFilterTermForIngredientId(ingredientId: string): string {
    const aliasTerm = this.filterTermByIngredientId.get(ingredientId);
    if (aliasTerm) {
      return aliasTerm;
    }

    const catalog = this.catalogById.get(ingredientId);
    if (catalog) {
      return catalog.name;
    }

    return ingredientId.replace(/-/g, " ");
  }

  async normalizeThemealdbLabel(
    externalLabel: string,
    options: { allowCatalogExpansion?: boolean } = {},
  ): Promise<IngredientNormalizationOutcome> {
    const trimmed = externalLabel.trim();
    if (!trimmed || shouldRejectThemealdbIngredientLabel(trimmed)) {
      return { status: "skipped", reason: "rejected" };
    }

    const aliasKey = normalizeAliasLabel(trimmed);
    const aliasHit = this.aliasByLabel.get(aliasKey);
    if (aliasHit) {
      return {
        status: "matched",
        ingredientId: aliasHit.ingredientId,
        matchConfidence: aliasHit.matchConfidence ?? 0.95,
        matchMethod: "alias",
      };
    }

    const fuzzy = this.fuzzyMatchCatalog(trimmed);
    if (fuzzy) {
      if (fuzzy.matchConfidence >= AUTO_ALIAS_CONFIDENCE_THRESHOLD) {
        await this.saveAlias(trimmed, fuzzy.ingredientId, fuzzy.matchConfidence);
      }
      return {
        status: "matched",
        ingredientId: fuzzy.ingredientId,
        matchConfidence: fuzzy.matchConfidence,
        matchMethod: "fuzzy",
      };
    }

    if (options.allowCatalogExpansion === false) {
      return { status: "skipped", reason: "unmappable" };
    }

    const category = inferIngredientCategory(trimmed);
    if (!category) {
      return { status: "skipped", reason: "unmappable" };
    }

    const ingredientId = await this.createCatalogIngredient(trimmed, category);
    await this.saveAlias(trimmed, ingredientId, 0.9);
    return {
      status: "new-catalog",
      ingredientId,
      matchConfidence: 0.9,
    };
  }

  getAliasSavedCount() {
    return this.aliasSavedCount;
  }

  getNewIngredientCount() {
    return this.newIngredientCount;
  }

  private fuzzyMatchCatalog(label: string) {
    let best:
      | {
          ingredientId: string;
          matchConfidence: number;
        }
      | undefined;

    for (const ingredient of this.catalogById.values()) {
      if (
        shouldRejectWeeklyAdIngredientMatch({
          ingredientId: ingredient.id,
          productName: label,
        })
      ) {
        continue;
      }

      for (const searchTerm of getWeeklyAdIngredientSearchTerms(ingredient)) {
        const scored = scoreProviderProductMatch({
          ingredient: {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            searchTerm,
          },
          description: label,
          inStock: true,
        });

        if (
          scored.matchConfidence >= MIN_WEEKLY_AD_MATCH_CONFIDENCE &&
          (!best || scored.matchConfidence > best.matchConfidence)
        ) {
          best = {
            ingredientId: ingredient.id,
            matchConfidence: scored.matchConfidence,
          };
        }
      }

      const directName = ingredient.name.toLowerCase();
      if (normalizeAliasLabel(label) === normalizeAliasLabel(directName)) {
        const confidence = 0.98;
        if (!best || confidence > best.matchConfidence) {
          best = { ingredientId: ingredient.id, matchConfidence: confidence };
        }
      }
    }

    return best;
  }

  private async saveAlias(
    externalLabel: string,
    ingredientId: string,
    matchConfidence: number,
  ) {
    const normalizedLabel = normalizeAliasLabel(externalLabel);
    if (this.aliasByLabel.has(normalizedLabel)) {
      return;
    }

    const pool = getDbPool();
    await pool.query(
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
      [ingredientId, THEMEALDB_SOURCE_NAME, externalLabel.trim(), matchConfidence],
    );

    this.aliasByLabel.set(normalizedLabel, {
      ingredientId,
      externalLabel: externalLabel.trim(),
      matchConfidence,
    });
    this.aliasSavedCount += 1;
  }

  private async createCatalogIngredient(name: string, category: IngredientCategory) {
    const baseId = slugifyIngredientId(name);
    let ingredientId = baseId;
    let suffix = 2;

    while (this.catalogById.has(ingredientId)) {
      ingredientId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const pool = getDbPool();
    await pool.query(
      `
        insert into ingredients (id, name, category, source_name, source_record_id)
        values ($1, $2, $3, $4, $5)
        on conflict (id) do nothing
      `,
      [ingredientId, titleCase(name), category, THEMEALDB_SOURCE_NAME, name.trim()],
    );

    this.catalogById.set(ingredientId, {
      id: ingredientId,
      name: titleCase(name),
      category,
    });
    this.newIngredientCount += 1;
    return ingredientId;
  }
}

export function normalizeAliasLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export { slugifyIngredientId };

function titleCase(value: string): string {
  return value
    .split(/\s+/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export { inferIngredientCategory };
