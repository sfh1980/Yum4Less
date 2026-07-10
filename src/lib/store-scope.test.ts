import { describe, expect, it } from "vitest";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
import {
  buildStoreSelectionSyncNotices,
  filterSaleIngredientChoicesByStoreIds,
  resolveEffectiveSelectedIngredientIds,
  resolveSelectedStoreIdsForRanking,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";

function store(
  partial: Partial<NearbyStoreSummary> & Pick<NearbyStoreSummary, "id" | "name" | "chain">,
): NearbyStoreSummary {
  return buildTestNearbyStoreSummary({
    city: "Mechanicsville",
    state: "VA",
    kind: "grocery",
    latitude: partial.latitude ?? 37.611004,
    longitude: partial.longitude ?? -77.336853,
    distanceMiles: partial.distanceMiles ?? 1.1,
    chainLabel: partial.chain === "kroger" ? "Kroger" : "Aldi",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: partial.recommendationEnabled ?? true,
    rolloutNote: "Fixture",
    locationProvenance: "bootstrap",
    locationBadge: "Seed catalog pin",
    locationNote: "Fixture",
    ...partial,
  });
}

const market: MarketSummary = {
  searchedZipCode: "23111",
  locationLabel: "Mechanicsville, VA",
  searchLatitude: 37.6085,
  searchLongitude: -77.3321,
  radiusMiles: 5,
  nearbyStores: [
    buildTestNearbyStoreSummary({
      id: "kroger-mechanicsville",
      name: "Kroger",
      latitude: 37.61,
      longitude: -77.33,
      distanceMiles: 1.2,
      chain: "kroger",
      chainLabel: "Kroger",
    }),
    buildTestNearbyStoreSummary({
      id: "aldi-mechanicsville",
      name: "Aldi",
      latitude: 37.62,
      longitude: -77.34,
      distanceMiles: 2.1,
      chain: "aldi",
      chainLabel: "Aldi",
    }),
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

describe("resolveSelectedStoreIdsForRanking", () => {
  it("collapses collocated Aldi slug + ZIP twins to the slug winner", () => {
    const resolved = resolveSelectedStoreIdsForRanking({
      selectedStoreIds: ["aldi-mechanicsville", "aldi-23111"],
      marketNearbyStores: [
        store({
          id: "aldi-mechanicsville",
          name: "Aldi",
          chain: "aldi",
          sourceName: "aldi-weekly-ad-scrape",
        }),
        store({
          id: "aldi-23111",
          name: "Aldi",
          chain: "aldi",
          sourceName: "yum4less-market-catalog",
        }),
      ],
    });

    expect(resolved.effectiveSelectedStoreIds).toEqual(["aldi-mechanicsville"]);
    expect(resolved.collapsedStoreIds).toEqual(["aldi-23111"]);
    expect(resolved.droppedStoreIds).toEqual([]);
    expect(resolved.selectionChanged).toBe(true);
  });

  it("drops stale ids not present on the market snapshot before collapse", () => {
    const resolved = resolveSelectedStoreIdsForRanking({
      selectedStoreIds: ["kroger-mechanicsville", "aldi-23111"],
      marketNearbyStores: [
        store({
          id: "kroger-mechanicsville",
          name: "Kroger",
          chain: "kroger",
          latitude: 37.61,
          longitude: -77.33,
          sourceName: "kroger-weekly-ad-scrape",
        }),
      ],
    });

    expect(resolved.effectiveSelectedStoreIds).toEqual(["kroger-mechanicsville"]);
    expect(resolved.droppedStoreIds).toEqual(["aldi-23111"]);
    expect(resolved.selectionChanged).toBe(true);
  });

  it("keeps non-collocated Aldi twins between 0.05 and 0.15 mi", () => {
    const resolved = resolveSelectedStoreIdsForRanking({
      selectedStoreIds: ["aldi-slug", "aldi-near"],
      marketNearbyStores: [
        store({
          id: "aldi-slug",
          name: "Aldi",
          chain: "aldi",
          latitude: 37.61546,
          longitude: -77.32939,
          sourceName: "aldi-weekly-ad-scrape",
        }),
        store({
          id: "aldi-near",
          name: "Aldi",
          chain: "aldi",
          latitude: 37.61546 + 0.00145,
          longitude: -77.32939,
          sourceName: "yum4less-market-catalog",
        }),
      ],
    });

    expect(resolved.effectiveSelectedStoreIds).toEqual(["aldi-slug", "aldi-near"]);
    expect(resolved.collapsedStoreIds).toEqual([]);
  });
});

describe("buildStoreSelectionSyncNotices", () => {
  it("returns a supplementary notice when some submitted ids were dropped", () => {
    expect(
      buildStoreSelectionSyncNotices({
        droppedStoreIds: ["aldi-23111"],
        effectiveSelectedStoreIds: ["kroger-mechanicsville"],
      }),
    ).toEqual({
      supplementaryShopperNotices: [
        expect.objectContaining({ title: "Store selection updated" }),
      ],
    });
  });

  it("returns a primary unavailable notice when every submitted id was dropped", () => {
    expect(
      buildStoreSelectionSyncNotices({
        droppedStoreIds: ["aldi-23111"],
        effectiveSelectedStoreIds: [],
      }),
    ).toEqual({
      shopperNotice: expect.objectContaining({ title: "Selected stores unavailable" }),
    });
  });
});
