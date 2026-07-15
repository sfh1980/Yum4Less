/**
 * Canonical step order for `npm run ingest:weekly-ads:scheduled`.
 * `scripts/run-scheduled-weekly-ad-ingest.mjs` must match — guarded by unit test.
 */
export const SCHEDULED_INGEST_STEP_ORDER = [
  "map-catalog",
  "weekly-ad",
  "snap-ensure",
  "provider-sync",
  "themealdb-from-sales",
  "ranked-price-freshness",
] as const;

export type ScheduledIngestStep = (typeof SCHEDULED_INGEST_STEP_ORDER)[number];
