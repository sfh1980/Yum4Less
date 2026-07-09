import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
} from "@/lib/market-catalog-types";
import type { MarketDataSource } from "@/lib/market-repository";
import {
  getRankedPriceSourceKind,
  getRankedPriceSourceTier,
} from "@/lib/price-source-policy";
import { getSaleConfidence } from "@/lib/sale-confidence";
import {
  compareMultiStoreObservationQuality,
  comparePlanQuality,
  getStorePricedPlanItems,
} from "@/lib/recommendation-scoring";
import type {
  NearbyStoreSummary,
  ShoppingPlanItem,
} from "@/lib/recommendation-types";

export type ShoppingPlanBuilderOptions = {
  pantryIngredientIds?: ReadonlySet<string>;
};

// TODO: add storeId to ShoppingPlanItem and StorePlan so overlay join
// uses ID rather than name — avoids ambiguity when two same-chain
// branches are in radius. See 2026-06-30 store-map-overlay session.

export function buildSingleStorePlan(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
  options?: ShoppingPlanBuilderOptions,
): ShoppingPlanItem[] {
  const pantryIds = options?.pantryIngredientIds ?? new Set<string>();

  const candidatePlans = nearbyStores
    .map((store) => {
      const plan: ShoppingPlanItem[] = [];

      for (const ingredient of recipe.ingredients) {
        if (pantryIds.has(ingredient.ingredientId)) {
          plan.push(toPantryShoppingPlanItem(ingredient));
          continue;
        }

        const observation = getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        );
        if (!observation) {
          return null;
        }

        plan.push(
          toShoppingPlanItem(
            ingredient.ingredientId,
            ingredient.displayName,
            ingredient.quantityNote,
            observation,
            store.name,
            dataSource,
          ),
        );
      }

      return plan;
    })
    .filter((plan): plan is ShoppingPlanItem[] => plan !== null);

  if (candidatePlans.length === 0) {
    return [];
  }

  return candidatePlans.sort(
    (left, right) => comparePlanQuality(left, right),
  )[0]!;
}

export function buildMultiStorePlan(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
  options?: ShoppingPlanBuilderOptions,
): ShoppingPlanItem[] {
  const pantryIds = options?.pantryIngredientIds ?? new Set<string>();
  const plan: ShoppingPlanItem[] = [];

  for (const ingredient of recipe.ingredients) {
    if (pantryIds.has(ingredient.ingredientId)) {
      plan.push(toPantryShoppingPlanItem(ingredient));
      continue;
    }

    const bestObservation = nearbyStores
      .map((store) => ({
        store,
        observation: getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      }))
      .filter(
        (
          candidate,
        ): candidate is { store: NearbyStoreSummary; observation: CatalogPriceObservation } =>
          candidate.observation !== undefined,
      )
      .sort((left, right) =>
        compareMultiStoreObservationQuality(left.observation, right.observation),
      )[0];

    if (!bestObservation) {
      return [];
    }

    plan.push(
      toShoppingPlanItem(
        ingredient.ingredientId,
        ingredient.displayName,
        ingredient.quantityNote,
        bestObservation.observation,
        bestObservation.store.name,
        dataSource,
      ),
    );
  }

  return plan;
}

export function sumStorePricedPlanTotal(plan: ShoppingPlanItem[]): number {
  return getStorePricedPlanItems(plan).reduce((sum, item) => sum + item.price, 0);
}

function getObservationForStore(
  priceObservations: CatalogPriceObservation[],
  storeId: string,
  ingredientId: string,
) {
  return priceObservations.find(
    (observation) =>
      observation.storeId === storeId &&
      observation.ingredientId === ingredientId &&
      observation.inStock,
  );
}

function toPantryShoppingPlanItem(ingredient: {
  ingredientId: string;
  displayName: string;
  quantityNote: string;
}): ShoppingPlanItem {
  return {
    ingredientId: ingredient.ingredientId,
    ingredient: ingredient.displayName,
    quantityNote: ingredient.quantityNote,
    sourcedFromPantry: true,
    price: 0,
    pantryNote: "From your pantry — not included in total",
    saleConfidence: {
      level: "no-sale-data",
      label: "From your pantry",
      note: "Not included in store total",
    },
  };
}

function toShoppingPlanItem(
  ingredientId: string,
  ingredient: string,
  quantityNote: string,
  observation: CatalogPriceObservation,
  storeName: string,
  dataSource: MarketDataSource,
): ShoppingPlanItem {
  return {
    ingredientId,
    ingredient,
    quantityNote,
    sourcedFromPantry: false,
    storeName,
    price: observation.price,
    freshnessDaysAgo: observation.freshnessDaysAgo,
    freshnessHoursAgo: observation.freshnessHoursAgo,
    saleLabel: observation.saleLabel,
    priceSource: observation.priceSource,
    priceSourceKind:
      observation.priceSourceKind ?? getRankedPriceSourceKind(observation.priceSource),
    priceSourceTier:
      observation.priceSourceTier ?? getRankedPriceSourceTier(observation.priceSource),
    matchConfidence: observation.matchConfidence,
    saleConfidence: getSaleConfidence({
      saleLabel: observation.saleLabel,
      freshnessDaysAgo: observation.freshnessDaysAgo,
      freshnessHoursAgo: observation.freshnessHoursAgo,
      dataSource,
      priceSource: observation.priceSource,
      matchConfidence: observation.matchConfidence,
    }),
  };
}
