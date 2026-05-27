import { describe, expect, it } from "vitest";
import {
  buildRecipeProviderPreviewComparison,
  buildRecipeProviderPreviewComparisons,
} from "@/lib/seed-vs-provider-recipe-comparison";
import type { MockRecipeRecord } from "@/lib/mock-market-data";

const sampleRecipe: MockRecipeRecord = {
  id: "sheet-pan-lemon-chicken",
  title: "Sheet Pan Lemon Chicken and Vegetables",
  summary: "Sample recipe",
  cookTimeMinutes: 35,
  difficulty: "easy",
  tags: [],
  dietaryTags: [],
  ingredients: [
    { ingredientId: "chicken-thighs", displayName: "Chicken thighs", quantityNote: "1.5 lb" },
    { ingredientId: "baby-potatoes", displayName: "Baby potatoes", quantityNote: "1 bag" },
    { ingredientId: "broccoli", displayName: "Broccoli florets", quantityNote: "2 heads" },
  ],
  steps: [],
};

const shoppingPlan = [
  {
    ingredient: "Chicken thighs",
    quantityNote: "1.5 lb",
    storeName: "Kroger",
    price: 6.49,
    freshnessDaysAgo: 1,
  },
  {
    ingredient: "Baby potatoes",
    quantityNote: "1 bag",
    storeName: "Kroger",
    price: 2.99,
    freshnessDaysAgo: 1,
  },
  {
    ingredient: "Broccoli florets",
    quantityNote: "2 heads",
    storeName: "Kroger",
    price: 2.49,
    freshnessDaysAgo: 1,
  },
];

describe("buildRecipeProviderPreviewComparison", () => {
  it("returns unavailable comparison when no provider preview overlap exists", () => {
    const comparison = buildRecipeProviderPreviewComparison({
      recipe: sampleRecipe,
      seedEstimatedTotal: 13.42,
      shoppingPlan,
      providerPricingPreview: {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        storeName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: 5,
        items: [],
        message: "No matches.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    });

    expect(comparison.comparisonStatus).toBe("unavailable");
    expect(comparison.provider).toBe("kroger");
    expect(comparison.providerLabel).toBe("Kroger");
    expect(comparison.providerPreviewSubtotal).toBeNull();
    expect(comparison.message).toContain("No Kroger provider preview prices");
    expect(comparison.message).toContain("does not change the ranked meal total");
  });

  it("builds a partial directional comparison for overlapping preview ingredients", () => {
    const comparison = buildRecipeProviderPreviewComparison({
      recipe: sampleRecipe,
      seedEstimatedTotal: 13.42,
      shoppingPlan,
      providerPricingPreview: {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        storeName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        coverageStatus: "limited",
        matchedIngredientCount: 1,
        totalTrackedIngredients: 5,
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            promoPrice: 5.99,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "description contains the full ingredient name",
          },
        ],
        message: "Preview ready.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    });

    expect(comparison.comparisonStatus).toBe("partial");
    expect(comparison.comparedIngredientCount).toBe(1);
    expect(comparison.seedComparedSubtotal).toBe(6.49);
    expect(comparison.providerPreviewSubtotal).toBe(5.99);
    expect(comparison.priceDelta).toBe(-0.5);
    expect(comparison.directionalLabel).toBe("Directional provider preview looks lower");
    expect(comparison.message).toContain("Kroger provider preview matches");
    expect(comparison.message).toContain("directional only");
  });
});

describe("buildRecipeProviderPreviewComparisons", () => {
  it("builds one comparison per provider preview", () => {
    const comparisons = buildRecipeProviderPreviewComparisons({
      recipe: sampleRecipe,
      seedEstimatedTotal: 13.42,
      shoppingPlan,
      providerPricingPreviews: [
        {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          storeName: "Kroger Mechanicsville",
          providerStoreId: "01100479",
          coverageStatus: "limited",
          matchedIngredientCount: 1,
          totalTrackedIngredients: 5,
          items: [
            {
              provider: "kroger",
              ingredientId: "chicken-thighs",
              ingredientName: "Chicken thighs",
              providerProductId: "0001111000001",
              description: "Fresh Chicken Thighs Family Pack",
              regularPrice: 6.49,
              promoPrice: 5.99,
              currencyCode: "USD",
              inStock: true,
              matchConfidence: 0.88,
              matchReason: "description contains the full ingredient name",
            },
          ],
          message: "Preview ready.",
          fetchedAt: "2026-05-20T12:00:00.000Z",
        },
        {
          provider: "publix",
          label: "Publix official pricing preview",
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
          fallbackUsed: false,
          storeName: "No matched provider store",
          providerStoreId: "unavailable",
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: 5,
          items: [],
          message: "Not configured.",
          fetchedAt: "2026-05-20T12:00:00.000Z",
        },
      ],
    });

    expect(comparisons).toHaveLength(2);
    expect(comparisons[0]?.provider).toBe("kroger");
    expect(comparisons[0]?.comparisonStatus).toBe("partial");
    expect(comparisons[1]?.provider).toBe("publix");
    expect(comparisons[1]?.comparisonStatus).toBe("unavailable");
    expect(comparisons[1]?.message).toContain("No Publix provider preview prices");
  });
});
