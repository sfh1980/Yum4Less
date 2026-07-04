import { describe, expect, it } from "vitest";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import {
  filterRecipesBySource,
  filterRecipesForMergedRanking,
  selectRecipesForRanking,
} from "@/lib/recipe-filter-by-source";

const baseRecipe = (overrides: Partial<CatalogRecipeRecord>): CatalogRecipeRecord => ({
  id: "recipe-1",
  title: "Test",
  summary: "Test",
  cookTimeMinutes: 30,
  difficulty: "easy",
  tags: [],
  dietaryTags: [],
  ingredients: [],
  steps: [],
  ...overrides,
});

describe("filterRecipesBySource", () => {
  it("returns internal catalog recipes for internal-library selection", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({ id: "themealdb", sourceName: THEMEALDB_SOURCE_NAME }),
    ];

    expect(filterRecipesBySource(recipes, "internal-library").map((r) => r.id)).toEqual([
      "internal",
    ]);
  });

  it("returns only TheMealDB imports for themealdb selection", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({ id: "themealdb", sourceName: THEMEALDB_SOURCE_NAME }),
    ];

    expect(filterRecipesBySource(recipes, "themealdb").map((r) => r.id)).toEqual(["themealdb"]);
  });
});

describe("filterRecipesForMergedRanking", () => {
  it("returns internal catalog and TheMealDB imports together", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({ id: "themealdb", sourceName: THEMEALDB_SOURCE_NAME }),
      baseRecipe({ id: "blocked", sourceName: "spoonacular" }),
    ];

    expect(filterRecipesForMergedRanking(recipes).map((r) => r.id)).toEqual([
      "internal",
      "themealdb",
    ]);
  });
});

describe("selectRecipesForRanking", () => {
  it("uses merged pool for internal-library default", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({ id: "themealdb", sourceName: THEMEALDB_SOURCE_NAME }),
    ];

    expect(selectRecipesForRanking(recipes, "internal-library").map((r) => r.id)).toEqual([
      "internal",
      "themealdb",
    ]);
  });

  it("keeps exclusive themealdb path for explicit API selection", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({ id: "themealdb", sourceName: THEMEALDB_SOURCE_NAME }),
    ];

    expect(selectRecipesForRanking(recipes, "themealdb").map((r) => r.id)).toEqual(["themealdb"]);
  });
});
