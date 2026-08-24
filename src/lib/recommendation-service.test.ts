import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecommendationExperience,
  RecommendationDependencyUnavailableError,
  type MealPreferenceForm,
} from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";
import { buildZip23111RankingSnapshot } from "@/lib/recommendation-service-ranking.fixture";

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

const originalDatabaseUrl = process.env.DATABASE_URL;

const preferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
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

/** Merge-gating ranking happy-path guards live in recommendation-service-ranking.test.ts (CI-02). */
describe("getRecommendationExperience", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: buildZip23111RankingSnapshot(["kroger-mechanicsville"]),
    });
  });

  afterEach(async () => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await resetDbPoolForTests();
    vi.clearAllMocks();
  });

  it("throws when Postgres pricing dependencies are unavailable (M4)", async () => {
    delete process.env.DATABASE_URL;
    getMarketDataSnapshot.mockResolvedValue({
      source: "unavailable",
      snapshot: buildZip23111RankingSnapshot([]),
    });

    await expect(
      getRecommendationExperience(preferences, location, false),
    ).rejects.toBeInstanceOf(RecommendationDependencyUnavailableError);
  });

  it("returns a layman shopper notice instead of market.message for inactive recipe sources", async () => {
    const experience = await getRecommendationExperience(
      { ...preferences, recipeSource: "spoonacular" },
      location,
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
    expect(experience.shopperNotice?.title).toContain("Spoonacular");
    expect(experience.shopperNotice?.body).toContain("TheMealDB");
    expect(experience.market).not.toHaveProperty("message");
    expect(experience.market.message).toBeUndefined();
  });
});
