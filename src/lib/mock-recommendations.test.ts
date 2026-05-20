import { afterEach, describe, expect, it } from "vitest";
import { getRecommendationExperience, type MealPreferenceForm } from "@/lib/mock-recommendations";
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
};

describe("getRecommendationExperience", () => {
  afterEach(async () => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await resetDbPoolForTests();
  });

  it("builds ranked recommendations from the seeded fallback path", async () => {
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

    expect(experience.market.dataSource).toBe("seed");
    expect(experience.market.nearbyStores.length).toBeGreaterThan(0);
    expect(experience.recommendations.length).toBeGreaterThan(0);
    expect(experience.recommendations.length).toBeLessThanOrEqual(
      preferences.dinnersWanted,
    );
    expect(experience.recommendations.every((meal) => meal.estimatedTotal <= preferences.budget)).toBe(true);
  });
});
