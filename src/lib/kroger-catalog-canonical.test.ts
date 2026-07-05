import { describe, expect, it } from "vitest";
import {
  dedupeKrogerStoresByIdentity,
  filterSupersededOsmKrogerFixturePins,
  pickPrimaryKrogerStoreForWeeklyAdIngestList,
  preferKrogerCanonicalStoreId,
  scoreKrogerCatalogStorePriority,
} from "@/lib/kroger-catalog-canonical";

describe("kroger-catalog-canonical", () => {
  it("prefers API-derived Kroger ids over bootstrap slugs", () => {
    expect(
      preferKrogerCanonicalStoreId(
        {
          id: "kroger-mechanicsville",
          source_name: "kroger-weekly-ad-scrape",
          source_store_id: "kroger-mechanicsville",
        },
        {
          id: "kroger-02900529",
          source_name: "kroger-official-api",
          source_store_id: "02900529",
        },
      ),
    ).toBe("kroger-02900529");
  });

  it("dedupes same-location Kroger alias rows for Settings/map display", () => {
    const deduped = dedupeKrogerStoresByIdentity([
      {
        id: "kroger-mechanicsville",
        name: "Kroger",
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "kroger-weekly-ad-scrape",
        sourceStoreId: "kroger-mechanicsville",
      },
      {
        id: "kroger-02900529",
        name: "Kroger Marketplace",
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
      },
      {
        id: "aldi-23111",
        name: "ALDI",
        latitude: 37.611,
        longitude: -77.336,
        sourceName: "yum4less-market-catalog",
      },
    ]);

    expect(deduped.map((store) => store.id).sort()).toEqual([
      "aldi-23111",
      "kroger-02900529",
    ]);
  });

  it("keeps distinct Kroger stores when they are nearby but not the same location", () => {
    const deduped = dedupeKrogerStoresByIdentity([
      {
        id: "kroger-02900529",
        name: "Kroger Marketplace",
        latitude: 37.61546,
        longitude: -77.32939,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
      },
      {
        id: "kroger-atlee",
        name: "Kroger Atlee",
        latitude: 37.6282,
        longitude: -77.282,
        sourceName: "kroger-official-api",
        sourceStoreId: "09999999",
      },
    ]);

    expect(deduped.map((store) => store.id).sort()).toEqual([
      "kroger-02900529",
      "kroger-atlee",
    ]);
  });

  it("hides osm fixture Kroger pins when official API catalog exists in radius", () => {
    const filtered = filterSupersededOsmKrogerFixturePins(
      [
        {
          id: "osm-node-900006",
          name: "Kroger",
          latitude: 37.6095,
          longitude: -77.3736,
          sourceName: "kroger-weekly-ad-scrape",
        },
        {
          id: "kroger-02900529",
          name: "Kroger Marketplace",
          latitude: 37.61546,
          longitude: -77.32939,
          sourceName: "kroger-official-api",
          sourceStoreId: "02900529",
        },
      ],
      { latitude: 37.6085, longitude: -77.3739 },
      10,
    );

    expect(filtered.map((store) => store.id)).toEqual(["kroger-02900529"]);
  });

  it("picks API-derived store for ZIP-scoped Kroger weekly-ad ingest", () => {
    expect(
      pickPrimaryKrogerStoreForWeeklyAdIngestList([
        { id: "kroger-mechanicsville", name: "Kroger", chain: "kroger" },
        { id: "kroger-02900511", name: "Kroger Lombardy", chain: "kroger" },
      ]).id,
    ).toBe("kroger-02900511");
  });

  it("scores official API rows above fixture OSM kroger pins", () => {
    expect(
      scoreKrogerCatalogStorePriority({
        id: "kroger-02900529",
        sourceName: "kroger-official-api",
      }),
    ).toBeGreaterThan(
      scoreKrogerCatalogStorePriority({
        id: "osm-node-900006",
        sourceName: "kroger-weekly-ad-scrape",
      }),
    );
  });
});
