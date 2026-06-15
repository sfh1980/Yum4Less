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

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
  getMarketPricingContext,
  getRecipeCatalog,
}));

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

/**
 * CI-02 merge-gating ranking guards for MVP ZIP 23111 (Mechanicsville).
 * Fixture-backed happy path for getRecommendationExperience — no live APIs or Postgres.
 */
describe("getRecommendationExperience ZIP 23111 ranking guards (CI-02)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    mockRankingReads(buildZip23111RankingSnapshot(["kroger-mechanicsville"]));
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("returns ranked dinners in score order when Kroger weekly-ad fixture prices load", async () => {
    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.market.dataSource).toBe("database");
    expect(experience.market.recommendationReadyStoreCount).toBeGreaterThan(0);
    expect(experience.recommendations).toHaveLength(3);

    const titles = experience.recommendations.map((meal) => meal.title);
    expect(titles).toEqual([
      "Black Bean Tacos with Lime Slaw",
      "Garlic Butter Pasta with Spinach",
      "Sheet Pan Lemon Chicken and Vegetables",
    ]);

    const totals = experience.recommendations.map((meal) => meal.estimatedTotal);
    expect(totals).toEqual([10.68, 13.99, 15.4]);
    expect(totals[0]!).toBeLessThanOrEqual(totals[1]!);
    expect(totals[1]!).toBeLessThanOrEqual(totals[2]!);

    const scores = experience.recommendations.map((meal) => meal.score.total);
    expect(scores[0]!).toBeGreaterThan(scores[1]!);
    expect(scores[1]!).toBeGreaterThan(scores[2]!);

    for (let index = 1; index < experience.recommendations.length; index += 1) {
      expect(experience.recommendations[index - 1]!.score.total).toBeGreaterThan(
        experience.recommendations[index]!.score.total,
      );
    }

    expect(
      experience.recommendations.every(
        (meal) => meal.estimatedTotal <= zip23111RankingPreferences.budget,
      ),
    ).toBe(true);
  });

  it("drops higher-cost meals when budget is tightened for ZIP 23111", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, budget: 12, dinnersWanted: 3 },
      zip23111MechanicsvilleLocation,
      false,
    );

    const titles = experience.recommendations.map((meal) => meal.title);
    expect(titles).toEqual(["Black Bean Tacos with Lime Slaw"]);
    expect(experience.recommendations[0]?.estimatedTotal).toBe(10.68);
    expect(titles).not.toContain("Sheet Pan Lemon Chicken and Vegetables");
    expect(titles).not.toContain("Garlic Butter Pasta with Spinach");
  });

  it("limits candidates when maxIngredients is reduced", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, maxIngredients: 4, dinnersWanted: 3 },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
  });

  it("returns only vegetarian-tagged fixture recipes when dietaryFocus is vegetarian", async () => {
    const experience = await getRecommendationExperience(
      { ...zip23111RankingPreferences, dietaryFocus: "vegetarian", dinnersWanted: 2 },
      zip23111MechanicsvilleLocation,
      false,
    );

    const titles = experience.recommendations.map((meal) => meal.title);
    expect(titles).toEqual([
      "Black Bean Tacos with Lime Slaw",
      "Garlic Butter Pasta with Spinach",
    ]);
    expect(titles).not.toContain("Sheet Pan Lemon Chicken and Vegetables");
  });

  it("uses one store in store plan for single-store shopping when a full-store basket exists", async () => {
    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    const topMeal = experience.recommendations[0];
    expect(topMeal?.storeCount).toBe(1);
    expect(new Set(topMeal?.shoppingPlan.map((item) => item.storeName)).size).toBe(1);
    expect(topMeal?.confidenceLabel).toBe("Single-store estimate");
  });

  it("builds multi-store plans across Kroger and Aldi when no one store stocks every ingredient", async () => {
    mockRankingReads(buildZip23111SplitStoreBlackBeanSnapshot());

    const singleStore = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        shoppingStyle: "single-store",
        dinnersWanted: 1,
      },
      zip23111MechanicsvilleLocation,
      false,
    );
    const multiStore = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        shoppingStyle: "multi-store",
        dinnersWanted: 1,
      },
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(singleStore.recommendations).toHaveLength(0);
    expect(multiStore.recommendations).toHaveLength(1);
    expect(multiStore.recommendations[0]?.title).toBe("Black Bean Tacos with Lime Slaw");
    expect(multiStore.recommendations[0]?.storeCount).toBe(2);
    expect(multiStore.recommendations[0]?.confidenceLabel).toBe("Multi-store estimate");
    const shoppingPlan = multiStore.recommendations[0]?.shoppingPlan ?? [];
    expect(shoppingPlan.map((item) => ({
      ingredient: item.ingredient,
      storeName: item.storeName,
      price: item.price,
    }))).toEqual([
      { ingredient: "Black beans", storeName: "Aldi", price: 0.89 },
      { ingredient: "Corn tortillas", storeName: "Kroger", price: 2.29 },
      { ingredient: "Cabbage", storeName: "Kroger", price: 2.19 },
      { ingredient: "Lime", storeName: "Aldi", price: 0.45 },
      { ingredient: "Olive oil", storeName: "Aldi", price: 2.49 },
      { ingredient: "Taco seasoning", storeName: "Kroger", price: 0.89 },
      { ingredient: "Ground cumin", storeName: "Kroger", price: 0.79 },
    ]);
    const planSubtotal = Math.round(
      shoppingPlan.reduce((sum, item) => sum + item.price, 0) * 100,
    ) / 100;
    expect(planSubtotal).toBe(9.99);
    expect(multiStore.recommendations[0]?.estimatedTotal).toBe(planSubtotal);
    expect(
      new Set(multiStore.recommendations[0]?.shoppingPlan.map((item) => item.storeName)),
    ).toEqual(new Set(["Kroger", "Aldi"]));
  });
});
