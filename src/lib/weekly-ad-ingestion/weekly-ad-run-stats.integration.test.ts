import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  readWeeklyAdRunStats,
  recordWeeklyAdRunStats,
} from "@/lib/weekly-ad-ingestion/weekly-ad-run-stats";

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
});
