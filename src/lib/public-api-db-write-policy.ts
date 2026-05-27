/**
 * Public HTTP routes stay read-only by default.
 *
 * Local dev may opt in with YUM4LESS_ENABLE_API_DB_WRITES=1 to persist provider
 * snapshots from /api/recommendations and /api/market-search. Ingest/cron scripts
 * remain the intended write path.
 *
 * Production must never enable this flag — the guard below ignores it when
 * NODE_ENV=production so a mis-set deploy env cannot open public write paths.
 */
export function isPublicApiDbWriteEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.YUM4LESS_ENABLE_API_DB_WRITES === "1";
}
