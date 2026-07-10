import { describe, expect, it } from "vitest";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";
import {
  buildTestMarketSummaryPick,
  buildTestNearbyStoreSummary,
  buildTestProviderCoverageRollup,
} from "@/lib/test-fixtures/contract-fixtures";

const baseMarket = buildTestMarketSummaryPick(
  [
    "providerStoreSearches",
    "providerPricingPreviews",
    "providerCoverageRollup",
    "lookupSource",
    "dataSource",
    "lookupProviderConfigured",
    "recommendationReadyStoreCount",
    "nearbyStores",
  ],
  {
    providerCoverageRollup: buildTestProviderCoverageRollup({ rankedPricingSource: "none" }),
    lookupSource: "geocodio",
    lookupProviderConfigured: true,
    recommendationReadyStoreCount: 0,
  },
);

describe("buildPricingTrustHeadsUp", () => {
  it("returns null when no store context exists", () => {
    expect(buildPricingTrustHeadsUp(baseMarket)).toBeNull();
  });

  it("returns trust baseline when store searches exist without fallback signals", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      providerStoreSearches: [
        {
          fallbackUsed: false,
        } as (typeof baseMarket)["providerStoreSearches"][number],
      ],
    });

    expect(headsUp?.title).toBe("Heads up about these prices");
    expect(headsUp?.message).toContain("Meal prices are estimates");
    expect(headsUp?.message).toContain("not live checkout");
    expect(headsUp?.message).toContain("estimates");
  });

  it("surfaces provider fallbackUsed in layman copy", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      providerPricingPreviews: [
        {
          fallbackUsed: true,
        } as (typeof baseMarket)["providerPricingPreviews"][number],
      ],
    });

    expect(headsUp?.title).toBe("Heads up about these prices");
    expect(headsUp?.message).toContain("backup data");
    expect(headsUp?.message).toContain("estimates");
    expect(headsUp?.message).toContain("Meal prices are estimates");
  });

  it("surfaces non-live ranked pricing when stores are recommendation-ready", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      recommendationReadyStoreCount: 1,
      providerCoverageRollup: {
        ...baseMarket.providerCoverageRollup,
        rankedPricingSource: "weekly-ad-cache",
      },
    });

    expect(headsUp?.message).toContain("saved store prices from ads and online checks");
  });

  it("surfaces limited ZIP lookup fallback", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      lookupSource: "seed",
    });

    expect(headsUp?.message).toContain("limited local ZIP list");
  });

  it("surfaces database unavailable state", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      dataSource: "unavailable",
    });

    expect(headsUp?.message).toContain("could not load saved store prices");
  });

  it("surfaces multi-store coverage skew when plans cluster on the deepest chain", () => {
    const headsUp = buildPricingTrustHeadsUp(
      {
        ...baseMarket,
        recommendationReadyStoreCount: 2,
        nearbyStores: [
          buildTestNearbyStoreSummary({
            id: "kroger-1",
            name: "Kroger Mechanicsville",
            matchedIngredientCount: 96,
          }),
          buildTestNearbyStoreSummary({
            id: "aldi-1",
            name: "Aldi Mechanicsville",
            chain: "aldi",
            chainLabel: "Aldi",
            matchedIngredientCount: 17,
          }),
        ],
        providerCoverageRollup: {
          ...baseMarket.providerCoverageRollup,
          rankedPricingSource: "mixed-online-weekly-ad-cache",
        },
      },
      {
        shoppingStyle: "multi-store",
        selectedStoreIds: ["kroger-1", "aldi-1"],
        recommendations: [
          {
            title: "Fixture meal",
            summary: "Fixture",
            estimatedTotal: 10,
            storeCount: 2,
            matchedIngredients: 2,
            cookTimeMinutes: 30,
            difficulty: "easy",
            primaryStore: "Kroger",
            ingredientHighlights: [],
            instructions: [],
            shoppingPlan: [
              {
                ingredientId: "a",
                ingredient: "A",
                quantityNote: "1",
                sourcedFromPantry: false,
                storeName: "Kroger Mechanicsville",
                price: 1,
                freshnessDaysAgo: 0,
                freshnessHoursAgo: 1,
                priceSource: "kroger-official-api",
                priceSourceKind: "official-online",
                priceSourceTier: 1,
                matchConfidence: 0.9,
                saleConfidence: {
                  level: "advertised-recent",
                  label: "Recent",
                  note: "Fixture",
                },
              },
              {
                ingredientId: "b",
                ingredient: "B",
                quantityNote: "1",
                sourcedFromPantry: false,
                storeName: "Kroger Mechanicsville",
                price: 2,
                freshnessDaysAgo: 0,
                freshnessHoursAgo: 1,
                priceSource: "kroger-official-api",
                priceSourceKind: "official-online",
                priceSourceTier: 1,
                matchConfidence: 0.9,
                saleConfidence: {
                  level: "advertised-recent",
                  label: "Recent",
                  note: "Fixture",
                },
              },
            ],
            storePlan: [],
            score: { total: 1, price: 1, convenience: 0, freshness: 0, fit: 0 },
            confidenceLabel: "Multi-store",
            tags: [],
            freshnessLabel: "Recent",
            explanation: "Fixture",
            providerPreviewComparisons: [],
          },
        ],
      },
    );

    expect(headsUp?.message).toContain("fewer current sale matches");
  });
});
