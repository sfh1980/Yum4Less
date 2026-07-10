import { describe, expect, it } from "vitest";
import {
  groupWeeklyAdIngestStoresByChain,
  pickPrimaryWeeklyAdIngestStoreForChain,
  scoreWeeklyAdIngestStorePriority,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingest-store-priority";

describe("weekly-ad ingest store priority", () => {
  it("prefers catalog rows over OSM pins for the same chain", () => {
    expect(scoreWeeklyAdIngestStorePriority({ id: "aldi-mechanicsville" })).toBe(5);
    expect(scoreWeeklyAdIngestStorePriority({ id: "osm-node-6531578976" })).toBe(1);

    const primary = pickPrimaryWeeklyAdIngestStoreForChain([
      { id: "osm-node-6531578976", name: "ALDI", chain: "aldi" },
      { id: "aldi-mechanicsville", name: "ALDI", chain: "aldi" },
    ]);

    expect(primary.id).toBe("aldi-mechanicsville");
  });

  it("groups nearby stores by chain for one-ingest-per-chain fan-out", () => {
    const grouped = groupWeeklyAdIngestStoresByChain([
      { id: "aldi-mechanicsville", name: "ALDI", chain: "aldi" },
      { id: "osm-node-6531578976", name: "ALDI", chain: "aldi" },
      { id: "food-lion-mechanicsville", name: "Food Lion", chain: "food-lion" },
      { id: "publix-1626", name: "Brandy Creek Commons", chain: "publix" },
      { id: "publix-1566", name: "Nuckols Place", chain: "publix" },
    ]);

    expect([...grouped.keys()].sort()).toEqual(["aldi", "food-lion", "publix"]);
    expect(grouped.get("aldi")).toHaveLength(2);
    expect(grouped.get("publix")).toHaveLength(2);
  });
});
