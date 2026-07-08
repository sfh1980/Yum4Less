import { getDistanceMiles } from "@/lib/geo-distance";
import {
  SETTINGS_SELECTABLE_CHAIN_ORDER,
  SETTINGS_SELECTABLE_CHAINS,
} from "@/lib/chain-rollout-policy";
import { collapseSameChainCollocatedCatalogStores } from "@/lib/catalog-store-colocated-identity";
import {
  isFixtureOsmCatalogSource,
  isFixtureOsmStoreId,
  isLiveOsmStoreId,
  isNonLiveOsmCatalogIdentity,
} from "@/lib/osm-food-retail-discovery";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

/** Keep aligned with MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES in market-store-catalog-merge.ts */
const SETTINGS_RANKED_CHAIN_DEDUPE_MILES = 1.5;

export { SETTINGS_SELECTABLE_CHAINS } from "@/lib/chain-rollout-policy";

function isLiveOsmSelectableStoreId(storeId: string): boolean {
  return isLiveOsmStoreId(storeId);
}

function isShopperExcludedMapFixture(store: NearbyStoreSummary): boolean {
  return (
    isFixtureOsmStoreId(store.id) ||
    isFixtureOsmCatalogSource(store.sourceName) ||
    isNonLiveOsmCatalogIdentity({ id: store.id, sourceName: store.sourceName })
  );
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
 * keep ingested/catalog rows and include live OSM pins unless a catalog row for the
 * same chain is already within map dedupe proximity.
 * Fixture / synthetic OSM rows are never shopper-selectable.
 */
export function filterSettingsSelectableStores(
  stores: NearbyStoreSummary[],
): NearbyStoreSummary[] {
  const rankedChainStores = stores.filter(
    (store) =>
      SETTINGS_SELECTABLE_CHAINS.has(store.chain) &&
      !isShopperExcludedMapFixture(store),
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

    const catalogStores = chainStores.filter(
      (store) => !isLiveOsmSelectableStoreId(store.id),
    );
    const osmStores = chainStores.filter((store) =>
      isLiveOsmSelectableStoreId(store.id),
    );

    pool.push(...catalogStores);

    for (const osmStore of osmStores) {
      if (!osmStoreConflictsWithCatalogPin(osmStore, catalogStores)) {
        pool.push(osmStore);
      }
    }
  }

  // Chain-configurable collocated collapse (0.05 default; Kroger 0.15 exception).
  // Replaces Settings' prior dedupeKrogerStoresByIdentity-only call.
  return collapseSameChainCollocatedCatalogStores(
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
