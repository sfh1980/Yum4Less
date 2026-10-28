import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEDULED_INGEST_STEP_ORDER, isScheduledIngestStepNonFatal } from "@/lib/scheduled-ingest-pipeline";

const SCHEDULED_SCRIPT_PATH = join(
  process.cwd(),
  "scripts",
  "run-scheduled-weekly-ad-ingest.mjs",
);

const STEP_MARKERS: Record<(typeof SCHEDULED_INGEST_STEP_ORDER)[number], string> = {
  "map-catalog": "ingest:map-catalog",
  "weekly-ad": "run-weekly-ad-ingest.mjs",
  "snap-ensure": "ensure-snap-context.mjs",
  "provider-sync": "sync:provider-prices",
  "themealdb-from-sales": "ingest:themealdb:from-sales",
  "ranked-price-freshness": "check:ranked-price-freshness",
};

describe("scheduled ingest pipeline order", () => {
  it("documents map-catalog before weekly-ad in the canonical step list", () => {
    const mapIndex = SCHEDULED_INGEST_STEP_ORDER.indexOf("map-catalog");
    const weeklyIndex = SCHEDULED_INGEST_STEP_ORDER.indexOf("weekly-ad");
    expect(mapIndex).toBeGreaterThanOrEqual(0);
    expect(weeklyIndex).toBeGreaterThan(mapIndex);
  });

  it("matches spawn order in run-scheduled-weekly-ad-ingest.mjs", () => {
    const source = readFileSync(SCHEDULED_SCRIPT_PATH, "utf8");
    const positions = SCHEDULED_INGEST_STEP_ORDER.map(
      (step) => source.indexOf(STEP_MARKERS[step]),
    );

    for (const position of positions) {
      expect(position).toBeGreaterThan(-1);
    }

    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]!).toBeGreaterThan(positions[index - 1]!);
    }
  });

  it("keeps a recipe-import failure from stopping the night", () => {
    expect(isScheduledIngestStepNonFatal("themealdb-from-sales")).toBe(true);
    expect(isScheduledIngestStepNonFatal("weekly-ad")).toBe(false);
    const source = readFileSync(SCHEDULED_SCRIPT_PATH, "utf8");
    const themealdb = source.indexOf("ingest:themealdb:from-sales");
    const freshness = source.indexOf("check:ranked-price-freshness");
    const between = source.slice(themealdb, freshness);
    expect(between).toContain("Recipe import did not finish.");
    expect(between).not.toContain("process.exit");
    const worker = readFileSync(
      join(process.cwd(), "scripts", "run-ingest-worker.ts"),
      "utf8",
    );
    expect(worker).toContain("isScheduledIngestStepNonFatal");
  });
});
