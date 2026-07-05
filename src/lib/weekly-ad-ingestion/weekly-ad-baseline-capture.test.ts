import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getWeeklyAdBaselineCaptureDir,
  persistWeeklyAdBaselineCapture,
  readLatestWeeklyAdBaselineCapture,
} from "@/lib/weekly-ad-ingestion/weekly-ad-baseline-capture";

describe("weekly ad baseline capture", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("persists raw offers and funnel probes under captures/weekly-ad-baseline", () => {
    tempDir = mkdtempSync(joinPath(tmpdir(), "yum4less-baseline-"));
    process.chdir(tempDir);

    const captureDir = persistWeeklyAdBaselineCapture({
      chain: "kroger",
      zipCode: "23111",
      capturedAt: "2026-06-28T12:00:00.000Z",
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [{ productName: "Kroger Black Beans 15 oz", price: 0.99 }],
      funnel: {
        chain: "kroger",
        rawOfferCount: 1,
        matchedCount: 1,
        belowThresholdCount: 0,
        noCandidateCount: 0,
        guardRejectedOnlyCount: 0,
        uniqueMatchedIngredientIds: ["black-beans"],
        probes: [
          {
            productName: "Kroger Black Beans 15 oz",
            price: 0.99,
            outcome: "matched",
            bestConfidence: 0.84,
            matchedIngredientId: "black-beans",
            guardRejectedIngredientIds: [],
            nearMisses: [],
          },
        ],
      },
    });

    expect(captureDir).toContain(getWeeklyAdBaselineCaptureDir("kroger"));
    const rawOffers = JSON.parse(
      readFileSync(joinPath(captureDir, "raw-offers.json"), "utf8"),
    ) as Array<{ productName: string }>;
    expect(rawOffers[0]?.productName).toContain("Black Beans");

    const latest = readLatestWeeklyAdBaselineCapture("kroger");
    expect(latest?.rawOffers).toHaveLength(1);
    expect(latest?.funnel.matchedCount).toBe(1);
  });
});
