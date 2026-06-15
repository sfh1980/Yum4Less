import { getDbPool } from "@/lib/db";
import { isKrogerProviderLocationId } from "@/lib/provider-price-observation-sync";
import { createKrogerApiClient } from "@/lib/providers/kroger/kroger-api-client";

export async function resolveKrogerStoreForZip(zipCode: string): Promise<{
  locationId?: string;
  storeName?: string;
}> {
  return resolveKrogerStoreForWeeklyAd({ zipCode });
}

export async function resolveKrogerStoreForWeeklyAd(input: {
  zipCode: string;
  storeId?: string;
}): Promise<{
  locationId?: string;
  storeName?: string;
}> {
  const overrideLocationId = process.env.KROGER_LOCATION_ID?.trim();
  if (overrideLocationId) {
    return { locationId: overrideLocationId };
  }

  if (input.storeId) {
    const fromCatalog = await lookupKrogerLocationIdFromStoreRow(input.storeId);
    if (fromCatalog.locationId) {
      return fromCatalog;
    }
  }

  const api = createKrogerApiClient();
  if (!api.isConfigured) {
    return {};
  }

  try {
    const locationId = await api.resolveLocationIdForZip(input.zipCode);
    return { locationId };
  } catch {
    return {};
  }
}

async function lookupKrogerLocationIdFromStoreRow(storeId: string): Promise<{
  locationId?: string;
  storeName?: string;
}> {
  try {
    const pool = getDbPool();
    const result = await pool.query<{
      source_store_id: string | null;
      name: string;
    }>(
      `
        select source_store_id, name
        from stores
        where id = $1
      `,
      [storeId],
    );

    const row = result.rows[0];
    if (!row?.source_store_id || !isKrogerProviderLocationId(row.source_store_id)) {
      return {};
    }

    return {
      locationId: row.source_store_id.trim(),
      storeName: row.name,
    };
  } catch {
    return {};
  }
}
