import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMarketPricingContext,
  getRankedPriceObservationsWithTimestamps,
  getRecipeCatalog,
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
  resolveKrogerPreviewTrackedIngredients,
} = vi.hoisted(() => ({
  getMarketPricingContext: vi.fn(),
  getRankedPriceObservationsWithTimestamps: vi.fn(),
  getRecipeCatalog: vi.fn(),
  buildNearbyStoresForSearch: vi.fn(),
  collectRecipeIngredientIdsForRollout: vi.fn(),
  resolveKrogerPreviewTrackedIngredients: vi.fn(),
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketPricingContext,
  getRankedPriceObservationsWithTimestamps,
  getRecipeCatalog,
}));

vi.mock("@/lib/recommendation-service", () => ({
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
}));

vi.mock("@/lib/provider-search-terms", () => ({
  resolveKrogerPreviewTrackedIngredients,
}));

import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import { getPipelineDebugView } from "@/lib/debug/pipeline-debug-service";

describe("getPipelineDebugView", () => {
  beforeEach(() => {
    getMarketPricingContext.mockReset();
    getRankedPriceObservationsWithTimestamps.mockReset();
    getRecipeCatalog.mockReset();
    buildNearbyStoresForSearch.mockReset();
    collectRecipeIngredientIdsForRollout.mockReset();
    resolveKrogerPreviewTrackedIngredients.mockReset();

    resolveKrogerPreviewTrackedIngredients.mockResolvedValue(PROVIDER_TRACKED_INGREDIENTS);

    getRecipeCatalog.mockResolvedValue({
      source: "database",
      recipes: [],
    });
    collectRecipeIngredientIdsForRollout.mockReturnValue(["chicken-thighs"]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nearby stores, scoped observations, freshness, and missing ingredients", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T12:00:00.000Z"));

    getMarketPricingContext.mockResolvedValue({
      source: "database",
      stores: [{ id: "kroger-mechanicsville", name: "Kroger" }],
      priceObservations: [],
    });

    buildNearbyStoresForSearch.mockReturnValue([
      {
        id: "kroger-mechanicsville",
        name: "Kroger Mechanicsville",
        kind: "grocery",
        latitude: 37.6153,
        longitude: -77.3491,
        distanceMiles: 1.2,
        chain: "kroger",
        chainLabel: "Kroger",
        rolloutStatus: "weekly-ad-preview",
        recommendationEnabled: true,
        rolloutNote: "Fixture coverage.",
        sourceName: "kroger-official-api",
        locationProvenance: "ingested-catalog",
        locationBadge: "Catalog coordinates",
        locationNote: "Seed catalog row.",
      },
    ]);

    getRankedPriceObservationsWithTimestamps.mockResolvedValue([
      {
        store_id: "kroger-mechanicsville",
        ingredient_id: "chicken-thighs",
        price: "6.49",
        sale_label: "Kroger promo price",
        source_name: "kroger-official-api",
        confidence_score: "0.9",
        observed_at: new Date("2026-06-13T10:00:00.000Z"),
        last_verified_at: new Date("2026-06-13T10:00:00.000Z"),
        valid_through: null,
        freshness_hours_ago: 2,
        freshness_days_ago: 0,
      },
      {
        store_id: "kroger-mechanicsville",
        ingredient_id: "ground-beef",
        price: "5.99",
        sale_label: null,
        source_name: "kroger-official-api",
        confidence_score: "0.88",
        observed_at: new Date("2026-06-10T10:00:00.000Z"),
        last_verified_at: new Date("2026-06-10T10:00:00.000Z"),
        valid_through: new Date("2026-06-20T00:00:00.000Z"),
        freshness_hours_ago: 74,
        freshness_days_ago: 3,
      },
    ]);

    const view = await getPipelineDebugView({
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      radiusMiles: 10,
    });

    expect(resolveKrogerPreviewTrackedIngredients).toHaveBeenCalledOnce();
    expect(view.ok).toBe(true);
    expect(view.nearbyStores).toHaveLength(1);
    expect(view.nearbyStores[0]).toMatchObject({
      id: "kroger-mechanicsville",
      chain: "kroger",
      recommendationEnabled: true,
          trustBadge: "Est. sale prices",
    });
    expect(view.priceObservations).toHaveLength(2);
    expect(view.priceObservations[1]?.validThrough).toBe("2026-06-20T00:00:00.000Z");
    expect(view.freshnessSummary).toEqual({
      observationCount: 2,
      freshWithin24Hours: 1,
      staleCount: 1,
      countsBySource: { "kroger-official-api": 2 },
    });
    expect(view.missingIngredientIds).toEqual(
      PROVIDER_TRACKED_INGREDIENTS.map((ingredient) => ingredient.ingredientId).filter(
        (ingredientId) => ingredientId !== "chicken-thighs" && ingredientId !== "ground-beef",
      ),
    );
    expect(view).not.toHaveProperty("recipes");
    expect(view).not.toHaveProperty("recommendations");
    expect(view).not.toHaveProperty("weeklyAdIngestionStatus");
    expect(buildNearbyStoresForSearch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ zipCode: "23111" }),
      10,
      [],
      ["chicken-thighs"],
    );
  });
});
