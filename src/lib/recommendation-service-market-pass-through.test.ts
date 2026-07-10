import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trimMarketForRankingPassThrough } from "@/lib/market-pass-through";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  buildZip23111RankingSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import type { MarketSummary } from "@/lib/recommendation-service";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { getMarketDataSnapshot } = vi.hoisted(() => ({
  getMarketDataSnapshot: vi.fn(),
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

function passedMarketFromSnapshot(
  snapshot: ReturnType<typeof buildZip23111RankingSnapshot>,
): MarketSummary {
  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: zip23111MechanicsvilleLocation.latitude,
    searchLongitude: zip23111MechanicsvilleLocation.longitude,
    radiusMiles: zip23111RankingPreferences.radiusMiles,
    nearbyStores: [
      buildTestNearbyStoreSummary({
        id: "kroger-mechanicsville",
        name: "Kroger",
        latitude: 37.6153,
        longitude: -77.3491,
        distanceMiles: 2.4,
        rolloutNote: "Fixture rollout note.",
        locationProvenance: "bootstrap",
        locationBadge: "Catalog pin",
        locationNote: "Fixture location note.",
      }),
    ],
    recommendationReadyStoreCount: 1,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "limited",
      trustGate: "monitoring",
      rankedPricingSource: "weekly-ad-cache",
      totalTrackedIngredients: 5,
      matchedIngredientCount: 1,
      unmatchedIngredientCount: 4,
      averageMatchConfidence: 0.88,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "Fixture coverage.",
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
}

describe("getRecommendationExperience market pass-through (H1–H3)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getLatestThemealdbImportAt.mockReset();
    shouldRefreshThemealdbRecipesOnSearch.mockReset();
    getLatestThemealdbImportAt.mockResolvedValue(new Date());
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
    });
  });

  afterEach(async () => {
    await resetDbPoolForTests();
    vi.restoreAllMocks();
  });

  it("uses passed market and a single getMarketDataSnapshot read without rebuilding market search", async () => {
    const recommendationModule = await import("@/lib/recommendation-service");
    const searchSpy = vi.spyOn(recommendationModule, "getMarketSearchExperience");

    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: passedMarketFromSnapshot(
          buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
        ),
      },
    );

    expect(searchSpy).not.toHaveBeenCalled();
    expect(getMarketDataSnapshot).toHaveBeenCalledTimes(1);
    expect(experience.market.locationLabel).toBe("Mechanicsville, VA");
    expect(experience.market.nearbyStores[0]?.chain).toBe("kroger");
    expect(experience.market.nearbyStores[0]?.locationBadge).toBeTruthy();
    expect(experience.recommendations.length).toBeGreaterThan(0);
  });

  it("rehydrates thin pass-through market stores before returning recommendations", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    const thinMarket = trimMarketForRankingPassThrough(
      passedMarketFromSnapshot(snapshot),
    );

    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      { passedMarket: thinMarket },
    );

    expect(experience.market.nearbyStores[0]).toEqual(
      expect.objectContaining({
        id: "kroger-mechanicsville",
        chain: "kroger",
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
      }),
    );
    expect(experience.market.nearbyStores[0]?.latitude).toBeTypeOf("number");
    expect(experience.recommendations.length).toBeGreaterThan(0);
  });

  it("recomputes trust-sensitive pass-through fields from server state", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    const spoofedMarket = {
      ...passedMarketFromSnapshot(snapshot),
      lookupSource: "browser" as const,
      lookupProviderConfigured: true,
      dataSource: "database" as const,
      providerCoverageRollup: {
        ...passedMarketFromSnapshot(snapshot).providerCoverageRollup,
        rankedPricingSource: "official-api-cache" as const,
        trustGate: "monitoring" as const,
      },
    };

    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      { passedMarket: trimMarketForRankingPassThrough(spoofedMarket) },
    );

    expect(experience.market.lookupSource).toBe("seed");
    expect(experience.market.lookupProviderConfigured).toBe(false);
    expect(experience.market.dataSource).toBe("database");
    expect(experience.market.providerCoverageRollup.rankedPricingSource).toBe(
      "weekly-ad-cache",
    );
    expect(experience.market.providerCoverageRollup.trustGate).not.toBe(
      "promotion-ready",
    );
  });
});
