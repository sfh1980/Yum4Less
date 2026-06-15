import { getDbPool } from "@/lib/db";
import { RANKED_PRICE_CACHE_TTL_MINUTES } from "@/lib/ranked-price-cache-policy";
import type {
  ProviderDiscoveredStore,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

/** ~0.35 mi latitude tolerance for GPS/browser vs ZIP-centroid cache hits. */
export const PROVIDER_STORE_SEARCH_COORD_TOLERANCE = 0.005;

export function normalizeProviderSearchCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

export function buildProviderStoreSearchCacheKey(input: ProviderStoreSearchInput): {
  zipCode: string | null;
  latitude: number;
  longitude: number;
  radiusMiles: number;
} {
  return {
    zipCode: input.location.zipCode?.trim() || null,
    latitude: normalizeProviderSearchCoordinate(input.location.latitude),
    longitude: normalizeProviderSearchCoordinate(input.location.longitude),
    radiusMiles: input.radiusMiles,
  };
}

export async function persistProviderStoreSearchResult(
  input: ProviderStoreSearchInput,
  result: ProviderStoreSearchResult,
): Promise<number | undefined> {
  try {
    const pool = getDbPool();
    const storesJson = JSON.stringify(result.stores);
    const cacheKey = buildProviderStoreSearchCacheKey(input);

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
        cacheKey.zipCode,
        cacheKey.latitude,
        cacheKey.longitude,
        cacheKey.radiusMiles,
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
    const cacheKey = buildProviderStoreSearchCacheKey(input.search);
    const coordTolerance = PROVIDER_STORE_SEARCH_COORD_TOLERANCE;

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
            (
              $4::text is not null
              and search_zip_code is not distinct from $4
            )
            or (
              $4::text is null
              and search_latitude between ($5::numeric - $7::numeric) and ($5::numeric + $7::numeric)
              and search_longitude between ($6::numeric - $7::numeric) and ($6::numeric + $7::numeric)
            )
          )
        order by captured_at desc
        limit 1
      `,
      [
        input.provider,
        cacheKey.radiusMiles,
        String(maxAgeMinutes),
        cacheKey.zipCode,
        cacheKey.latitude,
        cacheKey.longitude,
        coordTolerance,
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
