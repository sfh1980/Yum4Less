import { describe, expect, it } from "vitest";
import { recipePassesVisibleRankingGates } from "@/lib/ranking-result-gates";
import {
  blackBeanTacoRecipe,
  buildFullKrogerBlackBeanObservations,
  krogerStore,
} from "@/lib/shopping-plan-builder.fixture";

describe("recipePassesVisibleRankingGates", () => {
  it("passes when a priced plan fits budget and ingredient limit", () => {
    expect(
      recipePassesVisibleRankingGates({
        recipe: blackBeanTacoRecipe,
        stores: [krogerStore],
        observations: buildFullKrogerBlackBeanObservations(),
        shoppingStyle: "single-store",
        budget: 18,
        maxIngredients: 8,
        pantryIngredientIds: new Set(),
        dataSource: "database",
      }),
    ).toBe(true);
  });

  it("fails when the store-priced total is over budget", () => {
    expect(
      recipePassesVisibleRankingGates({
        recipe: blackBeanTacoRecipe,
        stores: [krogerStore],
        observations: buildFullKrogerBlackBeanObservations(),
        shoppingStyle: "single-store",
        budget: 5,
        maxIngredients: 20,
        pantryIngredientIds: new Set(),
        dataSource: "database",
      }),
    ).toBe(false);
  });

  it("fails when the shopping plan is longer than maxIngredients", () => {
    expect(
      recipePassesVisibleRankingGates({
        recipe: blackBeanTacoRecipe,
        stores: [krogerStore],
        observations: buildFullKrogerBlackBeanObservations(),
        shoppingStyle: "single-store",
        budget: 40,
        maxIngredients: 4,
        pantryIngredientIds: new Set(),
        dataSource: "database",
      }),
    ).toBe(false);
  });
});
