import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import {
  boundsContainBounds,
  boundsFromGeometry,
  geometryCentroid,
  geometryToSvgPath,
  unionBounds,
  type GeoBounds,
} from "@/lib/geo/geojson-bounds";
import {
  CONTINENTAL_US_MAP_BOUNDS,
  CONTINENTAL_US_OUTLINE,
  MID_ATLANTIC_BOUNDS,
  VIRGINIA_BOUNDS,
  VIRGINIA_OUTLINE,
} from "@/lib/geo/us-land-outlines";

export type OwnerMarketCoverageStatus = "active" | "paused" | "preview";

export type OwnerMarketCoverageShade = {
  zipCode: string;
  status: OwnerMarketCoverageStatus;
  geometry: GeoJsonGeometry;
};

export type OwnerCoverageMapFrame = "virginia" | "mid-atlantic" | "continental-us";

export type OwnerCoverageMapModel = {
  frame: OwnerCoverageMapFrame;
  bounds: GeoBounds;
  heightPx: number;
  viewBox: string;
  labelFontSize: number;
  landPaths: Array<{ id: string; d: string }>;
  shades: Array<{
    zipCode: string;
    status: OwnerMarketCoverageStatus;
    d: string;
    labelX: number;
    labelY: number;
  }>;
};

const MIN_VIRGINIA_CHUNK_LON = 1.15;
const MIN_VIRGINIA_CHUNK_LAT = 0.85;
const FULL_VIRGINIA_LON_RATIO = 0.7;

function coverageBounds(shades: readonly OwnerMarketCoverageShade[]): GeoBounds | null {
  let combined: GeoBounds | null = null;
  for (const shade of shades) {
    const bounds = boundsFromGeometry(shade.geometry);
    if (bounds) {
      combined = unionBounds(combined, bounds);
    }
  }
  return combined;
}

function padBounds(bounds: GeoBounds, minLonSpan: number, minLatSpan: number): GeoBounds {
  const spanLon = Math.max(bounds.maxLongitude - bounds.minLongitude, minLonSpan);
  const spanLat = Math.max(bounds.maxLatitude - bounds.minLatitude, minLatSpan);
  const midLon = (bounds.minLongitude + bounds.maxLongitude) / 2;
  const midLat = (bounds.minLatitude + bounds.maxLatitude) / 2;
  const paddedLon = spanLon * 1.35;
  const paddedLat = spanLat * 1.35;
  return {
    minLongitude: midLon - paddedLon / 2,
    maxLongitude: midLon + paddedLon / 2,
    minLatitude: midLat - paddedLat / 2,
    maxLatitude: midLat + paddedLat / 2,
  };
}

function lonSpan(bounds: GeoBounds): number {
  return bounds.maxLongitude - bounds.minLongitude;
}

export function chooseOwnerCoverageMapFrame(
  shades: readonly OwnerMarketCoverageShade[],
): OwnerCoverageMapFrame {
  const covered = coverageBounds(shades);
  if (!covered) {
    return "virginia";
  }
  if (boundsContainBounds(VIRGINIA_BOUNDS, covered, 0.15)) {
    return "virginia";
  }
  if (boundsContainBounds(MID_ATLANTIC_BOUNDS, covered, 0.2)) {
    return "mid-atlantic";
  }
  return "continental-us";
}

export function boundsForOwnerCoverageFrame(
  frame: OwnerCoverageMapFrame,
  shades: readonly OwnerMarketCoverageShade[] = [],
): GeoBounds {
  if (frame === "mid-atlantic") {
    return MID_ATLANTIC_BOUNDS;
  }
  if (frame === "continental-us") {
    return CONTINENTAL_US_MAP_BOUNDS;
  }
  const covered = coverageBounds(shades);
  if (!covered) {
    return VIRGINIA_BOUNDS;
  }
  const padded = padBounds(covered, MIN_VIRGINIA_CHUNK_LON, MIN_VIRGINIA_CHUNK_LAT);
  if (lonSpan(padded) >= lonSpan(VIRGINIA_BOUNDS) * FULL_VIRGINIA_LON_RATIO) {
    return VIRGINIA_BOUNDS;
  }
  return padded;
}

function heightForFrame(frame: OwnerCoverageMapFrame, bounds: GeoBounds): number {
  if (frame === "mid-atlantic") {
    return 220;
  }
  if (frame === "continental-us") {
    return 240;
  }
  const ratio = lonSpan(bounds) / lonSpan(VIRGINIA_BOUNDS);
  return Math.round(180 + Math.min(28, Math.max(0, ratio) * 40));
}

export function buildOwnerCoverageMapModel(
  shades: readonly OwnerMarketCoverageShade[],
): OwnerCoverageMapModel {
  const frame = chooseOwnerCoverageMapFrame(shades);
  const bounds = boundsForOwnerCoverageFrame(frame, shades);
  const land =
    frame === "continental-us"
      ? [{ id: "conus", geometry: CONTINENTAL_US_OUTLINE }]
      : [
          { id: "virginia", geometry: VIRGINIA_OUTLINE },
          ...(frame === "mid-atlantic"
            ? [{ id: "conus", geometry: CONTINENTAL_US_OUTLINE }]
            : []),
        ];

  return {
    frame,
    bounds,
    heightPx: heightForFrame(frame, bounds),
    viewBox: `${bounds.minLongitude} ${-bounds.maxLatitude} ${
      bounds.maxLongitude - bounds.minLongitude
    } ${bounds.maxLatitude - bounds.minLatitude}`,
    labelFontSize: lonSpan(bounds) * 0.04,
    landPaths: land.map((item) => ({
      id: item.id,
      d: geometryToSvgPath(item.geometry),
    })),
    shades: shades.flatMap((shade) => {
      const centroid = geometryCentroid(shade.geometry);
      if (!centroid) {
        return [];
      }
      return [
        {
          zipCode: shade.zipCode,
          status: shade.status,
          d: geometryToSvgPath(shade.geometry),
          labelX: centroid.longitude,
          labelY: -centroid.latitude,
        },
      ];
    }),
  };
}
