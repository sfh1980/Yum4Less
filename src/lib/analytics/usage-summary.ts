import { getDbPool } from "@/lib/db";

export const USAGE_SUMMARY_WINDOW_DAYS = 30;
const TOP_ZIP_LIMIT = 10;

export type UsageDay = {
  day: string;
  visitors: number;
};

export type UsageZipCount = {
  zip: string;
  count: number;
};

export type UsageSummary = {
  windowDays: number;
  visitorsByDay: UsageDay[];
  rankedDinnerSessions: number;
  mapOnlySessions: number;
  mapOnlyTopZips: UsageZipCount[];
  areaInterestTopZips: UsageZipCount[];
};

type DayRow = { day: string; visitors: number };
type CountRow = { count: number };
type ZipRow = { zip: string; count: number };

/**
 * Read-only counts from analytics_events. No session ids, addresses, or coordinates.
 * A ranked dinner list is a finished rank whose result bucket is not zero.
 */
export async function summarizeRecentUsage(): Promise<UsageSummary> {
  const pool = getDbPool();
  const [days, ranked, mapOnly, mapZips, interestZips] = await Promise.all([
    pool.query<DayRow>(
      `
        select to_char((received_at at time zone 'utc')::date, 'YYYY-MM-DD') as day,
               count(distinct session_id)::int as visitors
        from analytics_events
        where received_at >= now() - interval '30 days'
          and session_id is not null
          and btrim(session_id) <> ''
        group by 1
        order by 1 desc
      `,
    ),
    pool.query<CountRow>(
      `
        select count(distinct session_id)::int as count
        from analytics_events
        where received_at >= now() - interval '30 days'
          and event_name = 'rank_meals_completed'
          and properties->>'result_count_bucket' in ('1-3', '4+')
          and session_id is not null
          and btrim(session_id) <> ''
      `,
    ),
    pool.query<CountRow>(
      `
        select count(distinct session_id)::int as count
        from analytics_events
        where received_at >= now() - interval '30 days'
          and event_name = 'map_only_shown'
          and session_id is not null
          and btrim(session_id) <> ''
      `,
    ),
    pool.query<ZipRow>(
      `
        select properties->>'zip' as zip,
               count(*)::int as count
        from analytics_events
        where received_at >= now() - interval '30 days'
          and event_name = 'map_only_shown'
          and properties->>'zip' ~ '^[0-9]{5}$'
        group by 1
        order by count desc, zip asc
        limit $1
      `,
      [TOP_ZIP_LIMIT],
    ),
    pool.query<ZipRow>(
      `
        select properties->>'zip' as zip,
               count(*)::int as count
        from analytics_events
        where received_at >= now() - interval '30 days'
          and event_name = 'area_interest_saved'
          and properties->>'zip' ~ '^[0-9]{5}$'
        group by 1
        order by count desc, zip asc
        limit $1
      `,
      [TOP_ZIP_LIMIT],
    ),
  ]);

  return {
    windowDays: USAGE_SUMMARY_WINDOW_DAYS,
    visitorsByDay: days.rows.map((row) => ({
      day: row.day,
      visitors: Number(row.visitors),
    })),
    rankedDinnerSessions: Number(ranked.rows[0]?.count ?? 0),
    mapOnlySessions: Number(mapOnly.rows[0]?.count ?? 0),
    mapOnlyTopZips: mapZipCounts(mapZips.rows),
    areaInterestTopZips: mapZipCounts(interestZips.rows),
  };
}

function mapZipCounts(rows: ZipRow[]): UsageZipCount[] {
  return rows
    .filter((row) => /^\d{5}$/.test(row.zip))
    .map((row) => ({ zip: row.zip, count: Number(row.count) }));
}
