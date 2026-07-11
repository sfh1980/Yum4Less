import { getDbPool } from "@/lib/db";
import { geocodeStreetAddress } from "@/lib/geocoding";
import { findNearestOsmAldiStore } from "@/lib/aldi-location-discovery";
import { USDA_SNAP_CONTEXT_SOURCE } from "@/lib/map-context-types";
import { PUBLIX_STORE_LOCATOR_SOURCE } from "@/lib/publix-catalog-sync";
import { logServerError } from "@/lib/server-log";
import {
  accumulateAliasWriteStats,
  deleteStoreIdentityAttachmentsForStore,
  emptyAliasWriteStats,
  ensureCatalogStoreIdentityAliases,
  type StoreIdentityAliasWriteStats,
} from "@/lib/store-identity-ingest-aliases";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { ProviderDiscoveredStore } from "@/lib/providers/provider-types";
import { findSnapLocationWitnessForStore } from "@/lib/snap-retailer-locations";
import {
  buildProviderLocationWitness,
  reconcileRankedStoreCoordinates,
  type LocationWitness,
} from "@/lib/store-location-reconciliation";
import {
  isMapContextLikeCatalogStore,
  resolveCollocatedCatalogUpsertTarget,
  resolveSelectableCatalogChain,
  type CollocatedCatalogStoreLike,
} from "@/lib/catalog-store-colocated-identity";
import { getDistanceMiles } from "@/lib/geo-distance";
import {
  findProximityLinkedKrogerStore,
  isApiDerivedKrogerCatalogStoreId,
  KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
  preferKrogerCanonicalStoreId,
} from "@/lib/kroger-catalog-canonical";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
  isSyntheticFixtureOsmNumericId,
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
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

export { isApiDerivedKrogerCatalogStoreId } from "@/lib/kroger-catalog-canonical";

/** @deprecated Slug ids are legacy CI bootstrap only; production catalog is ingest-backed. */
export function isBootstrapSeedStoreRow(store: {
  id: string;
  source_name?: string | null;
}) {
  if (store.source_name === INTERNAL_CATALOG_SOURCE) {
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
  getRolloutForStore: (store: { id: string; name: string; source_name?: string | null }) => {
    chain: StoreChain;
  };
  mergeRadiusMiles?: number;
}): string | undefined {
  const linkedStores = input.existingStores.filter(
    (store) =>
      store.id !== input.catalogStoreId &&
      store.source_store_id === input.discovered.providerStoreId &&
      input.getRolloutForStore(store).chain === input.chain,
  );

  if (linkedStores.length === 0) {
    if (input.chain !== "kroger") {
      return undefined;
    }

    const proximityMatch = findProximityLinkedKrogerStore(
      input.existingStores,
      {
        catalogStoreId: input.catalogStoreId,
        latitude: input.discovered.latitude,
        longitude: input.discovered.longitude,
        source_store_id: input.discovered.providerStoreId,
      },
      input.mergeRadiusMiles ?? KROGER_SAME_STORE_MERGE_PROXIMITY_MILES,
    );

    if (!proximityMatch) {
      return undefined;
    }

    const survivor = preferKrogerCanonicalStoreId(
      {
        id: input.catalogStoreId,
        source_name: KROGER_CATALOG_SOURCE,
        source_store_id: input.discovered.providerStoreId,
      },
      proximityMatch,
    );

    // Incoming API row wins — upsert separately; slug reconciled after catalog sync.
    if (survivor !== proximityMatch.id) {
      return undefined;
    }

    return proximityMatch.id;
  }

  return findPrimaryStoreIdForChain(
    linkedStores,
    input.chain,
    input.getRolloutForStore,
  );
}

async function mergeApiDiscoveredStoreIntoCanonical(input: {
  canonicalStoreId: string;
  duplicateStoreId: string;
  catalog: CatalogStoreRecord;
  providerStore?: ProviderDiscoveredStore;
  aliasStats?: StoreIdentityAliasWriteStats;
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
    // Self-alias identities RESTRICT store deletes — drop singleton attachments first.
    await deleteStoreIdentityAttachmentsForStore(input.duplicateStoreId, pool);
    await pool.query(`delete from stores where id = $1`, [input.duplicateStoreId]);
  }

  return updateIngestedRankedStoreCoordinates(
    input.canonicalStoreId,
    input.catalog,
    input.providerStore,
    input.aliasStats,
  );
}

const KROGER_CATALOG_SOURCE = "kroger-official-api";
const ALDI_CATALOG_SOURCE = "yum4less-market-catalog";
const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";

/** @deprecated Proximity merge into bootstrap slugs removed; kept for test imports. */
export const BOOTSTRAP_STORE_MERGE_RADIUS_MILES = 0.1;

export const MAP_CONTEXT_CATALOG_SOURCES = new Set<string>([
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
  USDA_SNAP_CONTEXT_SOURCE,
  PUBLIX_STORE_LOCATOR_SOURCE,
]);

export const RANKED_CATALOG_SOURCES = new Set<string>([
  KROGER_CATALOG_SOURCE,
  ALDI_CATALOG_SOURCE,
]);

/** Weekly-ad ingest may set source_name before map-catalog runs. */
export function isIngestCoordinateRefreshEligible(
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

/** @deprecated Renamed to {@link isIngestCoordinateRefreshEligible}. */
export const isBootstrapCoordinateRefreshEligible = isIngestCoordinateRefreshEligible;

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
 * Build ranked Aldi catalog coords from live OSM only.
 * Fixture / synthetic osmIds must never become aldi-{zip} source_store_id truth.
 */
export function buildAldiCatalogStoreForMarket(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  osmAldiStore?: OsmDiscoveredFoodRetailStore;
}): CatalogStoreRecord | null {
  if (!input.osmAldiStore) {
    return null;
  }

  if (isSyntheticFixtureOsmNumericId(input.osmAldiStore.osmId)) {
    return null;
  }

  const zipKey = (input.zipCode ?? input.location.zipCode ?? "market")
    .trim()
    .replace(/[^\d]/g, "")
    .slice(0, 5);
  const storeKey = zipKey.length === 5 ? zipKey : "market";

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

export function buildOsmCatalogStore(
  discovered: OsmDiscoveredFoodRetailStore,
  options?: { fixture?: boolean },
): CatalogStoreRecord {
  const fixture =
    options?.fixture === true || isSyntheticFixtureOsmNumericId(discovered.osmId);
  const id = buildOsmCatalogStoreId(discovered, { fixture });

  return {
    id,
    name: discovered.name,
    kind: discovered.kind,
    city: discovered.city,
    state: discovered.state,
    latitude: discovered.latitude,
    longitude: discovered.longitude,
    sourceName: fixture ? OSM_MAP_FIXTURE_SOURCE : OSM_MAP_CATALOG_SOURCE,
    sourceStoreId: id,
  };
}

export async function upsertCatalogStores(
  stores: CatalogStoreRecord[],
  options?: {
    preserveRankedSources?: boolean;
    aliasStats?: StoreIdentityAliasWriteStats;
  },
): Promise<number> {
  if (stores.length === 0) {
    return 0;
  }

  try {
    const pool = getDbPool();
    let upserted = 0;
    const preserveRankedSources = options?.preserveRankedSources ?? false;
    const rankedSources = [...RANKED_CATALOG_SOURCES];
    const aliasStats = options?.aliasStats ?? emptyAliasWriteStats();

    const existingResult = await pool.query<{
      id: string;
      name: string;
      source_name: string | null;
      source_store_id: string | null;
      latitude: string;
      longitude: string;
    }>(`
      select id, name, source_name, source_store_id, latitude, longitude
      from stores
    `);
    const existingCollocated: CollocatedCatalogStoreLike[] = existingResult.rows.map(
      (row) => ({
        id: row.id,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        sourceName: row.source_name,
        sourceStoreId: row.source_store_id,
      }),
    );

    for (const store of stores) {
      const candidate: CollocatedCatalogStoreLike = {
        id: store.id,
        name: store.name,
        latitude: store.latitude,
        longitude: store.longitude,
        sourceName: store.sourceName,
        sourceStoreId: store.sourceStoreId,
      };

      let writeId = store.id;
      const candidateChain = resolveSelectableCatalogChain(candidate);
      // Kroger keeps dedicated findCanonical / proximity-reconcile paths that may
      // retain distinct slug vs API rows (different source_store_id). Do not
      // silently collapse those at generic upsert time.
      if (
        candidateChain &&
        candidateChain !== "kroger" &&
        !isMapContextLikeCatalogStore(candidate)
      ) {
        const target = resolveCollocatedCatalogUpsertTarget(
          candidate,
          existingCollocated,
        );
        writeId = target.storeId;
      }

      const existingRow = existingCollocated.find((row) => row.id === writeId);
      const existingSource = existingRow?.sourceName ?? null;
      const preserveSourceName =
        writeId !== store.id &&
        store.sourceName === ALDI_CATALOG_SOURCE &&
        (Boolean(existingSource?.endsWith("-weekly-ad-scrape")) ||
          existingSource === INTERNAL_CATALOG_SOURCE);
      const writeSourceName = preserveSourceName
        ? existingSource!
        : store.sourceName;

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
                or strpos(stores.source_name, '-weekly-ad-scrape') > 0
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
              writeId,
              store.name,
              store.kind,
              store.city,
              store.state,
              store.latitude,
              store.longitude,
              writeSourceName,
              store.sourceStoreId,
              rankedSources,
            ]
          : [
              writeId,
              store.name,
              store.kind,
              store.city,
              store.state,
              store.latitude,
              store.longitude,
              writeSourceName,
              store.sourceStoreId,
            ],
      );
      upserted += result.rowCount ?? 0;

      // Keep in-memory collocated snapshot current for subsequent inserts in this batch.
      const snapshotIndex = existingCollocated.findIndex((row) => row.id === writeId);
      const snapshotRow: CollocatedCatalogStoreLike = {
        id: writeId,
        name: store.name,
        latitude: store.latitude,
        longitude: store.longitude,
        sourceName: writeSourceName,
        sourceStoreId: store.sourceStoreId,
      };
      if (snapshotIndex >= 0) {
        existingCollocated[snapshotIndex] = snapshotRow;
      } else {
        existingCollocated.push(snapshotRow);
      }

      // Slice 5c: self-alias (+ allowlisted Aldi→OSM pointer). Uses writeId after
      // collocated redirect so Mechanicsville slug gets the alias, not aldi-{zip}.
      accumulateAliasWriteStats(
        aliasStats,
        await ensureCatalogStoreIdentityAliases(
          {
            storeId: writeId,
            sourceName: writeSourceName,
            sourceStoreId: store.sourceStoreId,
            name: store.name,
            kind: store.kind,
            city: store.city,
            state: store.state,
            latitude: store.latitude,
            longitude: store.longitude,
          },
          pool,
          { logSummary: false },
        ),
      );
    }

    if (
      !options?.aliasStats &&
      (aliasStats.aliasesEnsured > 0 ||
        aliasStats.aliasesSkipped > 0 ||
        aliasStats.aliasConflicts > 0)
    ) {
      console.log(
        JSON.stringify({
          level: "info",
          scope: "store-identity.ingest-alias-summary",
          ...aliasStats,
          path: "upsertCatalogStores",
          at: new Date().toISOString(),
        }),
      );
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
  const { getProviderRolloutForCatalogStore } = await import("@/lib/provider-rollout");
  const pool = getDbPool();
  const aliasStats = emptyAliasWriteStats();
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
        getRolloutForStore: getProviderRolloutForCatalogStore,
      });

      if (canonicalStoreId && canonicalStoreId !== catalogStore.id) {
        mergedCount += await mergeApiDiscoveredStoreIntoCanonical({
          canonicalStoreId,
          duplicateStoreId: catalogStore.id,
          catalog: catalogStore,
          providerStore: discovered,
          aliasStats,
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

  const osmAldiStore = input.osmFoodRetailStores
    ? findNearestOsmAldiStore(input.osmFoodRetailStores, input.location)
    : undefined;

  const aldiCatalog = buildAldiCatalogStoreForMarket({
    location: input.location,
    zipCode: input.zipCode ?? input.location.zipCode,
    osmAldiStore,
  });
  if (aldiCatalog) {
    const existingCollocated = existingStores.map((store) =>
      existingCatalogRowToCollocatedLike(store),
    );
    const target = resolveCollocatedCatalogUpsertTarget(
      {
        id: aldiCatalog.id,
        name: aldiCatalog.name,
        chain: "aldi",
        latitude: aldiCatalog.latitude,
        longitude: aldiCatalog.longitude,
        sourceName: aldiCatalog.sourceName,
        sourceStoreId: aldiCatalog.sourceStoreId,
      },
      existingCollocated,
    );

    if (target.shouldCreateCandidateId) {
      catalogStores.push(aldiCatalog);
    } else {
      // Prefer existing slug/API twin: refresh its coordinates, do not upsert aldi-{zip}.
      // Slice 5c: alias ensure runs inside updateIngestedRankedStoreCoordinates.
      mergedCount += await updateIngestedRankedStoreCoordinates(
        target.storeId,
        {
          ...aldiCatalog,
          id: target.storeId,
        },
        undefined,
        aliasStats,
      );
    }
  }

  const uniqueById = new Map(catalogStores.map((store) => [store.id, store]));
  const providerUpserted = await upsertCatalogStores([...uniqueById.values()], {
    aliasStats,
  });
  const refreshed = await refreshIngestedRankedStoreCoordinates({
    ...input,
    osmFoodRetailStores: input.osmFoodRetailStores,
    existingStores: existingResult.rows,
    aliasStats,
  });
  const reconciledCount = await reconcileDuplicateApiDerivedKrogerStores();
  const proximityReconciledCount = await reconcileProximityDuplicateKrogerSlugStores();

  if (
    aliasStats.aliasesEnsured > 0 ||
    aliasStats.aliasesSkipped > 0 ||
    aliasStats.aliasConflicts > 0
  ) {
    console.log(
      JSON.stringify({
        level: "info",
        scope: "store-identity.ingest-alias-summary",
        ...aliasStats,
        path: "syncV1ChainStoresToCatalog",
        at: new Date().toISOString(),
      }),
    );
  }

  return providerUpserted + mergedCount + refreshed + reconciledCount + proximityReconciledCount;
}

function existingCatalogRowToCollocatedLike(
  store: ExistingCatalogStoreRow,
): CollocatedCatalogStoreLike {
  return {
    id: store.id,
    name: store.name,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceName: store.source_name,
    sourceStoreId: store.source_store_id,
  };
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

async function reconcileDuplicateApiDerivedKrogerStores(): Promise<number> {
  const { getProviderRolloutForCatalogStore } = await import("@/lib/provider-rollout");
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

    if (getProviderRolloutForCatalogStore(store).chain !== "kroger") {
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
      getRolloutForStore: getProviderRolloutForCatalogStore,
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

async function reconcileProximityDuplicateKrogerSlugStores(): Promise<number> {
  const { getProviderRolloutForCatalogStore } = await import("@/lib/provider-rollout");
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
  const mergedDuplicateIds = new Set<string>();

  for (const store of existingStores) {
    if (!isApiDerivedKrogerCatalogStoreId(store.id)) {
      continue;
    }

    if (getProviderRolloutForCatalogStore(store).chain !== "kroger") {
      continue;
    }

    const slugMatches = existingStores.filter((candidate) => {
      if (candidate.id === store.id || mergedDuplicateIds.has(candidate.id)) {
        return false;
      }

      if (isApiDerivedKrogerCatalogStoreId(candidate.id)) {
        return false;
      }

      if (getProviderRolloutForCatalogStore(candidate).chain !== "kroger") {
        return false;
      }

      // Legacy bootstrap slugs (e.g. source_store_id=kroger-mechanicsville) stay
      // separate from numeric API rows (source_store_id=02900529) even when nearby.
      if (
        candidate.source_store_id &&
        store.source_store_id &&
        candidate.source_store_id !== store.source_store_id
      ) {
        return false;
      }

      return (
        getDistanceMiles(
          store.latitude,
          store.longitude,
          candidate.latitude,
          candidate.longitude,
        ) <= KROGER_SAME_STORE_MERGE_PROXIMITY_MILES
      );
    });

    for (const duplicate of slugMatches) {
      reconciledCount += await mergeApiDiscoveredStoreIntoCanonical({
        canonicalStoreId: store.id,
        duplicateStoreId: duplicate.id,
        catalog: {
          id: store.id,
          name: store.name,
          kind: "grocery",
          city: store.city,
          state: store.state,
          latitude: store.latitude,
          longitude: store.longitude,
          sourceName: store.source_name ?? KROGER_CATALOG_SOURCE,
          sourceStoreId: store.source_store_id ?? "",
        },
      });
      mergedDuplicateIds.add(duplicate.id);
      applyCanonicalStoreMergeToSnapshot(existingStores, {
        canonicalStoreId: store.id,
        duplicateStoreId: duplicate.id,
        catalog: {
          id: store.id,
          name: store.name,
          kind: "grocery",
          city: store.city,
          state: store.state,
          latitude: store.latitude,
          longitude: store.longitude,
          sourceName: store.source_name ?? KROGER_CATALOG_SOURCE,
          sourceStoreId: store.source_store_id ?? "",
        },
      });
    }
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

export async function refreshIngestedRankedStoreCoordinates(input: {
  location: ResolvedSearchLocation;
  zipCode?: string;
  providerStoreSearches: ProviderStoreSearchResult[];
  osmFoodRetailStores?: OsmDiscoveredFoodRetailStore[];
  existingStores?: { id: string; name: string; source_name?: string | null; source_store_id?: string | null }[];
  aliasStats?: StoreIdentityAliasWriteStats;
}): Promise<number> {
  const { getProviderRolloutForCatalogStore } = await import("@/lib/provider-rollout");
  const existing =
    input.existingStores ??
    (
      await getDbPool().query<{
        id: string;
        name: string;
        source_name: string | null;
        source_store_id: string | null;
      }>(`select id, name, source_name, source_store_id from stores`)
    ).rows;

  let updated = 0;

  const krogerSearch = input.providerStoreSearches.find(
    (search) => search.provider === "kroger" && search.stores.length > 0,
  );
  if (krogerSearch) {
    for (const discovered of krogerSearch.stores) {
      const catalog = buildKrogerCatalogStore(discovered);
      const linkedStore = existing.find(
        (store) =>
          getProviderRolloutForCatalogStore(store).chain === "kroger" &&
          store.source_store_id === discovered.providerStoreId,
      );
      const storeId = linkedStore?.id ?? catalog.id;
      updated += await updateIngestedRankedStoreCoordinates(
        storeId,
        catalog,
        discovered,
        input.aliasStats,
      );
    }
  }

  const aldiZip = (input.zipCode ?? input.location.zipCode ?? "").trim();
  const osmAldiStore = input.osmFoodRetailStores
    ? findNearestOsmAldiStore(input.osmFoodRetailStores, input.location)
    : undefined;
  const aldiCatalog =
    aldiZip.length === 5
      ? buildAldiCatalogStoreForMarket({
          location: input.location,
          zipCode: aldiZip,
          osmAldiStore,
        })
      : null;

  if (aldiCatalog) {
    const aldiRows = await getDbPool().query<{
      id: string;
      name: string;
      source_name: string | null;
      source_store_id: string | null;
      latitude: string;
      longitude: string;
    }>(`
      select id, name, source_name, source_store_id, latitude, longitude
      from stores
      where id like 'aldi-%'
         or source_name = 'yum4less-market-catalog'
         or source_name = 'aldi-weekly-ad-scrape'
         or source_name = 'yum4less-internal-catalog'
    `);

    const existingAldi = aldiRows.rows
      .filter((row) => getProviderRolloutForCatalogStore(row).chain === "aldi")
      .map((row) => ({
        id: row.id,
        name: row.name,
        chain: "aldi" as const,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        sourceName: row.source_name,
        sourceStoreId: row.source_store_id,
      }));

    const target = resolveCollocatedCatalogUpsertTarget(
      {
        id: aldiCatalog.id,
        name: aldiCatalog.name,
        chain: "aldi",
        latitude: aldiCatalog.latitude,
        longitude: aldiCatalog.longitude,
        sourceName: aldiCatalog.sourceName,
        sourceStoreId: aldiCatalog.sourceStoreId,
      },
      existingAldi,
    );

    updated += await updateIngestedRankedStoreCoordinates(
      target.storeId,
      {
        ...aldiCatalog,
        id: target.storeId,
      },
      undefined,
      input.aliasStats,
    );
  }

  return updated;
}

/** @deprecated Renamed to {@link refreshIngestedRankedStoreCoordinates}. */
export const refreshBootstrapRankedStoreCoordinates = refreshIngestedRankedStoreCoordinates;

export function findPrimaryStoreIdForChain(
  stores: { id: string; name: string; source_name?: string | null }[],
  chain: StoreChain,
  getRolloutForStore: (store: { id: string; name: string; source_name?: string | null }) => {
    chain: StoreChain;
  },
): string | undefined {
  const matches = stores.filter(
    (store) => getRolloutForStore(store).chain === chain,
  );
  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    return matches[0]!.id;
  }

  const rankedPreference = matches.filter(
    (store) =>
      store.source_name === KROGER_CATALOG_SOURCE ||
      store.source_name === ALDI_CATALOG_SOURCE ||
      store.source_name?.endsWith("-weekly-ad-scrape"),
  );
  if (rankedPreference.length > 0) {
    return rankedPreference
      .slice()
      .sort((left, right) => left.id.length - right.id.length)[0]?.id;
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

async function updateIngestedRankedStoreCoordinates(
  storeId: string,
  catalog: CatalogStoreRecord,
  providerStore?: ProviderDiscoveredStore,
  aliasStats?: StoreIdentityAliasWriteStats,
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

    // Prefer OSM/market coords on collocated slug redirects, but do not clobber
    // weekly-ad / internal provenance when market-catalog is the weaker writer.
    // Official Kroger API refresh must still be allowed to overwrite weekly-ad.
    const existingSource = currentRow?.source_name ?? null;
    const preserveSourceName =
      catalog.sourceName === ALDI_CATALOG_SOURCE &&
      (Boolean(existingSource?.endsWith("-weekly-ad-scrape")) ||
        existingSource === INTERNAL_CATALOG_SOURCE);
    const writeSourceName = preserveSourceName
      ? existingSource!
      : catalog.sourceName;

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
            or (
              source_store_id is not null
              and source_store_id = $5
              and length(trim($5)) > 0
            )
          )
      `,
      [
        storeId,
        latitude,
        longitude,
        writeSourceName,
        catalog.sourceStoreId,
        catalog.name,
        catalog.city,
        catalog.state,
        rankedSources,
      ],
    );

    // Slice 5c: always ensure aliases after Aldi/Kroger refresh attempts so the
    // Mechanicsville collocated path (no upsertCatalogStores) still writes
    // self-alias + allowlisted OSM pointer when source_store_id is set.
    const ensured = await ensureCatalogStoreIdentityAliases(
      {
        storeId,
        sourceName: writeSourceName,
        sourceStoreId: catalog.sourceStoreId,
        name: catalog.name,
        kind: catalog.kind,
        city: catalog.city,
        state: catalog.state,
        latitude,
        longitude,
      },
      pool,
      { logSummary: false },
    );
    if (aliasStats) {
      accumulateAliasWriteStats(aliasStats, ensured);
    } else if (
      ensured.aliasesEnsured > 0 ||
      ensured.aliasesSkipped > 0 ||
      ensured.aliasConflicts > 0
    ) {
      console.log(
        JSON.stringify({
          level: "info",
          scope: "store-identity.ingest-alias-summary",
          ...ensured,
          path: "updateIngestedRankedStoreCoordinates",
          storeId,
          at: new Date().toISOString(),
        }),
      );
    }

    return result.rowCount ?? 0;
  } catch (error) {
    logServerError("store-catalog-sync-ingest-refresh", error);
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

  const useFixtureIdentity =
    input.useFixture === true || discovery.source === "fixture";
  const osmStores = discovery.stores.map((store) =>
    buildOsmCatalogStore(store, { fixture: useFixtureIdentity }),
  );
  if (useFixtureIdentity) {
    const { enforceFixtureOsmCatalogWrites } = await import(
      "@/lib/fixture-ingest-policy"
    );
    enforceFixtureOsmCatalogWrites(osmStores, process.env, { force: true });
  }
  const osmUpserted = await upsertCatalogStores(osmStores, {
    preserveRankedSources: true,
  });

  let rankedUpserted = 0;
  let publixUpserted = 0;
  let publixMessage = "";
  // Fixture map-catalog rehearsals upsert labeled fixture OSM only — never
  // refresh ranked Aldi/Kroger coords from synthetic Overpass stand-ins.
  if (!useFixtureIdentity) {
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
