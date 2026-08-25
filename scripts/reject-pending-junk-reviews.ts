/**
 * One-shot: reject pending /owner ingredient reviews that match junk heuristics.
 *
 * Uses the same isWeeklyAdJunkProduct / flyerLineLooksLikeJunk SSOT as live ingest.
 * Does not write through public shopper APIs. Defaults to yum4less_dev.
 *
 * Usage: npm run owner:reject-pending-junk-reviews
 */
import { isFixtureIngestMode } from "@/lib/fixture-ingest-policy";
import { loadEnvLocal } from "@/lib/load-env-local";
import { rejectPendingReviewsMatchingJunk } from "@/lib/owner/ingredient-review-repository";

loadEnvLocal();

function describeDatabaseTarget(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.hostname}${port}${parsed.pathname}`;
  } catch {
    return "(unparsed DATABASE_URL)";
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  if (isFixtureIngestMode()) {
    console.error(
      "[owner-junk] Refusing to run while YUM4LESS_WEEKLY_AD_FIXTURE or YUM4LESS_MAP_CATALOG_FIXTURE is 1.",
    );
    process.exit(1);
  }

  const target = describeDatabaseTarget(process.env.DATABASE_URL);
  console.log(`[owner-junk] Scanning pending reviews on ${target}...`);

  const result = await rejectPendingReviewsMatchingJunk();
  console.log(
    `[owner-junk] scanned=${result.scanned} rejected=${result.rejected} remaining=${result.scanned - result.rejected}`,
  );
}

main().catch((error) => {
  console.error(
    "[owner-junk] Reject-pending-junk failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
