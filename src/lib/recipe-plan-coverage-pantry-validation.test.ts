import { describe, expect, it } from "vitest";
import {
  buildCatalogIdSet,
  filterValidPantryIngredientIds,
} from "@/lib/recipe-plan-coverage";

describe("filterValidPantryIngredientIds", () => {
  const validIds = buildCatalogIdSet([
    { id: "olive-oil", name: "Olive oil", category: "pantry" },
    { id: "sugar", name: "Sugar", category: "baking" },
    { id: "chicken-breast", name: "Chicken breast", category: "protein" },
  ]);

  it("accepts TheMealDB-normalized catalog ids present in the DB set", () => {
    expect(filterValidPantryIngredientIds(["sugar", "olive-oil"], validIds)).toEqual([
      "sugar",
      "olive-oil",
    ]);
  });

  it("rejects unknown or garbage ids without silently passing them through", () => {
    expect(
      filterValidPantryIngredientIds(
        ["sugar", "not-a-real-ingredient", "zzzz-garbage"],
        validIds,
      ),
    ).toEqual(["sugar"]);
  });

  it("dedupes ids while preserving first-seen order", () => {
    expect(
      filterValidPantryIngredientIds(["sugar", "sugar", "olive-oil"], validIds),
    ).toEqual(["sugar", "olive-oil"]);
  });
});
