/**
 * Homelab ranked-price freshness heartbeat (Pass 1).
 *
 * Fail closed when zero in-stock ranked `price_observations` fall inside the
 * shared 24h cache window — the condition that let ingest go silent for days
 * without a cron-visible signal. Per-source rows are for log diagnosis only;
 * a thin week for one chain does not fail the job while other ranked sources
 * still have fresh rows.
 */
import type { Pool } from "pg";
import { RANKED_PRICE_CACHE_AGE_SQL_FILTER } from "@/lib/ranked-price-cache-policy";
import { RANKED_PRICE_SOURCE_SQL_FILTER } from "@/lib/price-source-policy";

export type RankedSourceFreshnessRow = {
  sourceName: string;
  freshCount: number;
  totalCount: number;
  newestAgeHours: number | null;
};

export type RankedFreshnessReport = {
  freshTotal: number;
  totalRanked: number;
  bySource: RankedSourceFreshnessRow[];
};

/** Non-zero exit when no ranked in-stock observation is inside the 24h window. */
export function shouldFailRankedPriceFreshnessExit(report: {
  freshTotal: number;
}): boolean {
  return report.freshTotal <= 0;
}

export function formatRankedFreshnessLogLines(
  report: RankedFreshnessReport,
): string[] {
  const lines: string[] = [];
  const status = shouldFailRankedPriceFreshnessExit(report)
    ? "STALE"
    : "OK";
  lines.push(
    `[freshness] ${status} — ${report.freshTotal} fresh / ${report.totalRanked} ranked in-stock observation(s) in 24h`,
  );
  for (const row of report.bySource) {
    const age =
      row.newestAgeHours === null ? "n/a" : `${row.newestAgeHours}h ago`;
    lines.push(
      `[freshness]   ${row.sourceName}: fresh=${row.freshCount} total=${row.totalCount} newest=${age}`,
    );
  }
  if (report.bySource.length === 0) {
    lines.push("[freshness]   (no ranked in-stock observations in database)");
  }
  return lines;
}

export async function queryRankedPriceFreshness(
  pool: Pool,
): Promise<RankedFreshnessReport> {
  const result = await pool.query<{
    source_name: string;
    fresh_count: string | number;
    total_count: string | number;
    newest_age_hours: string | number | null;
  }>(
    `
      select
        source_name,
        count(*)::int as total_count,
        count(*) filter (where ${RANKED_PRICE_CACHE_AGE_SQL_FILTER})::int as fresh_count,
        round(
          extract(epoch from (now() - max(coalesce(last_verified_at, observed_at)))) / 3600,
          1
        ) as newest_age_hours
      from price_observations
      where in_stock = true
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
      group by source_name
      order by source_name
    `,
  );

  const bySource: RankedSourceFreshnessRow[] = result.rows.map((row) => ({
    sourceName: row.source_name,
    freshCount: Number(row.fresh_count),
    totalCount: Number(row.total_count),
    newestAgeHours:
      row.newest_age_hours === null || row.newest_age_hours === undefined
        ? null
        : Number(row.newest_age_hours),
  }));

  return {
    freshTotal: bySource.reduce((sum, row) => sum + row.freshCount, 0),
    totalRanked: bySource.reduce((sum, row) => sum + row.totalCount, 0),
    bySource,
  };
}

/**
 * Optional single-operator alert hook. Uses native fetch only — no SaaS SDK.
 * Fires only when the heartbeat would fail the job.
 */
export async function notifyFreshnessWebhookIfConfigured(
  report: RankedFreshnessReport,
  env: Record<string, string | undefined> = process.env,
): Promise<{ attempted: boolean; ok: boolean; error?: string }> {
  if (!shouldFailRankedPriceFreshnessExit(report)) {
    return { attempted: false, ok: true };
  }

  const url = env.YUM4LESS_FRESHNESS_WEBHOOK_URL?.trim();
  if (!url) {
    return { attempted: false, ok: true };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "yum4less-ranked-price-freshness",
        status: "STALE",
        freshTotal: report.freshTotal,
        totalRanked: report.totalRanked,
        bySource: report.bySource,
        message:
          "No ranked in-stock price_observations within the 24-hour cache window.",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        attempted: true,
        ok: false,
        error: `webhook HTTP ${response.status}`,
      };
    }
    return { attempted: true, ok: true };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isFreshnessHeartbeatSkipped(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.YUM4LESS_SKIP_FRESHNESS_HEARTBEAT === "1";
}
