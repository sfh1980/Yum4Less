import { describe, expect, it } from "vitest";
import {
  geometryContainsPoint,
  type GeoJsonPolygon,
} from "@/lib/geo/point-in-polygon";
import {
  classifyDensityFromGroceryCount,
  ingestMilesForClass,
  INGEST_ZCTA_SAFETY_CAP_MILES,
  pickPersistedIngestMiles,
} from "@/lib/market-density";
import {
  classifyAndMilesFromGroceryCount,
  storePassesIngestFence,
} from "@/lib/market-ingest-fence";
import {
  classifyOwnerAdmissionGroup,
  formatDensityHeadline,
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
    expect(ingestMilesForClass("packed")).toBe(6);
    expect(INGEST_ZCTA_SAFETY_CAP_MILES).toBe(26);
    expect(classifyAndMilesFromGroceryCount(12)).toEqual({
      densityClass: "packed",
      ingestMiles: 26,
    });
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

  it("admits grocery pins in the ZIP outline out to the 26 mi cap, not the density circle", () => {
    const center = { latitude: 37.55, longitude: -77.45 };
    const hugeZipOutline: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [-79, 37],
          [-76, 37],
          [-76, 39],
          [-79, 39],
          [-79, 37],
        ],
      ],
    };
    const tenMilesNorth = { latitude: 37.6946, longitude: -77.45 };
    const thirtyMilesNorth = { latitude: 37.984, longitude: -77.45 };

    expect(
      storePassesIngestFence({
        ...tenMilesNorth,
        center,
        fence: { ingestMiles: 6, geometry: hugeZipOutline },
      }),
    ).toBe(false);
    expect(
      storePassesIngestFence({
        ...tenMilesNorth,
        center,
        fence: { ingestMiles: 26, geometry: hugeZipOutline },
      }),
    ).toBe(true);
    expect(
      storePassesIngestFence({
        ...thirtyMilesNorth,
        center,
        fence: { ingestMiles: 26, geometry: hugeZipOutline },
      }),
    ).toBe(false);
  });

  it("names the ZIP-outline ingest cap in the Check headline", () => {
    expect(
      formatDensityHeadline({
        zipCode: "23220",
        city: "Richmond",
        state: "VA",
        densityClass: "packed",
        groceryCountIn8Mi: 20,
        ingestMiles: 26,
      }),
    ).toBe(
      "23220 · Richmond, VA · packed (20 grocery pins in 8 mi) · ingest ZIP outline (cap 26 mi)",
    );
  });

  it("omits convenience, bakeries, specialty, and independent grocery leftovers from density counts", () => {
    expect(isConvenienceOrBakeryPin({ name: "7-Eleven" })).toBe(true);
    expect(isConvenienceOrBakeryPin({ name: "Harrison Mini Mart" })).toBe(true);
    expect(isConvenienceOrBakeryPin({ name: "Lark Bake Shoppe" })).toBe(true);
    expect(isConvenienceOrBakeryPin({ name: "Kroger" })).toBe(false);
    expect(isGroceryPinForDensity({ name: "7-Eleven", kind: "specialty" })).toBe(
      false,
    );
    expect(isGroceryPinForDensity({ name: "Fas Mart", kind: "grocery" })).toBe(
      false,
    );
    expect(
      isGroceryPinForDensity({ name: "Capt Gregs Seafood", kind: "grocery" }),
    ).toBe(false);
    expect(isGroceryPinForDensity({ name: "Joe's", kind: "grocery" })).toBe(false);
    expect(isGroceryPinForDensity({ name: "Kroger", kind: "grocery" })).toBe(true);
    expect(
      isGroceryPinForDensity({ name: "Whole Foods Market", kind: "grocery" }),
    ).toBe(true);
    expect(isGroceryPinForDensity({ name: "Target", kind: "big-box" })).toBe(true);
  });

  it("groups ranked banners, food-only variety/clubs, and Target as needs-you", () => {
    expect(classifyOwnerAdmissionGroup("Harris Teeter")).toBe("will-ingest");
    expect(classifyOwnerAdmissionGroup("Dollar General")).toBe("will-ingest");
    expect(classifyOwnerAdmissionGroup("Costco")).toBe("food-only");
    expect(classifyOwnerAdmissionGroup("Target")).toBe("needs-you");
    expect(classifyOwnerAdmissionGroup("Giant")).toBe("needs-you");
  });

  it("skips flyer persist when the content hash is unchanged and rows still exist", () => {
    const hash = weeklyAdFlyerContentHash([
      { productName: "Chicken", price: 5, saleLabel: "sale" },
    ]);
    expect(
      shouldSkipUnchangedFlyerPersist({
        previousHash: hash,
        nextHash: hash,
        targetStoresHaveObservations: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipUnchangedFlyerPersist({
        previousHash: null,
        nextHash: hash,
        targetStoresHaveObservations: true,
      }),
    ).toBe(false);
    expect(
      shouldSkipUnchangedFlyerPersist({
        previousHash: hash,
        nextHash: hash,
        targetStoresHaveObservations: false,
      }),
    ).toBe(false);
  });
});
