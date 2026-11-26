import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  readNoFlyerNights,
  readWeeklyAdRunStats,
  recordWeeklyAdRunStats,
} from "@/lib/weekly-ad-ingestion/weekly-ad-run-stats";
import { NO_FLYER_RUN_REASON } from "@/lib/weekly-ad-ingestion/weekly-ad-run-reasons";

const RUN_DATE = "2026-11-12";

describe("weekly_ad_run_stats", () => {
  afterEach(async () => {
    await getDbPool().query(
      `delete from weekly_ad_run_stats where chain = 'publix' and run_date = $1::date`,
      [RUN_DATE],
    );
    await resetDbPoolForTests();
  });

  it("keeps one row per chain per day and a later run replaces it", async () => {
    const pool = getDbPool();
    const query = (sql: string, params: readonly unknown[]) =>
      pool.query(sql, params as unknown[]);
    await recordWeeklyAdRunStats(
      {
        chain: "publix",
        status: "success",
        cardsSeen: 39,
        offersParsed: 39,
        matched: 44,
        rowsWritten: 34,
        rowsSkipped: 0,
        rowsFailed: 0,
        secondsTaken: 40,
        thinReason: "saved 39 cards but the bogo page showed 225",
        missReason: null,
        runDate: RUN_DATE,
      },
      { query },
    );
    await recordWeeklyAdRunStats(
      {
        chain: "publix",
        status: "success",
        cardsSeen: 445,
        offersParsed: 414,
        matched: 284,
        rowsWritten: 110,
        rowsSkipped: 14,
        rowsFailed: 0,
        secondsTaken: 90,
        thinReason: null,
        missReason: null,
        runDate: RUN_DATE,
      },
      { query },
    );
    const rows = await readWeeklyAdRunStats(RUN_DATE, { query });
    expect(rows?.get("publix")?.matched).toBe(284);
    expect(rows?.get("publix")?.thinReason).toBeNull();
    const count = await pool.query<{ n: string }>(
      `select count(*)::text as n from weekly_ad_run_stats where chain = 'publix' and run_date = $1::date`,
      [RUN_DATE],
    );
    expect(count.rows[0]?.n).toBe("1");
  });

  it("counts a no-flyer streak from miss_reason and stops when a night is not that reason", async () => {
    const pool = getDbPool();
    const query = (sql: string, params: readonly unknown[]) =>
      pool.query(sql, params as unknown[]);
    const dates = ["2026-11-24", "2026-11-25", "2026-11-26"];
    await pool.query(
      `delete from weekly_ad_run_stats where chain = 'food-lion' and run_date = any($1::date[])`,
      [dates],
    );
    for (const runDate of dates) {
      await recordWeeklyAdRunStats(
        {
          chain: "food-lion",
          status: "live",
          cardsSeen: null,
          offersParsed: 0,
          matched: 0,
          rowsWritten: 0,
          rowsSkipped: 0,
          rowsFailed: 0,
          secondsTaken: 1,
          thinReason: null,
          missReason: runDate === "2026-11-24" ? "the page timed out" : NO_FLYER_RUN_REASON,
          runDate,
        },
        { query },
      );
    }
    const streaks = await readNoFlyerNights("2026-11-26", { query });
    expect(streaks?.["food-lion"]).toBe(2);
    await pool.query(
      `delete from weekly_ad_run_stats where chain = 'food-lion' and run_date = any($1::date[])`,
      [dates],
    );
  });
});
