import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  formatIngestSourceLabel,
  formatLastVerifiedAge,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";

describe("store map location copy", () => {
  it("labels OSM catalog pins with ingest source", () => {
    expect(
      buildStoreMapLocationNote({
        storeId: "osm-node-900003",
        sourceName: "openstreetmap-overpass",
        lastVerifiedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      }),
    ).toContain("OpenStreetMap");
    expect(
      buildStoreMapLocationNote({
        storeId: "osm-node-900003",
        sourceName: "openstreetmap-overpass",
        lastVerifiedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      }),
    ).toContain("last verified");
  });

  it("labels bootstrap seed catalog pins honestly before live ingest", () => {
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
    ).toBe("Bootstrap pin");
    expect(
      buildStoreMapLocationNote({
        storeId: "kroger-mechanicsville",
        sourceName: "yum4less-internal-catalog",
      }),
    ).toContain("Bootstrap seed coordinates");
  });

  it("labels live Kroger API pins with ingest source and verification age", () => {
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
    ).toBe("API-verified pin");
    expect(note).toContain("Kroger Location API");
    expect(note).toContain("last verified");
  });

  it("labels Publix locator context pins as indicative (not ranked)", () => {
    expect(
      buildStoreMapLocationNote({
        storeId: "publix-1626",
        sourceName: "publix-store-locator",
      }),
    ).toContain("Not used for ranked meal estimates");
    expect(
      formatIngestSourceLabel("publix-store-locator"),
    ).toBe("Publix store locator");
  });

  it("labels Aldi market catalog pins as API-verified (not ZIP centroid)", () => {
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
    ).toBe("API-verified pin");
  });

  it("maps known ingest source names to readable labels", () => {
    expect(formatIngestSourceLabel("kroger-official-api")).toBe(
      "Kroger Location API",
    );
    expect(formatIngestSourceLabel("openstreetmap-overpass")).toBe(
      "OpenStreetMap",
    );
    expect(formatIngestSourceLabel("usda-snap-retailer-locator")).toBe(
      "USDA SNAP retailer directory",
    );
  });

  it("labels USDA SNAP context pins honestly", () => {
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
    ).toBe("SNAP context pin");
    expect(
      buildStoreMapLocationNote({
        storeId: "snap-va-23111-food-lion",
        sourceName: "usda-snap-retailer-locator",
      }),
    ).toMatch(/Not used for ranked meal estimates/i);
  });

  it("formats last verified age for map tooltips", () => {
    expect(
      formatLastVerifiedAge(new Date(Date.now() - 3 * 3_600_000)),
    ).toContain("~3 hours ago");
  });
});
