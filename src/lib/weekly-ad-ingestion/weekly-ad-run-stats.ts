import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import { weeklyAdRetryDate } from "@/lib/weekly-ad-ingestion/weekly-ad-retry";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdRunStatWrite = {
  chain: WeeklyAdChain;
  status: string;
  cardsSeen: number | null;
  offersParsed: number | null;
  matched: number | null;
  rowsWritten: number;
  rowsSkipped: number;
  rowsFailed: number;
  secondsTaken: number;
  thinReason: string | null;
  missReason: string | null;
  runDate?: string;
};

export type WeeklyAdRunStatRow = {
  chain: string;
  matched: number | null;
  thinReason: string | null;
  missReason: string | null;
};

type RunStatsQuery = (
  sql: string,
  params: readonly unknown[],
) => Promise<{ rows: WeeklyAdRunStatRow[] }>;

function runStatsDbEnabled(): boolean {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  if (process.env.NODE_ENV === "test" && process.env.YUM4LESS_RUN_STATS !== "1") {
    return false;
  }
  return true;
}

/**
 * Upsert one chain's night. A write failure is logged and does not fail the night.
 * Pass query to exercise a missing table without a database.
 */
export async function recordWeeklyAdRunStats(
  input: WeeklyAdRunStatWrite,
  deps?: { query: RunStatsQuery },
): Promise<void> {
  if (!deps && !runStatsDbEnabled()) {
    return;
  }
  const runDate = input.runDate ?? weeklyAdRetryDate(new Date());
  try {
    const query = deps?.query ?? ((sql, params) => getDbPool().query(sql, params as unknown[]));
    await query(
      `
        insert into weekly_ad_run_stats (
          run_date, chain, status, cards_seen, offers_parsed, matched,
          rows_written, rows_skipped, rows_failed, seconds_taken,
          thin_reason, miss_reason, recorded_at
        )
        values ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
        on conflict (run_date, chain) do update set
          status = excluded.status,
          cards_seen = excluded.cards_seen,
          offers_parsed = excluded.offers_parsed,
          matched = excluded.matched,
          rows_written = excluded.rows_written,
          rows_skipped = excluded.rows_skipped,
          rows_failed = excluded.rows_failed,
          seconds_taken = excluded.seconds_taken,
          thin_reason = excluded.thin_reason,
          miss_reason = excluded.miss_reason,
          recorded_at = now()
      `,
      [
        runDate,
        input.chain,
        input.status,
        input.cardsSeen,
        input.offersParsed,
        input.matched,
        input.rowsWritten,
        input.rowsSkipped,
        input.rowsFailed,
        Math.max(0, Math.round(input.secondsTaken)),
        input.thinReason,
        input.missReason,
      ],
    );
  } catch (error) {
    logServerError("weekly-ad-run-stats.write", error);
  }
}

export function applyRunStatsToChainFacts<
  T extends {
    chainId?: string;
    priceMissReason?: string | null;
    thinReason?: string | null;
    priceMissDetail?: string | null;
  },
>(facts: readonly T[], stats: Map<string, WeeklyAdRunStatRow> | null): T[] {
  if (!stats) {
    return [...facts];
  }
  return facts.map((fact) => {
    if (!fact.chainId) {
      return fact;
    }
    const row = stats.get(fact.chainId);
    if (!row) {
      return fact;
    }
    const next = { ...fact };
    if (fact.priceMissReason === "thin-page" && row.thinReason) {
      next.thinReason = row.thinReason;
    }
    if (fact.priceMissReason === "fetch-failed" && row.missReason) {
      next.priceMissDetail = row.missReason;
    }
    return next;
  });
}

export function matchedCountsFromRunStats(
  stats: Map<string, WeeklyAdRunStatRow> | null,
): Record<string, number> | null {
  if (!stats) {
    return null;
  }
  const counts: Record<string, number> = {};
  for (const [chain, row] of stats) {
    if (typeof row.matched === "number" && Number.isFinite(row.matched)) {
      counts[chain] = row.matched;
    }
  }
  return counts;
}

/** Null when the table is missing or the read fails. An empty map means no rows. */
export async function readWeeklyAdRunStats(
  runDate: string,
  deps?: { query: RunStatsQuery },
): Promise<Map<string, WeeklyAdRunStatRow> | null> {
  if (!deps && !runStatsDbEnabled()) {
    return null;
  }
  try {
    const query = deps?.query ?? ((sql, params) => getDbPool().query(sql, params as unknown[]));
    const result = await query(
      `
        select chain, matched, thin_reason as "thinReason", miss_reason as "missReason"
        from weekly_ad_run_stats
        where run_date = $1::date
      `,
      [runDate],
    );
    return new Map(
      result.rows
        .filter((row) => row.chain)
        .map((row) => [
          row.chain,
          {
            chain: row.chain,
            matched: row.matched === null ? null : Number(row.matched),
            thinReason: row.thinReason,
            missReason: row.missReason,
          },
        ]),
    );
  } catch (error) {
    logServerError("weekly-ad-run-stats.read", error);
    return null;
  }
}
