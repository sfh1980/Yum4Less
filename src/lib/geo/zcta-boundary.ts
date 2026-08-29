import { getDbPool } from "@/lib/db";
import {
  geometryContainsPoint,
  type GeoJsonGeometry,
} from "@/lib/geo/point-in-polygon";
import { logServerError } from "@/lib/server-log";

const TIGERWEB_ZCTA_QUERY =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query";

const FETCH_TIMEOUT_MS = 8_000;

export type ZctaPolygonResult =
  | { ok: true; geometry: GeoJsonGeometry; source: "cache" | "census" }
  | { ok: false; error: string };

function skipLiveZctaFetch(): boolean {
  if (process.env.YUM4LESS_ZCTA_LIVE === "1") {
    return false;
  }
  return process.env.NODE_ENV === "test";
}

function isGeometry(value: unknown): value is GeoJsonGeometry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  return (
    (type === "Polygon" || type === "MultiPolygon") && Array.isArray(coordinates)
  );
}

export function pointInZcta(
  geometry: GeoJsonGeometry,
  latitude: number,
  longitude: number,
): boolean {
  return geometryContainsPoint(geometry, longitude, latitude);
}

export async function readCachedZctaGeometry(
  zipCode: string,
): Promise<GeoJsonGeometry | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  const normalized = zipCode.trim();
  if (!/^\d{5}$/.test(normalized)) {
    return null;
  }
  try {
    const result = await getDbPool().query<{ zcta_geojson: GeoJsonGeometry | null }>(
      `select zcta_geojson from zip_geocode_cache where zip_code = $1`,
      [normalized],
    );
    const geometry = result.rows[0]?.zcta_geojson;
    return isGeometry(geometry) ? geometry : null;
  } catch {
    return null;
  }
}

async function writeCachedZctaGeometry(
  zipCode: string,
  geometry: GeoJsonGeometry,
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  try {
    await getDbPool().query(
      `
        update zip_geocode_cache
        set zcta_geojson = $2::jsonb, zcta_fetched_at = now()
        where zip_code = $1
      `,
      [zipCode, JSON.stringify(geometry)],
    );
  } catch (error) {
    logServerError("zcta-boundary.cache-write", error);
  }
}

export async function fetchCensusZctaGeometry(
  zipCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ZctaPolygonResult> {
  const normalized = zipCode.trim();
  if (!/^\d{5}$/.test(normalized)) {
    return { ok: false, error: "ZCTA lookup needs a 5-digit ZIP." };
  }

  const url = new URL(TIGERWEB_ZCTA_QUERY);
  url.searchParams.set("where", `ZCTA5='${normalized}'`);
  url.searchParams.set("outFields", "ZCTA5");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Yum4Less/0.1 (ZCTA ingest fence; +https://github.com/)" },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Census ZCTA lookup returned HTTP ${response.status}.`,
      };
    }
    const payload = (await response.json()) as {
      features?: Array<{ geometry?: unknown }>;
    };
    const geometry = payload.features?.[0]?.geometry;
    if (!isGeometry(geometry)) {
      return { ok: false, error: "Census ZCTA lookup returned no polygon for this ZIP." };
    }
    return { ok: true, geometry, source: "census" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Census ZCTA lookup failed: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveZctaGeometry(input: {
  zipCode: string;
  fetchImpl?: typeof fetch;
}): Promise<ZctaPolygonResult> {
  const cached = await readCachedZctaGeometry(input.zipCode);
  if (cached) {
    return { ok: true, geometry: cached, source: "cache" };
  }

  if (skipLiveZctaFetch()) {
    return {
      ok: false,
      error: "Census ZCTA fetch skipped in tests (set YUM4LESS_ZCTA_LIVE=1 to allow).",
    };
  }

  const fetched = await fetchCensusZctaGeometry(input.zipCode, input.fetchImpl);
  if (fetched.ok) {
    await writeCachedZctaGeometry(input.zipCode, fetched.geometry);
  }
  return fetched;
}
