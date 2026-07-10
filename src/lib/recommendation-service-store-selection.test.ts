import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  buildZip23111RankingSnapshot,
  buildZip23111SplitStoreBlackBeanSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import { buildNearbyStoresForSearch } from "@/lib/market-search-service";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { getMarketDataSnapshot, getMarketPricingContext, getRecipeCatalog } =
  vi.hoisted(() => ({
    getMarketDataSnapshot: vi.fn(),
    getMarketPricingContext: vi.fn(),
    getRecipeCatalog: vi.fn(),
  }));

const { getLatestThemealdbImportAt, shouldRefreshThemealdbRecipesOnSearch } =
  vi.hoisted(() => ({
    getLatestThemealdbImportAt: vi.fn(),
    shouldRefreshThemealdbRecipesOnSearch: vi.fn(),
  }));

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
  getMarketPricingContext,
  getRecipeCatalog,
}));

vi.mock("@/lib/recipe-import/ensure-themealdb-recipes-for-search", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recipe-import/ensure-themealdb-recipes-for-search")
  >("@/lib/recipe-import/ensure-themealdb-recipes-for-search");

  return {
    ...actual,
    getLatestThemealdbImportAt,
    shouldRefreshThemealdbRecipesOnSearch,
  };
});

function buildCollocatedAldiSplitStoreSnapshot() {
  const snapshot = buildZip23111SplitStoreBlackBeanSnapshot();
  const aldiSlug = snapshot.stores.find((store) => store.id === "aldi-mechanicsville");
  if (!aldiSlug) {
    throw new Error("missing aldi-mechanicsville fixture store");
  }

  snapshot.stores.push({
    ...aldiSlug,
    id: "aldi-23111",
    sourceName: "yum4less-market-catalog",
  });
  snapshot.priceObservations.push(
    ...snapshot.priceObservations
      .filter((observation) => observation.storeId === "aldi-mechanicsville")
      .map((observation) => ({
        ...observation,
        storeId: "aldi-23111",
        price: observation.price + 0.05,
      })),
  );

  return snapshot;
}

function buildCollocatedAldiMarket(snapshot: ReturnType<typeof buildCollocatedAldiSplitStoreSnapshot>) {
  const nearbyStores = buildNearbyStoresForSearch(
    snapshot.stores.filter((store) =>
      ["kroger-mechanicsville", "aldi-mechanicsville", "aldi-23111"].includes(store.id),
    ),
    zip23111MechanicsvilleLocation,
    zip23111RankingPreferences.radiusMiles,
    snapshot.priceObservations,
    snapshot.recipes.flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.ingredientId),
    ),
  );

  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: zip23111MechanicsvilleLocation.latitude,
    searchLongitude: zip23111MechanicsvilleLocation.longitude,
    radiusMiles: zip23111RankingPreferences.radiusMiles,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter((store) => store.recommendationEnabled)
      .length,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "limited" as const,
      trustGate: "monitoring" as const,
      rankedPricingSource: "weekly-ad-cache" as const,
      totalTrackedIngredients: 0,
      matchedIngredientCount: 0,
      unmatchedIngredientCount: 0,
      averageMatchConfidence: 0,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "Fixture",
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed" as const,
    lookupProviderConfigured: false,
    dataSource: "database" as const,
    saleIngredientChoices: [],
  } satisfies MarketSummary;
}

describe("getRecommendationExperience store selection integrity (#14–15)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getLatestThemealdbImportAt.mockReset();
    shouldRefreshThemealdbRecipesOnSearch.mockReset();
    getLatestThemealdbImportAt.mockResolvedValue(new Date());
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("collapses collocated Aldi twins so multi-store ranking uses one Aldi store", async () => {
    const snapshot = buildCollocatedAldiSplitStoreSnapshot();
    const market = buildCollocatedAldiMarket(snapshot);

    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot,
    });
    getMarketPricingContext.mockResolvedValue({
      source: "database",
      stores: snapshot.stores,
      priceObservations: snapshot.priceObservations,
    });
    getRecipeCatalog.mockResolvedValue({
      source: "database",
      recipes: snapshot.recipes,
    });

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        shoppingStyle: "multi-store",
        selectedStoreIds: [
          "kroger-mechanicsville",
          "aldi-mechanicsville",
          "aldi-23111",
        ],
      },
      zip23111MechanicsvilleLocation,
      false,
      { passedMarket: market },
    );

    expect(experience.effectiveSelectedStoreIds).toEqual([
      "kroger-mechanicsville",
      "aldi-mechanicsville",
    ]);
    expect(experience.recommendations).toHaveLength(1);
    expect(experience.recommendations[0]?.storeCount).toBe(2);
  });

  it("drops stale ids, returns sync notice, and exposes effectiveSelectedStoreIds", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot,
    });
    getMarketPricingContext.mockResolvedValue({
      source: "database",
      stores: snapshot.stores,
      priceObservations: snapshot.priceObservations,
    });
    getRecipeCatalog.mockResolvedValue({
      source: "database",
      recipes: snapshot.recipes,
    });

    const market: MarketSummary = {
      searchedZipCode: "23111",
      locationLabel: "Mechanicsville, VA",
      searchLatitude: zip23111MechanicsvilleLocation.latitude,
      searchLongitude: zip23111MechanicsvilleLocation.longitude,
      radiusMiles: 6,
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger",
          kind: "grocery",
          latitude: 37.6153,
          longitude: -77.3491,
          distanceMiles: 2.4,
          chain: "kroger",
          chainLabel: "Kroger",
          rolloutStatus: "weekly-ad-preview",
          recommendationEnabled: true,
          rolloutNote: "Fixture",
          locationProvenance: "bootstrap",
          locationBadge: "Seed",
          locationNote: "Fixture",
        },
      ],
      recommendationReadyStoreCount: 1,
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
        message: "Fixture",
      },
      providerPromotionReadiness: [],
      providerPriceObservationSync: [],
      weeklyAdIngestionStatus: [],
      weeklyAdPromotionReadiness: [],
      lookupSource: "seed",
      lookupProviderConfigured: false,
      dataSource: "database",
      saleIngredientChoices: [],
    };

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        selectedStoreIds: ["kroger-mechanicsville", "aldi-23111"],
      },
      zip23111MechanicsvilleLocation,
      false,
      { passedMarket: market },
    );

    expect(experience.effectiveSelectedStoreIds).toEqual(["kroger-mechanicsville"]);
    expect(
      experience.supplementaryShopperNotices?.some(
        (notice) => notice.title === "Store selection updated",
      ),
    ).toBe(true);
    expect(experience.recommendations.length).toBeGreaterThan(0);
  });

  it("returns unavailable notice when every submitted store id is stale", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot,
    });

    const market: MarketSummary = {
      searchedZipCode: "23111",
      locationLabel: "Mechanicsville, VA",
      searchLatitude: zip23111MechanicsvilleLocation.latitude,
      searchLongitude: zip23111MechanicsvilleLocation.longitude,
      radiusMiles: 6,
      nearbyStores: [],
      recommendationReadyStoreCount: 0,
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
        message: "Fixture",
      },
      providerPromotionReadiness: [],
      providerPriceObservationSync: [],
      weeklyAdIngestionStatus: [],
      weeklyAdPromotionReadiness: [],
      lookupSource: "seed",
      lookupProviderConfigured: false,
      dataSource: "database",
      saleIngredientChoices: [],
    };

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        selectedStoreIds: ["aldi-23111"],
      },
      zip23111MechanicsvilleLocation,
      false,
      { passedMarket: market },
    );

    expect(experience.shopperNotice?.title).toBe("Selected stores unavailable");
    expect(experience.effectiveSelectedStoreIds).toEqual([]);
    expect(experience.recommendations).toEqual([]);
  });
});
