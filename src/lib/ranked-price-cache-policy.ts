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
