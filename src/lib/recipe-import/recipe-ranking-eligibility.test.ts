import { describe, expect, it } from "vitest";
import type { CatalogPriceObservation, CatalogRecipeRecord } from "@/lib/market-catalog-types";
import {
  buildThemealdbAttribution,
  collectSaleIngredientIdsFromObservations,
  filterRecipesForRanking,
  isRecipeEligibleForRanking,
  passesThemealdbSaleOverlap,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

const internalRecipe: CatalogRecipeRecord = {
  id: "sheet-pan-lemon-chicken",
  title: "Sheet Pan Lemon Chicken",
  summary: "Internal",
  cookTimeMinutes: 35,
  difficulty: "easy",
  tags: [],
  dietaryTags: [],
  ingredients: [
    { ingredientId: "chicken-thighs", displayName: "Chicken thighs", quantityNote: "1 lb" },
    { ingredientId: "lemon", displayName: "Lemon", quantityNote: "1" },
    { ingredientId: "broccoli", displayName: "Broccoli", quantityNote: "1 head" },
  ],
  steps: [],
  sourceName: "yum4less-internal-catalog",
  eligibleForRanking: true,
};

const themealdbRecipe: CatalogRecipeRecord = {
  id: "themealdb-52772-teriyaki",
  title: "Teriyaki Chicken Casserole",
  summary: "Research import",
  cookTimeMinutes: 40,
  difficulty: "easy",
  tags: ["imported"],
  dietaryTags: [],
  ingredients: [
    { ingredientId: "chicken-breast", displayName: "Chicken", quantityNote: "2 lb" },
    { ingredientId: "soy-sauce", displayName: "Soy sauce", quantityNote: "1 cup" },
    { ingredientId: "garlic", displayName: "Garlic", quantityNote: "3 cloves" },
    { ingredientId: "jasmine-rice", displayName: "Rice", quantityNote: "2 cups" },
  ],
  steps: [],
  sourceName: THEMEALDB_SOURCE_NAME,
  sourceRecipeId: "52772",
  eligibleForRanking: false,
};

describe("recipe ranking eligibility", () => {
  it("keeps internal recipes eligible regardless of sale overlap", () => {
    expect(
      isRecipeEligibleForRanking({
        recipe: internalRecipe,
        saleIngredientIds: new Set(),
      }),
    ).toBe(true);
  });

  it("hides TheMealDB recipes until at least three sale ingredients overlap", () => {
    expect(
      passesThemealdbSaleOverlap(themealdbRecipe, new Set(["chicken-breast", "soy-sauce"])),
    ).toBe(false);

    expect(
      passesThemealdbSaleOverlap(
        themealdbRecipe,
        new Set(["chicken-breast", "soy-sauce", "garlic"]),
      ),
    ).toBe(true);
  });

  it("filters TheMealDB rows out of ranking when sale overlap is insufficient", () => {
    const saleIds = new Set(["chicken-breast", "soy-sauce"]);
    const filtered = filterRecipesForRanking({
      recipes: [internalRecipe, themealdbRecipe],
      saleIngredientIds: saleIds,
    });

    expect(filtered.map((recipe) => recipe.id)).toEqual([internalRecipe.id]);
  });

  it("includes TheMealDB rows when sale overlap threshold passes", () => {
    const saleIds = new Set(["chicken-breast", "soy-sauce", "garlic", "jasmine-rice"]);
    const filtered = filterRecipesForRanking({
      recipes: [internalRecipe, themealdbRecipe],
      saleIngredientIds: saleIds,
    });

    expect(filtered.map((recipe) => recipe.id)).toEqual([
      internalRecipe.id,
      themealdbRecipe.id,
    ]);
  });

  it("builds TheMealDB attribution with meal link", () => {
    const attribution = buildThemealdbAttribution({
      recipe: themealdbRecipe,
      nearbyStores: [
        buildTestNearbyStoreSummary({
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          latitude: 37.6,
          longitude: -77.3,
          distanceMiles: 1,
          rolloutNote: "Weekly-ad ranked",
        }),
      ],
    });

    expect(attribution?.text).toContain("TheMealDB");
    expect(attribution?.url).toBe("https://www.themealdb.com/meal/52772");
  });

  it("collects sale ingredient ids from weekly-ad observations", () => {
    const observations: CatalogPriceObservation[] = [
      {
        storeId: "kroger-mechanicsville",
        ingredientId: "chicken-thighs",
        price: 4.99,
        freshnessDaysAgo: 1,
        inStock: true,
        saleLabel: "Weekly special",
        priceSource: "kroger-weekly-ad-scrape",
        priceSourceKind: "weekly-ad",
      },
      {
        storeId: "kroger-mechanicsville",
        ingredientId: "lemon",
        price: 0.79,
        freshnessDaysAgo: 1,
        inStock: true,
      },
    ];

    expect(collectSaleIngredientIdsFromObservations(observations)).toEqual(
      new Set(["chicken-thighs"]),
    );
  });
});
