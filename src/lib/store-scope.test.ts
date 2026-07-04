import { describe, expect, it } from "vitest";
import type { MarketSummary } from "@/lib/recommendation-types";
import {
  filterSaleIngredientChoicesByStoreIds,
  resolveEffectiveSelectedIngredientIds,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";

const market: MarketSummary = {
  searchedZipCode: "23111",
  locationLabel: "Mechanicsville, VA",
  searchLatitude: 37.6085,
  searchLongitude: -77.3321,
  radiusMiles: 5,
  nearbyStores: [
    {
      id: "kroger-mechanicsville",
      name: "Kroger",
      kind: "grocery",
      latitude: 37.61,
      longitude: -77.33,
      distanceMiles: 1.2,
      chain: "kroger",
      chainLabel: "Kroger",
      rolloutStatus: "weekly-ad-preview",
      recommendationEnabled: true,
      rolloutNote: "Fixture",
      locationProvenance: "bootstrap",
      locationBadge: "Seed catalog pin",
      locationNote: "Fixture",
    },
    {
      id: "aldi-mechanicsville",
      name: "Aldi",
      kind: "grocery",
      latitude: 37.62,
      longitude: -77.34,
      distanceMiles: 2.1,
      chain: "aldi",
      chainLabel: "Aldi",
      rolloutStatus: "weekly-ad-preview",
      recommendationEnabled: true,
      rolloutNote: "Fixture",
      locationProvenance: "bootstrap",
      locationBadge: "Seed catalog pin",
      locationNote: "Fixture",
    },
  ],
  recommendationReadyStoreCount: 2,
  providerRollout: [],
  providerStoreSearches: [],
  providerPricingPreviews: [],
  providerCoverageRollup: {
    overallCoverageStatus: "limited",
    trustGate: "monitoring",
    rankedPricingSource: "weekly-ad-cache",
    totalTrackedIngredients: 0,
    matchedIngredientCount: 0,
    unmatchedIngredientCount: 0,
    averageMatchConfidence: 0,
    usesCachedPreview: false,
    ingredientSummaries: [],
    message: "Fixture coverage rollup.",
  },
  providerPromotionReadiness: [],
  providerPriceObservationSync: [],
  weeklyAdIngestionStatus: [],
  weeklyAdPromotionReadiness: [],
  lookupSource: "seed",
  lookupProviderConfigured: false,
  dataSource: "database",
  saleIngredientChoices: [
    {
      ingredientId: "chicken-thighs",
      ingredientName: "Chicken thighs",
      lowestEstimatedPrice: 4.99,
      storeOfferCount: 1,
      trustLabel: "directional",
      offers: [
        {
          storeId: "kroger-mechanicsville",
          storeName: "Kroger",
          price: 4.99,
          freshnessDaysAgo: 1,
          trustLabel: "directional",
          priceSource: "kroger-weekly-ad-scrape",
        },
      ],
    },
    {
      ingredientId: "lime",
      ingredientName: "Lime",
      lowestEstimatedPrice: 0.45,
      storeOfferCount: 1,
      trustLabel: "directional",
      offers: [
        {
          storeId: "aldi-mechanicsville",
          storeName: "Aldi",
          price: 0.45,
          freshnessDaysAgo: 1,
          trustLabel: "directional",
          priceSource: "aldi-weekly-ad-scrape",
        },
      ],
    },
  ],
};

describe("store scope", () => {
  it("returns an empty scoped market when no stores are selected", () => {
    const scoped = scopeMarketSummaryToSelectedStores(market, []);

    expect(scoped.nearbyStores).toEqual([]);
    expect(scoped.recommendationReadyStoreCount).toBe(0);
    expect(scoped.saleIngredientChoices).toEqual([]);
  });

  it("hides unselected stores and sale ingredients from scoped market", () => {
    const scoped = scopeMarketSummaryToSelectedStores(market, ["kroger-mechanicsville"]);

    expect(scoped.nearbyStores.map((store) => store.id)).toEqual([
      "kroger-mechanicsville",
    ]);
    expect(scoped.saleIngredientChoices.map((choice) => choice.ingredientId)).toEqual([
      "chicken-thighs",
    ]);
  });

  it("filters sale ingredient offers to selected stores", () => {
    const filtered = filterSaleIngredientChoicesByStoreIds(market.saleIngredientChoices, [
      "aldi-mechanicsville",
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.ingredientId).toBe("lime");
  });

  it("resolves all rankable ingredients at selected stores when client omits IDs", () => {
    const ids = resolveEffectiveSelectedIngredientIds({
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 4.99,
          priceSource: "kroger-weekly-ad-scrape",
          freshnessDaysAgo: 1,
          inStock: true,
        },
        {
          storeId: "aldi-mechanicsville",
          ingredientId: "lime",
          price: 0.45,
          priceSource: "aldi-weekly-ad-scrape",
          freshnessDaysAgo: 1,
          inStock: true,
        },
      ],
      selectedStoreIds: ["kroger-mechanicsville"],
    });

    expect(ids).toEqual(["chicken-thighs"]);
  });
});
