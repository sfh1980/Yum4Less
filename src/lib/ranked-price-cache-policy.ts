import type { Pool } from "pg";

/** Ranked price reads and provider snapshot caches share a 24-hour discipline. */
export const RANKED_PRICE_CACHE_TTL_HOURS = 24;

export const RANKED_PRICE_CACHE_TTL_MINUTES =
  RANKED_PRICE_CACHE_TTL_HOURS * 60;

/** SQL fragment: ranked price_observations must be within the cache window. */
export const RANKED_PRICE_CACHE_AGE_SQL_FILTER = `coalesce(last_verified_at, observed_at) >= now() - interval '${RANKED_PRICE_CACHE_TTL_HOURS} hours'`;

/**
 * A row is rankable when its sale has started and has not ended.
 * Null valid_from means the row was stored before start dates were kept.
 * The stale-row purge must not use this fragment: a future valid_from is
 * hidden here and kept in the table.
 */
export const RANKED_PRICE_WINDOW_SQL_FILTER =
  "(valid_through is null or valid_through >= now()) and (valid_from is null or valid_from <= now())";

/** Used when migration 042 has not added valid_from yet. Does not name that column. */
export const RANKED_PRICE_THROUGH_ONLY_SQL_FILTER =
  "(valid_through is null or valid_through >= now())";

let cachedRankedPriceWindowSql: string | null = null;

export function resetRankedPriceWindowSqlForTests(): void {
  cachedRankedPriceWindowSql = null;
}

/**
 * Ranked reads name valid_from only after 042 has applied.
 * A missing column is not cached, so the next read picks it up after migrate
 * without waiting for the app process to restart.
 */
export async function rankedPriceWindowSql(pool: Pick<Pool, "query">): Promise<string> {
  if (cachedRankedPriceWindowSql === RANKED_PRICE_WINDOW_SQL_FILTER) {
    return cachedRankedPriceWindowSql;
  }
  try {
    const result = await pool.query<{ present?: boolean }>(
      `select exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'price_observations'
           and column_name = 'valid_from'
       ) as present`,
    );
    if (result.rows[0]?.present === true) {
      cachedRankedPriceWindowSql = RANKED_PRICE_WINDOW_SQL_FILTER;
      return cachedRankedPriceWindowSql;
    }
  } catch {
    return RANKED_PRICE_THROUGH_ONLY_SQL_FILTER;
  }
  return RANKED_PRICE_THROUGH_ONLY_SQL_FILTER;
}

export type ProviderDataReadMode = "cache-only" | "live-allowed";

export function isWithinRankedPriceCache(
  observedAt: Date,
  lastVerifiedAt?: Date | null,
): boolean {
  const reference = lastVerifiedAt ?? observedAt;
  const ageMs = Date.now() - reference.getTime();
  return ageMs <= RANKED_PRICE_CACHE_TTL_HOURS * 3_600_000;
}

/** User-facing copy when ranked prices are missing or outside the cache window. */
export const RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE =
  "Pricing refreshes on a daily schedule (about every 24 hours), not when you search.";

export function rankedPriceCacheMissMessage(resourceLabel: string): string {
  return `No saved ${resourceLabel} within the last ${RANKED_PRICE_CACHE_TTL_HOURS} hours. ${RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE} Try again later — prices refresh daily.`;
}
