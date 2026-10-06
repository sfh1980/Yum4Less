import { describe, expect, it } from "vitest";
import {
  judgeFreshness,
  judgeLastNight,
  judgeMarkets,
  judgeMigrations,
  judgeRankedBanners,
  judgeShopperRead,
} from "@/lib/owner/after-update-checks";

describe("after-update checks", () => {
  it("fails migrations when a file in this app is missing from the database", () => {
    const result = judgeMigrations({
      expectedFilenames: ["001_schema.sql", "038_feedback_missing_store.sql"],
      appliedFilenames: ["001_schema.sql"],
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("038_feedback_missing_store.sql");
  });

  it("fails migrations when the ledger table is missing", () => {
    expect(
      judgeMigrations({
        expectedFilenames: ["001_schema.sql"],
        appliedFilenames: null,
      }).ok,
    ).toBe(false);
  });

  it("passes migrations when every expected file is applied", () => {
    expect(
      judgeMigrations({
        expectedFilenames: ["001_schema.sql"],
        appliedFilenames: ["001_schema.sql", "old_extra.sql"],
      }).ok,
    ).toBe(true);
  });

  it("fails the ZIP list when a debug overlay is set", () => {
    expect(
      judgeMarkets({
        markets: [{ zipCode: "23220", latitude: 1, longitude: 2 }],
        overlayActive: true,
      }).detail,
    ).toMatch(/debug ZIP list/i);
  });

  it("fails the ZIP list when an active ZIP has no map point", () => {
    const result = judgeMarkets({
      markets: [{ zipCode: "23220", latitude: null, longitude: -77 }],
      overlayActive: false,
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("23220");
  });

  it("passes the ZIP list with a count and no hardcoded roster", () => {
    const result = judgeMarkets({
      markets: [{ zipCode: "23220", latitude: 37.5, longitude: -77.4 }],
      overlayActive: false,
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("1 ZIP is");
  });

  it("fails last night when a step failed", () => {
    const result = judgeLastNight({
      runDate: "2026-10-06",
      jobs: [
        { kind: "weekly-ad", status: "failed", lastError: "flyer timeout" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("flyer timeout");
  });

  it("fails last night when nothing is recorded", () => {
    expect(judgeLastNight({ runDate: null, jobs: [] }).ok).toBe(false);
    expect(judgeLastNight({ runDate: null, jobs: null }).ok).toBe(false);
  });

  it("passes last night when every step succeeded or skipped", () => {
    expect(
      judgeLastNight({
        runDate: "2026-10-06",
        jobs: [
          { kind: "weekly-ad", status: "succeeded", lastError: null },
          { kind: "snap-ensure", status: "skipped", lastError: null },
        ],
      }).ok,
    ).toBe(true);
  });

  it("fails freshness when no ranked price is inside 24 hours", () => {
    expect(
      judgeFreshness({ freshTotal: 0, totalRanked: 4, bySource: [] }).ok,
    ).toBe(false);
  });

  it("passes freshness when any ranked price is fresh and still lists chains", () => {
    const result = judgeFreshness({
      freshTotal: 2,
      totalRanked: 4,
      bySource: [
        {
          sourceName: "kroger",
          freshCount: 2,
          totalCount: 2,
          newestAgeHours: 3,
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("kroger 2");
  });

  it("fails ranked chains when the list is empty or unknown", () => {
    expect(judgeRankedBanners([]).ok).toBe(false);
    expect(judgeRankedBanners(["not-a-chain"]).ok).toBe(false);
  });

  it("passes ranked chains the app already knows", () => {
    expect(judgeRankedBanners(["kroger", "aldi"]).ok).toBe(true);
  });

  it("fails the shopper search when prices are unavailable", () => {
    expect(
      judgeShopperRead({
        unavailable: true,
        errorMessage: "Store and meal prices are not loading right now.",
        recommendationCount: 0,
        trustText: "",
      }).ok,
    ).toBe(false);
  });

  it("fails dinners that omit an estimate label or use a forbidden claim", () => {
    expect(
      judgeShopperRead({
        unavailable: false,
        recommendationCount: 1,
        trustText: "Pasta dinner",
      }).detail,
    ).toMatch(/estimate label/i);
    expect(
      judgeShopperRead({
        unavailable: false,
        recommendationCount: 1,
        trustText: "This is the cheapest Single-store estimate",
      }).ok,
    ).toBe(false);
  });

  it("passes an honest empty search and an estimate-labeled dinner", () => {
    expect(
      judgeShopperRead({
        unavailable: false,
        recommendationCount: 0,
        trustText: "",
      }).ok,
    ).toBe(true);
    expect(
      judgeShopperRead({
        unavailable: false,
        recommendationCount: 2,
        trustText: "Single-store estimate limited coverage",
      }).ok,
    ).toBe(true);
  });
});
