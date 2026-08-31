import { describe, expect, it } from "vitest";
import {
  buildBestChainCoverageDepth,
  buildChainCoverageDepthLiveSummary,
  buildMultiStoreCoverageSkewReason,
  buildStoreCoverageHelpModel,
  formatStoreCoverageHelpOneLiner,
  formatStoreCoverageHelpParagraphs,
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

  it("includes Lidl and Walmart in honesty copy when those stores passed floors", () => {
    const depth = buildBestChainCoverageDepth([
      ...stores,
      buildTestNearbyStoreSummary({
        id: "lidl-1",
        chain: "lidl",
        chainLabel: "Lidl",
        matchedIngredientCount: 40,
        pricingSourceKind: "weekly-ad",
      }),
      buildTestNearbyStoreSummary({
        id: "walmart-1",
        chain: "walmart",
        chainLabel: "Walmart",
        matchedIngredientCount: 9,
        pricingSourceKind: "weekly-ad",
      }),
    ]);
    expect(depth.map((entry) => entry.chain)).toEqual([
      "kroger",
      "lidl",
      "publix",
      "aldi",
      "walmart",
    ]);
  });

  it("formats store coverage help from selected stores", () => {
    const model = buildStoreCoverageHelpModel(stores, [
      "kroger-1",
      "publix-1",
      "aldi-1",
    ]);
    expect(model).toMatchObject({
      trackedIngredientCount: 97,
      includeMultiStoreNote: true,
    });
    expect(model?.chains.map((chain) => chain.chainLabel)).toEqual([
      "Kroger",
      "Publix",
      "Aldi",
    ]);

    const paragraphs = formatStoreCoverageHelpParagraphs(model!);
    expect(paragraphs[0]).toBe(
      "Yum4Less currently tracks 97 dinner ingredients.",
    );
    expect(paragraphs).toContain(
      "Kroger is showing estimated prices for 96 of those 97.",
    );
    expect(paragraphs).toContain(
      "Publix is showing estimated prices for 34 of those 97.",
    );
    expect(paragraphs).toContain(
      "Aldi is showing estimated prices for 17 of those 97.",
    );
    expect(paragraphs.join(" ")).toContain("lowest estimate we have");
    expect(paragraphs.join(" ")).toContain("These are estimates");
    expect(paragraphs.join(" ")).not.toContain("Sale-price coverage");
  });

  it("formats a short coverage one-liner for Settings", () => {
    const model = buildStoreCoverageHelpModel(stores, [
      "kroger-1",
      "publix-1",
      "aldi-1",
    ]);
    expect(formatStoreCoverageHelpOneLiner(model!)).toBe(
      "Near you this week: Kroger ~96/97 · Publix ~34/97 · Aldi ~17/97.",
    );
  });

  it("omits per-chain counts until stores are selected", () => {
    const model = buildStoreCoverageHelpModel(stores, []);
    expect(model?.chains).toEqual([]);
    expect(formatStoreCoverageHelpParagraphs(model!).join(" ")).toContain(
      "After you choose stores",
    );
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
