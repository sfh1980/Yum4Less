import { getDistanceMiles } from "@/lib/geo-distance";
import type { CatalogStore } from "@/lib/market-catalog-types";
import type { StoreChain } from "@/lib/provider-rollout";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { getProviderRolloutForCatalogStore } from "@/lib/provider-rollout";

/** Same-building Kroger slug ↔ numeric locationId merge radius. */
export const KROGER_SAME_STORE_MERGE_PROXIMITY_MILES = 0.15;

const KROGER_OFFICIAL_API_SOURCE = "kroger-official-api";

export type KrogerCatalogStoreRow = {
  id: string;
  name: string;
  source_name: string | null;
  source_store_id: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export function isApiDerivedKrogerCatalogStoreId(storeId: string) {
  return /^kroger-\d+$/.test(storeId);
}

export function isNumericKrogerProviderLocationId(
  sourceStoreId: string | null | undefined,
): boolean {
  if (!sourceStoreId?.trim()) {
    return false;
  }

  return /^\d{6,10}$/.test(sourceStoreId.trim());
}

export function scoreKrogerCatalogStorePriority(input: {
  id: string;
  sourceName?: string | null;
  sourceStoreId?: string | null;
}): number {
  if (input.sourceName === KROGER_OFFICIAL_API_SOURCE || isApiDerivedKrogerCatalogStoreId(input.id)) {
    return 5;
  }

  if (
    input.sourceName?.endsWith("-weekly-ad-scrape") &&
    isNumericKrogerProviderLocationId(input.sourceStoreId)
  ) {
    return 4;
  }

  if (input.sourceName?.endsWith("-weekly-ad-scrape")) {
    return 3;
  }

  if (input.id.startsWith("osm-")) {
    return 1;
  }

  return 2;
}

export function preferKrogerCanonicalStoreId(
  left: Pick<KrogerCatalogStoreRow, "id" | "source_name" | "source_store_id">,
  right: Pick<KrogerCatalogStoreRow, "id" | "source_name" | "source_store_id">,
): string {
  const leftScore = scoreKrogerCatalogStorePriority({
    id: left.id,
    sourceName: left.source_name,
    sourceStoreId: left.source_store_id,
  });
  const rightScore = scoreKrogerCatalogStorePriority({
    id: right.id,
    sourceName: right.source_name,
    sourceStoreId: right.source_store_id,
  });

  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left.id : right.id;
  }

  return isApiDerivedKrogerCatalogStoreId(left.id) ? left.id : right.id;
}

export function findProximityLinkedKrogerStore(
  existingStores: KrogerCatalogStoreRow[],
  discovered: Pick<
    KrogerCatalogStoreRow,
    "latitude" | "longitude" | "source_store_id"
  > & { catalogStoreId: string },
  mergeRadiusMiles = KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
): KrogerCatalogStoreRow | undefined {
  const candidates = existingStores.filter((store) => {
    if (store.id === discovered.catalogStoreId) {
      return false;
    }

    if (getProviderRolloutForCatalogStore(store).chain !== "kroger") {
      return false;
    }

    return (
      getDistanceMiles(
        store.latitude,
        store.longitude,
        discovered.latitude,
        discovered.longitude,
      ) <= mergeRadiusMiles
    );
  });

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.reduce((best, candidate) =>
    preferKrogerCanonicalStoreId(best, candidate) === best.id ? best : candidate,
  );
}

export function resolveSurvivingKrogerStoreIdForMerge(input: {
  incomingId: string;
  incomingSourceName?: string | null;
  incomingSourceStoreId?: string | null;
  existing: Pick<KrogerCatalogStoreRow, "id" | "source_name" | "source_store_id">;
}): string {
  return preferKrogerCanonicalStoreId(
    {
      id: input.incomingId,
      source_name: input.incomingSourceName ?? null,
      source_store_id: input.incomingSourceStoreId ?? null,
    },
    input.existing,
  );
}

type KrogerDedupeStore = Pick<
  CatalogStore,
  "id" | "name" | "latitude" | "longitude" | "sourceName"
> & {
  sourceStoreId?: string;
};

function krogerStoresRepresentSameLocation(
  left: KrogerDedupeStore,
  right: KrogerDedupeStore,
  mergeRadiusMiles = KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
): boolean {
  if (
    left.sourceStoreId &&
    right.sourceStoreId &&
    left.sourceStoreId.trim() &&
    right.sourceStoreId.trim() &&
    left.sourceStoreId.trim() === right.sourceStoreId.trim()
  ) {
    return true;
  }

  return (
    getDistanceMiles(
      left.latitude,
      left.longitude,
      right.latitude,
      right.longitude,
    ) <= mergeRadiusMiles
  );
}

/** Keep the strongest Kroger row per same-store identity (map + Settings). */
export function dedupeKrogerStoresByIdentity<T extends KrogerDedupeStore>(
  stores: T[],
  mergeRadiusMiles = KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
): T[] {
  const krogerStores = stores.filter(
    (store) => getProviderRolloutForCatalogStore(store).chain === "kroger",
  );
  const otherStores = stores.filter(
    (store) => getProviderRolloutForCatalogStore(store).chain !== "kroger",
  );

  if (krogerStores.length <= 1) {
    return stores;
  }

  const keptKroger: T[] = [];

  for (const candidate of krogerStores) {
    const clusterIndex = keptKroger.findIndex(
      (kept) => krogerStoresRepresentSameLocation(kept, candidate, mergeRadiusMiles),
    );

    if (clusterIndex === -1) {
      keptKroger.push(candidate);
      continue;
    }

    const incumbent = keptKroger[clusterIndex]!;
    const survivorId = preferKrogerCanonicalStoreId(
      {
        id: incumbent.id,
        source_name: incumbent.sourceName ?? null,
        source_store_id: incumbent.sourceStoreId ?? null,
      },
      {
        id: candidate.id,
        source_name: candidate.sourceName ?? null,
        source_store_id: candidate.sourceStoreId ?? null,
      },
    );

    if (survivorId === candidate.id) {
      keptKroger[clusterIndex] = candidate;
    }
  }

  return [...otherStores, ...keptKroger];
}

/** @deprecated Use dedupeKrogerStoresByIdentity */
export const dedupeKrogerStoresByProximity = dedupeKrogerStoresByIdentity;

/**
 * Hide OSM/fixture Kroger pins when official API catalog rows exist in the search radius.
 * Addresses stale bootstrap pins (e.g. osm-node-*) that sit on wrong coordinates.
 */
export function filterSupersededOsmKrogerFixturePins<T extends KrogerDedupeStore>(
  stores: T[],
  searchLocation: { latitude: number; longitude: number },
  radiusMiles: number,
): T[] {
  const hasOfficialApiKrogerInRadius = stores.some((store) => {
    if (getProviderRolloutForCatalogStore(store).chain !== "kroger") {
      return false;
    }

    if (store.sourceName !== KROGER_OFFICIAL_API_SOURCE && !isApiDerivedKrogerCatalogStoreId(store.id)) {
      return false;
    }

    return (
      getDistanceMiles(
        searchLocation.latitude,
        searchLocation.longitude,
        store.latitude,
        store.longitude,
      ) <= radiusMiles
    );
  });

  if (!hasOfficialApiKrogerInRadius) {
    return stores;
  }

  return stores.filter((store) => {
    if (getProviderRolloutForCatalogStore(store).chain !== "kroger") {
      return true;
    }

    if (!store.id.startsWith("osm-")) {
      return true;
    }

    return false;
  });
}

export function pickPrimaryKrogerStoreForWeeklyAdIngestList<
  T extends Pick<NearbyStoreSummary, "id" | "name" | "chain">,
>(stores: T[]): T {
  return stores.reduce((best, store) => {
    const bestScore = scoreKrogerCatalogStorePriority({ id: best.id });
    const storeScore = scoreKrogerCatalogStorePriority({ id: store.id });
    return storeScore > bestScore ? store : best;
  });
}

export function pickPrimaryKrogerStoreIdForWeeklyAdIngest(
  storeIds: string[],
  resolveRow: (storeId: string) =>
    | Pick<KrogerCatalogStoreRow, "id" | "name" | "source_name" | "source_store_id">
    | undefined,
): string {
  const rows = storeIds
    .map((id) => resolveRow(id))
    .filter(
      (
        row,
      ): row is Pick<
        KrogerCatalogStoreRow,
        "id" | "name" | "source_name" | "source_store_id"
      > => row !== undefined,
    );

  if (rows.length === 0) {
    return storeIds[0] ?? "";
  }

  return rows.reduce((best, row) =>
    preferKrogerCanonicalStoreId(best, row) === best.id ? best : row,
  ).id;
}

export function isKrogerChain(chain: StoreChain): boolean {
  return chain === "kroger";
}
