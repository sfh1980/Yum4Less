import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";
import { getDistanceMiles } from "@/lib/geo-distance";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import { isKrogerProviderLocationId } from "@/lib/provider-price-observation-sync";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";

export type KrogerLocationCandidate = {
  name: string;
  sourceStoreId: string;
  latitude: number;
  longitude: number;
};

type KrogerStoreRow = {
  name: string;
  source_store_id: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
};

export function filterKrogerLocationCandidates(rows: KrogerStoreRow[]): KrogerLocationCandidate[] {
  const candidates: KrogerLocationCandidate[] = [];

  for (const row of rows) {
    if (getProviderRolloutForStore(row.name).chain !== "kroger") {
      continue;
    }

    const sourceStoreId = row.source_store_id?.trim();
    if (!sourceStoreId || !isKrogerProviderLocationId(sourceStoreId)) {
      continue;
    }

    if (!hasUsableCoordinates(row)) {
      continue;
    }

    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);

    candidates.push({
      name: row.name,
      sourceStoreId,
      latitude,
      longitude,
    });
  }

  return candidates;
}

export function pickNearestKrogerLocationId(
  candidates: KrogerLocationCandidate[],
  location: { latitude: number; longitude: number },
): string | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const nearest = candidates
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

  return nearest?.sourceStoreId;
}

export function resolveKrogerLocationIdFromEnv(
  value = process.env.KROGER_LOCATION_ID,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isKrogerProviderLocationId(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export async function fetchKrogerStoreRowsForLocationResolution(
  pool: Pool,
): Promise<KrogerStoreRow[]> {
  const result = await pool.query<KrogerStoreRow>(`
    select name, source_store_id, latitude, longitude
    from stores
    where source_store_id is not null
  `);

  return result.rows;
}

export async function resolvePreferredKrogerLocationIdForZip(input: {
  location?: ResolvedSearchLocation;
  pool?: Pool;
}): Promise<string | undefined> {
  const pool = input.pool ?? getDbPool();

  let rows: KrogerStoreRow[];
  try {
    rows = await fetchKrogerStoreRowsForLocationResolution(pool);
  } catch {
    return resolveKrogerLocationIdFromEnv();
  }

  const qualifyingRows = rows.filter((row) => {
    if (getProviderRolloutForStore(row.name).chain !== "kroger") {
      return false;
    }

    return isKrogerProviderLocationId(row.source_store_id);
  });

  const hasLocation =
    input.location !== undefined &&
    Number.isFinite(input.location.latitude) &&
    Number.isFinite(input.location.longitude);

  if (hasLocation) {
    const candidates = filterKrogerLocationCandidates(rows);
    const nearest = pickNearestKrogerLocationId(candidates, input.location!);
    if (nearest) {
      return nearest;
    }
  }

  const shouldUseEnvFallback =
    qualifyingRows.length === 0 ||
    qualifyingRows.every((row) => !hasUsableCoordinates(row)) ||
    !hasLocation;

  if (shouldUseEnvFallback) {
    return resolveKrogerLocationIdFromEnv();
  }

  return undefined;
}

function hasUsableCoordinates(row: KrogerStoreRow): boolean {
  if (row.latitude === null || row.longitude === null) {
    return false;
  }

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}
