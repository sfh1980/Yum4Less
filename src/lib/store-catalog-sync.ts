import { getDbPool } from "@/lib/db";
import { geocodeStreetAddress } from "@/lib/geocoding";
import { findNearestOsmAldiStore } from "@/lib/aldi-location-discovery";
import { USDA_SNAP_CONTEXT_SOURCE } from "@/lib/map-context-types";
import { PUBLIX_STORE_LOCATOR_SOURCE } from "@/lib/publix-catalog-sync";
import { logServerError } from "@/lib/server-log";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { ProviderDiscoveredStore } from "@/lib/providers/provider-types";
import { findSnapLocationWitnessForStore } from "@/lib/snap-retailer-locations";
import {
  buildProviderLocationWitness,
  reconcileRankedStoreCoordinates,
  type LocationWitness,
} from "@/lib/store-location-reconciliation";
import { getDistanceMiles } from "@/lib/geo-distance";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
  OSM_MAP_CATALOG_SOURCE,
  type OsmDiscoveredFoodRetailStore,
} from "@/lib/osm-food-retail-discovery";
import type { ProviderStoreSearchResult } from "@/lib/providers/provider-types";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import type { StoreChain } from "@/lib/provider-rollout";

export type CatalogStoreRecord = {
  id: string;
  name: string;
  kind: "grocery" | "big-box" | "specialty" | "dollar-market";
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  sourceName: string;
  sourceStoreId: string;
};

export type CatalogStoreRole = "map-context" | "ranked-ready";

export type ExistingCatalogStoreRow = {
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

export function isBootstrapSeedStoreRow(store: {
  id: string;
  source_name?: string | null;
}) {
  if (store.source_name === INTERNAL_BOOTSTRAP_SOURCE) {
    return true;
  }

  if (store.source_name?.endsWith("-weekly-ad-scrape")) {
    return true;
  }

  return !isApiDerivedKrogerCatalogStoreId(store.id);
}

export function findCanonicalStoreIdForApiDiscoveredStore(input: {
  existingStores: ExistingCatalogStoreRow[];
  chain: StoreChain;
  discovered: Pick<ProviderDiscoveredStore, "providerStoreId" | "latitude" | "longitude">;
  catalogStoreId: string;
  getRolloutForStore: (storeName: string) => { chain: StoreChain };
  mergeRadiusMiles?: number;
}): string | undefined {
  const mergeRadiusMiles = input.mergeRadiusMiles ?? BOOTSTRAP_STORE_MERGE_RADIUS_MILES;

  const nearbySeedStores = input.existingStores.filter((store) => {
    if (input.getRolloutForStore(store.name).chain !== input.chain) {
      return false;
    }

    if (store.id === input.catalogStoreId) {
      return false;
    }

    if (!isBootstrapSeedStoreRow(store)) {
      return false;
    }

    return (
      getDistanceMiles(
        input.discovered.latitude,
        input.discovered.longitude,
        store.latitude,
        store.longitude,
      ) <= mergeRadiusMiles
    );
  });

  if (nearbySeedStores.length > 0) {
    return findPrimaryStoreIdForChain(
      nearbySeedStores,
      input.chain,
      input.getRolloutForStore,
    );
  }

  const linkedStores = input.existingStores.filter(
    (store) =>
      store.source_store_id === input.discovered.providerStoreId &&
      input.getRolloutForStore(store.name).chain === input.chain,
  );
  if (linkedStores.length > 0) {
    return findPrimaryStoreIdForChain(
      linkedStores,
      input.chain,
      input.getRolloutForStore,
    );
  }

  return undefined;
}

async function mergeApiDiscoveredStoreIntoCanonical(input: {
  canonicalStoreId: string;
  duplicateStoreId: string;
  catalog: CatalogStoreRecord;
  providerStore?: ProviderDiscoveredStore;
}): Promise<number> {
  const pool = getDbPool();

  const duplicateExists = await pool.query<{ id: string }>(
    `select id from stores where id = $1`,
    [input.duplicateStoreId],
  );

  if ((duplicateExists.rowCount ?? 0) > 0) {
    await pool.query(
      `
        update price_observations
        set store_id = $1
        where store_id = $2
      `,
      [input.canonicalStoreId, input.duplicateStoreId],
    );
    await pool.query(`delete from stores where id = $1`, [input.duplicateStoreId]);
  }

  return updateRankedBootstrapStoreCoordinates(
    input.canonicalStoreId,
    input.catalog,
    input.providerStore,
  );
}

const KROGER_CATALOG_SOURCE = "kroger-official-api";
const ALDI_CATALOG_SOURCE = "yum4less-market-catalog";
const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";
const INTERNAL_BOOTSTRAP_SOURCE = INTERNAL_CATALOG_SOURCE;

/** Max distance to treat an API-discovered store as the same physical location as a bootstrap seed row. */
export const BOOTSTRAP_STORE_MERGE_RADIUS_MILES = 0.1;

export const MAP_CONTEXT_CATALOG_SOURCES = new Set<string>([
  OSM_MAP_CATALOG_SOURCE,
  USDA_SNAP_CONTEXT_SOURCE,
  PUBLIX_STORE_LOCATOR_SOURCE,
]);

export const RANKED_CATALOG_SOURCES = new Set<string>([
  KROGER_CATALOG_SOURCE,
  ALDI_CATALOG_SOURCE,
  INTERNAL_CATALOG_SOURCE,
]);

/** Weekly-ad ingest sets bootstrap store source_name before map-catalog runs. */
export function isBootstrapCoordinateRefreshEligible(
  sourceName: string | null | undefined,
): boolean {
  if (!sourceName) {
    return true;
  }

  if (RANKED_CATALOG_SOURCES.has(sourceName)) {
    return true;
  }

  return sourceName.endsWith("-weekly-ad-scrape");
}

export function getCatalogStoreRole(sourceName: string | null | undefined): CatalogStoreRole {
  if (sourceName && RANKED_CATALOG_SOURCES.has(sourceName)) {
    return "ranked-ready";
  }

  return "map-context";
}

export function isMapContextOnlyCatalogSource(sourceName: string | null | undefined): boolean {
  return getCatalogStoreRole(sourceName) === "map-context";
}

export function buildKrogerCatalogStore(
  discovered: ProviderDiscoveredStore,
): CatalogStoreRecord {
  return {
    id: `kroger-${discovered.providerStoreId}`,
    name: discovered.name,
    kind: "grocery",
    city: discovered.city,
    state: discovered.state,
    latitude: discovered.latitude,
    longitude: discovered.longitude,
    sourceName: KROGER_CATALOG_SOURCE,
    sourceStoreId: discovered.providerStoreId,
  };
}

/**
 * Bootstrap Aldi store pins by ZIP — search anchor lat/lon is NOT a store address.
 * Align with db/init/002_seed.sql until an official Aldi locator is wired.
 */
export const BOOTSTRAP_ALDI_COORDINATES_BY_ZIP: Record<
  string,
  { latitude: number; longitude: number; city: string; state: string }
> = {
  "23111": {
    latitude: 37.6362,
    longitude: -77.3606,
    city: "Mechanicsville",
    state: "VA",
  },
};

export function buildAldiCatalogStoreForMarket(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  osmAldiStore?: OsmDiscoveredFoodRetailStore;
}): CatalogStoreRecord {
  const zipKey = (input.zipCode ?? input.location.zipCode ?? "market")
    .trim()
    .replace(/[^\d]/g, "")
    .slice(0, 5);
  const storeKey = zipKey.length === 5 ? zipKey : "market";
  const bootstrapCoordinates = BOOTSTRAP_ALDI_COORDINATES_BY_ZIP[storeKey];

  if (input.osmAldiStore) {
    return {
      id: `aldi-${storeKey}`,
      name: input.osmAldiStore.name,
      kind: "grocery",
      city: input.osmAldiStore.city,
      state: input.osmAldiStore.state,
      latitude: input.osmAldiStore.latitude,
      longitude: input.osmAldiStore.longitude,
      sourceName: ALDI_CATALOG_SOURCE,
      sourceStoreId: buildOsmCatalogStoreId(input.osmAldiStore),
    };
  }

  return {
    id: `aldi-${storeKey}`,
    name: "Aldi",
    kind: "grocery",
    city: bootstrapCoordinates?.city ?? input.location.city,
    state: bootstrapCoordinates?.state ?? input.location.state,
    latitude: bootstrapCoordinates?.latitude ?? input.location.latitude,
    longitude: bootstrapCoordinates?.longitude ?? input.location.longitude,
    sourceName: ALDI_CATALOG_SOURCE,
    sourceStoreId: `aldi-${storeKey}`,
  };
}

export function buildOsmCatalogStore(
  discovered: OsmDiscoveredFoodRetailStore,
): CatalogStoreRecord {
  const id = buildOsmCatalogStoreId(discovered);

  return {
    id,
    name: discovered.name,
    kind: discovered.kind,
    city: discovered.city,
    state: discovered.state,
    latitude: discovered.latitude,
    longitude: discovered.longitude,
    sourceName: OSM_MAP_CATALOG_SOURCE,
    sourceStoreId: id,
  };
}

export async function upsertCatalogStores(
  stores: CatalogStoreRecord[],
  options?: { preserveRankedSources?: boolean },
): Promise<number> {
  if (stores.length === 0) {
    return 0;
  }

  try {
    const pool = getDbPool();
    let upserted = 0;
    const preserveRankedSources = options?.preserveRankedSources ?? false;
    const rankedSources = [...RANKED_CATALOG_SOURCES];

    for (const store of stores) {
      const result = await pool.query(
        preserveRankedSources
          ? `
              insert into stores (
                id,
                name,
                kind,
                city,
                state,
                latitude,
                longitude,
                source_name,
                source_store_id,
                last_verified_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
              on conflict (id) do update set
                name = excluded.name,
                city = excluded.city,
                state = excluded.state,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                source_name = excluded.source_name,
                source_store_id = excluded.source_store_id,
                last_verified_at = now()
              where stores.source_name is null
                or stores.source_name = any($10::text[])
                or stores.source_name = excluded.source_name
            `
          : `
              insert into stores (
                id,
                name,
                kind,
                city,
                state,
                latitude,
                longitude,
                source_name,
                source_store_id,
                last_verified_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
              on conflict (id) do update set
                name = excluded.name,
                city = excluded.city,
                state = excluded.state,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                source_name = excluded.source_name,
                source_store_id = excluded.source_store_id,
                last_verified_at = now()
            `,
        preserveRankedSources
          ? [
              store.id,
              store.name,
              store.kind,
              store.city,
              store.state,
              store.latitude,
              store.longitude,
              store.sourceName,
              store.sourceStoreId,
              rankedSources,
            ]
          : [
              store.id,
              store.name,
              store.kind,
              store.city,
              store.state,
              store.latitude,
              store.longitude,
              store.sourceName,
              store.sourceStoreId,
            ],
      );
      upserted += result.rowCount ?? 0;
    }

    return upserted;
  } catch (error) {
    logServerError("store-catalog-sync.upsertCatalogStores", error);
    throw error;
  }
}

export async function syncV1ChainStoresToCatalog(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  providerStoreSearches: ProviderStoreSearchResult[];
  osmFoodRetailStores?: OsmDiscoveredFoodRetailStore[];
}): Promise<number> {
  const { getProviderRolloutForStore } = await import("@/lib/provider-rollout");
  const pool = getDbPool();
  const existingResult = await pool.query<{
    id: string;
    name: string;
    source_name: string | null;
    source_store_id: string | null;
    city: string;
    state: string;
    latitude: string;
    longitude: string;
  }>(`
    select id, name, source_name, source_store_id, city, state, latitude, longitude
    from stores
  `);

  const existingStores = mapExistingCatalogStoreRows(existingResult.rows);
  const catalogStores: CatalogStoreRecord[] = [];
  let mergedCount = 0;

  for (const search of input.providerStoreSearches) {
    if (search.provider !== "kroger" || search.stores.length === 0) {
      continue;
    }

    for (const discovered of search.stores) {
      const catalogStore = buildKrogerCatalogStore(discovered);
      const canonicalStoreId = findCanonicalStoreIdForApiDiscoveredStore({
        existingStores,
        chain: "kroger",
        discovered,
        catalogStoreId: catalogStore.id,
        getRolloutForStore: getProviderRolloutForStore,
      });

      if (canonicalStoreId && canonicalStoreId !== catalogStore.id) {
        mergedCount += await mergeApiDiscoveredStoreIntoCanonical({
          canonicalStoreId,
          duplicateStoreId: catalogStore.id,
          catalog: catalogStore,
          providerStore: discovered,
        });
        applyCanonicalStoreMergeToSnapshot(existingStores, {
          canonicalStoreId,
          duplicateStoreId: catalogStore.id,
          catalog: catalogStore,
        });
        continue;
      }

      catalogStores.push(catalogStore);
    }
  }

  const aldiBootstrapId = findPrimaryStoreIdForChain(
    existingResult.rows,
    "aldi",
    getProviderRolloutForStore,
  );
  const osmAldiStore = input.osmFoodRetailStores
    ? findNearestOsmAldiStore(input.osmFoodRetailStores, input.location)
    : undefined;

  if (!aldiBootstrapId) {
    catalogStores.push(
      buildAldiCatalogStoreForMarket({
        location: input.location,
        zipCode: input.zipCode ?? input.location.zipCode,
        osmAldiStore,
      }),
    );
  }

  const uniqueById = new Map(catalogStores.map((store) => [store.id, store]));
  const providerUpserted = await upsertCatalogStores([...uniqueById.values()]);
  const bootstrapRefreshed = await refreshBootstrapRankedStoreCoordinates({
    ...input,
    osmFoodRetailStores: input.osmFoodRetailStores,
  });
  const reconciledCount = await reconcileDuplicateApiDerivedStoresWithBootstrapSeeds();

  return providerUpserted + mergedCount + bootstrapRefreshed + reconciledCount;
}

function mapExistingCatalogStoreRows(
  rows: {
    id: string;
    name: string;
    source_name: string | null;
    source_store_id: string | null;
    city: string;
    state: string;
    latitude: string;
    longitude: string;
  }[],
): ExistingCatalogStoreRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    source_name: row.source_name,
    source_store_id: row.source_store_id,
    city: row.city,
    state: row.state,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}

async function reconcileDuplicateApiDerivedStoresWithBootstrapSeeds(): Promise<number> {
  const { getProviderRolloutForStore } = await import("@/lib/provider-rollout");
  const pool = getDbPool();
  const existingResult = await pool.query<{
    id: string;
    name: string;
    source_name: string | null;
    source_store_id: string | null;
    city: string;
    state: string;
    latitude: string;
    longitude: string;
  }>(`
    select id, name, source_name, source_store_id, city, state, latitude, longitude
    from stores
  `);
  const existingStores = mapExistingCatalogStoreRows(existingResult.rows);
  let reconciledCount = 0;

  for (const store of existingStores) {
    if (!isApiDerivedKrogerCatalogStoreId(store.id)) {
      continue;
    }

    if (getProviderRolloutForStore(store.name).chain !== "kroger") {
      continue;
    }

    if (!store.source_store_id) {
      continue;
    }

    const catalogStoreId = store.id;
    const canonicalStoreId = findCanonicalStoreIdForApiDiscoveredStore({
      existingStores,
      chain: "kroger",
      discovered: {
        providerStoreId: store.source_store_id,
        latitude: store.latitude,
        longitude: store.longitude,
      },
      catalogStoreId,
      getRolloutForStore: getProviderRolloutForStore,
    });

    if (!canonicalStoreId || canonicalStoreId === catalogStoreId) {
      continue;
    }

    reconciledCount += await mergeApiDiscoveredStoreIntoCanonical({
      canonicalStoreId,
      duplicateStoreId: catalogStoreId,
      catalog: {
        id: catalogStoreId,
        name: store.name,
        kind: "grocery",
        city: store.city,
        state: store.state,
        latitude: store.latitude,
        longitude: store.longitude,
        sourceName: store.source_name ?? KROGER_CATALOG_SOURCE,
        sourceStoreId: store.source_store_id,
      },
    });
    applyCanonicalStoreMergeToSnapshot(existingStores, {
      canonicalStoreId,
      duplicateStoreId: catalogStoreId,
      catalog: {
        id: catalogStoreId,
        name: store.name,
        kind: "grocery",
        city: store.city,
        state: store.state,
        latitude: store.latitude,
        longitude: store.longitude,
        sourceName: store.source_name ?? KROGER_CATALOG_SOURCE,
        sourceStoreId: store.source_store_id,
      },
    });
  }

  return reconciledCount;
}

function applyCanonicalStoreMergeToSnapshot(
  existingStores: ExistingCatalogStoreRow[],
  input: {
    canonicalStoreId: string;
    duplicateStoreId: string;
    catalog: CatalogStoreRecord;
  },
) {
  const duplicateIndex = existingStores.findIndex((store) => store.id === input.duplicateStoreId);
  if (duplicateIndex >= 0) {
    existingStores.splice(duplicateIndex, 1);
  }

  const canonicalIndex = existingStores.findIndex(
    (store) => store.id === input.canonicalStoreId,
  );
  if (canonicalIndex < 0) {
    return;
  }

  existingStores[canonicalIndex] = {
    ...existingStores[canonicalIndex]!,
    source_name: input.catalog.sourceName,
    source_store_id: input.catalog.sourceStoreId,
    latitude: input.catalog.latitude,
    longitude: input.catalog.longitude,
  };
}

export async function refreshBootstrapRankedStoreCoordinates(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  providerStoreSearches: ProviderStoreSearchResult[];
  osmFoodRetailStores?: OsmDiscoveredFoodRetailStore[];
  existingStores?: { id: string; name: string; source_name?: string | null }[];
}): Promise<number> {
  const { getProviderRolloutForStore } = await import("@/lib/provider-rollout");
  const existing =
    input.existingStores ??
    (
      await getDbPool().query<{
        id: string;
        name: string;
        source_name: string | null;
      }>(`select id, name, source_name from stores`)
    ).rows;

  let updated = 0;

  const krogerSearch = input.providerStoreSearches.find(
    (search) => search.provider === "kroger" && search.stores.length > 0,
  );
  if (krogerSearch) {
    const nearest = pickNearestProviderStore(krogerSearch.stores, input.location);
    const bootstrapId = findPrimaryStoreIdForChain(
      existing,
      "kroger",
      getProviderRolloutForStore,
    );
    if (bootstrapId && nearest) {
      updated += await updateRankedBootstrapStoreCoordinates(
        bootstrapId,
        buildKrogerCatalogStore(nearest),
        nearest,
      );
    }
  }

  // Aldi has no official store API in v1 — keep bootstrap/OSM coords; never ZIP-centroid refresh.
  const aldiZip = (input.zipCode ?? input.location.zipCode ?? "").trim();
  const aldiBootstrapId = findPrimaryStoreIdForChain(
    existing,
    "aldi",
    getProviderRolloutForStore,
  );
  const osmAldiStore = input.osmFoodRetailStores
    ? findNearestOsmAldiStore(input.osmFoodRetailStores, input.location)
    : undefined;

  if (aldiBootstrapId && aldiZip.length === 5) {
    const aldiCatalog = buildAldiCatalogStoreForMarket({
      location: input.location,
      zipCode: aldiZip,
      osmAldiStore,
    });
    const hasAldiCoords =
      osmAldiStore !== undefined || BOOTSTRAP_ALDI_COORDINATES_BY_ZIP[aldiZip] !== undefined;
    if (hasAldiCoords) {
      updated += await updateRankedBootstrapStoreCoordinates(aldiBootstrapId, aldiCatalog);
    }
  }

  return updated;
}

export function findPrimaryStoreIdForChain(
  stores: { id: string; name: string; source_name?: string | null }[],
  chain: StoreChain,
  getRolloutForStore: (storeName: string) => { chain: StoreChain },
): string | undefined {
  const matches = stores.filter(
    (store) => getRolloutForStore(store.name).chain === chain,
  );
  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    return matches[0]!.id;
  }

  const bootstrap = matches.find(
    (store) =>
      store.source_name === INTERNAL_BOOTSTRAP_SOURCE ||
      store.source_name?.endsWith("-weekly-ad-scrape"),
  );
  if (bootstrap) {
    return bootstrap.id;
  }

  return matches
    .slice()
    .sort((left, right) => left.id.length - right.id.length)[0]?.id;
}

export async function buildRankedStoreLocationWitnesses(
  providerStore: ProviderDiscoveredStore,
): Promise<LocationWitness[]> {
  const witnesses: LocationWitness[] = [buildProviderLocationWitness(providerStore)];

  if (providerStore.addressLine1) {
    const geocoded = await geocodeStreetAddress({
      addressLine1: providerStore.addressLine1,
      city: providerStore.city,
      state: providerStore.state,
      zipCode: providerStore.zipCode,
    });

    if (geocoded.ok) {
      witnesses.push({
        source: "geocodio",
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      });
    }
  }

  const snapWitness = await findSnapLocationWitnessForStore({
    storeName: providerStore.name,
    latitude: providerStore.latitude,
    longitude: providerStore.longitude,
  });
  if (snapWitness) {
    witnesses.push(snapWitness);
  }

  return witnesses;
}

async function updateRankedBootstrapStoreCoordinates(
  storeId: string,
  catalog: CatalogStoreRecord,
  providerStore?: ProviderDiscoveredStore,
): Promise<number> {
  try {
    const pool = getDbPool();
    const rankedSources = [...RANKED_CATALOG_SOURCES];
    const currentResult = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(
      `
        select latitude, longitude, source_name
        from stores
        where id = $1
      `,
      [storeId],
    );
    const currentRow = currentResult.rows[0];

    let latitude = catalog.latitude;
    let longitude = catalog.longitude;

    if (providerStore) {
      const witnesses = await buildRankedStoreLocationWitnesses(providerStore);
      const reconciliation = reconcileRankedStoreCoordinates({
        current: currentRow
          ? {
              latitude: Number(currentRow.latitude),
              longitude: Number(currentRow.longitude),
              sourceName: currentRow.source_name,
            }
          : null,
        witnesses,
      });

      latitude = reconciliation.latitude;
      longitude = reconciliation.longitude;
    }

    const result = await pool.query(
      `
        update stores
        set
          latitude = $2,
          longitude = $3,
          source_name = $4,
          source_store_id = $5,
          name = $6,
          city = $7,
          state = $8,
          last_verified_at = now()
        where id = $1
          and (
            source_name is null
            or source_name = any($9::text[])
            or strpos(source_name, '-weekly-ad-scrape') > 0
          )
      `,
      [
        storeId,
        latitude,
        longitude,
        catalog.sourceName,
        catalog.sourceStoreId,
        catalog.name,
        catalog.city,
        catalog.state,
        rankedSources,
      ],
    );

    return result.rowCount ?? 0;
  } catch (error) {
    logServerError("store-catalog-sync-bootstrap-refresh", error);
    return 0;
  }
}

function pickNearestProviderStore(
  stores: ProviderDiscoveredStore[],
  location: ResolvedSearchLocation,
): ProviderDiscoveredStore | undefined {
  if (stores.length === 0) {
    return undefined;
  }

  return stores
    .slice()
    .sort(
      (left, right) =>
        getDistanceMiles(
          location.latitude,
          location.longitude,
          left.latitude,
          left.longitude,
        ) -
        getDistanceMiles(
          location.latitude,
          location.longitude,
          right.latitude,
          right.longitude,
        ),
    )[0];
}

export { getDistanceMiles } from "@/lib/geo-distance";

export type CatalogStoreCoordinate = {
  id: string;
  latitude: number;
  longitude: number;
};

export function resolveIngestRadiusMiles(
  value = process.env.YUM4LESS_PROVIDER_SYNC_RADIUS_MILES,
): number {
  const parsed = Number(value ?? 8);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8;
  }

  return parsed;
}

export function filterCatalogStoresNearLocation<T extends CatalogStoreCoordinate>(
  stores: T[],
  location: { latitude: number; longitude: number },
  radiusMiles: number,
): T[] {
  return stores.filter(
    (store) =>
      getDistanceMiles(
        location.latitude,
        location.longitude,
        store.latitude,
        store.longitude,
      ) <= radiusMiles,
  );
}

export function parseIngestZipCodesFromEnv(
  value = process.env.YUM4LESS_INGEST_ZIPS,
): string[] {
  const fallback = process.env.YUM4LESS_PROVIDER_SYNC_ZIP ?? "23111";

  if (!value?.trim()) {
    return [fallback];
  }

  const parsed = value
    .split(",")
    .map((zip) => zip.trim())
    .filter((zip) => /^\d{5}$/.test(zip));

  if (parsed.length === 0) {
    console.warn(
      `YUM4LESS_INGEST_ZIPS had no valid 5-digit ZIP codes; falling back to ${fallback}`,
    );
    return [fallback];
  }

  return parsed;
}

export async function syncUniversalMapCatalogForZip(input: {
  zipCode: string;
  radiusMiles?: number;
  useFixture?: boolean;
}): Promise<{
  osmUpserted: number;
  rankedUpserted: number;
  publixUpserted: number;
  osmMessage: string;
  publixMessage: string;
}> {
  const { resolveLocationInput } = await import("@/lib/location-resolution");
  const radiusMiles = input.radiusMiles ?? Number(process.env.YUM4LESS_MAP_CATALOG_RADIUS_MILES ?? 12);
  const locationResult = await resolveLocationInput({ zipCode: input.zipCode });

  if (!locationResult.ok) {
    return {
      osmUpserted: 0,
      rankedUpserted: 0,
      publixUpserted: 0,
      osmMessage: `Skipped map catalog sync for ZIP ${input.zipCode}: ${locationResult.error}`,
      publixMessage: "",
    };
  }

  const discovery = await discoverFoodRetailStoresNearLocation({
    latitude: locationResult.location.latitude,
    longitude: locationResult.location.longitude,
    radiusMiles,
    zipCode: input.zipCode,
    useFixture: input.useFixture,
  });

  const osmStores = discovery.stores.map(buildOsmCatalogStore);
  const osmUpserted = await upsertCatalogStores(osmStores, {
    preserveRankedSources: true,
  });

  let rankedUpserted = 0;
  let publixUpserted = 0;
  let publixMessage = "";
  if (!input.useFixture) {
    const providerStoreSearches = await searchOfficialProviderStores({
      location: locationResult.location,
      radiusMiles,
      readMode: "live-allowed",
    });
    rankedUpserted = await syncV1ChainStoresToCatalog({
      location: locationResult.location,
      zipCode: input.zipCode,
      providerStoreSearches,
      osmFoodRetailStores: discovery.stores,
    });

    const { syncPublixContextStoresForZip } = await import("@/lib/publix-catalog-sync");
    const publixResult = await syncPublixContextStoresForZip({
      zipCode: input.zipCode,
      bootstrapStoreId: "publix-atlee",
    });
    publixUpserted = publixResult.upserted;
    publixMessage = publixResult.message;
  }

  return {
    osmUpserted,
    rankedUpserted,
    publixUpserted,
    osmMessage: discovery.message,
    publixMessage,
  };
}
