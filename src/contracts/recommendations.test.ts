import { describe, expect, it } from "vitest";
import { parseRecommendationRequest } from "@/contracts/recommendations";

const validPayload = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 16,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
} as const;

describe("parseRecommendationRequest", () => {
  it("accepts a valid ZIP payload with defaults", () => {
    expect(parseRecommendationRequest(validPayload)).toMatchObject({
      zipCode: "23111",
      radiusMiles: 5,
      budget: 16,
      planningMode: "ingredient-first",
      selectedStoreIds: ["kroger-mechanicsville"],
    });
    expect(parseRecommendationRequest(validPayload)?.selectedIngredientIds).toBeUndefined();
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

  it("rejects non-internal recipe sources on the public API", () => {
    expect(
      parseRecommendationRequest({
        ...validPayload,
        recipeSource: "themealdb",
      }),
    ).toBeUndefined();
  });

  it("accepts large selectedIngredientIds lists within body safeguards", () => {
    const ids = Array.from({ length: 50 }, (_, index) => `ingredient-${index}`);
    expect(
      parseRecommendationRequest({ ...validPayload, selectedIngredientIds: ids })
        ?.selectedIngredientIds,
    ).toEqual(ids);
  });

  it("accepts multi-store selections beyond the shopping-route stop cap", () => {
    const selectedStoreIds = Array.from(
      { length: 9 },
      (_, index) => `store-${index}`,
    );

    expect(
      parseRecommendationRequest({
        ...validPayload,
        shoppingStyle: "multi-store",
        selectedStoreIds,
      })?.selectedStoreIds,
    ).toEqual(selectedStoreIds);
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
