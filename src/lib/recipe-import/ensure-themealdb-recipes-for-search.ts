import { getDbPool } from "@/lib/db";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import type { ShopperNotice } from "@/lib/recommendation-service";
import { filterRecipesBySource } from "@/lib/recipe-filter-by-source";
import {
  filterRecipesForRanking,
  type collectSaleIngredientIdsFromObservations,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import { runSaleDrivenThemealdbImport } from "@/lib/recipe-import/sale-driven-themealdb-import";
import {
  DEFAULT_THEMEALDB_SEARCH_IMPORT_MAX_PER_RUN,
  isThemealdbRecipeCacheFresh,
  isThemealdbSearchImportEnabled,
} from "@/lib/recipe-import/themealdb-recipe-cache-policy";
import { THEMEALDB_SOURCE_NAME, type ThemealdbImportReport } from "@/lib/recipe-import/themealdb-types";
import { filterRecipesBySelectedIngredientIds } from "@/lib/sale-ingredient-offers";

export type ThemealdbSearchEnsureStatus =
  | "cache-hit"
  | "refreshed"
  | "import-skipped"
  | "import-failed";

export type ThemealdbSearchEnsureResult = {
  status: ThemealdbSearchEnsureStatus;
  importReport?: ThemealdbImportReport;
  degradedNotice?: ShopperNotice;
};

type SaleIngredientIdSet = ReturnType<typeof collectSaleIngredientIdsFromObservations>;

export function countRankableThemealdbRecipes(input: {
  recipes: CatalogRecipeRecord[];
  saleIngredientIds: SaleIngredientIdSet;
  selectedIngredientIds?: string[];
}): number {
  const themealdbOnly = filterRecipesBySource(input.recipes, "themealdb");
  const saleEligible = filterRecipesForRanking({
    recipes: themealdbOnly,
    saleIngredientIds: input.saleIngredientIds,
  });
  const scoped = filterRecipesBySelectedIngredientIds(
    saleEligible,
    input.selectedIngredientIds,
  );
  return scoped.length;
}

export function shouldRefreshThemealdbRecipesOnSearch(input: {
  recipes: CatalogRecipeRecord[];
  saleIngredientIds: SaleIngredientIdSet;
  selectedIngredientIds?: string[];
  latestImportAt: Date | null;
}): boolean {
  const rankableCount = countRankableThemealdbRecipes(input);

  if (rankableCount > 0 && isThemealdbRecipeCacheFresh(input.latestImportAt)) {
    return false;
  }

  if (rankableCount === 0) {
    // Zero sale overlap is not fixed by a catalog refresh notice — only stale/empty imports are.
    return !isThemealdbRecipeCacheFresh(input.latestImportAt);
  }

  return !isThemealdbRecipeCacheFresh(input.latestImportAt);
}

export async function getLatestThemealdbImportAt(): Promise<Date | null> {
  const pool = getDbPool();
  const result = await pool.query<{ latest_import_at: Date | null }>(
    `
      select max(created_at) as latest_import_at
      from recipes
      where source_name = $1
    `,
    [THEMEALDB_SOURCE_NAME],
  );

  return result.rows[0]?.latest_import_at ?? null;
}

/**
 * Cache-first TheMealDB availability helpers for opt-in ranking.
 * Cron/script path: `runSaleDrivenThemealdbImport` via `npm run ingest:themealdb:from-sales`.
 * Recommendation requests must not call `ensureThemealdbRecipesForSearch` (cron/script-only refresh).
 */
export async function ensureThemealdbRecipesForSearch(input: {
  recipes: CatalogRecipeRecord[];
  saleIngredientIds: SaleIngredientIdSet;
  selectedIngredientIds?: string[];
}): Promise<ThemealdbSearchEnsureResult> {
  const latestImportAt = await getLatestThemealdbImportAt();
  const needsRefresh = shouldRefreshThemealdbRecipesOnSearch({
    ...input,
    latestImportAt,
  });

  if (!needsRefresh) {
    return { status: "cache-hit" };
  }

  if (!isThemealdbSearchImportEnabled()) {
    return { status: "import-skipped" };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      status: "import-skipped",
      degradedNotice: {
        title: "TheMealDB imports refresh on a schedule",
        body: "Opt-in TheMealDB meals use saved imports from the daily ingest job. Run npm run ingest:themealdb:from-sales on your host to refresh the catalog.",
      },
    };
  }

  if (!isPublicApiDbWriteEnabled()) {
    return {
      status: "import-skipped",
      degradedNotice: {
        title: "TheMealDB refresh skipped on this request",
        body: "Public API routes stay read-only by default. Saved TheMealDB imports still rank when they match your sale ingredients. Use npm run ingest:themealdb:from-sales or set YUM4LESS_ENABLE_API_DB_WRITES=1 locally to allow search-path refresh.",
      },
    };
  }

  if (input.saleIngredientIds.size === 0) {
    return {
      status: "import-skipped",
      degradedNotice: {
        title: "No sale ingredients for TheMealDB import",
        body: "Weekly-ad sale prices are not available yet. Try again after the next ingest run, or rank from the internal recipe library.",
      },
    };
  }

  try {
    const maxPerRun = Number(
      process.env.THEMEALDB_SEARCH_IMPORT_MAX_PER_RUN ??
        DEFAULT_THEMEALDB_SEARCH_IMPORT_MAX_PER_RUN,
    );

    const importReport = await runSaleDrivenThemealdbImport({
      maxPerRun,
      limitToIngredientIds: input.selectedIngredientIds,
    });

    return {
      status: "refreshed",
      importReport,
      ...(importReport.importedCount === 0
        ? {
            degradedNotice: {
              title: "TheMealDB refresh found no new meals",
              body: "Saved imports may still appear if they match your sale ingredients. New imports need at least three overlapping weekly-ad sale ingredients.",
            },
          }
        : {}),
    };
  } catch (error) {
    console.error("themealdb-search-import-failed", error);

    return {
      status: "import-failed",
      degradedNotice: {
        title: "TheMealDB import unavailable",
        body: "Showing saved imports only when available. Try again after the next scheduled ingest run, or rank from the internal recipe library.",
      },
    };
  }
}
