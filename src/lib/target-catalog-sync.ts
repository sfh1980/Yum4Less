import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import type { CatalogStoreRecord } from "@/lib/store-catalog-sync";
import { upsertCatalogStores } from "@/lib/store-catalog-sync";
import {
  buildTargetCatalogStoreId,
  type TargetLocatorStore,
} from "@/lib/weekly-ad-ingestion/target-weekly-ad-store";

export const TARGET_STORE_LOCATOR_SOURCE = "target-store-locator";

export function buildTargetCatalogStoreFromLocator(
  store: TargetLocatorStore,
): CatalogStoreRecord | undefined {
  if (
    !store.latitude ||
    !store.longitude ||
    !Number.isFinite(store.latitude) ||
    !Number.isFinite(store.longitude)
  ) {
    return undefined;
  }

  return {
    id: buildTargetCatalogStoreId(store.storeId),
    name: `Target ${store.locationName}`.replace(/\s+/g, " ").trim(),
    kind: "big-box",
    city: store.city,
    state: store.state.length === 2 ? store.state.toUpperCase() : store.state,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceName: TARGET_STORE_LOCATOR_SOURCE,
    sourceStoreId: store.storeId,
  };
}

/**
 * Persist retailer store id onto the weekly-ad ingest pin and upsert a
 * `target-{id}` catalog row when the locator returned coordinates.
 */
export async function persistTargetSourceStoreBinding(input: {
  catalogStoreId: string;
  locatorStore: TargetLocatorStore;
}): Promise<{ updatedPin: boolean; upsertedCatalog: boolean }> {
  let updatedPin = false;
  let upsertedCatalog = false;

  try {
    const pool = getDbPool();
    const update = await pool.query(
      `
        update stores
        set source_store_id = $1,
            last_verified_at = now()
        where id = $2
          and (
            source_store_id is null
            or source_store_id = ''
            or source_store_id = $1
          )
      `,
      [input.locatorStore.storeId, input.catalogStoreId],
    );
    updatedPin = (update.rowCount ?? 0) > 0;
  } catch (error) {
    logServerError("target.catalog.bind-source-store-id", error);
  }

  const catalogRow = buildTargetCatalogStoreFromLocator(input.locatorStore);
  if (catalogRow) {
    try {
      await upsertCatalogStores([catalogRow]);
      upsertedCatalog = true;
    } catch (error) {
      logServerError("target.catalog.upsert-locator-store", error);
    }
  }

  return { updatedPin, upsertedCatalog };
}
