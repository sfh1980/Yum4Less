import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";

const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";

function isInternalCatalogRecipe(recipe: CatalogRecipeRecord): boolean {
  return !recipe.sourceName || recipe.sourceName === INTERNAL_CATALOG_SOURCE;
}

function isThemealdbImportRecipe(recipe: CatalogRecipeRecord): boolean {
  return recipe.sourceName === THEMEALDB_SOURCE_NAME;
}

/** TheMealDB meal page URL requires a numeric meal id. */
export function hasThemealdbFullRecipeLink(recipe: CatalogRecipeRecord): boolean {
  const sourceRecipeId = recipe.sourceRecipeId?.trim() ?? "";
  return isThemealdbImportRecipe(recipe) && /^\d+$/.test(sourceRecipeId);
}

/**
 * Shopper ranking pool: TheMealDB imports that have a full recipe page link.
 * Short internal-library dinners stay in the catalog for matching, but are not ranked.
 */
export function filterRecipesForMergedRanking(
  recipes: CatalogRecipeRecord[],
): CatalogRecipeRecord[] {
  return recipes.filter((recipe) => hasThemealdbFullRecipeLink(recipe));
}

export function selectRecipesForRanking(
  recipes: CatalogRecipeRecord[],
  recipeSource: RecipeSourceSelection,
): CatalogRecipeRecord[] {
  if (recipeSource === "internal-library") {
    return filterRecipesForMergedRanking(recipes);
  }

  return filterRecipesBySource(recipes, recipeSource);
}

export function filterRecipesBySource(
  recipes: CatalogRecipeRecord[],
  recipeSource: RecipeSourceSelection,
): CatalogRecipeRecord[] {
  if (recipeSource === "internal-library") {
    return recipes.filter((recipe) => isInternalCatalogRecipe(recipe));
  }

  if (recipeSource === "themealdb") {
    return recipes.filter((recipe) => hasThemealdbFullRecipeLink(recipe));
  }

  return [];
}
