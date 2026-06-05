import { getDbPool } from "@/lib/db";
import type { MockPriceObservation, MockRecipeRecord } from "@/lib/mock-market-data";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { MIN_SALE_INGREDIENT_MATCHES, THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";

export const THEMEALDB_RESEARCH_ATTRIBUTION =
  "Recipe data from TheMealDB (research import). Verify ingredients and prices in store before shopping.";

/**
 * Internal library recipes are always eligible when other gates pass.
 * TheMealDB imports require sale overlap with this week's on-sale catalog set.
 */
export function isRecipeEligibleForRanking(input: {
  recipe: MockRecipeRecord;
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
  recipe: MockRecipeRecord,
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
  observations: MockPriceObservation[],
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
  recipes: MockRecipeRecord[];
  saleIngredientIds: Set<string>;
}): MockRecipeRecord[] {
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

export function buildThemealdbResearchNote(input: {
  recipe: MockRecipeRecord;
  nearbyStores: NearbyStoreSummary[];
}): string | undefined {
  if (input.recipe.sourceName !== THEMEALDB_SOURCE_NAME) {
    return undefined;
  }

  if (input.nearbyStores.every((store) => !store.recommendationEnabled)) {
    return THEMEALDB_RESEARCH_ATTRIBUTION;
  }

  return `${THEMEALDB_RESEARCH_ATTRIBUTION} Imported from weekly-ad sale overlap — estimated meal totals only.`;
}
