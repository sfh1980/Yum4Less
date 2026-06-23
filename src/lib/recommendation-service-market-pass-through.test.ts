import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  buildZip23111RankingSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import type { MarketSummary } from "@/lib/recommendation-service";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { getMarketDataSnapshot } = vi.hoisted(() => ({
  getMarketDataSnapshot: vi.fn(),
}));

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
}));

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
        rolloutNote: "Fixture rollout note.",
        pricingStatus: "weekly-ad-preview",
        pricingLabel: "Est. weekly-ad prices",
        pricingNote: "Fixture pricing note.",
        locationProvenance: "postgres-catalog",
        locationBadge: "Catalog pin",
        locationNote: "Fixture location note.",
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
    expect(experience.recommendations.length).toBeGreaterThan(0);
  });
});
