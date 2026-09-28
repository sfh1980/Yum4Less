import { describe, expect, it } from "vitest";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { parseCensusCoordinateZcta } from "@/lib/geo/zcta-from-point";
import {
  groupReachStoresByChain,
  reachStoreIdLine,
  reachStorePlace,
  reachStoreTitle,
} from "@/lib/owner/market-reach-format";
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
          storeId: "kroger-lombardy",
          name: "Kroger Lombardy",
          chainLabel: "Kroger",
          city: "Richmond",
          state: "VA",
          sourceStoreId: "00123",
          addressLine: null,
          postalCode: null,
          latitude: 37.55,
          longitude: -77.45,
          usable: true,
          zipCode: "23220",
        },
        {
          storeId: "aldi-forest-hill",
          name: "Forest Hill",
          chainLabel: "Aldi",
          city: "Richmond",
          state: "VA",
          sourceStoreId: "7003",
          addressLine: "7319 Forest Hill Ave",
          postalCode: "23225",
          latitude: 37.52,
          longitude: -77.49,
          usable: false,
          zipCode: "23225",
        },
        {
          storeId: "kroger-stonebridge",
          name: "Stonebridge",
          chainLabel: "Kroger",
          city: "Richmond",
          state: "VA",
          sourceStoreId: null,
          addressLine: null,
          postalCode: null,
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
        reason: TURN_ZIP_ON_REASON,
        stores: [
          {
            storeId: "aldi-forest-hill",
            name: "Forest Hill",
            chainLabel: "Aldi",
            city: "Richmond",
            state: "VA",
            sourceStoreId: "7003",
            addressLine: "7319 Forest Hill Ave",
            postalCode: "23225",
          },
          {
            storeId: "kroger-stonebridge",
            name: "Stonebridge",
            chainLabel: "Kroger",
            city: "Richmond",
            state: "VA",
            sourceStoreId: null,
            addressLine: null,
            postalCode: null,
          },
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

  it("shows a street and store id without repeating the chain name", () => {
    const foodLion = {
      storeId: "osm-node-1",
      name: "Food Lion",
      chainLabel: "Food Lion",
      city: "Richmond",
      state: "VA",
      sourceStoreId: "osm-node-1",
      addressLine: null,
      postalCode: null,
    };
    expect(reachStoreTitle(foodLion)).toBeNull();
    expect(reachStorePlace(foodLion)).toBe("Richmond, VA. No street address saved.");
    expect(reachStoreIdLine(foodLion)).toBeNull();
    expect(
      reachStorePlace({
        addressLine: "7319 Forest Hill Ave",
        city: "Richmond",
        state: "VA",
        postalCode: "23225",
      }),
    ).toBe("7319 Forest Hill Ave, Richmond, VA 23225");
    expect(reachStoreIdLine({ storeId: "aldi-7003", sourceStoreId: "7003" })).toBe(
      "Store id 7003",
    );
    expect(groupReachStoresByChain([foodLion, foodLion]).map((group) => group.chainLabel)).toEqual([
      "Food Lion",
    ]);
  });

  it("reads a Census coordinate ZIP", () => {
    expect(
      parseCensusCoordinateZcta({
        result: { geographies: { "ZIP Code Tabulation Areas": [{ ZCTA5: "23225" }] } },
      }),
    ).toBe("23225");
  });
});
