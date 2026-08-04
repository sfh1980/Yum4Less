/**
 * ZIP → search-center pins in localStorage.
 * Separate from settings preferences so `stripExactCoordinates` privacy
 * stripping still applies to the main prefs blob; this cache is intentional
 * for the ZIP reference-pin flow and clears when the shopper clears site data.
 */

export const ZIP_SEARCH_CENTERS_STORAGE_KEY = "yum4less.zip-search-centers.v1";

export type ZipSearchCenter = {
  latitude: number;
  longitude: number;
};

type ZipSearchCentersMap = Record<string, ZipSearchCenter>;

function isValidCenter(value: unknown): value is ZipSearchCenter {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.latitude === "number" &&
    Number.isFinite(record.latitude) &&
    record.latitude >= -90 &&
    record.latitude <= 90 &&
    typeof record.longitude === "number" &&
    Number.isFinite(record.longitude) &&
    record.longitude >= -180 &&
    record.longitude <= 180
  );
}

function readAll(): ZipSearchCentersMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ZIP_SEARCH_CENTERS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: ZipSearchCentersMap = {};
    for (const [zip, center] of Object.entries(parsed)) {
      if (/^\d{5}$/.test(zip) && isValidCenter(center)) {
        out[zip] = {
          latitude: center.latitude,
          longitude: center.longitude,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: ZipSearchCentersMap): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      ZIP_SEARCH_CENTERS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // Quota / private mode — search still works for the current session via caller state.
  }
}

export function readZipSearchCenter(zipCode: string): ZipSearchCenter | null {
  const zip = zipCode.trim();
  if (!/^\d{5}$/.test(zip)) {
    return null;
  }
  return readAll()[zip] ?? null;
}

export function writeZipSearchCenter(
  zipCode: string,
  center: ZipSearchCenter,
): void {
  const zip = zipCode.trim();
  if (!/^\d{5}$/.test(zip) || !isValidCenter(center)) {
    return;
  }
  const map = readAll();
  map[zip] = {
    latitude: center.latitude,
    longitude: center.longitude,
  };
  writeAll(map);
}

export function clearZipSearchCenter(zipCode: string): void {
  const zip = zipCode.trim();
  if (!/^\d{5}$/.test(zip)) {
    return;
  }
  const map = readAll();
  if (!(zip in map)) {
    return;
  }
  delete map[zip];
  writeAll(map);
}

export function clearAllZipSearchCenters(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(ZIP_SEARCH_CENTERS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
