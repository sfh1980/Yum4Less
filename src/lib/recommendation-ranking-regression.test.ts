import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  pickRankingSnapshot,
  zip23111Budget12Baseline,
  zip23111DefaultRankingBaseline,
  zip23111SplitStoreMultiBaseline,
  zip23111VegetarianBaseline,
} from "@/lib/recommendation-ranking-baseline.fixture";
import {
  buildZip23111RankingSnapshot,
  buildZip23111SplitStoreBlackBeanSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";

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

function mockRankingReads(snapshot: ReturnType<typeof buildZip23111RankingSnapshot>) {
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
}

describe("CI-02 ranking regression baseline", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getLatestThemealdbImportAt.mockReset();
    shouldRefreshThemealdbRecipesOnSearch.mockReset();
    getLatestThemealdbImportAt.mockResolvedValue(new Date());
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
    mockRankingReads(buildZip23111RankingSnapshot(["kroger-mechanicsville"]));
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("matches the frozen default ZIP 23111 ranking order and score breakdown", async () => {
    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    const snapshot = pickRankingSnapshot(experience.recommendations);
    expect(snapshot.map((meal) => meal.title)).toEqual([...zip23111DefaultRankingBaseline.titles]);
    expect(snapshot.map((meal) => meal.estimatedTotal)).toEqual([
      ...zip23111DefaultRankingBaseline.estimatedTotals,
    ]);
    expect(snapshot.map((meal) => meal.score)).toEqual([...zip23111DefaultRankingBaseline.scores]);
  });

  it("matches the frozen budget-12 subset", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, budget: 12 },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations.map((meal) => meal.title)).toEqual([
      ...zip23111Budget12Baseline.titles,
    ]);
    expect(experience.recommendations.map((meal) => meal.estimatedTotal)).toEqual([
      ...zip23111Budget12Baseline.estimatedTotals,
    ]);
  });

  it("matches the frozen vegetarian subset", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, dietaryFocus: "vegetarian" },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations.map((meal) => meal.title)).toEqual([
      ...zip23111VegetarianBaseline.titles,
    ]);
  });

  it("matches the frozen split-store multi-store black bean plan", async () => {
    mockRankingReads(buildZip23111SplitStoreBlackBeanSnapshot());

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        shoppingStyle: "multi-store",
        selectedStoreIds: ["kroger-mechanicsville", "aldi-mechanicsville"],
      },
      zip23111MechanicsvilleLocation,
      false,
    );

    const meal = experience.recommendations[0];
    expect(meal?.title).toBe(zip23111SplitStoreMultiBaseline.title);
    expect(meal?.estimatedTotal).toBe(zip23111SplitStoreMultiBaseline.estimatedTotal);
    expect(meal?.storeCount).toBe(zip23111SplitStoreMultiBaseline.storeCount);
    expect(meal?.confidenceLabel).toBe(zip23111SplitStoreMultiBaseline.confidenceLabel);
    expect(
      meal?.shoppingPlan.map((item) => ({
        ingredient: item.ingredient,
        storeName: item.storeName,
        price: item.price,
      })),
    ).toEqual([...zip23111SplitStoreMultiBaseline.shoppingPlan]);
  });
});
