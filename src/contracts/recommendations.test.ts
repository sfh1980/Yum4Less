import { describe, expect, it } from "vitest";
import { parseRecommendationRequest } from "@/contracts/recommendations";

const validPayload = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 16,
  maxIngredients: 8,
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
} as const;

describe("parseRecommendationRequest", () => {
  it("accepts a valid ZIP payload with defaults", () => {
    expect(parseRecommendationRequest(validPayload)).toMatchObject({
      zipCode: "23111",
      radiusMiles: 5,
      budget: 16,
      planningMode: "ingredient-first",
      selectedIngredientIds: [],
    });
  });

  it("passes market through without validating snapshot shape", () => {
    const market = { not: "a-real-market-summary" };
    expect(parseRecommendationRequest({ ...validPayload, market })?.market).toBe(
      market,
    );
  });

  it("accepts API budget up to 250", () => {
    expect(
      parseRecommendationRequest({ ...validPayload, budget: 250 })?.budget,
    ).toBe(250);
  });

  it("rejects budget above API max", () => {
    expect(parseRecommendationRequest({ ...validPayload, budget: 251 })).toBeUndefined();
  });

  it("accepts TheMealDB when recipeSourceOptIn is true", () => {
    expect(
      parseRecommendationRequest({
        ...validPayload,
        recipeSource: "themealdb",
        recipeSourceOptIn: true,
      }),
    ).toMatchObject({
      recipeSource: "themealdb",
      recipeSourceOptIn: true,
    });
  });

  it("rejects TheMealDB without opt-in", () => {
    expect(
      parseRecommendationRequest({
        ...validPayload,
        recipeSource: "themealdb",
        recipeSourceOptIn: false,
      }),
    ).toBeUndefined();
  });

  it.each([
    ["shoppingStyle", "triple-store"],
    ["dietaryFocus", "paleo"],
    ["recipeSource", "not-a-real-source"],
  ])("rejects invalid enum field %s=%s", (field, value) => {
    expect(
      parseRecommendationRequest({ ...validPayload, [field]: value }),
    ).toBeUndefined();
  });

  it.each([
    ["selectedIngredientIds", "not-an-array"],
    ["selectedIngredientIds", Array.from({ length: 41 }, (_, index) => `id-${index}`)],
    ["selectedIngredientIds", ["has spaces"]],
    ["selectedIngredientIds", ["UPPERCASE"]],
  ])("rejects invalid selectedIngredientIds payload %s=%s", (_field, value) => {
    expect(
      parseRecommendationRequest({
        ...validPayload,
        planningMode: "ingredient-first",
        selectedIngredientIds: value,
      }),
    ).toBeUndefined();
  });
});
