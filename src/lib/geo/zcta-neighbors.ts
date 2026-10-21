import { getDbPool } from "@/lib/db";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { resolveZctaGeometry } from "@/lib/geo/zcta-boundary";
import { logServerError } from "@/lib/server-log";

const TIGERWEB_ZCTA_QUERY =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query";

const ZIP5 = /^\d{5}$/;

export function parseTouchingZctaCodes(payload: unknown, selfZip: string): string[] {
  const found = new Set<string>();
  const features = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) {
    return [];
  }
  for (const feature of features) {
    if (!feature || typeof feature !== "object") {
      continue;
    }
    const record = feature as {
      attributes?: { ZCTA5?: unknown };
      properties?: { ZCTA5?: unknown };
    };
    const raw = record.attributes?.ZCTA5 ?? record.properties?.ZCTA5;
    const zipCode = String(raw ?? "").trim();
    if (ZIP5.test(zipCode) && zipCode !== selfZip) {
      found.add(zipCode);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

export function zctaPolygons(geometry: GeoJsonGeometry): number[][][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates.map((ring) => ring.map((point) => [point[0], point[1]]))];
  }
  return geometry.coordinates.map((polygon) =>
    polygon.map((ring) => ring.map((point) => [point[0], point[1]])),
  );
}

export async function listTouchingZipCodes(input: {
  zipCode: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; zipCodes: string[] } | { ok: false; error: string }> {
  const zipCode = input.zipCode.trim();
  if (!ZIP5.test(zipCode)) {
    return { ok: false, error: "Touching ZIP lookup needs a 5-digit ZIP." };
  }

  const cached = await readCachedTouchingZips(zipCode);
  if (cached) {
    return { ok: true, zipCodes: cached };
  }

  const geometry = await resolveZctaGeometry({
    zipCode,
    fetchImpl: input.fetchImpl,
  });
  if (!geometry.ok) {
    return { ok: false, error: geometry.error };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const zipCodes = new Set<string>();
  for (const rings of zctaPolygons(geometry.geometry)) {
    const found = await fetchTouchingZctas({
      selfZip: zipCode,
      rings,
      fetchImpl,
    });
    if (!found.ok) {
      return found;
    }
    for (const neighbor of found.zipCodes) {
      zipCodes.add(neighbor);
    }
  }

  const sorted = [...zipCodes].sort((a, b) => a.localeCompare(b));
  await writeCachedTouchingZips(zipCode, sorted);
  return { ok: true, zipCodes: sorted };
}

async function fetchTouchingZctas(input: {
  selfZip: string;
  rings: number[][][];
  fetchImpl: typeof fetch;
}): Promise<{ ok: true; zipCodes: string[] } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings: input.rings }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelTouches",
    outFields: "ZCTA5",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await input.fetchImpl(TIGERWEB_ZCTA_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Yum4Less/0.1 (ZCTA neighbors; +https://yum4less.com)",
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Census touching-ZIP lookup returned HTTP ${response.status}.`,
      };
    }
    return {
      ok: true,
      zipCodes: parseTouchingZctaCodes(await response.json(), input.selfZip),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Census touching-ZIP lookup failed: ${message}` };
  }
}

async function readCachedTouchingZips(zipCode: string): Promise<string[] | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  try {
    const result = await getDbPool().query<{ touching_zips: string[] | null }>(
      `
        select touching_zips
        from zip_geocode_cache
        where zip_code = $1
          and touching_zips is not null
      `,
      [zipCode],
    );
    const zips = result.rows[0]?.touching_zips;
    if (!zips) {
      return null;
    }
    return zips.filter((zip) => ZIP5.test(zip)).sort((a, b) => a.localeCompare(b));
  } catch {
    return null;
  }
}

async function writeCachedTouchingZips(
  zipCode: string,
  zipCodes: readonly string[],
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  try {
    await getDbPool().query(
      `
        update zip_geocode_cache
        set touching_zips = $2::text[],
            touching_zips_fetched_at = now()
        where zip_code = $1
      `,
      [zipCode, zipCodes],
    );
  } catch (error) {
    logServerError("zcta-neighbors.cache-write", error);
  }
}
