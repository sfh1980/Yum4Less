import { describe, expect, it } from "vitest";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  filterOsmCatalogStoresConflictingWithIngestedRankedChains,
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
});
