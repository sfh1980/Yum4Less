import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";
import {
  buildNearbyStoresMapModel,
  getMapBounds,
} from "@/lib/nearby-stores-map-model";

function withLocationFields<
  T extends { id: string; sourceName?: string; lastVerifiedAt?: string },
>(store: T) {
  const locationInput = {
    storeId: store.id,
    sourceName: store.sourceName,
    lastVerifiedAt: store.lastVerifiedAt,
  };

  return {
    ...store,
    locationProvenance: resolveStoreMapLocationProvenance(locationInput),
    locationBadge: buildStoreMapLocationBadge(locationInput),
    locationNote: buildStoreMapLocationNote(locationInput),
  };
}

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
        withLocationFields({
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
          sourceName: "yum4less-internal-catalog",
        }),
      ],
    });

    expect(model.anchor.label).toBe("Mechanicsville, VA");
    expect(model.anchor.source).toBe("zip");
    expect(model.stores).toHaveLength(1);
    expect(model.stores[0]?.rolloutNote).toBe("Seed preview pricing");
    expect(model.stores[0]?.locationNote).toContain("Seed catalog coordinates");
    expect(model.usesOsmCatalogData).toBe(false);
  });

  it("flags OSM map-catalog pins for attribution", () => {
    const model = buildNearbyStoresMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3321,
      lookupSource: "geocodio",
      radiusMiles: 12,
      dataSource: "database",
      nearbyStores: [
        withLocationFields({
          id: "osm-node-900001",
          name: "Costco Wholesale",
          kind: "big-box",
          latitude: 37.6682,
          longitude: -77.4561,
          distanceMiles: 8.2,
          chain: "unknown",
          chainLabel: "Other stores",
          rolloutStatus: "coming-soon",
          recommendationEnabled: false,
          rolloutNote: "Map context only",
          sourceName: "openstreetmap-overpass",
        }),
      ],
    });

    expect(model.usesOsmCatalogData).toBe(true);
    expect(model.stores[0]?.locationNote).toContain("OpenStreetMap");
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
      usesOsmCatalogData: false,
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
          locationNote: "Indicative beta map pin — verify the store address before visiting.",
        },
      ],
    });

    expect(bounds.kind).toBe("bounds");
    if (bounds.kind === "bounds") {
      expect(bounds.southWest[0]).toBeLessThanOrEqual(bounds.northEast[0]);
      expect(bounds.southWest[1]).toBeLessThanOrEqual(bounds.northEast[1]);
    }
  });
});
