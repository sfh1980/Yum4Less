import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  formatIngestSourceLabel,
  formatLastVerifiedAge,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";

describe("store map location copy", () => {
  it("labels live OSM catalog pins with OpenStreetMap source", () => {
    expect(
      buildStoreMapLocationNote({
        storeId: "osm-node-6531578976",
        sourceName: "openstreetmap-overpass",
        lastVerifiedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      }),
    ).toContain("OpenStreetMap");
    expect(
      resolveStoreMapLocationProvenance({
        storeId: "osm-node-6531578976",
        sourceName: "openstreetmap-overpass",
      }),
    ).toBe("osm-context");
  });

  it("labels fixture OSM pins as rehearsal (not live OpenStreetMap)", () => {
    expect(
      resolveStoreMapLocationProvenance({
        storeId: "fixture-osm-node-900003",
        sourceName: "yum4less-map-fixture",
      }),
    ).toBe("map-fixture");
    expect(
      buildStoreMapLocationNote({
        storeId: "fixture-osm-node-900003",
        sourceName: "yum4less-map-fixture",
      }),
    ).toContain("Rehearsal map fixture");
    expect(formatIngestSourceLabel("yum4less-map-fixture")).toBe(
      "map fixture rehearsal",
    );
  });

  it("labels seed catalog pins honestly", () => {
    expect(
      resolveStoreMapLocationProvenance({
        storeId: "kroger-mechanicsville",
        sourceName: "yum4less-internal-catalog",
      }),
    ).toBe("bootstrap");
    expect(
      buildStoreMapLocationBadge({
        storeId: "kroger-mechanicsville",
        sourceName: "yum4less-internal-catalog",
      }),
    ).toBe("Seed catalog pin");
    expect(
      buildStoreMapLocationNote({
        storeId: "kroger-mechanicsville",
        sourceName: "yum4less-internal-catalog",
      }),
    ).toContain("Seed catalog coordinates");
  });

  it("labels verified store pins with source and verification age", () => {
    const note = buildStoreMapLocationNote({
      storeId: "kroger-mechanicsville",
      sourceName: "kroger-official-api",
      lastVerifiedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
    });

    expect(
      resolveStoreMapLocationProvenance({
        storeId: "kroger-mechanicsville",
        sourceName: "kroger-official-api",
      }),
    ).toBe("api-verified");
    expect(
      buildStoreMapLocationBadge({
        storeId: "kroger-mechanicsville",
        sourceName: "kroger-official-api",
        lastVerifiedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      }),
    ).toBe("Verified store pin");
    expect(note).toContain("retailer store directory");
    expect(note).toContain("last verified");
  });

  it("labels store locator context pins as indicative (not ranked)", () => {
    expect(
      buildStoreMapLocationNote({
        storeId: "publix-1626",
        sourceName: "publix-store-locator",
      }),
    ).toContain("Not used for dinner estimates");
    expect(formatIngestSourceLabel("publix-store-locator")).toBe("store locator");
  });

  it("labels market catalog pins as verified (not ZIP centroid)", () => {
    const note = buildStoreMapLocationNote({
      storeId: "aldi-mechanicsville",
      sourceName: "yum4less-market-catalog",
      lastVerifiedAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    });

    expect(note).toContain("not ZIP centroid");
    expect(
      buildStoreMapLocationBadge({
        storeId: "aldi-mechanicsville",
        sourceName: "yum4less-market-catalog",
        lastVerifiedAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
      }),
    ).toBe("Verified store pin");
  });

  it("maps known source names to readable labels", () => {
    expect(formatIngestSourceLabel("kroger-official-api")).toBe(
      "retailer store directory",
    );
    expect(formatIngestSourceLabel("openstreetmap-overpass")).toBe(
      "OpenStreetMap",
    );
    expect(formatIngestSourceLabel("usda-snap-retailer-locator")).toBe(
      "retailer directory",
    );
  });

  it("labels directory context pins honestly", () => {
    expect(
      resolveStoreMapLocationProvenance({
        storeId: "snap-va-23111-food-lion",
        sourceName: "usda-snap-retailer-locator",
      }),
    ).toBe("snap-context");
    expect(
      buildStoreMapLocationBadge({
        storeId: "snap-va-23111-food-lion",
        sourceName: "usda-snap-retailer-locator",
      }),
    ).toBe("Map context pin");
    expect(
      buildStoreMapLocationNote({
        storeId: "snap-va-23111-food-lion",
        sourceName: "usda-snap-retailer-locator",
      }),
    ).toMatch(/Not used for dinner estimates/i);
  });

  it("formats last verified age for map tooltips", () => {
    expect(
      formatLastVerifiedAge(new Date(Date.now() - 3 * 3_600_000)),
    ).toContain("~3 hours ago");
  });
});
