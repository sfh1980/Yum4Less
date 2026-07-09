import { describe, expect, it } from "vitest";
import { buildWeeklyAdIngestStoreCandidates } from "@/lib/ingest/weekly-ad-ingest-store-selection";

describe("buildWeeklyAdIngestStoreCandidates", () => {
  it("includes locator-backed Publix stores when display name omits Publix", () => {
    const candidates = buildWeeklyAdIngestStoreCandidates([
      {
        id: "publix-1626",
        name: "Brandy Creek Commons",
        sourceName: "publix-store-locator",
        latitude: 37.610899,
        longitude: -77.335779,
      },
      {
        id: "publix-1566",
        name: "Nuckols Place",
        sourceName: "publix-store-locator",
        latitude: 37.683972,
        longitude: -77.586556,
      },
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates.every((store) => store.chain === "publix")).toBe(true);
    expect(candidates.map((store) => store.id)).toEqual([
      "publix-1626",
      "publix-1566",
    ]);
  });

  it("still resolves chains from branded display names", () => {
    const candidates = buildWeeklyAdIngestStoreCandidates([
      {
        id: "aldi-mechanicsville",
        name: "ALDI",
        sourceName: "aldi-weekly-ad-scrape",
        latitude: 37.61,
        longitude: -77.34,
      },
      {
        id: "food-lion-mechanicsville",
        name: "Food Lion",
        sourceName: "food-lion-weekly-ad-scrape",
        latitude: 37.61,
        longitude: -77.34,
      },
    ]);

    expect(candidates.map((store) => store.chain)).toEqual(["aldi", "food-lion"]);
  });

  it("excludes unknown catalog rows from weekly-ad ingest", () => {
    const candidates = buildWeeklyAdIngestStoreCandidates([
      {
        id: "osm-node-123",
        name: "Mystery Market",
        sourceName: "openstreetmap-overpass",
        latitude: 37.61,
        longitude: -77.34,
      },
    ]);

    expect(candidates).toEqual([]);
  });
});
