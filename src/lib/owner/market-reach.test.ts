import { describe, expect, it } from "vitest";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { parseCensusCoordinateZcta } from "@/lib/geo/zcta-from-point";
import {
  buildMarketReachSummary,
  containingZipCode,
  TURN_ZIP_ON_REASON,
} from "@/lib/owner/market-reach";

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

describe("market reach", () => {
  it("counts priced stores and groups the ones in ZIPs that are still off", () => {
    const summary = buildMarketReachSummary({
      activeZipCodes: new Set(["23220"]),
      stores: [
        {
          name: "Kroger Lombardy",
          chainLabel: "Kroger",
          latitude: 37.55,
          longitude: -77.45,
          usable: true,
          zipCode: "23220",
        },
        {
          name: "Forest Hill",
          chainLabel: "Aldi",
          latitude: 37.52,
          longitude: -77.49,
          usable: false,
          zipCode: "23225",
        },
        {
          name: "Stonebridge",
          chainLabel: "Kroger",
          latitude: 37.5,
          longitude: -77.52,
          usable: false,
          zipCode: "23225",
        },
      ],
    });

    expect(summary.sentence).toBe(
      "1 of 3 nearby stores can be priced. 2 sit in ZIPs that are still off.",
    );
    expect(summary.offZips).toEqual([
      {
        zipCode: "23225",
        storeCount: 2,
        stores: [
          { name: "Forest Hill", chainLabel: "Aldi", reason: TURN_ZIP_ON_REASON },
          { name: "Stonebridge", chainLabel: "Kroger", reason: TURN_ZIP_ON_REASON },
        ],
      },
    ]);
  });

  it("puts a pin in the ZIP outline that contains it", () => {
    const zip = containingZipCode(
      { latitude: 37.55, longitude: -77.45 },
      [
        { zipCode: "23221", geometry: box(-77.5, 37.54, -77.46, 37.57) },
        { zipCode: "23220", geometry: box(-77.46, 37.54, -77.43, 37.57) },
      ],
      "23220",
    );
    expect(zip).toBe("23220");
  });

  it("reads a Census coordinate ZIP", () => {
    expect(
      parseCensusCoordinateZcta({
        result: { geographies: { "ZIP Code Tabulation Areas": [{ ZCTA5: "23225" }] } },
      }),
    ).toBe("23225");
  });
});
