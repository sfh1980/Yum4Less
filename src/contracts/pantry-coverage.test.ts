import { describe, expect, it } from "vitest";
import { parsePantryCoverageRequest } from "@/contracts/pantry-coverage";

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

describe("parsePantryCoverageRequest", () => {
  it("accepts a valid payload without pantry fields", () => {
    expect(parsePantryCoverageRequest(validPayload)).toMatchObject({
      zipCode: "23111",
      selectedStoreIds: ["kroger-mechanicsville"],
    });
  });

  it("accepts pantryIngredientIds and includeIngredientCatalog", () => {
    expect(
      parsePantryCoverageRequest({
        ...validPayload,
        pantryIngredientIds: ["olive-oil", "lime"],
        includeIngredientCatalog: true,
      }),
    ).toMatchObject({
      pantryIngredientIds: ["olive-oil", "lime"],
      includeIngredientCatalog: true,
    });
  });

  it("accepts an empty pantryIngredientIds array", () => {
    expect(
      parsePantryCoverageRequest({
        ...validPayload,
        pantryIngredientIds: [],
      })?.pantryIngredientIds,
    ).toEqual([]);
  });

  it("rejects invalid pantryIngredientIds entries", () => {
    expect(
      parsePantryCoverageRequest({
        ...validPayload,
        pantryIngredientIds: ["Not A Real Id"],
      }),
    ).toBeUndefined();
  });

  it("rejects invalid recommendation fields", () => {
    expect(
      parsePantryCoverageRequest({
        ...validPayload,
        budget: 4,
      }),
    ).toBeUndefined();
  });
});
