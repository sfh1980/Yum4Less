import { getDbPool } from "@/lib/db";
import type { CatalogPriceObservation, CatalogRecipeRecord } from "@/lib/market-catalog-types";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import {
  buildThemealdbMealUrl,
  THEMEALDB_ATTRIBUTION_URL,
} from "@/lib/recipe-import/themealdb-recipe-cache-policy";
import { MIN_SALE_INGREDIENT_MATCHES, THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";

export const THEMEALDB_RESEARCH_ATTRIBUTION =
  "Recipe from TheMealDB — verify ingredients and prices in store before shopping.";

export type ThemealdbAttribution = {
  text: string;
  url?: string;
};

/**
 * Internal library recipes are always eligible when other gates pass.
 * TheMealDB imports require sale overlap with this week's on-sale catalog set.
 */
export function isRecipeEligibleForRanking(input: {
  recipe: CatalogRecipeRecord;
  saleIngredientIds: Set<string>;
}): boolean {
  if (input.recipe.eligibleForRanking === false) {
    if (input.recipe.sourceName !== THEMEALDB_SOURCE_NAME) {
      return false;
    }
    return passesThemealdbSaleOverlap(input.recipe, input.saleIngredientIds);
  }

  if (input.recipe.sourceName === THEMEALDB_SOURCE_NAME) {
    return passesThemealdbSaleOverlap(input.recipe, input.saleIngredientIds);
  }

  return true;
}

export function passesThemealdbSaleOverlap(
  recipe: CatalogRecipeRecord,
  saleIngredientIds: Set<string>,
): boolean {
  if (saleIngredientIds.size === 0) {
    return false;
  }

  const matchedSaleCount = recipe.ingredients.filter((line) =>
    saleIngredientIds.has(line.ingredientId),
  ).length;

  return matchedSaleCount >= MIN_SALE_INGREDIENT_MATCHES;
}

export function collectSaleIngredientIdsFromObservations(
  observations: CatalogPriceObservation[],
): Set<string> {
  const saleIds = new Set<string>();

  for (const observation of observations) {
    if (observation.saleLabel && observation.priceSourceKind === "weekly-ad") {
      saleIds.add(observation.ingredientId);
      continue;
    }

    if (observation.saleLabel && observation.priceSource?.includes("-weekly-ad-scrape")) {
      saleIds.add(observation.ingredientId);
    }
  }

  return saleIds;
}

export function filterRecipesForRanking(input: {
  recipes: CatalogRecipeRecord[];
  saleIngredientIds: Set<string>;
}): CatalogRecipeRecord[] {
  return input.recipes.filter((recipe) =>
    isRecipeEligibleForRanking({ recipe, saleIngredientIds: input.saleIngredientIds }),
  );
}

/** Read-only helper for scripts/tests — not used on hot API paths. */
export async function getSaleIngredientIdsForRanking(): Promise<Set<string>> {
  const pool = getDbPool();
  const result = await pool.query<{ ingredient_id: string }>(
    `
      select distinct po.ingredient_id
      from price_observations po
      where po.source_name like '%-weekly-ad-scrape'
        and po.sale_label is not null
        and (po.valid_through is null or po.valid_through >= now())
    `,
  );

  return new Set(result.rows.map((row) => row.ingredient_id));
}

export function buildThemealdbAttribution(input: {
  recipe: CatalogRecipeRecord;
  nearbyStores: NearbyStoreSummary[];
}): ThemealdbAttribution | undefined {
  if (input.recipe.sourceName !== THEMEALDB_SOURCE_NAME) {
    return undefined;
  }

  const mealUrl = input.recipe.sourceRecipeId
    ? buildThemealdbMealUrl(input.recipe.sourceRecipeId)
    : THEMEALDB_ATTRIBUTION_URL;

  if (input.nearbyStores.every((store) => !store.recommendationEnabled)) {
    return {
      text: THEMEALDB_RESEARCH_ATTRIBUTION,
      url: mealUrl,
    };
  }

  return {
    text: `${THEMEALDB_RESEARCH_ATTRIBUTION} Sale-matched import — estimated meal totals only.`,
    url: mealUrl,
  };
}

/** @deprecated Use buildThemealdbAttribution for link support. */
export function buildThemealdbResearchNote(input: {
  recipe: CatalogRecipeRecord;
  nearbyStores: NearbyStoreSummary[];
}): string | undefined {
  return buildThemealdbAttribution(input)?.text;
}
