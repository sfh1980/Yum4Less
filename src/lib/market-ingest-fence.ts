import { readIngestMarket } from "@/lib/active-markets";
import { getDistanceMiles } from "@/lib/geo-distance";
import { pointInZcta, resolveZctaGeometry } from "@/lib/geo/zcta-boundary";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import {
  BOOTSTRAP_INGEST_MILES,
  classifyDensityFromGroceryCount,
  ingestMilesForClass,
  pickPersistedIngestMiles,
  type DensityClass,
} from "@/lib/market-density";

export type IngestFence = {
  zipCode: string;
  densityClass: DensityClass | null;
  ingestMiles: number;
  geometry: GeoJsonGeometry | null;
  zctaWarning?: string;
};

export function storePassesIngestFence(input: {
  latitude: number;
  longitude: number;
  center: { latitude: number; longitude: number };
  fence: Pick<IngestFence, "ingestMiles" | "geometry">;
}): boolean {
  const withinMiles =
    getDistanceMiles(
      input.center.latitude,
      input.center.longitude,
      input.latitude,
      input.longitude,
    ) <= input.fence.ingestMiles;
  if (!withinMiles) {
    return false;
  }
  if (!input.fence.geometry) {
    return true;
  }
  return pointInZcta(input.fence.geometry, input.latitude, input.longitude);
}

export async function resolveIngestFenceForZip(zipCode: string): Promise<IngestFence> {
  const market = await readIngestMarket(zipCode).catch(() => null);
  const savedMiles = market?.ingestMiles ?? null;
  const densityClass = market?.densityClass ?? null;
  const computedMiles = densityClass
    ? ingestMilesForClass(densityClass)
    : BOOTSTRAP_INGEST_MILES;
  const ingestMiles = pickPersistedIngestMiles({
    savedMiles,
    computedMiles,
  });

  const zcta = await resolveZctaGeometry({ zipCode });
  if (!zcta.ok) {
    return {
      zipCode,
      densityClass,
      ingestMiles,
      geometry: null,
      zctaWarning: `ZIP outline unavailable (${zcta.error}). Listing/ingest uses the density circle only.`,
    };
  }

  return {
    zipCode,
    densityClass,
    ingestMiles,
    geometry: zcta.geometry,
  };
}

export function classifyAndMilesFromGroceryCount(groceryCountIn8Mi: number): {
  densityClass: DensityClass;
  ingestMiles: number;
} {
  const densityClass = classifyDensityFromGroceryCount(groceryCountIn8Mi);
  return {
    densityClass,
    ingestMiles: ingestMilesForClass(densityClass),
  };
}
