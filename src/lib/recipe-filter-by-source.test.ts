import { describe, expect, it } from "vitest";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import {
  filterRecipesBySource,
  filterRecipesForMergedRanking,
  hasThemealdbFullRecipeLink,
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
      baseRecipe({
        id: "themealdb",
        sourceName: THEMEALDB_SOURCE_NAME,
        sourceRecipeId: "52772",
      }),
    ];

    expect(filterRecipesBySource(recipes, "internal-library").map((r) => r.id)).toEqual([
      "internal",
    ]);
  });

  it("returns only TheMealDB imports with a full recipe link for themealdb selection", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({
        id: "themealdb",
        sourceName: THEMEALDB_SOURCE_NAME,
        sourceRecipeId: "52772",
      }),
      baseRecipe({
        id: "themealdb-no-link",
        sourceName: THEMEALDB_SOURCE_NAME,
      }),
    ];

    expect(filterRecipesBySource(recipes, "themealdb").map((r) => r.id)).toEqual(["themealdb"]);
  });
});

describe("hasThemealdbFullRecipeLink", () => {
  it("requires a numeric TheMealDB meal id", () => {
    expect(
      hasThemealdbFullRecipeLink(
        baseRecipe({ sourceName: THEMEALDB_SOURCE_NAME, sourceRecipeId: "52772" }),
      ),
    ).toBe(true);
    expect(
      hasThemealdbFullRecipeLink(
        baseRecipe({ sourceName: THEMEALDB_SOURCE_NAME, sourceRecipeId: "sheet-pan" }),
      ),
    ).toBe(false);
    expect(
      hasThemealdbFullRecipeLink(
        baseRecipe({ sourceName: "yum4less-internal-catalog", sourceRecipeId: "52772" }),
      ),
    ).toBe(false);
  });
});

describe("filterRecipesForMergedRanking", () => {
  it("returns only TheMealDB imports that have a full recipe link", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({
        id: "themealdb",
        sourceName: THEMEALDB_SOURCE_NAME,
        sourceRecipeId: "52772",
      }),
      baseRecipe({ id: "blocked", sourceName: "spoonacular" }),
    ];

    expect(filterRecipesForMergedRanking(recipes).map((r) => r.id)).toEqual(["themealdb"]);
  });
});

describe("selectRecipesForRanking", () => {
  it("uses TheMealDB-only pool for internal-library default", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({
        id: "themealdb",
        sourceName: THEMEALDB_SOURCE_NAME,
        sourceRecipeId: "52772",
      }),
    ];

    expect(selectRecipesForRanking(recipes, "internal-library").map((r) => r.id)).toEqual([
      "themealdb",
    ]);
  });

  it("keeps exclusive themealdb path for explicit API selection", () => {
    const recipes = [
      baseRecipe({ id: "internal", sourceName: "yum4less-internal-catalog" }),
      baseRecipe({
        id: "themealdb",
        sourceName: THEMEALDB_SOURCE_NAME,
        sourceRecipeId: "52772",
      }),
    ];

    expect(selectRecipesForRanking(recipes, "themealdb").map((r) => r.id)).toEqual(["themealdb"]);
  });
});
