import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
} from "@/lib/market-catalog-types";
import type { MarketDataSource } from "@/lib/market-repository";
import {
  buildMultiStorePlan,
  buildSingleStorePlan,
  sumStorePricedPlanTotal,
} from "@/lib/shopping-plan-builder";
import type { MealPreferenceForm, NearbyStoreSummary } from "@/lib/recommendation-types";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export type VisibleRankingGateInput = {
  recipe: CatalogRecipeRecord;
  stores: NearbyStoreSummary[];
  observations: CatalogPriceObservation[];
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  budget: number;
  maxIngredients: number;
  pantryIngredientIds: ReadonlySet<string>;
  dataSource: MarketDataSource;
  equivalentStoreIdsByStoreId?: ReadonlyMap<string, ReadonlySet<string>>;
};

/**
 * Same gates ranking uses after the eligible pool: a shopping plan can be built,
 * the store-priced total fits budget, and the plan is within maxIngredients.
 */
export function recipePassesVisibleRankingGates(
  input: VisibleRankingGateInput,
): boolean {
  const planOptions = {
    ...(input.pantryIngredientIds.size > 0
      ? { pantryIngredientIds: input.pantryIngredientIds }
      : {}),
    ...(input.equivalentStoreIdsByStoreId
      ? { equivalentStoreIdsByStoreId: input.equivalentStoreIdsByStoreId }
      : {}),
  };

  const shoppingPlan =
    input.shoppingStyle === "single-store"
      ? buildSingleStorePlan(
          input.recipe,
          input.stores,
          input.observations,
          input.dataSource,
          planOptions,
        )
      : buildMultiStorePlan(
          input.recipe,
          input.stores,
          input.observations,
          input.dataSource,
          planOptions,
        );

  if (shoppingPlan.length === 0) {
    return false;
  }

  const estimatedTotal = roundCurrency(sumStorePricedPlanTotal(shoppingPlan));
  if (estimatedTotal > input.budget) {
    return false;
  }

  return shoppingPlan.length <= input.maxIngredients;
}
