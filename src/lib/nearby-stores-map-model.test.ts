import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";
import {
  buildDiscoveryMapModel,
  buildSingleStoreMapModel,
  buildZipCenterPickMapModel,
  getMapBounds,
} from "@/lib/nearby-stores-map-model";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

function withLocationFields(
  store: Partial<NearbyStoreSummary> & Pick<NearbyStoreSummary, "id" | "name">,
): NearbyStoreSummary {
  const locationInput = {
    storeId: store.id,
    sourceName: store.sourceName,
    lastVerifiedAt: store.lastVerifiedAt,
  };

  return buildTestNearbyStoreSummary({
    ...store,
    locationProvenance: resolveStoreMapLocationProvenance(locationInput),
    locationBadge: buildStoreMapLocationBadge(locationInput),
    locationNote: buildStoreMapLocationNote(locationInput),
  });
}

describe("nearby stores map model", () => {
  it("builds discovery map markers from the market summary anchor and nearby stores", () => {
    const model = buildDiscoveryMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3321,
      lookupSource: "geocodio",
      radiusMiles: 5,
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

    expect(model.kind).toBe("discovery");
    expect(model.anchor.label).toBe("Mechanicsville, VA");
    expect(model.anchor.source).toBe("zip");
    expect(model.stores).toHaveLength(1);
    expect(model.stores[0]?.rolloutNote).toBe("Seed preview pricing");
    expect(model.stores[0]?.locationNote).toContain("Seed catalog coordinates");
    expect(model.usesOsmCatalogData).toBe(false);
  });

  it("flags OSM map-catalog pins for attribution", () => {
    const model = buildDiscoveryMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3321,
      lookupSource: "geocodio",
      radiusMiles: 12,
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

  it("builds a single-store model with one pin and no search radius", () => {
    const store = withLocationFields({
      id: "kroger-mechanicsville",
      name: "Kroger",
      kind: "grocery",
      latitude: 37.6153,
      longitude: -77.3491,
      distanceMiles: 1.2,
      chain: "kroger",
      chainLabel: "Kroger",
      rolloutStatus: "weekly-ad-preview",
      recommendationEnabled: true,
      rolloutNote: "Seed preview pricing",
      sourceName: "yum4less-internal-catalog",
    });

    const model = buildSingleStoreMapModel(store);

    expect(model.kind).toBe("single-store");
    expect(model.store.id).toBe("kroger-mechanicsville");
    expect("radiusMiles" in model).toBe(false);
    expect("anchor" in model).toBe(false);
  });

  it("computes bounds that include the anchor and store coordinates", () => {
    const bounds = getMapBounds({
      kind: "discovery",
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
          locationProvenance: "bootstrap",
          locationBadge: "Catalog coordinates",
        },
      ],
    });

    expect(bounds.kind).toBe("bounds");
    if (bounds.kind === "bounds") {
      expect(bounds.southWest[0]).toBeLessThanOrEqual(bounds.northEast[0]);
      expect(bounds.southWest[1]).toBeLessThanOrEqual(bounds.northEast[1]);
    }
  });

  it("centers single-store bounds on the lone store pin", () => {
    const bounds = getMapBounds({
      kind: "single-store",
      usesOsmCatalogData: false,
      store: {
        id: "kroger-mechanicsville",
        name: "Kroger",
        latitude: 37.6153,
        longitude: -77.3491,
        distanceMiles: 1.2,
        chainLabel: "Kroger",
        chain: "kroger",
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
        rolloutNote: "Seed preview pricing",
        locationNote: "Indicative beta map pin — verify the store address before visiting.",
        locationProvenance: "bootstrap",
        locationBadge: "Catalog coordinates",
      },
    });

    expect(bounds).toEqual({
      kind: "center",
      center: [37.6153, -77.3491],
      zoom: 14,
    });
  });

  it("builds a ZIP center-pick model and bounds around the ZIP focus", () => {
    const model = buildZipCenterPickMapModel({
      latitude: 37.6085,
      longitude: -77.3321,
      label: "Mechanicsville, VA",
      radiusMiles: 5,
      pendingCenter: { latitude: 37.61, longitude: -77.34 },
    });

    expect(model.kind).toBe("zip-center-pick");
    expect(model.pendingCenter).toEqual({ latitude: 37.61, longitude: -77.34 });
    expect(getMapBounds(model)).toEqual({
      kind: "center",
      center: [37.6085, -77.3321],
      zoom: 12,
    });
  });
});
