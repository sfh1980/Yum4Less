import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import type { CatalogStoreRecord } from "@/lib/store-catalog-sync";
import { upsertCatalogStores } from "@/lib/store-catalog-sync";
import {
  buildWholeFoodsCatalogStoreId,
  type WholeFoodsLocatorStore,
} from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-store";

export const WHOLE_FOODS_STORE_LOCATOR_SOURCE = "whole-foods-store-locator";

export function buildWholeFoodsCatalogStoreFromLocator(
  store: WholeFoodsLocatorStore,
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
    id: buildWholeFoodsCatalogStoreId(store.storeId),
    name: `Whole Foods ${store.locationName}`.replace(/\s+/g, " ").trim(),
    kind: "grocery",
    city: store.city,
    state: store.state.length === 2 ? store.state.toUpperCase() : store.state,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceName: WHOLE_FOODS_STORE_LOCATOR_SOURCE,
    sourceStoreId: store.storeId,
  };
}

/**
 * Persist retailer store id onto the weekly-ad ingest pin and upsert a
 * `whole-foods-{id}` catalog row when the locator returned coordinates.
 */
export async function persistWholeFoodsSourceStoreBinding(input: {
  catalogStoreId: string;
  locatorStore: WholeFoodsLocatorStore;
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
    logServerError("whole-foods.catalog.bind-source-store-id", error);
  }

  const catalogRow = buildWholeFoodsCatalogStoreFromLocator(input.locatorStore);
  if (catalogRow) {
    try {
      await upsertCatalogStores([catalogRow]);
      upsertedCatalog = true;
    } catch (error) {
      logServerError("whole-foods.catalog.upsert-locator-store", error);
    }
  }

  return { updatedPin, upsertedCatalog };
}
