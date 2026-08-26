/**
 * One-shot Kroger weekly-ad live baseline (Flipp-first path) for a required ingest ZIP.
 * Owner probe — not a CI merge gate. Single attempt; report parsed → synced.
 * Persists raw offers + match funnel under captures/weekly-ad-baseline/kroger/.
 */
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import { loadEnvLocal } from "@/lib/load-env-local";
import { resolveRequiredProbeZipCode } from "@/lib/ingest-zip-codes";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { createKrogerWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion";
import { persistWeeklyAdBaselineCapture } from "@/lib/weekly-ad-ingestion/weekly-ad-baseline-capture";
import { analyzeWeeklyAdMatchFunnel } from "@/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import { syncWeeklyAdOffersToPriceObservations } from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
}

async function main() {
  enforceFixtureIngestDatabasePolicy();

  const zipCode = resolveRequiredProbeZipCode();
  const storeId = process.env.YUM4LESS_KROGER_BASELINE_STORE_ID ?? "kroger-mechanicsville";
  const capturedAt = new Date().toISOString();

  console.log(`\n=== Kroger Flipp-first live baseline (ZIP ${zipCode}) ===\n`);

  const client = createKrogerWeeklyAdIngestionClient();
  const result = await client.ingestWeeklyAd({
    chain: "kroger",
    storeId,
    storeName: "Kroger",
    zipCode,
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });

  const flipp = await resolveFlippWeeklyAdOffersForChain({
    chain: "kroger",
    zipCode,
    merchantName: "Kroger",
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });
  const funnel = analyzeWeeklyAdMatchFunnel({
    chain: "kroger",
    storeId,
    sourceUrl: `flipp://kroger/${zipCode}`,
    observedAt: capturedAt,
    rawOffers: flipp.rawOffers,
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });
  const captureDir = persistWeeklyAdBaselineCapture({
    chain: "kroger",
    zipCode,
    capturedAt,
    retrievalLabel: flipp.retrievalLabel,
    rawOffers: flipp.rawOffers,
    funnel,
  });

  const parsedMatch = result.message.match(/extracted (\d+) offer\(s\)/);
  const matchedMatch = result.message.match(/(\d+) matched tracked dinner ingredients/);
  const parsedCount = parsedMatch ? Number(parsedMatch[1]) : funnel.rawOfferCount;
  const matchedCount = matchedMatch
    ? Number(matchedMatch[1])
    : result.offers.filter((offer) => offer.ingredientId).length;

  console.log(`Status: ${result.status}`);
  console.log(`Provenance: ${result.provenance}`);
  console.log(`Retrieval: ${result.message.split(" via ")[1]?.split(" extracted")[0] ?? flipp.retrievalLabel}`);
  console.log(`Parsed (raw offers): ${parsedCount}`);
  console.log(`Matched (tracked ingredients): ${matchedCount}`);
  console.log(
    `Funnel: near-miss 0.45-0.54=${funnel.probes.filter((p) => p.bestConfidence >= 0.45 && p.bestConfidence < 0.55).length}, noise<=${0.05}=${funnel.probes.filter((p) => p.bestConfidence <= 0.05).length}`,
  );
  console.log(`Capture dir: ${captureDir}`);

  let syncedCount = 0;
  if (result.offers.length > 0) {
    const sync = await syncWeeklyAdOffersToPriceObservations({ result });
    syncedCount = sync.syncedCount;
    console.log(`Synced to Postgres: ${sync.syncedCount}`);
    console.log(`Sync skipped: ${sync.skippedCount}, failed: ${sync.failedCount}`);
    console.log(`Sync message: ${sync.message}`);
  } else {
    console.log("Synced to Postgres: 0 (no offers to persist)");
  }

  console.log(`\nFull message: ${result.message}`);
  console.log("\n=== Baseline summary ===");
  console.log(`Kroger @ ZIP ${zipCode}: ${parsedCount} parsed → ${syncedCount} synced`);
  console.log("");

  process.exit(result.status === "error" && parsedCount === 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
