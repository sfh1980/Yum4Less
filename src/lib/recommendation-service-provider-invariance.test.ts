import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience, type MealPreferenceForm } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  fixturePriceObservations,
  fixtureRecipes,
  fixtureStores,
} from "@/lib/fixtures/market-catalog.fixtures";

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

const preferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
};

const location = {
  zipCode: "23111",
  city: "Mechanicsville",
  state: "VA",
  county: "Hanover County",
  latitude: 37.6085,
  longitude: -77.3321,
  source: "seed" as const,
};

const liveCacheObservations = fixturePriceObservations
  .filter((observation) => observation.storeId === "kroger-mechanicsville")
  .map((observation) => ({
    ...observation,
    priceSource: "kroger-weekly-ad-scrape",
    matchConfidence: 0.85,
  }));

describe("getRecommendationExperience provider preview invariance", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: {
        stores: fixtureStores,
        recipes: fixtureRecipes,
        priceObservations: liveCacheObservations,
      },
    });
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("keeps ranked meal totals on ingested cache when provider previews change", async () => {
    buildProviderPricingPreviews
      .mockResolvedValueOnce([
        {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          storeName: "Kroger Mechanicsville",
          providerStoreId: "01100479",
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: 5,
          items: [],
          message: "No matches.",
          fetchedAt: "2026-05-20T12:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          storeName: "Kroger Mechanicsville",
          providerStoreId: "01100479",
          coverageStatus: "strong",
          matchedIngredientCount: 5,
          totalTrackedIngredients: 5,
          items: [
            "chicken-thighs",
            "baby-potatoes",
            "broccoli",
            "lemon",
            "olive-oil",
          ].map((ingredientId, index) => ({
            provider: "kroger" as const,
            ingredientId,
            ingredientName: ingredientId,
            providerProductId: `000111100000${index + 1}`,
            description: `${ingredientId} family pack`,
            regularPrice: 0.01,
            promoPrice: 0.01,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.99,
            matchReason: "description contains the full ingredient name",
          })),
          message: "Strong preview coverage.",
          fetchedAt: "2026-05-20T12:00:00.000Z",
        },
      ]);

    const baseline = await getRecommendationExperience(preferences, location, false);
    const withStrongPreview = await getRecommendationExperience(
      preferences,
      location,
      false,
    );

    expect(baseline.recommendations.length).toBeGreaterThan(0);
    expect(
      withStrongPreview.recommendations.map((meal) => ({
        title: meal.title,
        estimatedTotal: meal.estimatedTotal,
        shoppingPlan: meal.shoppingPlan,
        score: meal.score,
      })),
    ).toEqual(
      baseline.recommendations.map((meal) => ({
        title: meal.title,
        estimatedTotal: meal.estimatedTotal,
        shoppingPlan: meal.shoppingPlan,
        score: meal.score,
      })),
    );
    expect(
      baseline.recommendations[0]?.providerPreviewComparisons.find(
        (comparison) => comparison.provider === "kroger",
      )?.comparisonStatus,
    ).toBe("unavailable");
    expect(
      withStrongPreview.recommendations[0]?.providerPreviewComparisons.find(
        (comparison) => comparison.provider === "kroger",
      )?.comparedIngredientCount,
    ).toBeGreaterThan(0);
    expect(withStrongPreview.market.providerCoverageRollup.rankedPricingSource).toBe(
      "weekly-ad-cache",
    );
    expect(withStrongPreview.market.providerCoverageRollup.trustGate).toBe(
      "monitoring",
    );
    expect(
      withStrongPreview.market.providerPromotionReadiness.every(
        (readiness) => !readiness.recommendationPricingPromotionEnabled,
      ),
    ).toBe(true);
  });
});
