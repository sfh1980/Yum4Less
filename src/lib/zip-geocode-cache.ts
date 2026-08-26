import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";

export type ZipGeocodeCacheLocation = {
  zipCode: string;
  city: string;
  state: string;
  county?: string;
  latitude: number;
  longitude: number;
  source: "geocodio" | "seed";
};

type ZipGeocodeCacheRow = {
  zip_code: string;
  latitude: string | number;
  longitude: string | number;
  city: string;
  state: string;
  county: string | null;
  provider: "geocodio" | "seed";
};

function durableZipGeocodeCacheEnabled(): boolean {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  if (process.env.NODE_ENV === "test" && process.env.YUM4LESS_ZIP_GEOCODE_CACHE !== "1") {
    return false;
  }

  return true;
}

function parseCoordinate(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function readZipGeocodeCache(zipCode: string): Promise<ZipGeocodeCacheLocation | null> {
  if (!durableZipGeocodeCacheEnabled()) {
    return null;
  }

  const normalized = zipCode.trim();
  if (!/^\d{5}$/.test(normalized)) {
    return null;
  }

  try {
    const result = await getDbPool().query<ZipGeocodeCacheRow>(
      `
        select zip_code, latitude, longitude, city, state, county, provider
        from zip_geocode_cache
        where zip_code = $1
      `,
      [normalized],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const latitude = parseCoordinate(row.latitude);
    const longitude = parseCoordinate(row.longitude);
    if (latitude === null || longitude === null) {
      return null;
    }

    return {
      zipCode: row.zip_code.trim(),
      city: row.city,
      state: row.state,
      county: row.county ?? undefined,
      latitude,
      longitude,
      source: row.provider,
    };
  } catch (error) {
    logServerError("zip-geocode-cache.read", error);
    return null;
  }
}

export async function upsertZipGeocodeCache(location: ZipGeocodeCacheLocation): Promise<void> {
  if (!durableZipGeocodeCacheEnabled()) {
    return;
  }

  if (location.source !== "geocodio" && location.source !== "seed") {
    return;
  }

  try {
    await getDbPool().query(
      `
        insert into zip_geocode_cache (
          zip_code,
          latitude,
          longitude,
          city,
          state,
          county,
          provider,
          resolved_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (zip_code) do update set
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          city = excluded.city,
          state = excluded.state,
          county = excluded.county,
          provider = excluded.provider,
          resolved_at = now()
      `,
      [
        location.zipCode,
        location.latitude,
        location.longitude,
        location.city,
        location.state,
        location.county ?? null,
        location.source,
      ],
    );
  } catch (error) {
    logServerError("zip-geocode-cache.upsert", error);
  }
}

export async function rememberIngestZipGeocode(location: {
  zipCode?: string;
  city: string;
  state: string;
  county?: string;
  latitude: number;
  longitude: number;
  source: string;
}): Promise<void> {
  if (
    !location.zipCode ||
    (location.source !== "geocodio" && location.source !== "seed")
  ) {
    return;
  }

  await upsertZipGeocodeCache({
    zipCode: location.zipCode,
    city: location.city,
    state: location.state,
    county: location.county,
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
  });
}
