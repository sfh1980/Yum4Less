const CENSUS_COORDINATE_GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

export function parseCensusCoordinateZcta(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const geographies = (payload as { result?: { geographies?: unknown } }).result
    ?.geographies;
  if (!geographies || typeof geographies !== "object") {
    return null;
  }
  for (const value of Object.values(geographies as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const row of value) {
      if (!row || typeof row !== "object" || !("ZCTA5" in row)) {
        continue;
      }
      const zip = String((row as { ZCTA5?: unknown }).ZCTA5 ?? "").trim();
      if (/^\d{5}$/.test(zip)) {
        return zip;
      }
    }
  }
  return null;
}

export async function lookupZctaFromPoint(input: {
  latitude: number;
  longitude: number;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(CENSUS_COORDINATE_GEOCODER);
  url.searchParams.set("x", String(input.longitude));
  url.searchParams.set("y", String(input.latitude));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "Yum4Less/0.1 (market reach; +https://yum4less.com)" },
    });
    if (!response.ok) {
      return null;
    }
    return parseCensusCoordinateZcta(await response.json());
  } catch {
    return null;
  }
}
