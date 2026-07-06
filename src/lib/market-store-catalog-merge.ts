import type { CatalogStore } from "@/lib/market-catalog-types";
import { MAP_RANKED_CHAIN_KEYS } from "@/lib/map-osm-ranked-chain-policy";
import { getProviderRolloutForCatalogStore, type StoreChain } from "@/lib/provider-rollout";
import type {
  ProviderDiscoveredStore,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";
import {
  buildKrogerCatalogStore,
  buildOsmCatalogStore,
  RANKED_CATALOG_SOURCES,
  type CatalogStoreRecord,
} from "@/lib/store-catalog-sync";
import { isMapContextCatalogStore } from "@/lib/map-context-types";
import type { OsmDiscoveredFoodRetailStore } from "@/lib/osm-food-retail-discovery";

const PROVIDER_CATALOG_SOURCE_NAMES: Record<ProviderDiscoveredStore["provider"], string> = {
  kroger: "kroger-official-api",
  publix: "publix-official-api",
  walmart: "walmart-official-api",
};

/** Tight proximity dedupe for OSM-only context pins. */
export const MAP_OSM_DEDUPE_PROXIMITY_MILES = 0.15;

/** Wider same-chain dedupe when Postgres/provider ranked rows compete with OSM or duplicates. */
export const MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES = 1.5;

/** @deprecated Use MAP_OSM_DEDUPE_PROXIMITY_MILES — kept for existing imports/tests. */
export const MAP_STORE_DEDUPE_PROXIMITY_MILES = MAP_OSM_DEDUPE_PROXIMITY_MILES;

const KROGER_OFFICIAL_API_SOURCE = "kroger-official-api";

export function buildProviderDiscoveredCatalogStore(
  discovered: ProviderDiscoveredStore,
): CatalogStoreRecord {
  if (discovered.provider === "kroger") {
    return buildKrogerCatalogStore(discovered);
  }

  return {
    id: `${discovered.provider}-${discovered.providerStoreId}`,
    name: discovered.name,
    kind: "grocery",
    city: discovered.city,
    state: discovered.state,
    latitude: discovered.latitude,
    longitude: discovered.longitude,
    sourceName: PROVIDER_CATALOG_SOURCE_NAMES[discovered.provider],
    sourceStoreId: discovered.providerStoreId,
  };
}

export function buildCatalogStoresFromProviderSearches(
  searches: ProviderStoreSearchResult[],
): CatalogStoreRecord[] {
  const stores: CatalogStoreRecord[] = [];

  for (const search of searches) {
    for (const discovered of search.stores) {
      stores.push(buildProviderDiscoveredCatalogStore(discovered));
    }
  }

  return stores;
}

export function buildCatalogStoresFromOsmDiscovery(
  stores: OsmDiscoveredFoodRetailStore[],
): CatalogStoreRecord[] {
  return stores.map(buildOsmCatalogStore);
}

export function catalogStoreRecordToCatalogStore(record: CatalogStoreRecord): CatalogStore {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    city: record.city,
    state: record.state,
    latitude: record.latitude,
    longitude: record.longitude,
    sourceName: record.sourceName,
  };
}

function catalogStoreMergePriority(store: CatalogStore): number {
  if (isMapContextCatalogStore(store)) {
    return 1;
  }

  if (store.sourceName === KROGER_OFFICIAL_API_SOURCE) {
    return 5;
  }

  if (store.sourceName && RANKED_CATALOG_SOURCES.has(store.sourceName)) {
    return 4;
  }

  if (store.sourceName?.includes("weekly-ad-scrape")) {
    return 3;
  }

  if (
    store.id.startsWith("kroger-") ||
    store.id.startsWith("publix-") ||
    store.id.startsWith("walmart-")
  ) {
    return 3;
  }

  return 2;
}

export function mergeCatalogStoresForMap(
  baseStores: CatalogStore[],
  additions: CatalogStore[],
): CatalogStore[] {
  const merged = [...baseStores];

  for (const candidate of additions) {
    const duplicateIndex = merged.findIndex((existing) =>
      storesAreDuplicateForMap(existing, candidate),
    );

    if (duplicateIndex === -1) {
      merged.push(candidate);
      continue;
    }

    const existing = merged[duplicateIndex]!;
    if (catalogStoreMergePriority(candidate) > catalogStoreMergePriority(existing)) {
      merged[duplicateIndex] = candidate;
    }
  }

  return merged;
}

function storesAreDuplicateForMap(left: CatalogStore, right: CatalogStore): boolean {
  if (left.id === right.id) {
    return true;
  }

  const leftChain = getProviderRolloutForCatalogStore(left).chain;
  const rightChain = getProviderRolloutForCatalogStore(right).chain;

  if (leftChain === "unknown" || rightChain === "unknown" || leftChain !== rightChain) {
    return false;
  }

  const proximityMiles = resolveDedupeProximityMiles(left, right, leftChain);

  return (
    getDistanceMiles(left.latitude, left.longitude, right.latitude, right.longitude) <=
    proximityMiles
  );
}

function resolveDedupeProximityMiles(
  left: CatalogStore,
  right: CatalogStore,
  chain: StoreChain,
): number {
  const leftContext = isMapContextCatalogStore(left);
  const rightContext = isMapContextCatalogStore(right);

  if (leftContext && rightContext) {
    return MAP_OSM_DEDUPE_PROXIMITY_MILES;
  }

  if (MAP_RANKED_CHAIN_KEYS.has(chain)) {
    return MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES;
  }

  return MAP_OSM_DEDUPE_PROXIMITY_MILES;
}

function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
