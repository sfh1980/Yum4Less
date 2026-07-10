import { describe, expect, it } from "vitest";
import {
  buildBestChainCoverageDepth,
  buildChainCoverageDepthLiveSummary,
  buildMultiStoreCoverageSkewReason,
  buildMultiStoreCoverageSummary,
} from "@/lib/chain-coverage-honesty";
import { buildTestMeal } from "@/components/meal-planner/test-fixtures";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

describe("chain-coverage-honesty", () => {
  const stores = [
    buildTestNearbyStoreSummary({
      id: "kroger-1",
      chain: "kroger",
      chainLabel: "Kroger",
      matchedIngredientCount: 96,
      pricingSourceKind: "official-online",
    }),
    buildTestNearbyStoreSummary({
      id: "publix-1",
      chain: "publix",
      chainLabel: "Publix",
      matchedIngredientCount: 34,
      pricingSourceKind: "weekly-ad",
    }),
    buildTestNearbyStoreSummary({
      id: "aldi-1",
      chain: "aldi",
      chainLabel: "Aldi",
      matchedIngredientCount: 17,
      pricingSourceKind: "weekly-ad",
    }),
  ];

  it("builds best per-chain coverage from enabled stores", () => {
    const depth = buildBestChainCoverageDepth(stores);
    expect(depth.map((entry) => entry.chain)).toEqual([
      "kroger",
      "publix",
      "aldi",
    ]);
    expect(depth[0]?.matchedIngredientCount).toBe(96);
    expect(depth[1]?.matchedIngredientCount).toBe(34);
  });

  it("formats multi-store settings summary from selected stores", () => {
    const summary = buildMultiStoreCoverageSummary(stores, [
      "kroger-1",
      "publix-1",
      "aldi-1",
    ]);

    expect(summary).toContain("Kroger ~96/97");
    expect(summary).toContain("Publix ~34/97");
    expect(summary).toContain("Aldi ~17/97");
    expect(summary).toContain("lowest estimated priced item");
  });

  it("builds live coverage summary for trust banner depth section", () => {
    const summary = buildChainCoverageDepthLiveSummary(stores);
    expect(summary).toContain("Near you this week:");
    expect(summary).toContain("Kroger ~96/97");
  });

  it("surfaces coverage-skew heads-up when multi-store plans cluster on deepest chain", () => {
    const recommendations = [
      buildTestMeal({
        shoppingPlan: [
          {
            ingredientId: "chicken-thighs",
            ingredient: "Chicken thighs",
            quantityNote: "1.5 lb",
            sourcedFromPantry: false,
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            freshnessDaysAgo: 0,
            freshnessHoursAgo: 12,
            priceSource: "kroger-official-api",
            priceSourceKind: "official-online",
            priceSourceTier: 1,
            matchConfidence: 0.9,
            saleConfidence: {
              level: "advertised-recent",
              label: "Recent online price",
              note: "Fixture.",
            },
          },
          {
            ingredientId: "black-beans",
            ingredient: "Black beans",
            quantityNote: "15 oz",
            sourcedFromPantry: false,
            storeName: "Kroger Mechanicsville",
            price: 1.09,
            freshnessDaysAgo: 0,
            freshnessHoursAgo: 12,
            priceSource: "kroger-official-api",
            priceSourceKind: "official-online",
            priceSourceTier: 1,
            matchConfidence: 0.9,
            saleConfidence: {
              level: "advertised-recent",
              label: "Recent online price",
              note: "Fixture.",
            },
          },
        ],
      }),
    ];

    const nearbyStores = [
      buildTestNearbyStoreSummary({
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        matchedIngredientCount: 96,
      }),
      buildTestNearbyStoreSummary({
        id: "aldi-1",
        name: "Aldi Mechanicsville",
        chain: "aldi",
        matchedIngredientCount: 17,
      }),
    ];

    const reason = buildMultiStoreCoverageSkewReason({
      shoppingStyle: "multi-store",
      nearbyStores,
      selectedStoreIds: ["kroger-1", "aldi-1"],
      recommendations,
    });

    expect(reason).toContain("Kroger");
    expect(reason).toContain("fewer current sale matches");
    expect(reason).toContain("not because they are farther away");
  });

  it("returns null for coverage skew when plans are not dominated by one chain", () => {
    const recommendations = [
      buildTestMeal({
        shoppingPlan: [
          {
            ingredientId: "chicken-thighs",
            ingredient: "Chicken thighs",
            quantityNote: "1.5 lb",
            sourcedFromPantry: false,
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            freshnessDaysAgo: 0,
            freshnessHoursAgo: 12,
            priceSource: "kroger-official-api",
            priceSourceKind: "official-online",
            priceSourceTier: 1,
            matchConfidence: 0.9,
            saleConfidence: {
              level: "advertised-recent",
              label: "Recent online price",
              note: "Fixture.",
            },
          },
          {
            ingredientId: "black-beans",
            ingredient: "Black beans",
            quantityNote: "15 oz",
            sourcedFromPantry: false,
            storeName: "Aldi Mechanicsville",
            price: 0.89,
            freshnessDaysAgo: 0,
            freshnessHoursAgo: 12,
            priceSource: "aldi-weekly-ad",
            priceSourceKind: "weekly-ad",
            priceSourceTier: 2,
            matchConfidence: 0.8,
            saleConfidence: {
              level: "advertised-recent",
              label: "Sale price",
              note: "Fixture.",
            },
          },
        ],
      }),
    ];

    const nearbyStores = [
      buildTestNearbyStoreSummary({
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        matchedIngredientCount: 96,
      }),
      buildTestNearbyStoreSummary({
        id: "aldi-1",
        name: "Aldi Mechanicsville",
        chain: "aldi",
        matchedIngredientCount: 17,
      }),
    ];

    expect(
      buildMultiStoreCoverageSkewReason({
        shoppingStyle: "multi-store",
        nearbyStores,
        selectedStoreIds: ["kroger-1", "aldi-1"],
        recommendations,
      }),
    ).toBeNull();
  });
});
