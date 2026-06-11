/** Continental US bounds (48 contiguous states; excludes AK/HI). */
export const CONTINENTAL_US_BOUNDS = {
  minLatitude: 24.5,
  maxLatitude: 49.5,
  minLongitude: -125,
  maxLongitude: -66,
} as const;

/** Local dev seed ZIPs when GEOCODIO_API_KEY is unset. */
export const DEV_SEED_ZIP_CODES = new Set([
  "23111",
  "23116",
  "23223",
  "23231",
]);

/** Primary dev/demo ZIP for fixture ingest, E2E, and CI (Mechanicsville, VA). */
export const DEV_PRIMARY_ZIP = "23111";

export const DEV_AREA_CENTER = {
  latitude: 37.6085,
  longitude: -77.3321,
} as const;

export function isSupportedDevSeedZip(zipCode: string) {
  return DEV_SEED_ZIP_CODES.has(zipCode.trim());
}

export function isWithinContinentalUsBounds(input: {
  latitude: number;
  longitude: number;
}) {
  return (
    input.latitude >= CONTINENTAL_US_BOUNDS.minLatitude &&
    input.latitude <= CONTINENTAL_US_BOUNDS.maxLatitude &&
    input.longitude >= CONTINENTAL_US_BOUNDS.minLongitude &&
    input.longitude <= CONTINENTAL_US_BOUNDS.maxLongitude
  );
}
