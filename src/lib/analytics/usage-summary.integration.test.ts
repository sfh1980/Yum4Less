import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { summarizeRecentUsage } from "@/lib/analytics/usage-summary";

const SESSIONS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

describe("usage summary query (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query("delete from analytics_events where session_id = any($1::text[])", [
      SESSIONS,
    ]);
    await resetDbPoolForTests();
  });

  it("counts visitors, ranked dinners, map-only, and typed ZIPs in the last 30 days", async () => {
    const pool = getDbPool();
    await pool.query("delete from analytics_events where session_id = any($1::text[])", [
      SESSIONS,
    ]);
    const before = await summarizeRecentUsage();

    await pool.query(
      `
        insert into analytics_events (received_at, event_name, session_id, properties, app_env)
        values
          (now(), 'site_opened', $1, '{"setup_complete":true}'::jsonb, 'test'),
          (now(), 'rank_meals_completed', $1, '{"result_count_bucket":"1-3"}'::jsonb, 'test'),
          (now(), 'rank_meals_completed', $1, '{"result_count_bucket":"0"}'::jsonb, 'test'),
          (now(), 'map_only_shown', $1, '{"zip":"30301"}'::jsonb, 'test'),
          (now(), 'map_only_shown', $2, '{"zip":"30301"}'::jsonb, 'test'),
          (now(), 'map_only_shown', $2, '{"zip":"near the river","latitude":37.6}'::jsonb, 'test'),
          (now(), 'area_interest_saved', $1, '{"zip":"30301"}'::jsonb, 'test'),
          (now(), 'area_interest_saved', $3, '{"zip":"20202"}'::jsonb, 'test'),
          (now() - interval '40 days', 'site_opened', $1, '{"setup_complete":false}'::jsonb, 'test')
      `,
      [...SESSIONS],
    );

    const summary = await summarizeRecentUsage();
    const today = new Date().toISOString().slice(0, 10);
    const visitorsBefore = before.visitorsByDay.find((row) => row.day === today)?.visitors ?? 0;
    const visitorsAfter = summary.visitorsByDay.find((row) => row.day === today)?.visitors ?? 0;

    expect(summary.windowDays).toBe(30);
    expect(visitorsAfter).toBe(visitorsBefore + 3);
    expect(summary.visitorsByDay.some((row) => row.day < daysAgo(31))).toBe(false);
    expect(summary.rankedDinnerSessions).toBe(before.rankedDinnerSessions + 1);
    expect(summary.mapOnlySessions).toBe(before.mapOnlySessions + 2);
    expect(zipCount(summary.mapOnlyTopZips, "30301")).toBe(
      zipCount(before.mapOnlyTopZips, "30301") + 2,
    );
    expect(summary.mapOnlyTopZips.map((row) => row.zip)).not.toContain("near the river");
    expect(zipCount(summary.areaInterestTopZips, "30301")).toBe(
      zipCount(before.areaInterestTopZips, "30301") + 1,
    );
    expect(zipCount(summary.areaInterestTopZips, "20202")).toBe(
      zipCount(before.areaInterestTopZips, "20202") + 1,
    );
    expect(summary).not.toHaveProperty("sessionId");
    expect(JSON.stringify(summary)).not.toMatch(/latitude|longitude|@/i);
  });
});

function zipCount(rows: { zip: string; count: number }[], zip: string) {
  return rows.find((row) => row.zip === zip)?.count ?? 0;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
