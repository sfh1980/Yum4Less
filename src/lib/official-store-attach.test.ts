import { describe, expect, it } from "vitest";
import { getDistanceMiles } from "@/lib/geo-distance";
import {
  chooseAttachedSourceStoreId,
  findSavedStoreForOfficialPin,
  SAME_BUILDING_MILES,
} from "@/lib/official-store-attach";

const ANCHOR = { latitude: 37.61, longitude: -77.34 };

function offsetNorth(miles: number): { latitude: number; longitude: number } {
  return {
    latitude: ANCHOR.latitude + miles / 69,
    longitude: ANCHOR.longitude,
  };
}

describe("chooseAttachedSourceStoreId", () => {
  it("replaces a map pin id with the chain store number", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: "osm-node-42",
        incoming: "02900515",
      }),
    ).toBe("02900515");
  });

  it("keeps a store number already written on a map row", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: "02900515",
        incoming: "02900999",
      }),
    ).toBe("02900515");
  });

  it("fills an empty store number", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: null,
        incoming: "1234",
      }),
    ).toBe("1234");
  });
});

describe("findSavedStoreForOfficialPin", () => {
  it("keeps the OpenStreetMap id when the same chain is within 0.04 miles", () => {
    const near = offsetNorth(0.02);
    expect(getDistanceMiles(ANCHOR.latitude, ANCHOR.longitude, near.latitude, near.longitude)).toBeLessThan(
      SAME_BUILDING_MILES,
    );
    const match = findSavedStoreForOfficialPin({
      stores: [
        {
          id: "kroger-02900529",
          name: "Kroger",
          latitude: near.latitude,
          longitude: near.longitude,
          sourceName: "kroger-official-api",
          sourceStoreId: "02900529",
        },
        {
          id: "osm-way-252997411",
          name: "Kroger",
          latitude: near.latitude,
          longitude: near.longitude,
          sourceName: "openstreetmap-overpass",
          sourceStoreId: "osm-way-252997411",
        },
      ],
      latitude: ANCHOR.latitude,
      longitude: ANCHOR.longitude,
      chainHint: "kroger",
      radiusMiles: SAME_BUILDING_MILES,
      locatorStoreNumber: "02900529",
    });
    expect(match?.id).toBe("osm-way-252997411");
  });

  it("does not match a same-chain store 0.2 miles away", () => {
    const far = offsetNorth(0.2);
    expect(getDistanceMiles(ANCHOR.latitude, ANCHOR.longitude, far.latitude, far.longitude)).toBeGreaterThan(
      0.15,
    );
    const match = findSavedStoreForOfficialPin({
      stores: [
        {
          id: "kroger-02900515",
          name: "Kroger",
          latitude: far.latitude,
          longitude: far.longitude,
          sourceName: "kroger-official-api",
          sourceStoreId: "02900515",
        },
      ],
      latitude: ANCHOR.latitude,
      longitude: ANCHOR.longitude,
      chainHint: "kroger",
      radiusMiles: SAME_BUILDING_MILES,
    });
    expect(match).toBeUndefined();
  });

  it("matches a Publix shopping-center name by source and store number, not the display name", () => {
    const match = findSavedStoreForOfficialPin({
      stores: [
        {
          id: "publix-1626",
          name: "Brandy Creek Commons",
          latitude: ANCHOR.latitude,
          longitude: ANCHOR.longitude,
          sourceName: "publix-store-locator",
          sourceStoreId: "1626",
        },
      ],
      latitude: ANCHOR.latitude,
      longitude: ANCHOR.longitude,
      chainHint: "publix",
      radiusMiles: SAME_BUILDING_MILES,
      locatorStoreNumber: "1626",
    });
    expect(match?.id).toBe("publix-1626");
  });

  it("matches an OpenStreetMap Publix pin by the chain on the name", () => {
    const match = findSavedStoreForOfficialPin({
      stores: [
        {
          id: "osm-way-789560637",
          name: "Publix",
          latitude: ANCHOR.latitude,
          longitude: ANCHOR.longitude,
          sourceName: "openstreetmap-overpass",
          sourceStoreId: "osm-way-789560637",
        },
      ],
      latitude: ANCHOR.latitude,
      longitude: ANCHOR.longitude,
      chainHint: "publix",
      radiusMiles: SAME_BUILDING_MILES,
      locatorStoreNumber: "1626",
    });
    expect(match?.id).toBe("osm-way-789560637");
  });

  it("does not treat a pharmacy or money counter within 0.04 miles as the grocery", () => {
    const pharmacy = findSavedStoreForOfficialPin({
      stores: [
        {
          id: "osm-way-pharmacy",
          name: "Publix Pharmacy",
          latitude: ANCHOR.latitude,
          longitude: ANCHOR.longitude,
          sourceName: "openstreetmap-overpass",
        },
        {
          id: "osm-way-western-union",
          name: "Western Union",
          latitude: ANCHOR.latitude,
          longitude: ANCHOR.longitude,
          sourceName: "openstreetmap-overpass",
        },
      ],
      latitude: ANCHOR.latitude,
      longitude: ANCHOR.longitude,
      chainHint: "publix",
      radiusMiles: SAME_BUILDING_MILES,
      locatorStoreNumber: "1626",
    });
    expect(pharmacy).toBeUndefined();
  });
});
