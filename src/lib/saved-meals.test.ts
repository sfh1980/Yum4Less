// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MealRecommendation } from "@/contracts/recommendations";
import {
  SAVED_MEALS_STORAGE_KEY,
  clearSavedMeals,
  isMealSaved,
  parseSavedMeals,
  readSavedMeals,
  toggleSavedMeal,
  writeSavedMeals,
} from "@/lib/saved-meals";

function buildMeal(title = "Sheet-pan chicken"): MealRecommendation {
  return {
    title,
    summary: "A fixture dinner.",
    estimatedTotal: 12.5,
    storeCount: 1,
    matchedIngredients: 3,
    cookTimeMinutes: 35,
    difficulty: "easy",
    primaryStore: "Kroger",
    ingredientHighlights: ["chicken"],
    instructions: ["Roast."],
    shoppingPlan: [],
    storePlan: [],
    score: { total: 70, price: 30, convenience: 20, freshness: 10, fit: 10 },
    confidenceLabel: "Single-store estimate",
    tags: [],
    freshnessLabel: "Recent weekly-ad prices",
    explanation: "Fixture.",
    providerPreviewComparisons: [],
  };
}

describe("saved meals", () => {
  beforeEach(() => {
    clearSavedMeals();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T16:00:00.000Z"));
  });

  afterEach(() => {
    clearSavedMeals();
    vi.useRealTimers();
  });

  it("saves a snapshot on this browser without a user profile", () => {
    const next = toggleSavedMeal([], buildMeal());
    writeSavedMeals(next);

    const stored = readSavedMeals();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe("Sheet-pan chicken");
    expect(stored[0]?.estimatedTotal).toBe(12.5);
    expect(isMealSaved(stored, buildMeal())).toBe(true);
    expect(window.localStorage.getItem(SAVED_MEALS_STORAGE_KEY)).toContain(
      "Sheet-pan chicken",
    );
  });

  it("removes a saved meal on a second toggle", () => {
    const saved = toggleSavedMeal([], buildMeal());
    expect(toggleSavedMeal(saved, buildMeal())).toEqual([]);
  });

  it("drops malformed stored rows", () => {
    expect(parseSavedMeals([{ title: "Nope" }, buildMeal()])).toHaveLength(0);
  });
});
