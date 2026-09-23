import type { GeoJsonGeometry, LonLat } from "@/lib/geo/point-in-polygon";

export type GeoBounds = {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
};

export function forEachGeoJsonRing(
  geometry: GeoJsonGeometry,
  visit: (ring: ReadonlyArray<LonLat>) => void,
): void {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      visit(ring);
    }
    return;
  }
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      visit(ring);
    }
  }
}

export function boundsFromGeometry(geometry: GeoJsonGeometry): GeoBounds | null {
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  let found = false;

  forEachGeoJsonRing(geometry, (ring) => {
    for (const point of ring) {
      const longitude = point[0];
      const latitude = point[1];
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        continue;
      }
      found = true;
      minLongitude = Math.min(minLongitude, longitude);
      maxLongitude = Math.max(maxLongitude, longitude);
      minLatitude = Math.min(minLatitude, latitude);
      maxLatitude = Math.max(maxLatitude, latitude);
    }
  });

  if (!found) {
    return null;
  }

  return { minLongitude, maxLongitude, minLatitude, maxLatitude };
}

export function geometryCentroid(geometry: GeoJsonGeometry): { longitude: number; latitude: number } | null {
  const bounds = boundsFromGeometry(geometry);
  if (!bounds) {
    return null;
  }
  return {
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
  };
}

export function unionBounds(left: GeoBounds | null, right: GeoBounds): GeoBounds {
  if (!left) {
    return right;
  }
  return {
    minLongitude: Math.min(left.minLongitude, right.minLongitude),
    maxLongitude: Math.max(left.maxLongitude, right.maxLongitude),
    minLatitude: Math.min(left.minLatitude, right.minLatitude),
    maxLatitude: Math.max(left.maxLatitude, right.maxLatitude),
  };
}

export function boundsContainBounds(outer: GeoBounds, inner: GeoBounds, slack = 0): boolean {
  return (
    inner.minLongitude >= outer.minLongitude - slack &&
    inner.maxLongitude <= outer.maxLongitude + slack &&
    inner.minLatitude >= outer.minLatitude - slack &&
    inner.maxLatitude <= outer.maxLatitude + slack
  );
}

export function geometryToSvgPath(geometry: GeoJsonGeometry): string {
  const parts: string[] = [];
  forEachGeoJsonRing(geometry, (ring) => {
    if (ring.length < 3) {
      return;
    }
    const commands = ring.map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${point[0].toFixed(3)} ${(-point[1]).toFixed(3)}`;
    });
    parts.push(`${commands.join(" ")} Z`);
  });
  return parts.join(" ");
}
