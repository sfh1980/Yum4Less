import { fetchFlippWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-feed.ts";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "../src/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest.ts";
import { matchWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching.ts";
import { buildWalmartWeeklyAdUrl } from "../src/lib/weekly-ad-ingestion/walmart-weekly-ad-url.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = process.env.YUM4LESS_INGEST_ZIP ?? "23111";
const trackedIngredientIds = WEEKLY_AD_TRACKED_INGREDIENT_IDS;

async function main() {
  const sourceUrl = buildWalmartWeeklyAdUrl({
    storeId: process.env.WALMART_STORE_ID?.trim(),
  });

  console.log(`\n=== Walmart live scrape test (ZIP ${zipCode}) ===`);
  console.log(`Source URL: ${sourceUrl}\n`);

  const started = Date.now();

  console.log("1) Flipp syndicated weekly-ad feed...");
  let rawOffers = [];
  try {
    rawOffers = await fetchFlippWeeklyAdOffers({
      zipCode,
      merchantName: "Walmart",
    });
    console.log(`   Parsed ${rawOffers.length} offer(s) in ${formatElapsed(started)}`);
    for (const offer of rawOffers.slice(0, 5)) {
      console.log(`   - ${offer.productName} @ $${offer.price}${offer.saleLabel ? ` (${offer.saleLabel})` : ""}`);
    }
  } catch (error) {
    console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n2) Ingredient matching...");
  const matched = matchWeeklyAdOffers({
    chain: "walmart",
    storeId: "walmart-rocketts",
    sourceUrl,
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
  });
  const matchedCount = matched.filter((offer) => offer.ingredientId).length;
  console.log(`   Matched tracked ingredients: ${matchedCount}`);
  console.log(`\n=== Done in ${formatElapsed(started)} ===\n`);

  process.exit(rawOffers.length > 0 ? 0 : 1);
}

function formatElapsed(startedMs) {
  return `${((Date.now() - startedMs) / 1000).toFixed(1)}s`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
