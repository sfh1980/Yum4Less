import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import {
  createPublixServicesApiClient,
  parsePublixStoreNumber,
} from "@/lib/providers/publix/publix-services-api-client";
import type { PublixStoreRecord } from "@/lib/providers/publix/publix-services-api-types";
import type { CatalogStoreRecord } from "@/lib/store-catalog-sync";
import { upsertCatalogStores } from "@/lib/store-catalog-sync";

export const PUBLIX_STORE_LOCATOR_SOURCE = "publix-store-locator";

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

export async function syncPublixContextStoresForZip(input: {
  zipCode: string;
  bootstrapStoreId?: string;
}): Promise<{ upserted: number; message: string }> {
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
      };
    }

    let upserted = await upsertCatalogStores(catalogStores, {
      preserveRankedSources: true,
    });

    if (input.bootstrapStoreId) {
      upserted += await refreshPublixBootstrapStoreCoordinates({
        bootstrapStoreId: input.bootstrapStoreId,
        nearestStore: catalogStores[0]!,
      });
    }

    return {
      upserted,
      message: `Publix store locator mapped ${catalogStores.length} context store(s) for ZIP ${input.zipCode}.`,
    };
  } catch (error) {
    logServerError("publix-catalog-sync", error);
    return {
      upserted: 0,
      message:
        error instanceof Error
          ? `Publix store locator sync failed: ${error.message}`
          : "Publix store locator sync failed unexpectedly.",
    };
  }
}

async function refreshPublixBootstrapStoreCoordinates(input: {
  bootstrapStoreId: string;
  nearestStore: CatalogStoreRecord;
}): Promise<number> {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      `
        update stores
        set
          latitude = $2,
          longitude = $3,
          name = $4,
          city = $5,
          state = $6,
          source_store_id = $7,
          last_verified_at = now()
        where id = $1
          and (
            source_name is null
            or source_name = 'yum4less-internal-catalog'
            or source_name = $8
          )
      `,
      [
        input.bootstrapStoreId,
        input.nearestStore.latitude,
        input.nearestStore.longitude,
        input.nearestStore.name,
        input.nearestStore.city,
        input.nearestStore.state,
        input.nearestStore.sourceStoreId,
        PUBLIX_STORE_LOCATOR_SOURCE,
      ],
    );

    return result.rowCount ?? 0;
  } catch (error) {
    logServerError("publix-bootstrap-refresh", error);
    return 0;
  }
}
