import { describe, expect, it } from "vitest";
import {
  applyRunStatsToChainFacts,
  matchedCountsFromRunStats,
  readWeeklyAdRunStats,
  recordWeeklyAdRunStats,
  type WeeklyAdRunStatRow,
} from "@/lib/weekly-ad-ingestion/weekly-ad-run-stats";

const write = {
  chain: "publix" as const,
  status: "success",
  cardsSeen: 445,
  offersParsed: 414,
  matched: 284,
  rowsWritten: 110,
  rowsSkipped: 14,
  rowsFailed: 0,
  secondsTaken: 90.4,
  thinReason: null,
  missReason: null,
  runDate: "2026-11-12",
};

describe("weekly ad run stats", () => {
  it("updates the same chain on the same day", async () => {
    const calls: string[] = [];
    await recordWeeklyAdRunStats(write, {
      query: async (sql) => {
        calls.push(sql);
        return { rows: [] };
      },
    });
    expect(calls[0]).toContain("on conflict (run_date, chain) do update");
    expect(calls[0]).not.toContain("http");
  });

  it("logs a write failure and does not throw", async () => {
    await expect(
      recordWeeklyAdRunStats(write, {
        query: async () => {
          throw new Error("relation weekly_ad_run_stats does not exist");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("reads a missing table as no stats", async () => {
    const rows = await readWeeklyAdRunStats("2026-11-12", {
      query: async () => {
        throw new Error('relation "weekly_ad_run_stats" does not exist');
      },
    });
    expect(rows).toBeNull();
    expect(matchedCountsFromRunStats(rows)).toBeNull();
  });

  it("keeps matched counts and the thin reason for the morning note", () => {
    const stats = new Map<string, WeeklyAdRunStatRow>([
      [
        "publix",
        {
          chain: "publix",
          matched: 44,
          thinReason: "saved 39 cards but the bogo page showed 225",
          missReason: null,
        },
      ],
    ]);
    expect(matchedCountsFromRunStats(stats)).toEqual({ publix: 44 });
    const facts = applyRunStatsToChainFacts(
      [
        {
          chainId: "publix",
          priceMissReason: "thin-page",
          thinReason: null,
          priceMissDetail: null,
        },
      ],
      stats,
    );
    expect(facts[0]?.thinReason).toBe("saved 39 cards but the bogo page showed 225");
  });
});
