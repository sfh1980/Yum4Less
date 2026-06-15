import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import {
  buildZip23111RankingSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";

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

const themealdbRecipe = {
  id: "themealdb-52772-teriyaki",
  title: "Teriyaki Chicken Casserole",
  summary: "Sale-matched TheMealDB import",
  cookTimeMinutes: 45,
  difficulty: "medium" as const,
  tags: ["casserole"],
  dietaryTags: ["quick" as const],
  ingredients: [
    { ingredientId: "chicken-thighs", displayName: "Chicken thighs", quantityNote: "1 lb" },
    { ingredientId: "garlic", displayName: "Garlic", quantityNote: "2 cloves" },
    { ingredientId: "broccoli", displayName: "Broccoli", quantityNote: "1 head" },
    { ingredientId: "lemon", displayName: "Lemon", quantityNote: "1" },
  ],
  steps: ["Bake until done."],
  sourceName: THEMEALDB_SOURCE_NAME,
  sourceRecipeId: "52772",
  eligibleForRanking: false,
};

function withThemealdbSaleLabels(
  snapshot: ReturnType<typeof buildZip23111RankingSnapshot>,
) {
  return {
    ...snapshot,
    priceObservations: snapshot.priceObservations.map((observation) => {
      if (
        observation.storeId === "kroger-mechanicsville" &&
        ["chicken-thighs", "garlic", "broccoli", "lemon"].includes(
          observation.ingredientId,
        )
      ) {
        return {
          ...observation,
          saleLabel: observation.saleLabel ?? "Weekly ad special",
          priceSource: "kroger-weekly-ad-scrape",
          priceSourceKind: "weekly-ad" as const,
        };
      }

      return observation;
    }),
  };
}

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

describe("getRecommendationExperience TheMealDB opt-in search merge", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getMarketDataSnapshot.mockReset();
    getMarketPricingContext.mockReset();
    getRecipeCatalog.mockReset();
    getLatestThemealdbImportAt.mockReset();
    shouldRefreshThemealdbRecipesOnSearch.mockReset();
    getLatestThemealdbImportAt.mockResolvedValue(new Date());
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("does not call search-time ensure and surfaces attribution when saved imports rank", async () => {
    const snapshot = withThemealdbSaleLabels(
      buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
    );
    snapshot.recipes = [...snapshot.recipes, themealdbRecipe];
    mockRankingReads(snapshot);

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        recipeSource: "themealdb",
        recipeSourceOptIn: true,
        planningMode: "ingredient-first",
        selectedIngredientIds: ["chicken-thighs", "garlic", "broccoli"],
      },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(shouldRefreshThemealdbRecipesOnSearch).toHaveBeenCalled();
    expect(experience.recommendations.length).toBeGreaterThan(0);

    const themealdbMeal = experience.recommendations.find((meal) =>
      meal.title.includes("Teriyaki"),
    );
    expect(themealdbMeal?.recipeAttribution).toContain("TheMealDB");
    expect(themealdbMeal?.recipeAttributionUrl).toBe(
      "https://www.themealdb.com/meal/52772",
    );
  });

  it("does not evaluate TheMealDB refresh when internal library is selected", async () => {
    mockRankingReads(buildZip23111RankingSnapshot(["kroger-mechanicsville"]));

    await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(getLatestThemealdbImportAt).not.toHaveBeenCalled();
    expect(shouldRefreshThemealdbRecipesOnSearch).not.toHaveBeenCalled();
  });

  it("surfaces scheduled refresh notice when saved imports are stale or empty", async () => {
    const snapshot = withThemealdbSaleLabels(
      buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
    );
    mockRankingReads(snapshot);
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(true);

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        recipeSource: "themealdb",
        recipeSourceOptIn: true,
        planningMode: "ingredient-first",
        selectedIngredientIds: ["chicken-thighs"],
      },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.shopperNotice?.title).toContain("schedule");
    expect(experience.shopperNotice?.body).toContain("saved imports");
    expect(experience.shopperNotice?.body).toContain("Verify totals in store");
    expect(experience.shopperNotice?.body).not.toContain("npm run");
  });

  it("replaces npm-script empty copy with shopper-facing notice", async () => {
    mockRankingReads(buildZip23111RankingSnapshot(["kroger-mechanicsville"]));

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        planningMode: "ingredient-first",
        recipeSource: "themealdb",
        recipeSourceOptIn: true,
        budget: 1,
        selectedIngredientIds: ["chicken-thighs"],
      },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
    expect(experience.shopperNotice?.body).not.toContain("npm run");
    expect(experience.shopperNotice?.title).toContain("TheMealDB");
  });
});
