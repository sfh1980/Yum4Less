import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
  OSM_MAP_CATALOG_SOURCE,
  type OsmDiscoveredFoodRetailStore,
} from "@/lib/osm-food-retail-discovery";
import type { ProviderDiscoveredStore, ProviderStoreSearchResult } from "@/lib/providers/provider-types";
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

const KROGER_CATALOG_SOURCE = "kroger-official-api";
const ALDI_CATALOG_SOURCE = "yum4less-market-catalog";
const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";
const INTERNAL_BOOTSTRAP_SOURCE = INTERNAL_CATALOG_SOURCE;

export const MAP_CONTEXT_CATALOG_SOURCES = new Set<string>([OSM_MAP_CATALOG_SOURCE]);

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

export function buildAldiCatalogStoreForMarket(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
}): CatalogStoreRecord {
  const zipKey = (input.zipCode ?? input.location.zipCode ?? "market")
    .trim()
    .replace(/[^\d]/g, "")
    .slice(0, 5);
  const storeKey = zipKey.length === 5 ? zipKey : "market";

  return {
    id: `aldi-${storeKey}`,
    name: "Aldi",
    kind: "grocery",
    city: input.location.city,
    state: input.location.state,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
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
}): Promise<number> {
  const { getProviderRolloutForStore } = await import("@/lib/provider-rollout");
  const pool = getDbPool();
  const existing = await pool.query<{
    id: string;
    name: string;
    source_name: string | null;
  }>(`select id, name, source_name from stores`);

  const catalogStores: CatalogStoreRecord[] = [];

  for (const search of input.providerStoreSearches) {
    if (search.provider !== "kroger" || search.stores.length === 0) {
      continue;
    }

    const bootstrapKrogerId = findPrimaryStoreIdForChain(
      existing.rows,
      "kroger",
      getProviderRolloutForStore,
    );
    if (bootstrapKrogerId) {
      continue;
    }

    for (const discovered of search.stores) {
      catalogStores.push(buildKrogerCatalogStore(discovered));
    }
  }

  const aldiBootstrapId = findPrimaryStoreIdForChain(
    existing.rows,
    "aldi",
    getProviderRolloutForStore,
  );
  if (!aldiBootstrapId) {
    catalogStores.push(
      buildAldiCatalogStoreForMarket({
        location: input.location,
        zipCode: input.zipCode ?? input.location.zipCode,
      }),
    );
  }

  const uniqueById = new Map(catalogStores.map((store) => [store.id, store]));
  const providerUpserted = await upsertCatalogStores([...uniqueById.values()]);
  const bootstrapRefreshed = await refreshBootstrapRankedStoreCoordinates({
    ...input,
    existingStores: existing.rows,
  });

  return providerUpserted + bootstrapRefreshed;
}

export async function refreshBootstrapRankedStoreCoordinates(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  providerStoreSearches: ProviderStoreSearchResult[];
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
      );
    }
  }

  const aldiBootstrapId = findPrimaryStoreIdForChain(
    existing,
    "aldi",
    getProviderRolloutForStore,
  );
  if (aldiBootstrapId) {
    const aldiCatalog = buildAldiCatalogStoreForMarket({
      location: input.location,
      zipCode: input.zipCode ?? input.location.zipCode,
    });
    updated += await updateRankedBootstrapStoreCoordinates(
      aldiBootstrapId,
      aldiCatalog,
    );
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

async function updateRankedBootstrapStoreCoordinates(
  storeId: string,
  catalog: CatalogStoreRecord,
): Promise<number> {
  try {
    const pool = getDbPool();
    const rankedSources = [...RANKED_CATALOG_SOURCES];
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
        catalog.latitude,
        catalog.longitude,
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

export function getDistanceMiles(
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
  osmMessage: string;
}> {
  const { resolveLocationInput } = await import("@/lib/location-resolution");
  const radiusMiles = input.radiusMiles ?? Number(process.env.YUM4LESS_MAP_CATALOG_RADIUS_MILES ?? 12);
  const locationResult = await resolveLocationInput({ zipCode: input.zipCode });

  if (!locationResult.ok) {
    return {
      osmUpserted: 0,
      rankedUpserted: 0,
      osmMessage: `Skipped map catalog sync for ZIP ${input.zipCode}: ${locationResult.error}`,
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
    });
  }

  return {
    osmUpserted,
    rankedUpserted,
    osmMessage: discovery.message,
  };
}
