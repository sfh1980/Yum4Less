import { describe, expect, it } from "vitest";
import {
  buildNearbySaleIngredientChoices,
  filterRecipesBySelectedIngredientIds,
  formatIngredientPriceAge,
  formatMealPriceAgeFromShoppingPlan,
} from "@/lib/sale-ingredient-offers";

describe("buildNearbySaleIngredientChoices", () => {
  it("groups live ranked price rows into shopper-facing ingredient choices", () => {
    const choices = buildNearbySaleIngredientChoices({
      nearbyStores: [{ id: "store-a", name: "Kroger A" }],
      ingredients: [{ id: "chicken-breast", name: "Chicken breast", category: "protein" }],
      priceObservations: [
        {
          storeId: "store-a",
          ingredientId: "chicken-breast",
          price: 4.99,
          saleLabel: "Weekly ad special",
          freshnessDaysAgo: 2,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          priceSourceKind: "weekly-ad",
        },
      ],
    });

    expect(choices).toHaveLength(1);
    expect(choices[0]?.ingredientName).toBe("Chicken breast");
    expect(choices[0]?.trustLabel).toBe("directional");
    expect(choices[0]?.lowestEstimatedPrice).toBe(4.99);
    expect(choices[0]?.freshnessHoursAgo).toBe(48);
  });

  it("surfaces freshness hours from observation metadata", () => {
    const choices = buildNearbySaleIngredientChoices({
      nearbyStores: [{ id: "store-a", name: "Kroger A" }],
      ingredients: [{ id: "rice", name: "Rice", category: "grain" }],
      priceObservations: [
        {
          storeId: "store-a",
          ingredientId: "rice",
          price: 1.99,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 22,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          priceSourceKind: "weekly-ad",
        },
      ],
    });

    expect(choices[0]?.freshnessHoursAgo).toBe(22);
    expect(
      formatIngredientPriceAge({ freshnessHoursAgo: choices[0]?.freshnessHoursAgo }),
    ).toBe("Prices from ~22 hours ago");
  });

  it("derives freshness hours from days when hours metadata is absent", () => {
    expect(formatIngredientPriceAge({ freshnessDaysAgo: 1 })).toBe(
      "Prices from ~24 hours ago",
    );
    expect(formatIngredientPriceAge({})).toBeUndefined();
  });

  it("averages shopping-plan freshness into a card-level data-age line", () => {
    expect(
      formatMealPriceAgeFromShoppingPlan([
        { freshnessHoursAgo: 20 },
        { freshnessHoursAgo: 28 },
      ]),
    ).toBe("Prices from ~24 hours ago");
  });

  it("only includes observations for stores passed in the nearby set", () => {
    const choices = buildNearbySaleIngredientChoices({
      nearbyStores: [{ id: "store-a", name: "Kroger A" }],
      ingredients: [{ id: "rice", name: "Rice", category: "grain" }],
      priceObservations: [
        {
          storeId: "store-b",
          ingredientId: "rice",
          price: 1.99,
          freshnessDaysAgo: 1,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          priceSourceKind: "weekly-ad",
        },
      ],
    });

    expect(choices).toHaveLength(0);
  });
});

describe("filterRecipesBySelectedIngredientIds", () => {
  it("keeps recipes that overlap the selected ingredient ids", () => {
    const recipes = [
      {
        id: "a",
        ingredients: [{ ingredientId: "chicken-breast" }],
      },
      {
        id: "b",
        ingredients: [{ ingredientId: "tofu" }],
      },
    ];

    const filtered = filterRecipesBySelectedIngredientIds(recipes, ["chicken-breast"]);

    expect(filtered.map((recipe) => recipe.id)).toEqual(["a"]);
  });
});
