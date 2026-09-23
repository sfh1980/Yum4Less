import { describe, expect, it } from "vitest";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import {
  buildOwnerCoverageMapModel,
  chooseOwnerCoverageMapFrame,
} from "@/lib/owner/owner-market-coverage-map-model";

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
  it("frames empty and Virginia ZIPs on the Virginia outline", () => {
    expect(chooseOwnerCoverageMapFrame([])).toBe("virginia");
    expect(
      chooseOwnerCoverageMapFrame([
        { zipCode: "23220", status: "active", geometry: box(-77.47, 37.54, -77.44, 37.56) },
      ]),
    ).toBe("virginia");
    const model = buildOwnerCoverageMapModel([
      { zipCode: "23220", status: "active", geometry: box(-77.47, 37.54, -77.44, 37.56) },
    ]);
    expect(model.heightPx).toBeGreaterThanOrEqual(180);
    expect(model.heightPx).toBeLessThan(220);
    expect(model.bounds.maxLongitude - model.bounds.minLongitude).toBeLessThan(3);
    expect(model.landPaths.some((path) => path.id === "virginia")).toBe(true);
    expect(model.shades).toHaveLength(1);
  });

  it("zooms out and grows the box when coverage leaves Virginia", () => {
    const northCarolina = {
      zipCode: "27601",
      status: "paused" as const,
      geometry: box(-78.65, 35.76, -78.62, 35.79),
    };
    expect(chooseOwnerCoverageMapFrame([northCarolina])).toBe("mid-atlantic");
    expect(buildOwnerCoverageMapModel([northCarolina]).heightPx).toBe(220);

    const california = {
      zipCode: "94103",
      status: "active" as const,
      geometry: box(-122.42, 37.76, -122.4, 37.78),
    };
    const national = buildOwnerCoverageMapModel([california]);
    expect(national.frame).toBe("continental-us");
    expect(national.heightPx).toBe(240);
    expect(national.landPaths.some((path) => path.id === "conus")).toBe(true);
  });
});
