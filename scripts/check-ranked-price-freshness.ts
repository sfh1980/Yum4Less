/**
 * Ranked-price freshness heartbeat CLI.
 *
 * Exit 1 when zero in-stock ranked price_observations are inside the shared
 * 24h cache window. Intended for scheduled ingest close-out and manual ops.
 *
 * Usage: npm run check:ranked-price-freshness
 */
import { getDbPool } from "@/lib/db";
import {
  formatRankedFreshnessLogLines,
  isFreshnessHeartbeatSkipped,
  notifyFreshnessWebhookIfConfigured,
  queryRankedPriceFreshness,
  shouldFailRankedPriceFreshnessExit,
} from "@/lib/ingest/ingest-freshness-heartbeat";
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  if (isFreshnessHeartbeatSkipped()) {
    console.warn(
      "[freshness] SKIPPED — YUM4LESS_SKIP_FRESHNESS_HEARTBEAT=1 (emergency escape only).",
    );
    return;
  }

  const pool = getDbPool();
  const report = await queryRankedPriceFreshness(pool);

  for (const line of formatRankedFreshnessLogLines(report)) {
    if (shouldFailRankedPriceFreshnessExit(report)) {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  if (shouldFailRankedPriceFreshnessExit(report)) {
    const webhook = await notifyFreshnessWebhookIfConfigured(report);
    if (webhook.attempted && !webhook.ok) {
      console.error(
        `[freshness] webhook notify failed (non-blocking): ${webhook.error ?? "unknown"}`,
      );
    }
    console.error(
      "[freshness] Ranked price freshness check failed — no observations in the 24h window. Cron/log will show non-zero exit.",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "[freshness] Ranked price freshness check crashed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
