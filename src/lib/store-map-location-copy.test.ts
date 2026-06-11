import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationNote,
  formatIngestSourceLabel,
  formatLastVerifiedAge,
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

    expect(note).toContain("Kroger Location API");
    expect(note).toContain("last verified");
  });

  it("maps known ingest source names to readable labels", () => {
    expect(formatIngestSourceLabel("kroger-official-api")).toBe(
      "Kroger Location API",
    );
    expect(formatIngestSourceLabel("openstreetmap-overpass")).toBe(
      "OpenStreetMap",
    );
  });

  it("formats last verified age for map tooltips", () => {
    expect(
      formatLastVerifiedAge(new Date(Date.now() - 3 * 3_600_000)),
    ).toContain("~3 hours ago");
  });
});
