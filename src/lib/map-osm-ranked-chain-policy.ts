import type { CatalogStore } from "@/lib/market-catalog-types";
import { isMapContextCatalogStore } from "@/lib/map-context-types";
import { getProviderRolloutForStore, type StoreChain } from "@/lib/provider-rollout";

/** Beta v1 chains with Postgres/provider ingest paths — OSM must not override these on the map. */
export const MAP_RANKED_CHAIN_KEYS = new Set<StoreChain>(["kroger", "aldi"]);

export type MapOsmRankedChainPolicy =
  | "suppress-conflicts"
  | "gap-fill-only"
  | "allow-conflicts"
  | "off";

const DEFAULT_POLICY: MapOsmRankedChainPolicy = "suppress-conflicts";

export function resolveMapOsmRankedChainPolicy(
  value = process.env.YUM4LESS_MAP_OSM_RANKED_CHAIN_POLICY,
): MapOsmRankedChainPolicy {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "suppress-conflicts" ||
    normalized === "gap-fill-only" ||
    normalized === "allow-conflicts" ||
    normalized === "off"
  ) {
    return normalized;
  }

  return DEFAULT_POLICY;
}

export function shouldRunSearchTimeOsmDiscovery(
  policy: MapOsmRankedChainPolicy = resolveMapOsmRankedChainPolicy(),
): boolean {
  return policy !== "off";
}

function isIngestedRankedChainStore(store: CatalogStore): boolean {
  if (isMapContextCatalogStore(store)) {
    return false;
  }

  const chain = getProviderRolloutForStore(store.name).chain;
  return MAP_RANKED_CHAIN_KEYS.has(chain);
}

/**
 * Policy C: drop search-time map-context pins for Kroger/Aldi when an ingested catalog row
 * for the same chain is already within the ranked-chain dedupe radius.
 */
export function filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
  baseStores: CatalogStore[],
  contextStores: CatalogStore[],
  dedupeProximityMiles: number,
): { kept: CatalogStore[]; suppressedCount: number } {
  const kept: CatalogStore[] = [];
  let suppressedCount = 0;

  for (const candidate of contextStores) {
    if (!isMapContextCatalogStore(candidate)) {
      kept.push(candidate);
      continue;
    }

    const candidateChain = getProviderRolloutForStore(candidate.name).chain;

    if (!MAP_RANKED_CHAIN_KEYS.has(candidateChain)) {
      kept.push(candidate);
      continue;
    }

    const conflicts = baseStores.some((base) => {
      if (!isIngestedRankedChainStore(base)) {
        return false;
      }

      const baseChain = getProviderRolloutForStore(base.name).chain;
      if (baseChain !== candidateChain) {
        return false;
      }

      return (
        getDistanceMiles(
          base.latitude,
          base.longitude,
          candidate.latitude,
          candidate.longitude,
        ) <= dedupeProximityMiles
      );
    });

    if (conflicts) {
      suppressedCount += 1;
      continue;
    }

    kept.push(candidate);
  }

  return { kept, suppressedCount };
}

/** @deprecated Use filterMapContextCatalogStoresConflictingWithIngestedRankedChains */
export const filterOsmCatalogStoresConflictingWithIngestedRankedChains =
  filterMapContextCatalogStoresConflictingWithIngestedRankedChains;

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
