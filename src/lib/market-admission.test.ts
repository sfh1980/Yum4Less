import { describe, expect, it } from "vitest";
import {
  geometryContainsPoint,
  type GeoJsonPolygon,
} from "@/lib/geo/point-in-polygon";
import {
  classifyDensityFromGroceryCount,
  ingestMilesForClass,
  pickPersistedIngestMiles,
} from "@/lib/market-density";
import {
  classifyOwnerAdmissionGroup,
  isConvenienceOrBakeryPin,
  isGroceryPinForDensity,
} from "@/lib/owner/owner-market-admission";
import {
  shouldSkipUnchangedFlyerPersist,
  weeklyAdFlyerContentHash,
} from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";

const squareAround: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-77.5, 37.5],
      [-77.3, 37.5],
      [-77.3, 37.7],
      [-77.5, 37.7],
      [-77.5, 37.5],
    ],
  ],
};

describe("market admission helpers", () => {
  it("classifies packed/urban/suburban/rural from grocery counts in 8 miles", () => {
    expect(classifyDensityFromGroceryCount(12)).toBe("packed");
    expect(classifyDensityFromGroceryCount(6)).toBe("urban");
    expect(classifyDensityFromGroceryCount(3)).toBe("suburban");
    expect(classifyDensityFromGroceryCount(1)).toBe("rural");
    expect(ingestMilesForClass("urban")).toBe(9);
  });

  it("auto-widens ingest miles and never shrinks a saved value", () => {
    expect(pickPersistedIngestMiles({ savedMiles: 9, computedMiles: 26 })).toBe(26);
    expect(pickPersistedIngestMiles({ savedMiles: 26, computedMiles: 9 })).toBe(26);
    expect(pickPersistedIngestMiles({ savedMiles: null, computedMiles: 9 })).toBe(9);
  });

  it("treats a point inside a polygon as in the ZCTA and a far point as out", () => {
    expect(geometryContainsPoint(squareAround, -77.37, 37.61)).toBe(true);
    expect(geometryContainsPoint(squareAround, -78, 38)).toBe(false);
  });

  it("omits convenience and bakeries from inventory and density grocery counts", () => {
    expect(isConvenienceOrBakeryPin({ name: "7-Eleven" })).toBe(true);
    expect(isConvenienceOrBakeryPin({ name: "Kroger" })).toBe(false);
    expect(isGroceryPinForDensity({ name: "7-Eleven", kind: "specialty" })).toBe(
      false,
    );
    expect(isGroceryPinForDensity({ name: "Kroger", kind: "grocery" })).toBe(true);
  });

  it("groups ranked banners, food-only variety/clubs, and Target as needs-you", () => {
    expect(classifyOwnerAdmissionGroup("Harris Teeter")).toBe("will-ingest");
    expect(classifyOwnerAdmissionGroup("Dollar General")).toBe("food-only");
    expect(classifyOwnerAdmissionGroup("Costco")).toBe("food-only");
    expect(classifyOwnerAdmissionGroup("Target")).toBe("needs-you");
    expect(classifyOwnerAdmissionGroup("Giant")).toBe("needs-you");
  });

  it("skips flyer persist when the content hash is unchanged", () => {
    const hash = weeklyAdFlyerContentHash([
      { productName: "Chicken", price: 5, saleLabel: "sale" },
    ]);
    expect(
      shouldSkipUnchangedFlyerPersist({ previousHash: hash, nextHash: hash }),
    ).toBe(true);
    expect(
      shouldSkipUnchangedFlyerPersist({ previousHash: null, nextHash: hash }),
    ).toBe(false);
  });
});
