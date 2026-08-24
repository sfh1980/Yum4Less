import { describe, expect, it } from "vitest";
import {
  assessRecipePlanCoverage,
  buildSuggestedPantryChecklist,
  countFullyCoveredRecipes,
  assessRecipePoolCoverage,
  mergeSuggestedPantryChecklist,
} from "@/lib/recipe-plan-coverage";
import {
  aldiStore,
  blackBeanTacoRecipe,
  buildFullKrogerBlackBeanObservations,
  buildWeeklyAdObservation,
  krogerStore,
  splitStoreNearbyStores,
  splitStoreSnapshot,
} from "@/lib/shopping-plan-builder.fixture";
import { fixtureRecipes } from "@/lib/fixtures/market-catalog.fixtures";

describe("assessRecipePlanCoverage", () => {
  it("reports fully covered when one store stocks every line (single-store)", () => {
    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: [krogerStore],
      observations: buildFullKrogerBlackBeanObservations(),
      shoppingStyle: "single-store",
    });

    expect(assessment.isFullyCovered).toBe(true);
    expect(assessment.missingLineCount).toBe(0);
    expect(assessment.missingLines).toEqual([]);
  });

  it("counts missing lines at the best single store when no store is complete", () => {
    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: [krogerStore],
      observations: [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "corn-tortillas" }),
      ],
      shoppingStyle: "single-store",
    });

    expect(assessment.isFullyCovered).toBe(false);
    expect(assessment.missingLineCount).toBe(5);
    expect(assessment.missingLines).toHaveLength(5);
  });

  it("uses the store with the fewest missing lines for single-store near-miss", () => {
    const partialKroger = buildFullKrogerBlackBeanObservations().filter(
      (observation) => observation.ingredientId !== "cumin",
    );

    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: [krogerStore],
      observations: partialKroger,
      shoppingStyle: "single-store",
    });

    expect(assessment.isFullyCovered).toBe(false);
    expect(assessment.missingLineCount).toBe(1);
    expect(assessment.missingLines[0]?.ingredientId).toBe("cumin");
  });

  it("counts missing lines across any store for multi-store", () => {
    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: splitStoreNearbyStores,
      observations: splitStoreSnapshot.priceObservations,
      shoppingStyle: "multi-store",
    });

    expect(assessment.isFullyCovered).toBe(true);
    expect(assessment.missingLineCount).toBe(0);
  });

  it("reports partial multi-store misses when any line lacks stock everywhere", () => {
    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: splitStoreNearbyStores,
      observations: splitStoreSnapshot.priceObservations.filter(
        (observation) => observation.ingredientId !== "cumin",
      ),
      shoppingStyle: "multi-store",
    });

    expect(assessment.isFullyCovered).toBe(false);
    expect(assessment.missingLineCount).toBe(1);
    expect(assessment.missingLines[0]?.ingredientId).toBe("cumin");
  });

  it("treats pantry ingredient IDs as satisfied without store observations", () => {
    const assessment = assessRecipePlanCoverage(blackBeanTacoRecipe, {
      stores: [krogerStore],
      observations: [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "corn-tortillas" }),
      ],
      shoppingStyle: "single-store",
      pantryIngredientIds: new Set([
        "cabbage",
        "lime",
        "olive-oil",
        "taco-seasoning",
        "cumin",
      ]),
    });

    expect(assessment.isFullyCovered).toBe(true);
    expect(assessment.missingLineCount).toBe(0);
  });

  it("can unlock recipes outside the 1-4 near-miss band when pantry satisfies lines", () => {
    const lemonChicken = fixtureRecipes.find(
      (recipe) => recipe.id === "sheet-pan-lemon-chicken",
    )!;

    const assessment = assessRecipePlanCoverage(lemonChicken, {
      stores: [krogerStore],
      observations: [],
      shoppingStyle: "single-store",
      pantryIngredientIds: new Set([
        "chicken-thighs",
        "baby-potatoes",
        "broccoli",
        "lemon",
        "olive-oil",
      ]),
    });

    expect(assessment.isFullyCovered).toBe(true);
    expect(assessment.missingLineCount).toBe(0);
  });
});

describe("buildSuggestedPantryChecklist", () => {
  it("consolidates distinct missing ingredients from 1-4 line near-misses", () => {
    const nearMissRecipe = {
      ...blackBeanTacoRecipe,
      id: "near-miss-tacos",
      ingredients: blackBeanTacoRecipe.ingredients.slice(0, 5),
    };

    const assessments = assessRecipePoolCoverage([nearMissRecipe], {
      stores: [krogerStore],
      observations: [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "corn-tortillas" }),
      ],
      shoppingStyle: "single-store",
    });

    const checklist = buildSuggestedPantryChecklist(assessments);

    expect(checklist.map((item) => item.ingredientId).sort()).toEqual([
      "cabbage",
      "lime",
      "olive-oil",
    ]);
    expect(checklist.every((item) => item.recipeCount === 1)).toBe(true);
  });

  it("excludes recipes missing more than four lines from the checklist seed", () => {
    const assessments = assessRecipePoolCoverage([blackBeanTacoRecipe], {
      stores: [krogerStore],
      observations: [buildWeeklyAdObservation({ ingredientId: "black-beans" })],
      shoppingStyle: "single-store",
    });

    expect(buildSuggestedPantryChecklist(assessments)).toEqual([]);
  });

  it("increments recipeCount when the same ingredient is missing across recipes", () => {
    const tacoNearMiss = {
      ...blackBeanTacoRecipe,
      id: "near-miss-tacos",
      ingredients: blackBeanTacoRecipe.ingredients.slice(0, 5),
    };
    const pastaNearMiss = {
      ...fixtureRecipes.find((recipe) => recipe.id === "garlic-butter-pasta")!,
      id: "near-miss-pasta",
      ingredients: [
        { ingredientId: "spaghetti", displayName: "Spaghetti", quantityNote: "1 box" },
        { ingredientId: "spinach", displayName: "Spinach", quantityNote: "1 bag" },
        { ingredientId: "olive-oil", displayName: "Olive oil", quantityNote: "1 bottle" },
      ],
    };

    const assessments = assessRecipePoolCoverage([tacoNearMiss, pastaNearMiss], {
      stores: [krogerStore, aldiStore],
      observations: [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "spaghetti" }),
        buildWeeklyAdObservation({ ingredientId: "spinach" }),
      ],
      shoppingStyle: "multi-store",
    });

    const oliveOil = buildSuggestedPantryChecklist(assessments).find(
      (item) => item.ingredientId === "olive-oil",
    );

    expect(oliveOil?.recipeCount).toBe(2);
  });
});

describe("countFullyCoveredRecipes", () => {
  it("counts assessments with zero missing lines", () => {
    const assessments = assessRecipePoolCoverage(
      [blackBeanTacoRecipe, fixtureRecipes[0]!],
      {
        stores: splitStoreNearbyStores,
        observations: splitStoreSnapshot.priceObservations,
        shoppingStyle: "multi-store",
      },
    );

    expect(countFullyCoveredRecipes(assessments)).toBe(1);
  });

  it("increases fully covered count when pantry satisfies remaining lines", () => {
    const assessments = assessRecipePoolCoverage([blackBeanTacoRecipe], {
      stores: [krogerStore],
      observations: [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "corn-tortillas" }),
      ],
      shoppingStyle: "single-store",
      pantryIngredientIds: new Set([
        "cabbage",
        "lime",
        "olive-oil",
        "taco-seasoning",
        "cumin",
      ]),
    });

    expect(countFullyCoveredRecipes(assessments)).toBe(1);
  });
});

describe("mergeSuggestedPantryChecklist", () => {
  it("keeps the original order when coverage membership changes", () => {
    const current = [
      { ingredientId: "cumin", ingredientName: "Cumin", recipeCount: 3 },
      { ingredientId: "onion", ingredientName: "Onion", recipeCount: 2 },
    ];
    const incoming = [
      { ingredientId: "garlic", ingredientName: "Garlic", recipeCount: 4 },
      { ingredientId: "onion", ingredientName: "Onion", recipeCount: 1 },
    ];

    expect(mergeSuggestedPantryChecklist(current, incoming)).toEqual([
      { ingredientId: "cumin", ingredientName: "Cumin", recipeCount: 3 },
      { ingredientId: "onion", ingredientName: "Onion", recipeCount: 1 },
      { ingredientId: "garlic", ingredientName: "Garlic", recipeCount: 4 },
    ]);
  });
});
