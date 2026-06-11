import { getDbPool } from "@/lib/db";
import { RANKED_PRICE_CACHE_TTL_MINUTES } from "@/lib/ranked-price-cache-policy";
import type {
  ProviderDiscoveredStore,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

export async function persistProviderStoreSearchResult(
  input: ProviderStoreSearchInput,
  result: ProviderStoreSearchResult,
): Promise<number | undefined> {
  try {
    const pool = getDbPool();
    const storesJson = JSON.stringify(result.stores);
    const normalizedLatitude = normalizeCoordinate(input.location.latitude);
    const normalizedLongitude = normalizeCoordinate(input.location.longitude);

    const persisted = await pool.query<{ id: string }>(
      `
        insert into provider_store_search_snapshots (
          provider,
          status,
          provenance,
          configured,
          fallback_used,
          search_zip_code,
          search_latitude,
          search_longitude,
          radius_miles,
          store_count,
          message,
          fetched_at,
          stores_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
        )
        returning id
      `,
      [
        result.provider,
        result.status,
        result.provenance,
        result.configured,
        result.fallbackUsed,
        input.location.zipCode ?? null,
        normalizedLatitude,
        normalizedLongitude,
        input.radiusMiles,
        result.stores.length,
        result.message,
        result.fetchedAt,
        storesJson,
      ],
    );

    return Number(persisted.rows[0]?.id);
  } catch {
    return undefined;
  }
}

export async function getLatestProviderStoreSearchSnapshot(input: {
  provider: StoreDiscoveryProvider;
  search: ProviderStoreSearchInput;
  maxAgeMinutes?: number;
}): Promise<ProviderStoreSearchResult | undefined> {
  try {
    const pool = getDbPool();
    const maxAgeMinutes = input.maxAgeMinutes ?? RANKED_PRICE_CACHE_TTL_MINUTES;
    const normalizedLatitude = normalizeCoordinate(input.search.location.latitude);
    const normalizedLongitude = normalizeCoordinate(
      input.search.location.longitude,
    );

    const snapshot = await pool.query<ProviderSnapshotRow>(
      `
        select
          id,
          provider,
          status,
          provenance,
          configured,
          fallback_used,
          store_count,
          message,
          fetched_at,
          captured_at,
          stores_json
        from provider_store_search_snapshots
        where provider = $1
          and radius_miles = $2
          and store_count > 0
          and provenance = 'official-api'
          and captured_at >= now() - ($3::text || ' minutes')::interval
          and (
            (search_zip_code is not distinct from $4)
            or (search_zip_code is null and search_latitude = $5 and search_longitude = $6)
          )
        order by captured_at desc
        limit 1
      `,
      [
        input.provider,
        input.search.radiusMiles,
        String(maxAgeMinutes),
        input.search.location.zipCode ?? null,
        normalizedLatitude,
        normalizedLongitude,
      ],
    );

    const row = snapshot.rows[0];
    if (!row) {
      return undefined;
    }

    const snapshotCapturedAt = row.captured_at.toISOString();
    const snapshotAgeMinutes = Math.max(
      0,
      Math.round((Date.now() - row.captured_at.getTime()) / 60000),
    );

    return {
      provider: row.provider,
      label: "Kroger official store discovery",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: row.configured,
      fallbackUsed: true,
      stores: row.stores_json,
      message: `Using a saved Kroger provider snapshot from ${snapshotAgeMinutes} minute(s) ago because live provider discovery was unavailable for this search.`,
      fetchedAt: row.fetched_at.toISOString(),
      persistedSnapshotId: row.id,
      snapshotCapturedAt,
      snapshotAgeMinutes,
    };
  } catch {
    return undefined;
  }
}

function normalizeCoordinate(value: number) {
  return Number(value.toFixed(3));
}

type ProviderSnapshotRow = {
  id: number;
  provider: StoreDiscoveryProvider;
  status: ProviderStoreSearchResult["status"];
  provenance: ProviderStoreSearchResult["provenance"];
  configured: boolean;
  fallback_used: boolean;
  store_count: number;
  message: string;
  fetched_at: Date;
  captured_at: Date;
  stores_json: ProviderDiscoveredStore[];
};
