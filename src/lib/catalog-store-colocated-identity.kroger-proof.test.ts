/**
 * Behavior-preservation proof: existing Settings Kroger fixtures stay identical
 * under collapseSameChainCollocatedCatalogStores vs legacy dedupeKrogerStoresByIdentity.
 * The ~0.10 mi threshold split is permanently pinned in catalog-store-colocated-identity.test.ts.
 */
import { describe, expect, it } from "vitest";
import { dedupeKrogerStoresByIdentity } from "@/lib/kroger-catalog-canonical";
import { collapseSameChainCollocatedCatalogStores } from "@/lib/catalog-store-colocated-identity";

type Row = {
  id: string;
  name: string;
  chain: string;
  latitude: number;
  longitude: number;
  sourceName?: string;
  sourceStoreId?: string;
  distanceMiles?: number;
};

function ids(rows: { id: string }[]) {
  return rows.map((row) => row.id);
}

/** Existing Settings fixture: co-located marketplace + slug (0.00 mi). */
const settingsCoLocatedKroger: Row[] = [
  {
    id: "kroger-mechanicsville",
    name: "Kroger",
    chain: "kroger",
    latitude: 37.61546,
    longitude: -77.32939,
    sourceName: "kroger-weekly-ad-scrape",
    sourceStoreId: "kroger-mechanicsville",
    distanceMiles: 2.4,
  },
  {
    id: "kroger-02900529",
    name: "Kroger Marketplace",
    chain: "kroger",
    latitude: 37.61546,
    longitude: -77.32939,
    sourceName: "kroger-official-api",
    sourceStoreId: "02900529",
    distanceMiles: 2.5,
  },
  {
    id: "aldi-mechanicsville",
    name: "Aldi",
    chain: "aldi",
    latitude: 37.611,
    longitude: -77.336,
    sourceName: "aldi-weekly-ad-scrape",
    distanceMiles: 2,
  },
];

/** Existing Settings fixture: two distinct Kroger APIs. */
const settingsDistinctKroger: Row[] = [
  {
    id: "kroger-02900529",
    name: "Kroger Marketplace",
    chain: "kroger",
    latitude: 37.61546,
    longitude: -77.32939,
    sourceStoreId: "02900529",
    sourceName: "kroger-official-api",
    distanceMiles: 2.7,
  },
  {
    id: "kroger-atlee",
    name: "Kroger Atlee",
    chain: "kroger",
    latitude: 37.6282,
    longitude: -77.282,
    sourceStoreId: "09999999",
    sourceName: "kroger-official-api",
    distanceMiles: 3.5,
  },
];

describe("Kroger Settings fold proof", () => {
  it("existing Settings co-located fixture: identical survivor ids", () => {
    const oldIds = ids(dedupeKrogerStoresByIdentity(settingsCoLocatedKroger)).sort();
    const newIds = ids(
      collapseSameChainCollocatedCatalogStores(settingsCoLocatedKroger),
    ).sort();
    expect(newIds).toEqual(oldIds);
  });

  it("existing Settings distinct Kroger fixture: identical survivor ids", () => {
    const oldIds = ids(dedupeKrogerStoresByIdentity(settingsDistinctKroger)).sort();
    const newIds = ids(
      collapseSameChainCollocatedCatalogStores(settingsDistinctKroger),
    ).sort();
    expect(newIds).toEqual(oldIds);
  });
});
