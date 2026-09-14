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
import { getDbPool } from "@/lib/db";
import { resolveIngredientReview } from "@/lib/owner/ingredient-review-repository";
import { planPendingReviewResolution } from "@/lib/owner/pending-review-auto-resolve";

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
  const pool = getDbPool();

  const existing = await pool.query<{ id: string }>(`select id from ingredients`);
  const existingIds = new Set(existing.rows.map((row) => row.id));

  const pending = await pool.query<{
    normalized_label: string;
    raw_product_name: string;
    chain: string | null;
  }>(
    `
      select normalized_label, raw_product_name, chain
      from ingredient_match_reviews
      where status = 'pending'
      order by chain, raw_product_name
    `,
  );

  console.log(
    `[owner-resolve] ${apply ? "Applying" : "Dry-run"} ${pending.rows.length} pending on ${target} (${existingIds.size} foods in catalog)`,
  );

  let yesCount = 0;
  let noCount = 0;
  let skipCount = 0;
  let appliedOk = 0;
  let appliedFail = 0;

  for (const row of pending.rows) {
    const plan = planPendingReviewResolution(row.raw_product_name, {
      normalizedLabel: row.normalized_label,
      existingIds,
    });
    const chain = row.chain ?? "(none)";

    if (plan.action === "skip") {
      skipCount += 1;
      console.log(`SKIP\t${chain}\t${row.raw_product_name}\t${plan.reason}`);
      continue;
    }

    if (plan.action === "no") {
      noCount += 1;
      console.log(`NO\t${chain}\t${row.raw_product_name}\t${plan.reason}`);
      if (!apply) {
        continue;
      }
      const result = await resolveIngredientReview({
        normalizedLabel: row.normalized_label,
        decision: "no",
      });
      if (result.ok) {
        appliedOk += 1;
      } else {
        appliedFail += 1;
        console.error(`FAIL\t${row.normalized_label}\t${result.error}`);
      }
      continue;
    }

    yesCount += 1;
    const existed = existingIds.has(plan.ingredientId);
    console.log(
      `YES\t${chain}\t${row.raw_product_name}\t${plan.ingredientId}${existed ? "" : " (create)"}\t${plan.reason}`,
    );
    if (!apply) {
      continue;
    }
    const result = await resolveIngredientReview({
      normalizedLabel: row.normalized_label,
      decision: "yes",
      ingredientId: plan.ingredientId,
      ingredientName: plan.ingredientName,
      category: plan.category,
    });
    if (result.ok) {
      appliedOk += 1;
      if (result.ingredientId) {
        existingIds.add(result.ingredientId);
      }
    } else {
      appliedFail += 1;
      console.error(`FAIL\t${row.normalized_label}\t${result.error}`);
    }
  }

  console.log(
    `[owner-resolve] yes=${yesCount} no=${noCount} skip=${skipCount}${
      apply ? ` applied_ok=${appliedOk} applied_fail=${appliedFail}` : " (dry-run; pass --apply to write)"
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
