/**
 * Dry-run (default) or apply conservative Yes/No plans for pending /owner reviews.
 *
 * Uses the same resolveIngredientReview path as the owner console (aliases + create-if-missing).
 * Does not write through public shopper APIs. Defaults to yum4less_dev.
 *
 * Usage:
 *   npm run owner:resolve-pending-reviews
 *   npm run owner:resolve-pending-reviews -- --apply
 */
import { isFixtureIngestMode } from "@/lib/fixture-ingest-policy";
import { loadEnvLocal } from "@/lib/load-env-local";
import { applyObviousPendingReviews } from "@/lib/owner/ingredient-review-repository";

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
      "[owner-resolve] Refusing to run while YUM4LESS_WEEKLY_AD_FIXTURE or YUM4LESS_MAP_CATALOG_FIXTURE is 1.",
    );
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const target = describeDatabaseTarget(process.env.DATABASE_URL);
  console.log(`[owner-resolve] ${apply ? "Applying" : "Dry-run"} pending reviews on ${target}...`);

  const summary = await applyObviousPendingReviews({ apply });
  console.log(
    `[owner-resolve] yes=${summary.yes} no=${summary.no} skip=${summary.skip}${
      apply
        ? ` applied_ok=${summary.appliedOk} applied_fail=${summary.appliedFail}`
        : " (dry-run; pass --apply to write)"
    }`,
  );
}

main().catch((error) => {
  console.error(
    "[owner-resolve] Resolve-pending failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
