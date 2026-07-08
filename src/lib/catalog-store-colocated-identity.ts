/**
 * Chain-agnostic collocated catalog-store identity helpers.
 *
 * Scope (this pass): same-chain CATALOG↔CATALOG near-duplicates (slug vs
 * ZIP-market vs API/weekly-ad ranked rows). Intentionally NOT full Option A
 * (locator↔OSM↔SNAP name similarity) — Option A Identity Matching can later
 * import {@link storesAreCollocatedCatalogDuplicates} / prefer-canonical here.
 */
import { getDistanceMiles } from "@/lib/geo-distance";
import {
  SETTINGS_SELECTABLE_CHAINS,
} from "@/lib/chain-rollout-policy";
import { getProviderRolloutForCatalogStore, type StoreChain } from "@/lib/provider-rollout";
import {
  isApiDerivedKrogerCatalogStoreId,
  isNumericKrogerProviderLocationId,
  KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
} from "@/lib/kroger-catalog-canonical";
import {
  isLiveOsmStoreId,
  isNonLiveOsmCatalogIdentity,
} from "@/lib/osm-food-retail-discovery";

/**
 * Same-physical-storefront merge for ranked/catalog twins (default for all
 * chains except Kroger). Kept separate from SETTINGS_RANKED_CHAIN_DEDUPE_MILES
 * (1.5) which hides OSM/context pins near a catalog pin — not same-catalog collapse.
 */
export const CATALOG_COLLOCATED_MERGE_MILES = 0.05;

/**
 * Kroger collocated catalog merge radius.
 * Matches legacy {@link KROGER_SAME_STORE_MERGE_PROXIMITY_MILES} (0.15): wider
 * tolerance for Kroger API coordinate variance. Unvalidated for other chains —
 * do not widen {@link CATALOG_COLLOCATED_MERGE_MILES} based on this exception.
 */
export const KROGER_COLLOCATED_MERGE_MILES = KROGER_SAME_STORE_MERGE_PROXIMITY_MILES;

export type CollocatedCatalogStoreLike = {
  id: string;
  name: string;
  chain?: StoreChain | string;
  latitude: number;
  longitude: number;
  sourceName?: string | null;
  sourceStoreId?: string | null;
};

export function resolveCollocatedMergeRadiusMiles(
  chain: StoreChain | null | undefined,
): number {
  if (chain === "kroger") {
    return KROGER_COLLOCATED_MERGE_MILES;
  }

  return CATALOG_COLLOCATED_MERGE_MILES;
}

export function isMapContextLikeCatalogStore(
  store: CollocatedCatalogStoreLike,
): boolean {
  if (
    isNonLiveOsmCatalogIdentity({
      id: store.id,
      sourceName: store.sourceName,
    })
  ) {
    return true;
  }

  if (isLiveOsmStoreId(store.id) || store.id.startsWith("osm-")) {
    return true;
  }

  if (store.id.startsWith("snap-") || store.sourceName === "usda-snap-retailer-locator") {
    return true;
  }

  // publix-store-locator rows remain Settings-selectable catalog pins in v1;
  // Option A may later reclassify them as map-context for cross-source matching.
  return false;
}

export function resolveSelectableCatalogChain(
  store: CollocatedCatalogStoreLike,
): StoreChain | null {
  if (store.chain && SETTINGS_SELECTABLE_CHAINS.has(store.chain as StoreChain)) {
    return store.chain as StoreChain;
  }

  const inferred = getProviderRolloutForCatalogStore({
    id: store.id,
    name: store.name,
    sourceName: store.sourceName ?? undefined,
  }).chain;

  return SETTINGS_SELECTABLE_CHAINS.has(inferred) ? inferred : null;
}

/**
 * Higher score wins when collapsing collocated catalog twins.
 * API/numeric provider > weekly-ad with numeric link > weekly-ad >
 * stable city slug > internal bootstrap > ZIP-market synthetic ids.
 */
export function scoreCollocatedCatalogStorePriority(
  store: CollocatedCatalogStoreLike,
): number {
  if (
    store.sourceName === "kroger-official-api" ||
    isApiDerivedKrogerCatalogStoreId(store.id)
  ) {
    return 100;
  }

  if (
    store.sourceName?.endsWith("-weekly-ad-scrape") &&
    isNumericKrogerProviderLocationId(store.sourceStoreId)
  ) {
    return 90;
  }

  if (store.sourceName?.endsWith("-weekly-ad-scrape")) {
    return 70;
  }

  // Stable city / bootstrap slugs: kroger-mechanicsville, aldi-mechanicsville
  if (/^[a-z]+-[a-z][a-z0-9-]*$/.test(store.id) && !/-\d{5}$/.test(store.id)) {
    return 60;
  }

  if (store.sourceName === "yum4less-internal-catalog") {
    return 55;
  }

  if (store.sourceName === "yum4less-market-catalog" || /-\d{5}$/.test(store.id)) {
    return 40;
  }

  return 50;
}

export function preferCollocatedCatalogStoreId(
  left: CollocatedCatalogStoreLike,
  right: CollocatedCatalogStoreLike,
): string {
  const leftScore = scoreCollocatedCatalogStorePriority(left);
  const rightScore = scoreCollocatedCatalogStorePriority(right);

  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left.id : right.id;
  }

  if (left.id.length !== right.id.length) {
    return left.id.length < right.id.length ? left.id : right.id;
  }

  return left.id < right.id ? left.id : right.id;
}

export function storesAreCollocatedCatalogDuplicates(
  left: CollocatedCatalogStoreLike,
  right: CollocatedCatalogStoreLike,
  mergeRadiusMiles?: number,
): boolean {
  const leftChain = resolveSelectableCatalogChain(left);
  const rightChain = resolveSelectableCatalogChain(right);
  if (!leftChain || leftChain !== rightChain) {
    return false;
  }

  if (isMapContextLikeCatalogStore(left) || isMapContextLikeCatalogStore(right)) {
    return false;
  }

  const radius =
    mergeRadiusMiles ?? resolveCollocatedMergeRadiusMiles(leftChain);

  return (
    getDistanceMiles(
      left.latitude,
      left.longitude,
      right.latitude,
      right.longitude,
    ) <= radius
  );
}

/**
 * Collapse same-chain catalog rows using the per-chain collocated radius
 * ({@link CATALOG_COLLOCATED_MERGE_MILES} default; {@link KROGER_COLLOCATED_MERGE_MILES}
 * for Kroger). Map-context / OSM rows pass through unchanged (Settings OSM
 * suppress remains the separate 1.5 mi rule).
 */
export function collapseSameChainCollocatedCatalogStores<
  T extends CollocatedCatalogStoreLike,
>(stores: T[]): T[] {
  if (stores.length <= 1) {
    return stores;
  }

  const survivors: T[] = [];

  for (const candidate of stores) {
    if (isMapContextLikeCatalogStore(candidate) || isLiveOsmStoreId(candidate.id)) {
      survivors.push(candidate);
      continue;
    }

    const clusterIndex = survivors.findIndex((kept) =>
      storesAreCollocatedCatalogDuplicates(kept, candidate),
    );

    if (clusterIndex === -1) {
      survivors.push(candidate);
      continue;
    }

    const incumbent = survivors[clusterIndex]!;
    const survivorId = preferCollocatedCatalogStoreId(incumbent, candidate);
    if (survivorId === candidate.id) {
      survivors[clusterIndex] = candidate;
    }
  }

  return survivors;
}

/**
 * When inserting/refreshing a ranked catalog row, redirect onto an existing
 * same-chain collocated winner instead of creating a twin id.
 */
export function resolveCollocatedCatalogUpsertTarget(
  candidate: CollocatedCatalogStoreLike,
  existing: CollocatedCatalogStoreLike[],
): { storeId: string; shouldCreateCandidateId: boolean } {
  const collocated = existing.filter(
    (row) =>
      row.id !== candidate.id &&
      storesAreCollocatedCatalogDuplicates(candidate, row),
  );

  if (collocated.length === 0) {
    return { storeId: candidate.id, shouldCreateCandidateId: true };
  }

  let winner: CollocatedCatalogStoreLike = candidate;
  for (const row of collocated) {
    const preferredId = preferCollocatedCatalogStoreId(winner, row);
    winner = preferredId === row.id ? row : winner;
  }

  return {
    storeId: winner.id,
    shouldCreateCandidateId: winner.id === candidate.id,
  };
}
