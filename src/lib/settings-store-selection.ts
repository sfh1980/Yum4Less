import { getDistanceMiles } from "@/lib/geo-distance";
import {
  SETTINGS_SELECTABLE_CHAIN_ORDER,
  SETTINGS_SELECTABLE_CHAINS,
} from "@/lib/chain-rollout-policy";
import { dedupeKrogerStoresByIdentity } from "@/lib/kroger-catalog-canonical";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

/** Keep aligned with MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES in market-store-catalog-merge.ts */
const SETTINGS_RANKED_CHAIN_DEDUPE_MILES = 1.5;

export { SETTINGS_SELECTABLE_CHAINS } from "@/lib/chain-rollout-policy";

function isOsmStoreId(storeId: string): boolean {
  return storeId.startsWith("osm-");
}

function osmStoreConflictsWithCatalogPin(
  osmStore: NearbyStoreSummary,
  catalogStores: NearbyStoreSummary[],
  proximityMiles = SETTINGS_RANKED_CHAIN_DEDUPE_MILES,
): boolean {
  return catalogStores.some(
    (catalogStore) =>
      getDistanceMiles(
        catalogStore.latitude,
        catalogStore.longitude,
        osmStore.latitude,
        osmStore.longitude,
      ) <= proximityMiles,
  );
}

/**
 * Stores eligible for the Settings dropdown — ranked v1 chains only. Per chain,
 * keep ingested/catalog rows and include OSM pins unless a catalog row for the
 * same chain is already within map dedupe proximity.
 */
export function filterSettingsSelectableStores(
  stores: NearbyStoreSummary[],
): NearbyStoreSummary[] {
  const rankedChainStores = stores.filter((store) =>
    SETTINGS_SELECTABLE_CHAINS.has(store.chain),
  );

  if (rankedChainStores.length === 0) {
    return [];
  }

  const pool: NearbyStoreSummary[] = [];

  for (const chain of SETTINGS_SELECTABLE_CHAIN_ORDER) {
    const chainStores = rankedChainStores.filter((store) => store.chain === chain);
    if (chainStores.length === 0) {
      continue;
    }

    const catalogStores = chainStores.filter((store) => !isOsmStoreId(store.id));
    const osmStores = chainStores.filter((store) => isOsmStoreId(store.id));

    pool.push(...catalogStores);

    for (const osmStore of osmStores) {
      if (!osmStoreConflictsWithCatalogPin(osmStore, catalogStores)) {
        pool.push(osmStore);
      }
    }
  }

  return dedupeKrogerStoresByIdentity(
    [...pool].sort((left, right) => left.distanceMiles - right.distanceMiles),
  );
}

export function defaultSelectedStoreIdsForSettings(
  stores: NearbyStoreSummary[],
  shoppingStyle: "single-store" | "multi-store",
): string[] {
  const selectable = filterSettingsSelectableStores(stores);
  const preferred =
    selectable.find((store) => store.recommendationEnabled) ?? selectable[0];

  if (shoppingStyle === "single-store") {
    return preferred ? [preferred.id] : [];
  }

  const enabled = selectable.filter((store) => store.recommendationEnabled);
  if (enabled.length > 0) {
    return enabled.map((store) => store.id);
  }

  return selectable.map((store) => store.id);
}
