import { describe, expect, it } from "vitest";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { buildOwnerCoverageMapModel } from "@/lib/owner/owner-market-coverage-map-model";

function box(minLon: number, minLat: number, maxLon: number, maxLat: number): GeoJsonGeometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

describe("owner market coverage map model", () => {
  it("frames a ZIP on its own coverage shape, not a state outline", () => {
    const model = buildOwnerCoverageMapModel([
      { zipCode: "23220", status: "active", geometry: box(-77.47, 37.54, -77.44, 37.56) },
    ]);
    expect(model.landPaths).toEqual([]);
    expect(model.shades).toHaveLength(1);
    expect(model.bounds.maxLongitude - model.bounds.minLongitude).toBeLessThan(0.2);
    expect(model.bounds.minLongitude).toBeGreaterThan(-77.6);
    expect(model.bounds.maxLongitude).toBeLessThan(-77.3);
  });

  it("frames a distant ZIP on that coverage, not the US outline", () => {
    const california = buildOwnerCoverageMapModel([
      {
        zipCode: "94103",
        status: "active",
        geometry: box(-122.42, 37.76, -122.4, 37.78),
      },
    ]);
    expect(california.landPaths).toEqual([]);
    expect(california.bounds.minLongitude).toBeLessThan(-122.3);
    expect(california.bounds.maxLongitude).toBeGreaterThan(-122.5);
    expect(california.bounds.maxLongitude - california.bounds.minLongitude).toBeLessThan(0.2);
  });
});
