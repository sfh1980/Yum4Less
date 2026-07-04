import { describe, expect, it } from "vitest";
import {
  shouldFailProviderPriceSyncExit,
  shouldFailWeeklyAdIngestExit,
} from "@/lib/ingest/ingest-script-exit-policy";

describe("shouldFailProviderPriceSyncExit", () => {
  it("returns false when every summary has zero failedCount", () => {
    expect(
      shouldFailProviderPriceSyncExit([
        { failedCount: 0 },
        { failedCount: 0 },
      ]),
    ).toBe(false);
  });

  it("returns true when any summary reports persist failures", () => {
    expect(
      shouldFailProviderPriceSyncExit([
        { failedCount: 0 },
        { failedCount: 2 },
      ]),
    ).toBe(true);
  });
});

describe("shouldFailWeeklyAdIngestExit", () => {
  it("returns true when any sync summary reports persist failures", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [{ status: "live" }],
        syncSummaries: [{ failedCount: 1 }],
      }),
    ).toBe(true);
  });

  it("returns true when any chain result status is error", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live" },
          { status: "error" },
        ],
        syncSummaries: [{ failedCount: 0 }],
      }),
    ).toBe(true);
  });

  it("returns false when all chains succeed and no persist failures", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live" },
          { status: "cached" },
        ],
        syncSummaries: [{ failedCount: 0 }],
      }),
    ).toBe(false);
  });

  it("returns false when partial chain success remains after one chain error is absent", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [{ status: "not-configured" }],
        syncSummaries: [{ failedCount: 0 }],
      }),
    ).toBe(false);
  });
});
