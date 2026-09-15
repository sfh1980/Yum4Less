import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trimMarketForRankingPassThrough } from "@/lib/market-pass-through";
import { getPantryCoverageExperience } from "@/lib/pantry-coverage-service";
import { resetDbPoolForTests } from "@/lib/db";
import { fixtureRecipes } from "@/lib/fixtures/market-catalog.fixtures";
import {
  buildZip23111RankingSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import type { MarketSummary } from "@/lib/recommendation-service";
import type { CatalogIngredient } from "@/lib/market-catalog-types";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { getMarketDataSnapshot } = vi.hoisted(() => ({
  getMarketDataSnapshot: vi.fn(),
}));

const { loadCatalogIngredients } = vi.hoisted(() => ({
  loadCatalogIngredients: vi.fn(),
}));

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
}));

vi.mock("@/lib/market-catalog-repository", () => ({
  loadCatalogIngredients,
}));

function fixtureIngredientCatalog(): CatalogIngredient[] {
  const byId = new Map<string, CatalogIngredient>();
  for (const recipe of fixtureRecipes) {
    for (const ingredient of recipe.ingredients) {
      if (!byId.has(ingredient.ingredientId)) {
        byId.set(ingredient.ingredientId, {
          id: ingredient.ingredientId,
          name: ingredient.displayName,
          category: "pantry",
        });
      }
    }
  }
  return [...byId.values()];
}

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

describe("getPantryCoverageExperience market pass-through (Scale risk A)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    loadCatalogIngredients.mockReset();
    loadCatalogIngredients.mockResolvedValue(fixtureIngredientCatalog());
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
    });
  });

  afterEach(async () => {
    await resetDbPoolForTests();
    vi.restoreAllMocks();
  });

  it("ignores client-spoofed recommendationEnabled=false after rehydrate", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    const spoofedDisabled = {
      ...passedMarketFromSnapshot(snapshot),
      nearbyStores: [
        buildTestNearbyStoreSummary({
          id: "kroger-mechanicsville",
          name: "Kroger",
          latitude: 37.6153,
          longitude: -77.3491,
          distanceMiles: 2.4,
          recommendationEnabled: false,
          rolloutStatus: "coming-soon",
          rolloutNote: "SPOOFED — pretend this store cannot rank.",
        }),
      ],
      recommendationReadyStoreCount: 0,
    };

    const honest = await getPantryCoverageExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: trimMarketForRankingPassThrough(
          passedMarketFromSnapshot(snapshot),
        ),
      },
    );

    const spoofed = await getPantryCoverageExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: trimMarketForRankingPassThrough(spoofedDisabled),
      },
    );

    expect(getMarketDataSnapshot).toHaveBeenCalled();
    expect(honest.eligibleRecipeCount).toBeGreaterThan(0);
    expect(spoofed.eligibleRecipeCount).toBe(honest.eligibleRecipeCount);
    expect(spoofed.fullyCoveredRecipeCount).toBe(honest.fullyCoveredRecipeCount);
  });

  it("does not inflate pantry counts from a client-invented enabled store id", async () => {
    const snapshot = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
    const spoofedExtraStore = {
      ...passedMarketFromSnapshot(snapshot),
      nearbyStores: [
        ...passedMarketFromSnapshot(snapshot).nearbyStores,
        buildTestNearbyStoreSummary({
          id: "spoofed-verified-superstore",
          name: "SPOOFED Superstore",
          chain: "walmart",
          latitude: 37.61,
          longitude: -77.35,
          distanceMiles: 1,
          recommendationEnabled: true,
          rolloutStatus: "official-api-preview",
          rolloutNote: "SPOOFED — live verified prices.",
        }),
      ],
      recommendationReadyStoreCount: 99,
    };

    const withSpoof = await getPantryCoverageExperience(
      {
        ...zip23111RankingPreferences,
        selectedStoreIds: ["kroger-mechanicsville", "spoofed-verified-superstore"],
      },
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: trimMarketForRankingPassThrough(spoofedExtraStore),
      },
    );

    const honestOnly = await getPantryCoverageExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: trimMarketForRankingPassThrough(
          passedMarketFromSnapshot(snapshot),
        ),
      },
    );

    expect(withSpoof.eligibleRecipeCount).toBe(honestOnly.eligibleRecipeCount);
    expect(withSpoof.fullyCoveredRecipeCount).toBe(
      honestOnly.fullyCoveredRecipeCount,
    );
  });
});
