import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recommendations/route";
import { resetDbPoolForTests } from "@/lib/db";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
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

const { resolveLocationInput } = vi.hoisted(() => ({
  resolveLocationInput: vi.fn(),
}));

const { getLatestThemealdbImportAt, shouldRefreshThemealdbRecipesOnSearch } =
  vi.hoisted(() => ({
    getLatestThemealdbImportAt: vi.fn(),
    shouldRefreshThemealdbRecipesOnSearch: vi.fn(),
  }));

vi.mock("@/lib/location-resolution", async () => {
  const actual = await vi.importActual<typeof import("@/lib/location-resolution")>(
    "@/lib/location-resolution",
  );

  return {
    ...actual,
    resolveLocationInput,
  };
});

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

function fatMarketFromSnapshot(
  snapshot: ReturnType<typeof buildZip23111RankingSnapshot>,
): MarketSummary {
  return {
    searchedZipCode: "23111",
    locationLabel: "SPOOFED — Live verified prices",
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
        locationProvenance: "api-verified",
        locationBadge: "Verified store pin",
        locationNote: "Fixture location note.",
      }),
    ],
    recommendationReadyStoreCount: 1,
    providerRollout: [
      {
        chain: "kroger",
        label: "Kroger",
        status: "official-api-preview",
        recommendationEnabled: true,
        priority: 1,
        note: "SPOOFED rollout — all prices verified live.",
      },
    ],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "strong",
      trustGate: "monitoring",
      rankedPricingSource: "official-api-cache",
      totalTrackedIngredients: 5,
      matchedIngredientCount: 5,
      unmatchedIngredientCount: 0,
      averageMatchConfidence: 0.99,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "SPOOFED — full live coverage.",
    },
    providerPromotionReadiness: [
      {
        provider: "kroger",
        overallStatus: "ready-but-disabled",
        gatesPassedCount: 6,
        gatesTotalCount: 6,
        gates: [],
        recommendationPricingPromotionEnabled: true,
        message: "SPOOFED promotion ready.",
      },
    ],
    providerPriceObservationSync: [
      {
        provider: "kroger",
        internalStoreId: "store-secret",
        syncedCount: 99,
        unchangedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        retrievalMode: "live",
        message: "SPOOFED sync summary.",
      },
    ],
    weeklyAdIngestionStatus: [
      {
        chain: "kroger",
        storeId: "kroger-mechanicsville",
        sourceName: "kroger-weekly-ad-scrape",
        observationCount: 999,
        message: "SPOOFED weekly-ad ingest.",
      },
    ],
    weeklyAdPromotionReadiness: [
      {
        chain: "kroger",
        chainLabel: "Kroger",
        overallStatus: "ready",
        gatesPassedCount: 5,
        gatesTotalCount: 5,
        gates: [],
        weeklyAdRankedPricingEnabled: true,
        message: "SPOOFED weekly-ad readiness.",
      },
    ],
    lookupSource: "browser",
    lookupProviderConfigured: true,
    dataSource: "database",
    saleIngredientChoices: [
      {
        ingredientId: "chicken-thighs",
        ingredientName: "Chicken thighs",
        lowestEstimatedPrice: 0.01,
        storeOfferCount: 1,
        trustLabel: "estimated",
        offers: [],
      },
    ],
    mapDiscoveryNotice: "SPOOFED map discovery notice.",
    usesEphemeralOsmDiscovery: true,
  };
}

const rankPayload = {
  zipCode: zip23111RankingPreferences.zipCode,
  radiusMiles: zip23111RankingPreferences.radiusMiles,
  budget: zip23111RankingPreferences.budget,
  maxIngredients: zip23111RankingPreferences.maxIngredients,
  shoppingStyle: zip23111RankingPreferences.shoppingStyle,
  dietaryFocus: zip23111RankingPreferences.dietaryFocus,
  recipeSource: zip23111RankingPreferences.recipeSource,
  selectedStoreIds: zip23111RankingPreferences.selectedStoreIds,
  planningMode: zip23111RankingPreferences.planningMode,
};

describe("POST /api/recommendations market pass-through hardening", () => {
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
    resolveLocationInput.mockResolvedValue({
      ok: true,
      location: zip23111MechanicsvilleLocation,
      providerConfigured: false,
    });
  });

  afterEach(async () => {
    await resetDbPoolForTests();
    vi.restoreAllMocks();
  });

  it("strips fat market snapshots and returns server-authoritative trust fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          ...rankPayload,
          market: fatMarketFromSnapshot(
            buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
          ),
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const market = body.experience.market;

    expect(market.locationLabel).toBe("Mechanicsville, VA");
    expect(market.lookupSource).toBe("seed");
    expect(market.lookupProviderConfigured).toBe(false);
    expect(market.dataSource).toBe("database");
    expect(market.providerRollout).toEqual([]);
    expect(market.providerPromotionReadiness).toEqual([]);
    expect(market.weeklyAdIngestionStatus).toEqual([]);
    expect(market.weeklyAdPromotionReadiness).toEqual([]);
    expect(market.providerPriceObservationSync).toEqual([]);
    expect(market.saleIngredientChoices).toEqual([]);
    expect(market).not.toHaveProperty("mapDiscoveryNotice");
    expect(market).not.toHaveProperty("usesEphemeralOsmDiscovery");
    expect(market.providerCoverageRollup.rankedPricingSource).toBe("weekly-ad-cache");
    expect(market.providerCoverageRollup.trustGate).not.toBe("promotion-ready");
    expect(body.experience.recommendations.length).toBeGreaterThan(0);
  });
});
