import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  listMapContextOnlyCatalogChains,
  MAP_CONTEXT_ONLY_NAME_FRAGMENTS,
  SETTINGS_SELECTABLE_CHAINS,
} from "@/lib/chain-rollout-policy";
import {
  FIXTURE_CHAIN_MEMBERSHIP,
  shopperRankedChainSet,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import { isMapContextCatalogStore } from "@/lib/map-context-types";
import { getProviderRolloutForCatalogStore, type StoreChain } from "@/lib/provider-rollout";

/** Known dinner-adapter keys — merge radius fallback when membership is not passed. */
export const MAP_RANKED_CHAIN_KEYS: Set<StoreChain> = SETTINGS_SELECTABLE_CHAINS;

function mapRankedChainKeySet(
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): Set<string> {
  return shopperRankedChainSet(membership);
}

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

/** Minimum Postgres catalog pins per ranked v1 chain before skipping OSM gap-fill for that chain. */
export const MAP_RANKED_CHAIN_MIN_DB_PINS = 2;

export type OsmGapFillTriggerReason =
  | { kind: "ranked-chain-sparse"; chain: StoreChain; pinCount: number }
  | { kind: "context-chain-missing"; chain: StoreChain; pinCount: number }
  | { kind: "context-name-missing"; nameFragment: string; pinCount: number };

function filterPostgresStoresWithinRadius(
  dbStores: CatalogStore[],
  latitude: number,
  longitude: number,
  radiusMiles: number,
): CatalogStore[] {
  return dbStores.filter(
    (store) =>
      getDistanceMiles(
        latitude,
        longitude,
        store.latitude,
        store.longitude,
      ) <= radiusMiles,
  );
}

function countStoresForChain(stores: CatalogStore[], chain: StoreChain): number {
  return stores.filter(
    (store) => getProviderRolloutForCatalogStore(store).chain === chain,
  ).length;
}

function countStoresMatchingNameFragment(
  stores: CatalogStore[],
  fragment: string,
): number {
  const normalizedFragment = fragment.toLowerCase();
  return stores.filter((store) =>
    store.name.toLowerCase().includes(normalizedFragment),
  ).length;
}

/**
 * Previously: skip OSM when total Postgres pins within radius were below
 * YUM4LESS_MAP_SPARSE_PIN_THRESHOLD (default 3). That blocked gap-fill once
 * *any* seed rows existed — e.g. 12 pins overall but only one Kroger branch.
 * Per-chain checks fix that trap.
 */
export function listOsmGapFillTriggerReasons(
  dbStores: CatalogStore[],
  latitude: number,
  longitude: number,
  radiusMiles: number,
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): OsmGapFillTriggerReason[] {
  const storesInRadius = filterPostgresStoresWithinRadius(
    dbStores,
    latitude,
    longitude,
    radiusMiles,
  );
  const reasons: OsmGapFillTriggerReason[] = [];

  for (const chain of membership.shopperRankedChainIds) {
    const pinCount = countStoresForChain(storesInRadius, chain as StoreChain);
    if (pinCount < MAP_RANKED_CHAIN_MIN_DB_PINS) {
      reasons.push({
        kind: "ranked-chain-sparse",
        chain: chain as StoreChain,
        pinCount,
      });
    }
  }

  for (const chain of listMapContextOnlyCatalogChains()) {
    const pinCount = countStoresForChain(storesInRadius, chain);
    if (pinCount === 0) {
      reasons.push({ kind: "context-chain-missing", chain, pinCount });
    }
  }

  for (const nameFragment of MAP_CONTEXT_ONLY_NAME_FRAGMENTS) {
    const pinCount = countStoresMatchingNameFragment(storesInRadius, nameFragment);
    if (pinCount === 0) {
      reasons.push({ kind: "context-name-missing", nameFragment, pinCount });
    }
  }

  return reasons;
}

export function needsSearchTimeOsmGapFill(
  dbStores: CatalogStore[],
  latitude: number,
  longitude: number,
  radiusMiles: number,
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): boolean {
  return listOsmGapFillTriggerReasons(
    dbStores,
    latitude,
    longitude,
    radiusMiles,
    membership,
  ).length > 0;
}

function isIngestedRankedChainStore(
  store: CatalogStore,
  rankedKeys: Set<string>,
): boolean {
  if (isMapContextCatalogStore(store)) {
    return false;
  }

  const chain = getProviderRolloutForCatalogStore(store).chain;
  return rankedKeys.has(chain);
}

/**
 * Policy C: drop search-time map-context pins for ranked v1 chains when an ingested catalog row
 * for the same chain is already within the ranked-chain dedupe radius.
 */
export function filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
  baseStores: CatalogStore[],
  contextStores: CatalogStore[],
  dedupeProximityMiles: number,
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): { kept: CatalogStore[]; suppressedCount: number } {
  const rankedKeys = mapRankedChainKeySet(membership);
  const kept: CatalogStore[] = [];
  let suppressedCount = 0;

  for (const candidate of contextStores) {
    if (!isMapContextCatalogStore(candidate)) {
      kept.push(candidate);
      continue;
    }

    const candidateChain = getProviderRolloutForCatalogStore(candidate).chain;

    if (!rankedKeys.has(candidateChain)) {
      kept.push(candidate);
      continue;
    }

    const conflicts = baseStores.some((base) => {
      if (!isIngestedRankedChainStore(base, rankedKeys)) {
        return false;
      }

      const baseChain = getProviderRolloutForCatalogStore(base).chain;
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
