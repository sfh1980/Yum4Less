import type { Pool } from "pg";

/** Ranked price reads and provider snapshot caches share a 24-hour discipline. */
export const RANKED_PRICE_CACHE_TTL_HOURS = 24;

export const RANKED_PRICE_CACHE_TTL_MINUTES =
  RANKED_PRICE_CACHE_TTL_HOURS * 60;

/** SQL fragment: a row was seen inside the 24-hour cache window. */
export const RANKED_PRICE_CACHE_AGE_SQL_FILTER = `coalesce(last_verified_at, observed_at) >= now() - interval '${RANKED_PRICE_CACHE_TTL_HOURS} hours'`;

/**
 * How long a row with a printed end still in the future stays after a search
 * misses it. Unset, blank, or unusable values use the default.
 */
export const KEEP_DATED_SALE_UNSEEN_DAYS_ENV = "YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS";

export const KEEP_DATED_SALE_UNSEEN_DAYS_DEFAULT = 3;

export function readKeepDatedSaleUnseenDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV]?.trim();
  if (!raw) {
    return KEEP_DATED_SALE_UNSEEN_DAYS_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return KEEP_DATED_SALE_UNSEEN_DAYS_DEFAULT;
  }
  return parsed;
}

/**
 * Shopper-visible age rule, shared by the opening purge, ranked reads, and
 * the morning note.
 * A printed end still in the future stays for N days since last seen.
 * A row with no printed end stays for 24 hours.
 * An ended row matches neither branch.
 * The dated branch starts with `valid_through is not null`. Without that,
 * `valid_through >= now()` is null for an undated row, and a purge of
 * `not (visibility)` would skip it.
 * A future start is hidden by rankedPriceWindowSql, not by this fragment.
 */
export function rankedPriceVisibilitySql(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const days = readKeepDatedSaleUnseenDays(env);
  return `(
    (
      valid_through is null
      and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
    )
    or (
      valid_through is not null
      and valid_through >= now()
      and coalesce(last_verified_at, observed_at) >= now() - interval '${days} days'
    )
  )`;
}

/**
 * Same rule as rankedPriceVisibilitySql, for tests and callers that already
 * have the dates. A future start is not considered here.
 */
export function isRankedSaleVisible(input: {
  validThrough: Date | null;
  lastSeenAt: Date;
  now: Date;
  unseenDays?: number;
}): boolean {
  const days = input.unseenDays ?? readKeepDatedSaleUnseenDays();
  const ageMs = input.now.getTime() - input.lastSeenAt.getTime();
  if (input.validThrough && input.validThrough.getTime() < input.now.getTime()) {
    return false;
  }
  if (input.validThrough && input.validThrough.getTime() >= input.now.getTime()) {
    return ageMs <= days * 24 * 3_600_000;
  }
  return ageMs <= RANKED_PRICE_CACHE_TTL_HOURS * 3_600_000;
}

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
