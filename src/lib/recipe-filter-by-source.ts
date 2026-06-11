import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";

export function filterRecipesBySource(
  recipes: CatalogRecipeRecord[],
  recipeSource: RecipeSourceSelection,
): CatalogRecipeRecord[] {
  if (recipeSource === "internal-library") {
    return recipes.filter(
      (recipe) =>
        !recipe.sourceName || recipe.sourceName === "yum4less-internal-catalog",
    );
  }

  if (recipeSource === "themealdb") {
    return recipes.filter((recipe) => recipe.sourceName === THEMEALDB_SOURCE_NAME);
  }

  return [];
}
