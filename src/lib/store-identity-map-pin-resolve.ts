/**
 * Option A Slice 5b — Map pin selection / highlight from server-provided
 * equivalentStoreIds (no client hardcoded known-pair table).
 *
 * Closes silent-empty when server expand collapsed nearbyStores to canonical
 * ids but client selection still holds an alias. Membership comes from the
 * market payload (Postgres-backed expand on the server), not a third registry.
 */

import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import { filterSaleIngredientChoicesByStoreIds } from "@/lib/store-scope";

function memberIdsForStore(store: NearbyStoreSummary): string[] {
  if (store.equivalentStoreIds && store.equivalentStoreIds.length > 0) {
    return store.equivalentStoreIds;
  }
  return [store.id];
}

/**
 * Keep nearby stores whose id is selected, or whose server-provided
 * equivalentStoreIds intersect the selection (stale alias path).
 */
export function filterNearbyStoresBySelectionForMap(
  stores: NearbyStoreSummary[],
  selectedStoreIds: string[] | undefined,
): NearbyStoreSummary[] {
  if (!selectedStoreIds || selectedStoreIds.length === 0) {
    return [];
  }

  const selected = new Set(selectedStoreIds);
  return stores.filter((store) => {
    if (selected.has(store.id)) {
      return true;
    }
    return memberIdsForStore(store).some((memberId) => selected.has(memberId));
  });
}

/**
 * Map-facing market scope using payload membership for sale + nearby filters.
 */
export function scopeMarketSummaryToSelectedStoresForMap(
  market: MarketSummary,
  selectedStoreIds: string[],
): MarketSummary {
  const nearbyStores = filterNearbyStoresBySelectionForMap(
    market.nearbyStores,
    selectedStoreIds,
  );
  const saleScopeIds = [
    ...new Set(nearbyStores.flatMap((store) => memberIdsForStore(store))),
  ];

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
    saleIngredientChoices: filterSaleIngredientChoicesByStoreIds(
      market.saleIngredientChoices,
      saleScopeIds.length > 0 ? saleScopeIds : selectedStoreIds,
    ),
  };
}

export type MapMarkerIdentityLike = {
  id: string;
  equivalentStoreIds?: string[];
};

/**
 * Resolve a highlight/selection id to a marker key present on the map.
 * Uses server-provided equivalentStoreIds on each marker — no client lookup.
 */
export function resolveSelectedMapMarkerId(
  selectedStoreId: string | undefined,
  markers: Iterable<MapMarkerIdentityLike>,
): string | undefined {
  if (!selectedStoreId) {
    return undefined;
  }

  const list = [...markers];
  if (list.some((marker) => marker.id === selectedStoreId)) {
    return selectedStoreId;
  }

  const viaMembers = list.find((marker) =>
    (marker.equivalentStoreIds ?? []).includes(selectedStoreId),
  );
  return viaMembers?.id;
}
