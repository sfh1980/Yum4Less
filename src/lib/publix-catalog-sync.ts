import { getDbPool } from "@/lib/db";
import { getDistanceMiles } from "@/lib/geo-distance";
import { MAP_OSM_DEDUPE_PROXIMITY_MILES } from "@/lib/market-store-catalog-merge";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import { logServerError } from "@/lib/server-log";
import {
  createPublixServicesApiClient,
  parsePublixStoreNumber,
} from "@/lib/providers/publix/publix-services-api-client";
import type { PublixStoreRecord } from "@/lib/providers/publix/publix-services-api-types";
import type { CatalogStoreRecord } from "@/lib/store-catalog-sync";
import { upsertCatalogStores } from "@/lib/store-catalog-sync";

export const PUBLIX_STORE_LOCATOR_SOURCE = "publix-store-locator";

/** Legacy bootstrap slug — no storefront at Atlee Rd; retired 2026-07-05. */
export const RETIRED_PUBLIX_BOOTSTRAP_STORE_ID = "publix-atlee";

/** Brandy Creek Commons — verified via Publix store locator for Mechanicsville CI anchor. */
export const PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_NUMBER = 1626;

export const PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID = buildPublixCatalogStoreId(
  PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_NUMBER,
);

type StoreCoordinateRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export function buildPublixCatalogStoreId(storeNumber: number): string {
  return `publix-${storeNumber}`;
}

export function buildPublixCatalogStoreFromLocator(
  record: PublixStoreRecord,
): CatalogStoreRecord | undefined {
  const storeNumber = parsePublixStoreNumber(record.KEY);
  const latitude = Number(record.CLAT);
  const longitude = Number(record.CLON);
  const name = record.NAME?.trim();
  const city = record.CITY?.trim();
  const state = record.STATE?.trim();

  if (
    !storeNumber ||
    !name ||
    !city ||
    !state ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return undefined;
  }

  return {
    id: buildPublixCatalogStoreId(storeNumber),
    name,
    kind: "grocery",
    city,
    state,
    latitude,
    longitude,
    sourceName: PUBLIX_STORE_LOCATOR_SOURCE,
    sourceStoreId: String(storeNumber),
  };
}

async function migratePriceObservationsAndRetireStore(
  fromStoreId: string,
  toStoreId: string,
): Promise<{ migratedPrices: number; deletedStore: boolean }> {
  if (fromStoreId === toStoreId) {
    return { migratedPrices: 0, deletedStore: false };
  }

  const pool = getDbPool();

  const retiredExists = await pool.query<{ exists: boolean }>(
    `select exists(select 1 from stores where id = $1) as exists`,
    [fromStoreId],
  );
  if (!retiredExists.rows[0]?.exists) {
    return { migratedPrices: 0, deletedStore: false };
  }

  await pool.query(
    `
      delete from price_observations target
      using price_observations source
      where source.store_id = $1
        and target.store_id = $2
        and target.ingredient_id = source.ingredient_id
    `,
    [fromStoreId, toStoreId],
  );

  const migrated = await pool.query(
    `
      update price_observations
      set store_id = $2
      where store_id = $1
    `,
    [fromStoreId, toStoreId],
  );

  const deleted = await pool.query(`delete from stores where id = $1`, [fromStoreId]);

  return {
    migratedPrices: migrated.rowCount ?? 0,
    deletedStore: (deleted.rowCount ?? 0) > 0,
  };
}

export async function retirePublixAtleeBootstrapStore(
  canonicalStoreId: string,
): Promise<{ migratedPrices: number; deletedStore: boolean }> {
  if (canonicalStoreId === RETIRED_PUBLIX_BOOTSTRAP_STORE_ID) {
    return { migratedPrices: 0, deletedStore: false };
  }

  try {
    return await migratePriceObservationsAndRetireStore(
      RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
      canonicalStoreId,
    );
  } catch (error) {
    logServerError("publix-retire-atlee-bootstrap", error);
    return { migratedPrices: 0, deletedStore: false };
  }
}

export async function retireDuplicateOsmPublixNearLocatorStores(): Promise<{
  migratedPrices: number;
  deletedStoreIds: string[];
}> {
  try {
    const pool = getDbPool();

    const locators = await pool.query<StoreCoordinateRow>(
      `
        select id, name, latitude, longitude
        from stores
        where source_name = $1
      `,
      [PUBLIX_STORE_LOCATOR_SOURCE],
    );

    if (locators.rowCount === 0) {
      return { migratedPrices: 0, deletedStoreIds: [] };
    }

    const osmStores = await pool.query<StoreCoordinateRow>(
      `
        select id, name, latitude, longitude
        from stores
        where id like 'osm-%'
      `,
    );

    const osmToLocator = new Map<string, string>();

    for (const osm of osmStores.rows) {
      if (getProviderRolloutForStore(osm.name).chain !== "publix") {
        continue;
      }

      let nearestLocator: StoreCoordinateRow | undefined;
      let nearestDistanceMiles = Number.POSITIVE_INFINITY;

      for (const locator of locators.rows) {
        const distanceMiles = getDistanceMiles(
          osm.latitude,
          osm.longitude,
          locator.latitude,
          locator.longitude,
        );

        if (
          distanceMiles <= MAP_OSM_DEDUPE_PROXIMITY_MILES &&
          distanceMiles < nearestDistanceMiles
        ) {
          nearestDistanceMiles = distanceMiles;
          nearestLocator = locator;
        }
      }

      if (nearestLocator) {
        osmToLocator.set(osm.id, nearestLocator.id);
      }
    }

    let migratedPrices = 0;
    const deletedStoreIds: string[] = [];

    for (const [osmStoreId, locatorStoreId] of osmToLocator) {
      const result = await migratePriceObservationsAndRetireStore(osmStoreId, locatorStoreId);
      migratedPrices += result.migratedPrices;
      if (result.deletedStore) {
        deletedStoreIds.push(osmStoreId);
      }
    }

    return { migratedPrices, deletedStoreIds };
  } catch (error) {
    logServerError("publix-retire-duplicate-osm-near-locator", error);
    return { migratedPrices: 0, deletedStoreIds: [] };
  }
}

export async function syncPublixContextStoresForZip(input: {
  zipCode: string;
}): Promise<{
  upserted: number;
  message: string;
  retiredAtlee: boolean;
  retiredOsmDuplicates: number;
}> {
  try {
    const client = createPublixServicesApiClient();
    const stores = await client.searchStoresByZip({
      zipCode: input.zipCode,
      count: 10,
    });

    const catalogStores = stores
      .map(buildPublixCatalogStoreFromLocator)
      .filter((store): store is CatalogStoreRecord => store !== undefined);

    if (catalogStores.length === 0) {
      return {
        upserted: 0,
        message: `Publix store locator returned no mappable stores for ZIP ${input.zipCode}.`,
        retiredAtlee: false,
        retiredOsmDuplicates: 0,
      };
    }

    const upserted = await upsertCatalogStores(catalogStores, {
      preserveRankedSources: true,
    });

    const nearestStore = catalogStores[0]!;
    const retirement = await retirePublixAtleeBootstrapStore(nearestStore.id);
    const osmRetirement = await retireDuplicateOsmPublixNearLocatorStores();

    return {
      upserted,
      message: `Publix store locator mapped ${catalogStores.length} context store(s) for ZIP ${input.zipCode}.`,
      retiredAtlee: retirement.deletedStore,
      retiredOsmDuplicates: osmRetirement.deletedStoreIds.length,
    };
  } catch (error) {
    logServerError("publix-catalog-sync", error);
    return {
      upserted: 0,
      message:
        error instanceof Error
          ? `Publix store locator sync failed: ${error.message}`
          : "Publix store locator sync failed unexpectedly.",
      retiredAtlee: false,
      retiredOsmDuplicates: 0,
    };
  }
}
