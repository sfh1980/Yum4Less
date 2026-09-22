import { describe, expect, it } from "vitest";
import type { CatalogStore } from "@/lib/market-catalog-types";
import { proposeStoreIdentityProximityMatches } from "@/lib/store-identity-proximity-matcher";

function store(partial: Partial<CatalogStore> & Pick<CatalogStore, "id" | "name">): CatalogStore {
  return {
    kind: "grocery",
    city: "Richmond",
    state: "VA",
    latitude: 37.569,
    longitude: -77.466,
    ...partial,
  };
}

describe("proposeStoreIdentityProximityMatches", () => {
  it("links Lombardy OSM Kroger to the official store id as a write pair", () => {
    const proposal = proposeStoreIdentityProximityMatches([
      store({
        id: "osm-way-236488104",
        name: "Kroger",
        sourceName: "openstreetmap-overpass",
        latitude: 37.5694,
        longitude: -77.4662,
      }),
      store({
        id: "kroger-02900511",
        name: "Kroger - Lombardy",
        sourceName: "kroger-official-api",
        sourceStoreId: "02900511",
        latitude: 37.5694,
        longitude: -77.4662,
      }),
    ]);

    expect(proposal.write).toHaveLength(1);
    expect(proposal.write[0]?.osm.id).toBe("osm-way-236488104");
    expect(proposal.write[0]?.official.id).toBe("kroger-02900511");
    expect(proposal.write[0]?.chainId).toBe("kroger");
    expect(proposal.review).toEqual([]);
  });

  it("does not link different chains that sit next to each other", () => {
    const proposal = proposeStoreIdentityProximityMatches([
      store({
        id: "osm-way-aldi",
        name: "Aldi",
        sourceName: "openstreetmap-overpass",
      }),
      store({
        id: "kroger-02900511",
        name: "Kroger - Lombardy",
        sourceName: "kroger-official-api",
        sourceStoreId: "02900511",
      }),
    ]);

    expect(proposal.write).toEqual([]);
    expect(proposal.review).toEqual([]);
  });

  it("keeps Mechanicsville Kroger slug vs official as a same-chain write when collocated", () => {
    const proposal = proposeStoreIdentityProximityMatches([
      store({
        id: "osm-way-kroger-mech",
        name: "Kroger",
        sourceName: "openstreetmap-overpass",
        city: "Mechanicsville",
        latitude: 37.61546,
        longitude: -77.32939,
      }),
      store({
        id: "kroger-02900529",
        name: "Kroger",
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
        city: "Mechanicsville",
        latitude: 37.61546,
        longitude: -77.32939,
      }),
    ]);

    expect(proposal.write.map((pair) => pair.official.id)).toEqual(["kroger-02900529"]);
  });
});
