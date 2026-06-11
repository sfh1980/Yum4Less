import { describe, expect, it } from "vitest";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import { filterRecipesBySource } from "@/lib/recipe-filter-by-source";

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
