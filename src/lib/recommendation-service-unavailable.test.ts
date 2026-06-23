import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecommendationExperience,
  RecommendationDependencyUnavailableError,
} from "@/lib/recommendation-service";
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

function passedMarket(overrides: Partial<MarketSummary> = {}): MarketSummary {
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
    ...overrides,
  };
}

describe("getRecommendationExperience unavailable vs empty (M4, M5)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("throws RecommendationDependencyUnavailableError when pricing snapshot is unavailable", async () => {
    getMarketDataSnapshot.mockResolvedValue({
      source: "unavailable",
      snapshot: buildZip23111RankingSnapshot([]),
    });

    await expect(
      getRecommendationExperience(
        zip23111RankingPreferences,
        zip23111MechanicsvilleLocation,
        false,
        { passedMarket: passedMarket() },
      ),
    ).rejects.toBeInstanceOf(RecommendationDependencyUnavailableError);
  });

  it("returns an explicit notice when no stores pass ranked pricing gates", async () => {
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: buildZip23111RankingSnapshot([]),
    });

    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: passedMarket({
          nearbyStores: [
            {
              ...passedMarket().nearbyStores[0]!,
              recommendationEnabled: false,
            },
          ],
          recommendationReadyStoreCount: 0,
        }),
      },
    );

    expect(experience.recommendations).toEqual([]);
    expect(experience.shopperNotice?.title).toBe("No ranked stores near this search");
  });
});
