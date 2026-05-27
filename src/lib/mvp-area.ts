export const MVP_PRIMARY_ZIP = "23111";

export const MVP_SEED_ZIP_CODES = new Set([
  "23111",
  "23116",
  "23223",
  "23231",
]);

/** Approximate center of the seeded Mechanicsville MVP market. */
export const MVP_AREA_CENTER = {
  latitude: 37.6085,
  longitude: -77.3321,
} as const;

/** Maximum distance from the MVP center for browser geolocation searches. */
export const MVP_BROWSER_LOCATION_RADIUS_MILES = 35;

export function isSupportedMvpZip(zipCode: string) {
  return MVP_SEED_ZIP_CODES.has(zipCode.trim());
}

export function isWithinMvpBrowserRadius(input: {
  latitude: number;
  longitude: number;
}) {
  return (
    haversineMiles(MVP_AREA_CENTER, input) <= MVP_BROWSER_LOCATION_RADIUS_MILES
  );
}

function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}
