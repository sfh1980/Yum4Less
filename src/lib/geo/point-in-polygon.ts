export type LonLat = readonly [number, number];

type Ring = ReadonlyArray<readonly [number, number]>;

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: Ring[];
};

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: Ring[][];
};

export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

function ringContains(ring: Ring, longitude: number, latitude: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (
      xi === undefined ||
      yi === undefined ||
      xj === undefined ||
      yj === undefined
    ) {
      continue;
    }
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonContains(
  polygon: Ring[],
  longitude: number,
  latitude: number,
): boolean {
  const outer = polygon[0];
  if (!outer || !ringContains(outer, longitude, latitude)) {
    return false;
  }
  for (let hole = 1; hole < polygon.length; hole += 1) {
    const ring = polygon[hole];
    if (ring && ringContains(ring, longitude, latitude)) {
      return false;
    }
  }
  return true;
}

export function geometryContainsPoint(
  geometry: GeoJsonGeometry,
  longitude: number,
  latitude: number,
): boolean {
  if (geometry.type === "Polygon") {
    return polygonContains(geometry.coordinates, longitude, latitude);
  }
  return geometry.coordinates.some((polygon) =>
    polygonContains(polygon, longitude, latitude),
  );
}
