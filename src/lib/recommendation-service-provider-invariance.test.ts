import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience, type MealPreferenceForm } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import { fixtureRecipes, fixtureStores } from "@/lib/fixtures/market-catalog.fixtures";
import { buildZip23111WeeklyAdPriceObservations } from "@/lib/recommendation-service-ranking.fixture";
import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { resolveKrogerPreviewTrackedIngredients } = vi.hoisted(() => ({
  resolveKrogerPreviewTrackedIngredients: vi.fn(),
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

vi.mock("@/lib/provider-search-terms", () => ({
  resolveKrogerPreviewTrackedIngredients,
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

function mockRankingReads(snapshot: {
  stores: typeof fixtureStores;
  recipes: typeof fixtureRecipes;
  priceObservations: typeof liveCacheObservations;
}) {
  getMarketDataSnapshot.mockResolvedValue({
    source: "database",
    snapshot: {
      ...snapshot,
      ingredients: [],
    },
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
}

const preferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
  planningMode: "standard",
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

const liveCacheObservations = buildZip23111WeeklyAdPriceObservations([
  "kroger-mechanicsville",
]);

describe("getRecommendationExperience provider preview invariance", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    resolveKrogerPreviewTrackedIngredients.mockReset();
    resolveKrogerPreviewTrackedIngredients.mockResolvedValue(
      PROVIDER_TRACKED_INGREDIENTS.slice(0, 5),
    );
    getLatestThemealdbImportAt.mockReset();
    shouldRefreshThemealdbRecipesOnSearch.mockReset();
    getLatestThemealdbImportAt.mockResolvedValue(new Date());
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
    mockRankingReads({
      stores: fixtureStores,
      recipes: fixtureRecipes,
      priceObservations: liveCacheObservations,
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
