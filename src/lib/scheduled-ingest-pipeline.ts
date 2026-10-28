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

/** A failure here is logged and the night continues. It does not fail the night. */
export const NON_FATAL_SCHEDULED_INGEST_STEPS = [
  "map-catalog",
  "snap-ensure",
  "themealdb-from-sales",
] as const;

export function isScheduledIngestStepNonFatal(kind: string): boolean {
  return (NON_FATAL_SCHEDULED_INGEST_STEPS as readonly string[]).includes(kind);
}
