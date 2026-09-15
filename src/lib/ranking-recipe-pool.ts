import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
} from "@/lib/market-catalog-types";
import type { MealPreferenceForm } from "@/lib/recommendation-types";
import {
  collectSaleIngredientIdsFromObservations,
  filterRecipesForRanking,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import { selectRecipesForRanking } from "@/lib/recipe-filter-by-source";
import { filterRecipesBySelectedIngredientIds } from "@/lib/sale-ingredient-offers";
import { resolveEffectiveSelectedIngredientIds } from "@/lib/store-scope";
import { recipeMatchesSelectedCuisines } from "@/lib/cuisine-chips";

export type RankingRecipePoolInput = {
  recipes: CatalogRecipeRecord[];
  preferences: MealPreferenceForm;
  priceObservations: CatalogPriceObservation[];
  selectedStoreIds: string[];
};

function byDietaryFocus(
  recipe: CatalogRecipeRecord,
  dietaryFocus: MealPreferenceForm["dietaryFocus"],
): boolean {
  if (dietaryFocus === "anything") {
    return true;
  }

  return recipe.dietaryTags.includes(dietaryFocus);
}

/**
 * Eligible recipe pool for ranking and pantry coverage — same upstream filters,
 * excluding budget, maxIngredients, and plan-build / budget gates applied later.
 */
export function buildEligibleRecipePool(
  input: RankingRecipePoolInput,
): CatalogRecipeRecord[] {
  const effectiveSelectedIngredientIds = resolveEffectiveSelectedIngredientIds({
    selectedIngredientIds: input.preferences.selectedIngredientIds,
    priceObservations: input.priceObservations,
    selectedStoreIds: input.selectedStoreIds,
  });

  if (effectiveSelectedIngredientIds.length === 0) {
    return [];
  }

  const saleIngredientIds = collectSaleIngredientIdsFromObservations(
    input.priceObservations,
  );
  const sourceFilteredRecipes = selectRecipesForRanking(
    input.recipes,
    input.preferences.recipeSource,
  );
  const rankableRecipes = filterRecipesForRanking({
    recipes: sourceFilteredRecipes,
    saleIngredientIds,
  });

  return filterRecipesBySelectedIngredientIds(
    rankableRecipes,
    effectiveSelectedIngredientIds,
  )
    .filter((recipe) => byDietaryFocus(recipe, input.preferences.dietaryFocus))
    .filter((recipe) =>
      recipeMatchesSelectedCuisines(
        recipe,
        input.preferences.selectedCuisineIds ?? [],
      ),
    );
}

/**
 * Rankable dinners before cuisine preference — used for cuisine chip facet counts.
 */
export function buildCuisineFacetRecipePool(input: {
  recipes: CatalogRecipeRecord[];
  priceObservations: CatalogPriceObservation[];
  selectedStoreIds: string[];
  recipeSource: MealPreferenceForm["recipeSource"];
  dietaryFocus?: MealPreferenceForm["dietaryFocus"];
  selectedIngredientIds?: string[];
}): CatalogRecipeRecord[] {
  return buildEligibleRecipePool({
    recipes: input.recipes,
    priceObservations: input.priceObservations,
    selectedStoreIds: input.selectedStoreIds,
    preferences: {
      zipCode: "",
      radiusMiles: 5,
      budget: 20,
      maxIngredients: 8,
      shoppingStyle: "multi-store",
      dietaryFocus: input.dietaryFocus ?? "anything",
      recipeSource: input.recipeSource,
      selectedStoreIds: input.selectedStoreIds,
      selectedIngredientIds: input.selectedIngredientIds,
      selectedCuisineIds: [],
    },
  });
}
