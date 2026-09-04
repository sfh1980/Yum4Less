import { describe, expect, it } from "vitest";
import {
  defaultSelectedStoreIdsForSettings,
  filterSettingsSelectableStores,
} from "@/lib/settings-store-selection";
import { formatSettingsStoreOptionLabel } from "@/lib/store-display-labels";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

function store(
  partial: Partial<NearbyStoreSummary> & Pick<NearbyStoreSummary, "id" | "name" | "chain">,
): NearbyStoreSummary {
  return buildTestNearbyStoreSummary({
    city: partial.city ?? "Mechanicsville",
    state: partial.state ?? "VA",
    kind: "grocery",
    latitude: 37.6,
    longitude: -77.3,
    distanceMiles: partial.distanceMiles ?? 1,
    chainLabel: partial.chain === "kroger" ? "Kroger" : "Aldi",
    rolloutStatus: "coming-soon",
    recommendationEnabled: partial.recommendationEnabled ?? false,
    rolloutNote: "Fixture note.",
    locationProvenance: "bootstrap",
    locationBadge: "Seed",
    locationNote: "Fixture.",
    ...partial,
  });
}

describe("filterSettingsSelectableStores", () => {
  it("includes Kroger, Aldi, Publix, Food Lion, Walmart, and Lidl even when recommendation gates are off", () => {
    const filtered = filterSettingsSelectableStores([
      store({ id: "osm-1", name: "Wawa", chain: "unknown" }),
      store({
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        recommendationEnabled: false,
      }),
      store({ id: "aldi-1", name: "Aldi", chain: "aldi", recommendationEnabled: false }),
      store({ id: "publix-1", name: "Publix", chain: "publix", recommendationEnabled: false }),
      store({
        id: "food-lion-1",
        name: "Food Lion",
        chain: "food-lion",
        recommendationEnabled: false,
      }),
      store({ id: "lidl-1", name: "Lidl", chain: "lidl", recommendationEnabled: false }),
      store({
        id: "walmart-1",
        name: "Walmart Supercenter",
        chain: "walmart",
        recommendationEnabled: false,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "kroger-1",
      "aldi-1",
      "publix-1",
      "food-lion-1",
      "walmart-1",
      "lidl-1",
    ]);
  });

  it("includes Whole Foods, Target, and clubs as selectable context stores without adapters", () => {
    const filtered = filterSettingsSelectableStores([
      store({ id: "osm-1", name: "Wawa", chain: "unknown" }),
      store({
        id: "mini-1",
        name: "Harrison Mini Mart",
        chain: "unknown",
      }),
      store({
        id: "cvs-1",
        name: "CVS Pharmacy",
        chain: "unknown",
      }),
      store({
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        recommendationEnabled: true,
        distanceMiles: 1,
      }),
      store({
        id: "whole-foods-1",
        name: "Whole Foods Market",
        chain: "unknown",
        recommendationEnabled: false,
        distanceMiles: 2,
      }),
      store({
        id: "target-1",
        name: "Target",
        chain: "unknown",
        kind: "big-box",
        recommendationEnabled: false,
        distanceMiles: 3,
      }),
      store({
        id: "costco-1",
        name: "Costco",
        chain: "unknown",
        kind: "big-box",
        recommendationEnabled: false,
        distanceMiles: 4,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "kroger-1",
      "whole-foods-1",
      "target-1",
      "costco-1",
    ]);
  });

  it("omits convenience, bakeries, specialty, and independent OSM grocery leftovers", () => {
    const filtered = filterSettingsSelectableStores([
      store({ id: "snack-1", name: "Snack Shop", chain: "unknown", kind: "grocery" }),
      store({ id: "dash-1", name: "Dash In", chain: "unknown", kind: "specialty" }),
      store({ id: "fas-1", name: "Fas Mart", chain: "unknown", kind: "grocery" }),
      store({
        id: "bake-1",
        name: "Lark Bake Shoppe",
        chain: "unknown",
        kind: "grocery",
      }),
      store({
        id: "seafood-1",
        name: "Capt Gregs Seafood",
        chain: "unknown",
        kind: "grocery",
      }),
      store({ id: "joes-1", name: "Joe's", chain: "unknown", kind: "grocery" }),
      store({
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        recommendationEnabled: true,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual(["kroger-1"]);
  });

  it("prefers non-OSM Kroger rows when catalog stores exist", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "osm-way-kroger",
        name: "Kroger",
        chain: "kroger",
        distanceMiles: 0.5,
      }),
      store({
        id: "kroger-mechanicsville",
        name: "Kroger Mechanicsville",
        chain: "kroger",
        distanceMiles: 2,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual(["kroger-mechanicsville"]);
  });

  it("excludes fixture and legacy synthetic OSM pins from Settings selection", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "fixture-osm-node-900007",
        name: "Aldi",
        chain: "aldi",
        sourceName: "yum4less-map-fixture",
        distanceMiles: 0.4,
      }),
      store({
        id: "osm-node-900007",
        name: "Aldi",
        chain: "aldi",
        sourceName: "openstreetmap-overpass",
        distanceMiles: 0.5,
      }),
      store({
        id: "aldi-mechanicsville",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 1.2,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual(["aldi-mechanicsville"]);
  });

  it("keeps nearby OSM ranked-chain stores when catalog rows exist for other chains", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "kroger-mechanicsville",
        name: "Kroger",
        chain: "kroger",
        distanceMiles: 4.8,
        latitude: 37.61546,
        longitude: -77.32939,
      }),
      store({
        id: "osm-way-food-lion",
        name: "Food Lion",
        chain: "food-lion",
        distanceMiles: 1.2,
        latitude: 37.61,
        longitude: -77.34,
        city: "Richmond",
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "osm-way-food-lion",
      "kroger-mechanicsville",
    ]);
  });

  it("dedupes co-located Kroger marketplace and slug rows in Settings", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "kroger-mechanicsville",
        name: "Kroger",
        chain: "kroger",
        distanceMiles: 2.4,
        latitude: 37.61546,
        longitude: -77.32939,
      }),
      store({
        id: "kroger-02900529",
        name: "Kroger Marketplace",
        chain: "kroger",
        distanceMiles: 2.5,
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
      }),
      store({
        id: "aldi-mechanicsville",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 2,
        latitude: 37.611,
        longitude: -77.336,
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "aldi-mechanicsville",
      "kroger-02900529",
    ]);
  });

  it("collapses collocated Aldi slug + ZIP-market twins to the slug winner", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "aldi-mechanicsville",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 1.1,
        latitude: 37.611004,
        longitude: -77.336853,
        sourceName: "aldi-weekly-ad-scrape",
      }),
      store({
        id: "aldi-23111",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 1.2,
        latitude: 37.611004,
        longitude: -77.336853,
        sourceName: "yum4less-market-catalog",
        sourceStoreId: "osm-node-6531578976",
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual(["aldi-mechanicsville"]);
  });

  it("collapses collocated Food Lion catalog twins", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "food-lion-mechanicsville",
        name: "Food Lion",
        chain: "food-lion",
        distanceMiles: 1.4,
        latitude: 37.61,
        longitude: -77.34,
        sourceName: "food-lion-weekly-ad-scrape",
      }),
      store({
        id: "food-lion-23111",
        name: "Food Lion",
        chain: "food-lion",
        distanceMiles: 1.5,
        latitude: 37.61,
        longitude: -77.34,
        sourceName: "yum4less-market-catalog",
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "food-lion-mechanicsville",
    ]);
  });

  it("keeps non-Kroger catalog twins when they sit between 0.05 and 0.15 mi", () => {
    // Same constructed ~0.10 mi band pinned in catalog-store-colocated-identity.test.ts
    const filtered = filterSettingsSelectableStores([
      store({
        id: "aldi-slug",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 1,
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "aldi-weekly-ad-scrape",
      }),
      store({
        id: "aldi-near",
        name: "Aldi",
        chain: "aldi",
        distanceMiles: 1.1,
        latitude: 37.61546 + 0.00145,
        longitude: -77.32939,
        sourceName: "yum4less-market-catalog",
      }),
    ]);

    expect(filtered.map((entry) => entry.id).sort()).toEqual([
      "aldi-near",
      "aldi-slug",
    ]);
  });

  it("collapses Kroger twins at ~0.10 mi under the 0.15 mi exception", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "kroger-slug",
        name: "Kroger",
        chain: "kroger",
        distanceMiles: 1,
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "kroger-weekly-ad-scrape",
      }),
      store({
        id: "kroger-02900999",
        name: "Kroger",
        chain: "kroger",
        distanceMiles: 1.1,
        latitude: 37.61546 + 0.00145,
        longitude: -77.32939,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900999",
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual(["kroger-02900999"]);
  });

  it("keeps multiple distinct Kroger stores within the selected radius", () => {
    const filtered = filterSettingsSelectableStores([
      store({
        id: "kroger-02900529",
        name: "Kroger Marketplace",
        chain: "kroger",
        distanceMiles: 2.7,
        latitude: 37.61546,
        longitude: -77.32939,
        sourceStoreId: "02900529",
        sourceName: "kroger-official-api",
      }),
      store({
        id: "kroger-atlee",
        name: "Kroger Atlee",
        chain: "kroger",
        distanceMiles: 3.5,
        latitude: 37.6282,
        longitude: -77.282,
        sourceStoreId: "09999999",
        sourceName: "kroger-official-api",
      }),
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "kroger-02900529",
      "kroger-atlee",
    ]);
  });
});

describe("defaultSelectedStoreIdsForSettings", () => {
  it("picks the first ranked-chain store for single-store mode when gates are off", () => {
    const stores = [
      store({
        id: "kroger-1",
        name: "Kroger",
        chain: "kroger",
        recommendationEnabled: false,
      }),
    ];

    expect(defaultSelectedStoreIdsForSettings(stores, "single-store")).toEqual(["kroger-1"]);
  });

  it("defaults multi-store to ranked-ready stores when mixed with context-only grocery", () => {
    const stores = [
      store({
        id: "whole-foods-1",
        name: "Whole Foods Market",
        chain: "unknown",
        recommendationEnabled: false,
      }),
      store({
        id: "kroger-1",
        name: "Kroger",
        chain: "kroger",
        recommendationEnabled: true,
      }),
    ];

    expect(defaultSelectedStoreIdsForSettings(stores, "multi-store")).toEqual(["kroger-1"]);
  });
});

describe("formatSettingsStoreOptionLabel", () => {
  it("includes name, city/state, and distance", () => {
    expect(
      formatSettingsStoreOptionLabel({
        name: "Kroger",
        city: "Mechanicsville",
        state: "VA",
        distanceMiles: 2.4,
      }),
    ).toBe("Kroger — Mechanicsville, VA (2.4 mi straight-line)");
  });
});
