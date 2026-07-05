import { describe, expect, it } from "vitest";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  filterOsmCatalogStoresConflictingWithIngestedRankedChains,
  listOsmGapFillTriggerReasons,
  MAP_RANKED_CHAIN_MIN_DB_PINS,
  needsSearchTimeOsmGapFill,
  resolveMapOsmRankedChainPolicy,
  shouldRunSearchTimeOsmDiscovery,
} from "@/lib/map-osm-ranked-chain-policy";
import { MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES } from "@/lib/market-store-catalog-merge";

const ingestedKroger: CatalogStore = {
  id: "kroger-mechanicsville",
  name: "Kroger",
  kind: "grocery",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.6153,
  longitude: -77.3491,
  sourceName: "kroger-official-api",
};

const osmKrogerConflict: CatalogStore = {
  id: "osm-node-900006",
  name: "Kroger",
  kind: "grocery",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.6095,
  longitude: -77.3736,
  sourceName: "openstreetmap-overpass",
};

const osmCostco: CatalogStore = {
  id: "osm-node-900001",
  name: "Costco Wholesale",
  kind: "big-box",
  city: "Glen Allen",
  state: "VA",
  latitude: 37.6682,
  longitude: -77.4561,
  sourceName: "openstreetmap-overpass",
};

describe("map osm ranked chain policy", () => {
  it("defaults to suppress-conflicts", () => {
    expect(resolveMapOsmRankedChainPolicy(undefined)).toBe("suppress-conflicts");
    expect(shouldRunSearchTimeOsmDiscovery("off")).toBe(false);
    expect(shouldRunSearchTimeOsmDiscovery("suppress-conflicts")).toBe(true);
  });

  it("filters OSM Kroger when ingested Kroger is within ranked dedupe radius", () => {
    const result = filterOsmCatalogStoresConflictingWithIngestedRankedChains(
      [ingestedKroger],
      [osmKrogerConflict, osmCostco],
      MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
    );

    expect(result.suppressedCount).toBe(1);
    expect(result.kept.map((store) => store.id)).toEqual(["osm-node-900001"]);
  });

  it("triggers gap-fill when a ranked chain has fewer than two Postgres pins", () => {
    const reasons = listOsmGapFillTriggerReasons(
      [ingestedKroger],
      ingestedKroger.latitude,
      ingestedKroger.longitude,
      12,
    );

    expect(
      reasons.some(
        (reason) =>
          reason.kind === "ranked-chain-sparse" &&
          reason.chain === "kroger" &&
          reason.pinCount === 1,
      ),
    ).toBe(true);
    expect(MAP_RANKED_CHAIN_MIN_DB_PINS).toBe(2);
    expect(
      needsSearchTimeOsmGapFill(
        [ingestedKroger],
        ingestedKroger.latitude,
        ingestedKroger.longitude,
        12,
      ),
    ).toBe(true);
  });

  it("skips gap-fill when every ranked chain has two or more pins and context chains are present", () => {
    const denseCatalog: CatalogStore[] = [
      { ...ingestedKroger, id: "kroger-a" },
      { ...ingestedKroger, id: "kroger-b", latitude: 37.62, longitude: -77.36 },
      {
        id: "aldi-a",
        name: "Aldi",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6362,
        longitude: -77.3606,
      },
      {
        id: "aldi-b",
        name: "Aldi",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.637,
        longitude: -77.361,
      },
      {
        id: "publix-a",
        name: "Publix",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.632,
        longitude: -77.348,
      },
      {
        id: "publix-b",
        name: "Publix",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.633,
        longitude: -77.349,
      },
      {
        id: "food-lion-a",
        name: "Food Lion",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.618,
        longitude: -77.342,
      },
      {
        id: "food-lion-b",
        name: "Food Lion",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.619,
        longitude: -77.343,
      },
      {
        id: "walmart-a",
        name: "Walmart Supercenter",
        kind: "big-box",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.613604,
        longitude: -77.355424,
      },
      {
        id: "lidl-a",
        name: "Lidl",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6362,
        longitude: -77.3605,
      },
      {
        id: "bjs-a",
        name: "BJ's Wholesale Club",
        kind: "big-box",
        city: "Glen Allen",
        state: "VA",
        latitude: 37.668,
        longitude: -77.456,
      },
      {
        id: "costco-a",
        name: "Costco Wholesale",
        kind: "big-box",
        city: "Glen Allen",
        state: "VA",
        latitude: 37.6682,
        longitude: -77.4561,
      },
      {
        id: "sams-a",
        name: "Sam's Club",
        kind: "big-box",
        city: "Glen Allen",
        state: "VA",
        latitude: 37.669,
        longitude: -77.457,
      },
    ];

    expect(
      needsSearchTimeOsmGapFill(
        denseCatalog,
        ingestedKroger.latitude,
        ingestedKroger.longitude,
        50,
      ),
    ).toBe(false);
  });
});
