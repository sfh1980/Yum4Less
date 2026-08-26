import { resolveRequiredProbeZipCode } from "../src/lib/ingest-zip-codes.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { createWalmartWeeklyAdIngestionClient } from "../src/lib/weekly-ad-ingestion/walmart-weekly-ad-ingestion.ts";
import { syncWeeklyAdOffersToPriceObservations } from "../src/lib/weekly-ad-ingestion/weekly-ad-offer-sync.ts";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "../src/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest.ts";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const client = createWalmartWeeklyAdIngestionClient();
  const result = await client.ingestWeeklyAd({
    chain: "walmart",
    storeId: "walmart-rocketts",
    storeName: "Walmart Supercenter",
    zipCode: resolveRequiredProbeZipCode(),
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });

  const matched = result.offers.filter((offer) => offer.ingredientId);
  console.log("status:", result.status);
  console.log("message:", result.message);
  console.log("offers:", result.offers.length, "matched:", matched.length);
  for (const hit of matched.slice(0, 10)) {
    console.log(`  ${hit.ingredientId} | ${hit.productName} | $${hit.price}`);
  }

  const sync = await syncWeeklyAdOffersToPriceObservations({ result });
  console.log("\nsync:", sync.syncedCount, "skipped:", sync.skippedCount);
  console.log(sync.message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
