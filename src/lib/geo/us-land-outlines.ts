import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import type { GeoBounds } from "@/lib/geo/geojson-bounds";

/** Simplified Census-style Virginia outline (not a legal boundary). */
export const VIRGINIA_OUTLINE: GeoJsonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-83.68, 36.6],
      [-81.93, 36.59],
      [-80.52, 36.59],
      [-79.48, 36.54],
      [-78.54, 36.54],
      [-77.52, 36.54],
      [-76.92, 36.55],
      [-75.87, 36.55],
      [-75.8, 36.55],
      [-75.89, 37.05],
      [-75.46, 37.77],
      [-75.17, 38.03],
      [-76.24, 37.89],
      [-76.61, 38.15],
      [-76.95, 38.21],
      [-77.04, 38.4],
      [-77.28, 38.34],
      [-77.31, 38.49],
      [-77.04, 38.72],
      [-77.04, 38.87],
      [-77.52, 39.12],
      [-77.46, 39.22],
      [-77.57, 39.31],
      [-77.73, 39.32],
      [-77.83, 39.13],
      [-78.35, 39.47],
      [-78.4, 39.17],
      [-78.87, 38.76],
      [-79.0, 38.85],
      [-79.28, 38.42],
      [-79.65, 38.59],
      [-80.3, 37.69],
      [-80.31, 37.5],
      [-81.68, 37.2],
      [-81.93, 37.36],
      [-81.97, 37.54],
      [-83.14, 36.74],
      [-83.68, 36.6],
    ],
  ],
};

export const VIRGINIA_BOUNDS: GeoBounds = {
  minLongitude: -83.7,
  maxLongitude: -75.15,
  minLatitude: 36.5,
  maxLatitude: 39.5,
};

/** Mid-Atlantic padding around Virginia for the next zoom-out step. */
export const MID_ATLANTIC_BOUNDS: GeoBounds = {
  minLongitude: -85.5,
  maxLongitude: -73.5,
  minLatitude: 33.8,
  maxLatitude: 41.6,
};

/** Simplified lower-48 outline (not a legal boundary). */
export const CONTINENTAL_US_OUTLINE: GeoJsonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-124.8, 48.5],
      [-124.5, 42.0],
      [-124.4, 40.4],
      [-122.0, 36.6],
      [-117.1, 32.5],
      [-114.5, 32.7],
      [-111.0, 31.3],
      [-108.2, 31.3],
      [-103.0, 29.0],
      [-97.1, 25.8],
      [-81.0, 25.1],
      [-80.0, 26.9],
      [-81.5, 30.7],
      [-81.4, 32.0],
      [-75.5, 35.2],
      [-75.5, 38.0],
      [-70.0, 41.2],
      [-69.9, 41.8],
      [-70.8, 43.1],
      [-67.0, 44.8],
      [-68.0, 47.0],
      [-69.0, 47.4],
      [-71.0, 45.0],
      [-74.3, 45.0],
      [-76.5, 44.0],
      [-82.4, 43.0],
      [-83.5, 45.0],
      [-84.8, 46.8],
      [-88.0, 48.3],
      [-90.0, 48.0],
      [-95.0, 49.3],
      [-107.0, 49.0],
      [-123.0, 49.0],
      [-124.8, 48.5],
    ],
  ],
};

export const CONTINENTAL_US_MAP_BOUNDS: GeoBounds = {
  minLongitude: -125,
  maxLongitude: -66,
  minLatitude: 24.5,
  maxLatitude: 49.5,
};
