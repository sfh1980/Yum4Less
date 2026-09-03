import { describe, expect, it } from "vitest";
import {
  isWeeklyAdFailLoudChain,
  shouldFailProviderPriceSyncExit,
  shouldFailWeeklyAdIngestExit,
} from "@/lib/ingest/ingest-script-exit-policy";

describe("isWeeklyAdFailLoudChain", () => {
  it("treats missing chain as fail-loud", () => {
    expect(isWeeklyAdFailLoudChain(undefined)).toBe(true);
  });

  it("keeps Kroger, Aldi, Publix, Food Lion, Walmart, and Dollar General fail-loud", () => {
    expect(isWeeklyAdFailLoudChain("kroger")).toBe(true);
    expect(isWeeklyAdFailLoudChain("aldi")).toBe(true);
    expect(isWeeklyAdFailLoudChain("publix")).toBe(true);
    expect(isWeeklyAdFailLoudChain("food-lion")).toBe(true);
    expect(isWeeklyAdFailLoudChain("walmart")).toBe(true);
    expect(isWeeklyAdFailLoudChain("dollar-general")).toBe(true);
    expect(isWeeklyAdFailLoudChain("lidl")).toBe(false);
  });

  it("follows the roster snapshot instead of a hardcoded ranked list", () => {
    expect(
      isWeeklyAdFailLoudChain("kroger", {
        shopperRankedChainIds: [],
        settingsSelectableChainIds: [],
        weeklyAdEligibleChainIds: [],
      }),
    ).toBe(false);
    expect(
      isWeeklyAdFailLoudChain("dollar-general", {
        shopperRankedChainIds: ["dollar-general"],
        settingsSelectableChainIds: ["dollar-general"],
        weeklyAdEligibleChainIds: ["dollar-general"],
      }),
    ).toBe(true);
  });
});

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
  it("returns true when a ranked chain persist summary reports failures", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [{ status: "live", chain: "kroger" }],
        syncSummaries: [{ failedCount: 1, chain: "kroger" }],
      }),
    ).toBe(true);
  });

  it("returns true when persist failures have no chain (fail-loud default)", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [{ status: "live" }],
        syncSummaries: [{ failedCount: 1 }],
      }),
    ).toBe(true);
  });

  it("returns false when only unranked chains report persist failures", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [{ status: "live", chain: "kroger" }],
        syncSummaries: [{ failedCount: 2, chain: "lidl" }],
      }),
    ).toBe(false);
  });

  it("returns true when a ranked persist failure arrives with unranked errors", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live", chain: "kroger" },
          { status: "error", chain: "dollar-general" },
        ],
        syncSummaries: [{ failedCount: 1, chain: "food-lion" }],
      }),
    ).toBe(true);
  });

  it("returns true when a ranked chain result status is error", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live", chain: "aldi" },
          { status: "error", chain: "publix" },
        ],
        syncSummaries: [{ failedCount: 0, chain: "aldi" }],
      }),
    ).toBe(true);
  });

  it("returns true when Dollar General errors", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live", chain: "kroger" },
          { status: "error", chain: "dollar-general" },
        ],
        syncSummaries: [{ failedCount: 0, chain: "kroger" }],
      }),
    ).toBe(true);
  });

  it("does not fail the job when only Lidl errors", () => {
    expect(
      shouldFailWeeklyAdIngestExit({
        results: [
          { status: "live", chain: "kroger" },
          { status: "error", chain: "lidl" },
        ],
        syncSummaries: [{ failedCount: 0, chain: "kroger" }],
      }),
    ).toBe(false);
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
