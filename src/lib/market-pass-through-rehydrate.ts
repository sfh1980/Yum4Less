import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MarketDataSnapshot } from "@/lib/market-repository";
import {
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
} from "@/lib/market-search-service";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";

/**
 * Rebuilds full nearby-store rows from the catalog snapshot for store IDs
 * present on a thin pass-through market (coordinates, badges, rollout gates).
 * Server-only — do not import from client components.
 */
export function rehydratePassedMarketNearbyStores(
  market: MarketSummary,
  snapshot: MarketDataSnapshot,
  location: ResolvedSearchLocation,
): MarketSummary {
  const passedStoreIds = new Set(market.nearbyStores.map((store) => store.id));
  const catalogStores = snapshot.stores.filter((store) => passedStoreIds.has(store.id));
  const recipeIngredientIds = collectRecipeIngredientIdsForRollout(snapshot.recipes);
  const rehydratedById = new Map(
    buildNearbyStoresForSearch(
      catalogStores,
      location,
      market.radiusMiles,
      snapshot.priceObservations,
      recipeIngredientIds,
    ).map((store) => [store.id, store]),
  );

  const nearbyStores = market.nearbyStores
    .map((store) => rehydratedById.get(store.id))
    .filter((store): store is NearbyStoreSummary => store !== undefined);

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
  };
}
