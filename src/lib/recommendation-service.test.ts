import { afterEach, describe, expect, it } from "vitest";
import { getRecommendationExperience, type MealPreferenceForm } from "@/lib/recommendation-service";
import { resetDbPoolForTests } from "@/lib/db";

const originalDatabaseUrl = process.env.DATABASE_URL;

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

/** Merge-gating ranking happy-path guards live in recommendation-service-ranking.test.ts (CI-02). */
describe("getRecommendationExperience", () => {
  afterEach(async () => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await resetDbPoolForTests();
  });

  it("returns no ranked recommendations when Postgres is unavailable", async () => {
    delete process.env.DATABASE_URL;

    const experience = await getRecommendationExperience(
      preferences,
      {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        county: "Hanover County",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      false,
    );

    expect(experience.market.dataSource).toBe("unavailable");
    expect(experience.market.nearbyStores).toHaveLength(0);
    expect(experience.market.recommendationReadyStoreCount).toBe(0);
    expect(experience.recommendations).toHaveLength(0);
    expect(experience.market.providerCoverageRollup.rankedPricingSource).toBe("none");
    expect(experience.market.providerPromotionReadiness.every(
      (readiness) => !readiness.recommendationPricingPromotionEnabled,
    )).toBe(true);
    expect(experience.market).not.toHaveProperty("message");
  });

  it("blocks non-internal recipe sources unless recipeSourceOptIn is true", async () => {
    delete process.env.DATABASE_URL;

    const experience = await getRecommendationExperience(
      { ...preferences, recipeSource: "themealdb" },
      {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        county: "Hanover County",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
    expect(experience.shopperNotice?.title).toBe("Recipe source requires opt-in");
  });

  it("returns a layman shopper notice instead of market.message for inactive recipe sources", async () => {
    delete process.env.DATABASE_URL;

    const experience = await getRecommendationExperience(
      { ...preferences, recipeSource: "spoonacular" },
      {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        county: "Hanover County",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      false,
    );

    expect(experience.recommendations).toHaveLength(0);
    expect(experience.shopperNotice?.title).toContain("Spoonacular");
    expect(experience.shopperNotice?.body).toContain("internal recipe library");
    expect(experience.market).not.toHaveProperty("message");
    expect(experience.market.message).toBeUndefined();
  });
});
