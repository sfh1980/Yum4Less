import { describe, expect, it } from "vitest";
import {
  buildNearbyStoresMapModel,
  getMapBounds,
} from "@/lib/nearby-stores-map-model";

describe("nearby stores map model", () => {
  it("builds map markers from the market summary anchor and nearby stores", () => {
    const model = buildNearbyStoresMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3321,
      lookupSource: "geocodio",
      radiusMiles: 5,
      dataSource: "database",
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger",
          kind: "grocery",
          latitude: 37.6153,
          longitude: -77.3491,
          distanceMiles: 2.4,
          chain: "kroger",
          chainLabel: "Kroger",
          rolloutStatus: "weekly-ad-preview",
          recommendationEnabled: true,
          rolloutNote: "Seed preview pricing",
        },
      ],
    });

    expect(model.anchor.label).toBe("Mechanicsville, VA");
    expect(model.anchor.source).toBe("zip");
    expect(model.stores).toHaveLength(1);
    expect(model.trustNote).toContain("saved local store locations");
    expect(model.trustNote).toContain("Walmart pins are context only");
    expect(model.trustNote).toContain("Live store lookups");
  });

  it("computes bounds that include the anchor and store coordinates", () => {
    const bounds = getMapBounds({
      anchor: {
        latitude: 37.6085,
        longitude: -77.3321,
        label: "Mechanicsville, VA",
        source: "zip",
      },
      radiusMiles: 5,
      stores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger",
          latitude: 37.6153,
          longitude: -77.3491,
          distanceMiles: 2.4,
          chainLabel: "Kroger",
          chain: "kroger",
          recommendationEnabled: true,
          rolloutStatus: "weekly-ad-preview",
          rolloutNote: "Seed preview pricing",
        },
      ],
      trustNote: "Trust note",
    });

    expect(bounds.kind).toBe("bounds");
    if (bounds.kind === "bounds") {
      expect(bounds.southWest[0]).toBeLessThanOrEqual(bounds.northEast[0]);
      expect(bounds.southWest[1]).toBeLessThanOrEqual(bounds.northEast[1]);
    }
  });
});
