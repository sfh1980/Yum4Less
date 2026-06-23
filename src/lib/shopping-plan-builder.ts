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
  compareObservationQuality,
  comparePlanQuality,
} from "@/lib/recommendation-scoring";
import type {
  NearbyStoreSummary,
  ShoppingPlanItem,
} from "@/lib/recommendation-types";

export function buildSingleStorePlan(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): ShoppingPlanItem[] {
  const candidatePlans = nearbyStores
    .map((store) => {
      const observations = recipe.ingredients.map((ingredient) =>
        getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      );
      if (observations.some((observation) => observation === undefined)) {
        return null;
      }

      return recipe.ingredients.map((ingredient, index) =>
        toShoppingPlanItem(
          ingredient.displayName,
          ingredient.quantityNote,
          observations[index]!,
          store.name,
          dataSource,
        ),
      );
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
): ShoppingPlanItem[] {
  const plan: ShoppingPlanItem[] = [];

  for (const ingredient of recipe.ingredients) {
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
        compareObservationQuality(left.observation, right.observation),
      )[0];

    if (!bestObservation) {
      return [];
    }

    plan.push(
      toShoppingPlanItem(
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

function toShoppingPlanItem(
  ingredient: string,
  quantityNote: string,
  observation: CatalogPriceObservation,
  storeName: string,
  dataSource: MarketDataSource,
): ShoppingPlanItem {
  return {
    ingredient,
    quantityNote,
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
