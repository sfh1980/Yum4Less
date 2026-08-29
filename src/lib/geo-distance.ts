/** Approximate statute miles per degree of latitude. */
const MILES_PER_DEGREE_LATITUDE = 69;

export function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Axis-aligned box used to prefilter catalog rows before a haversine check. */
export function boundingBoxForRadiusMiles(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
} {
  const latDelta = radiusMiles / MILES_PER_DEGREE_LATITUDE;
  const lngMilesPerDegree = Math.max(
    Math.cos(toRadians(latitude)) * MILES_PER_DEGREE_LATITUDE,
    0.01,
  );
  const lngDelta = radiusMiles / lngMilesPerDegree;

  return {
    minLatitude: latitude - latDelta,
    maxLatitude: latitude + latDelta,
    minLongitude: longitude - lngDelta,
    maxLongitude: longitude + lngDelta,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
