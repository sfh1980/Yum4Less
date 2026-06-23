import { describe, expect, it } from "vitest";
import {
  buildMealPreferencePayload,
  validateLocationFields,
  validateMealFields,
} from "@/components/meal-planner/form-validation";
import type { FormState } from "@/components/meal-planner/types";

const baseForm: FormState = {
  zipCode: "23111",
  radiusMiles: "5",
  budget: "16",
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  externalRecipeOptIn: false,
};

describe("validateLocationFields", () => {
  it("rejects non-integer radius values", () => {
    expect(
      validateLocationFields({ ...baseForm, radiusMiles: "5.5" }, true).radiusMiles,
    ).toBeDefined();
  });
});

describe("validateMealFields", () => {
  it("rejects budgets above the form max of 40", () => {
    expect(validateMealFields({ ...baseForm, budget: "41" }).budget).toBeDefined();
  });

  it("rejects budgets below the form min of 5", () => {
    expect(validateMealFields({ ...baseForm, budget: "4" }).budget).toBeDefined();
  });
});

describe("buildMealPreferencePayload", () => {
  it("returns undefined when radius is not an integer", () => {
    expect(
      buildMealPreferencePayload({ ...baseForm, radiusMiles: "5.5" }),
    ).toBeUndefined();
  });

  it("returns undefined when budget exceeds form max", () => {
    expect(buildMealPreferencePayload({ ...baseForm, budget: "41" })).toBeUndefined();
  });

  it("builds a payload when radius and budget are valid", () => {
    expect(buildMealPreferencePayload(baseForm)).toMatchObject({
      zipCode: "23111",
      radiusMiles: 5,
      budget: 16,
    });
  });
});
