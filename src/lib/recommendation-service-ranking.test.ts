import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
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

/** CI-02 orchestration guards — ranking math lives in recommendation-ranking-regression.test.ts */
describe("getRecommendationExperience ZIP 23111 orchestration guards (CI-02)", () => {
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

  it("reads fixture-backed market data and returns recommendation-ready stores", async () => {
    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.market.dataSource).toBe("database");
    expect(experience.market.recommendationReadyStoreCount).toBeGreaterThan(0);
    expect(experience.recommendations.length).toBeGreaterThan(0);
  });

  it("returns empty recommendations when maxIngredients is too low", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, maxIngredients: 4 },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
  });

  it("returns empty recommendations for single-store when split-store fixture has no full basket", async () => {
    mockRankingReads(buildZip23111SplitStoreBlackBeanSnapshot());

    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, shoppingStyle: "single-store" },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
  });

  it("returns multi-store recommendations when split-store fixture requires two chains", async () => {
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

    expect(experience.recommendations).toHaveLength(1);
    expect(experience.recommendations[0]?.storeCount).toBe(2);
  });
});
