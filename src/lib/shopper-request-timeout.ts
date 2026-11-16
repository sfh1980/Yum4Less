/**
 * How long the shopper waits on a store search or dinner ranking before
 * the page stops waiting and shows the existing error with Try again.
 * Read on the server when the home page is requested.
 * Unset, or a value outside 1000–120000, uses the default.
 */

export const STORE_SEARCH_TIMEOUT_MS_ENV = "YUM4LESS_STORE_SEARCH_TIMEOUT_MS";

export const STORE_SEARCH_TIMEOUT_MS_DEFAULT = 20_000;

export const RANK_TIMEOUT_MS_ENV = "YUM4LESS_RANK_TIMEOUT_MS";

export const RANK_TIMEOUT_MS_DEFAULT = 30_000;

const TIMEOUT_MS_MIN = 1_000;
const TIMEOUT_MS_MAX = 120_000;

function readBoundedTimeoutMs(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < TIMEOUT_MS_MIN || parsed > TIMEOUT_MS_MAX) {
    return fallback;
  }

  return parsed;
}

export function readStoreSearchTimeoutMs(
  env: Record<string, string | undefined> = process.env,
): number {
  return readBoundedTimeoutMs(
    env,
    STORE_SEARCH_TIMEOUT_MS_ENV,
    STORE_SEARCH_TIMEOUT_MS_DEFAULT,
  );
}

export function readRankTimeoutMs(
  env: Record<string, string | undefined> = process.env,
): number {
  return readBoundedTimeoutMs(env, RANK_TIMEOUT_MS_ENV, RANK_TIMEOUT_MS_DEFAULT);
}
