/**
 * Option A Slice 5b — expand-aware Map pin selection / highlight helpers.
 *
 * Closes client/server flag-mismatch silent-empty: server may emit only the
 * canonical nearbyStores id while client selection still holds an alias
 * (stale localStorage or NEXT_PUBLIC_ lagging server expand).
 */

import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import type { StoreIdentityEnv } from "@/lib/store-identity-flags";
import { isStoreIdentityExpandEnabled } from "@/lib/store-identity-flags";
import { createMapPinIdentityLookup } from "@/lib/store-identity-map-lookup";
import {
  expandStoreIdsForRead,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";
import { filterSaleIngredientChoicesByStoreIds } from "@/lib/store-scope";

export type MapPinIdentityOptions = {
  identityLookup?: StoreIdentityLookup;
  env?: StoreIdentityEnv;
};

/**
 * Keep nearby stores whose id is selected, or (when expand ON) whose identity
 * members intersect the selected ids. Flag OFF → exact-id (legacy).
 */
export function filterNearbyStoresBySelectionForMap(
  stores: NearbyStoreSummary[],
  selectedStoreIds: string[] | undefined,
  options?: MapPinIdentityOptions,
): NearbyStoreSummary[] {
  if (!selectedStoreIds || selectedStoreIds.length === 0) {
    return [];
  }

  const env = options?.env ?? process.env;
  const lookup = options?.identityLookup ?? createMapPinIdentityLookup();

  if (!isStoreIdentityExpandEnabled(env)) {
    const allowed = new Set(selectedStoreIds);
    return stores.filter((store) => allowed.has(store.id));
  }

  const allowed = new Set(
    expandStoreIdsForRead(lookup, selectedStoreIds, env),
  );
  return stores.filter((store) => allowed.has(store.id));
}

/**
 * Map-facing market scope: expand-aware nearby filter + sale choices.
 * Flag OFF matches scopeMarketSummaryToSelectedStores exact-id behavior.
 */
export function scopeMarketSummaryToSelectedStoresForMap(
  market: MarketSummary,
  selectedStoreIds: string[],
  options?: MapPinIdentityOptions,
): MarketSummary {
  const env = options?.env ?? process.env;
  const lookup = options?.identityLookup ?? createMapPinIdentityLookup();
  const nearbyStores = filterNearbyStoresBySelectionForMap(
    market.nearbyStores,
    selectedStoreIds,
    { identityLookup: lookup, env },
  );
  const saleScopeIds = isStoreIdentityExpandEnabled(env)
    ? expandStoreIdsForRead(lookup, selectedStoreIds, env)
    : selectedStoreIds;

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
    saleIngredientChoices: filterSaleIngredientChoicesByStoreIds(
      market.saleIngredientChoices,
      saleScopeIds,
    ),
  };
}

/**
 * Resolve a highlight/selection id to a marker key present on the map.
 * Tries exact id first, then any expanded member that exists in markerIds.
 */
export function resolveSelectedMapMarkerId(
  selectedStoreId: string | undefined,
  markerIds: Iterable<string>,
  options?: MapPinIdentityOptions,
): string | undefined {
  if (!selectedStoreId) {
    return undefined;
  }

  const markerSet = markerIds instanceof Set ? markerIds : new Set(markerIds);
  if (markerSet.has(selectedStoreId)) {
    return selectedStoreId;
  }

  const env = options?.env ?? process.env;
  if (!isStoreIdentityExpandEnabled(env)) {
    return undefined;
  }

  const lookup = options?.identityLookup ?? createMapPinIdentityLookup();
  const members = expandStoreIdsForRead(lookup, [selectedStoreId], env);
  return members.find((memberId) => markerSet.has(memberId));
}
