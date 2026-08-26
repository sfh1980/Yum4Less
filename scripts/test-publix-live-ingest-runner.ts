import { getMarketDataSnapshot } from "@/lib/market-repository";
import { resolveProviderRolloutForStore } from "@/lib/provider-rollout";
import {
  buildWeeklyAdStoreCoverage,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";
import { runWeeklyAdIngestionForStores } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import { resolveRequiredProbeZipCode } from "@/lib/ingest-zip-codes";
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

const zipCode = resolveRequiredProbeZipCode();
const storeId = "publix-1626";
const storeName = "Publix";

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  console.log(`\n=== Publix live ingest → Postgres probe (ZIP ${zipCode}) ===\n`);

  const { results, syncSummaries } = await runWeeklyAdIngestionForStores({
    nearbyStores: [{ id: storeId, name: storeName, chain: "publix" }],
    zipCode,
    persistToDatabase: true,
  });

  const result = results[0];
  const sync = syncSummaries[0];

  if (!result) {
    console.log("No ingest result returned.");
    process.exit(1);
  }

  console.log(`Status: ${result.status}`);
  console.log(`Message: ${result.message}`);
  console.log(`Raw offers parsed: ${result.offers.length}`);
  console.log(
    `Matched tracked ingredients: ${result.offers.filter((offer) => offer.ingredientId).length}`,
  );

  if (sync) {
    console.log(`\nPostgres sync: synced=${sync.syncedCount}, skipped=${sync.skippedCount}`);
    console.log(`Sync message: ${sync.message}`);
  } else {
    console.log("\nPostgres sync: skipped (no offers to persist).");
  }

  const { snapshot } = await getMarketDataSnapshot();
  const recipeIngredientIds = [
    ...new Set(
      snapshot.recipes.flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.ingredientId),
      ),
    ),
  ];

  const scrapedObservations = snapshot.priceObservations.filter(
    (observation) =>
      observation.storeId === storeId &&
      observation.priceSource === "publix-weekly-ad-scrape",
  );

  console.log(`\nDB rows with publix-weekly-ad-scrape source: ${scrapedObservations.length}`);

  if (scrapedObservations.length > 0) {
    for (const observation of scrapedObservations.slice(0, 8)) {
      console.log(
        `  - ${observation.ingredientId}: $${observation.price.toFixed(2)} (${observation.saleLabel ?? "no label"})`,
      );
    }
  }

  const coverage = buildWeeklyAdStoreCoverage({
    storeId,
    chain: "publix",
    priceObservations: snapshot.priceObservations,
    recipeIngredientIds,
  });

  const promotionPassed = weeklyAdPromotionGatesPass(coverage, "publix");
  const rollout = resolveProviderRolloutForStore(storeName, {
    matchedIngredientCount: coverage.matchedIngredientCount,
    usesWeeklyAdSource: coverage.usesWeeklyAdSource,
    weeklyAdPromotionPassed: promotionPassed,
  });

  console.log("\nPromotion gates:");
  console.log(`  matched recipe ingredients: ${coverage.matchedIngredientCount}`);
  console.log(`  coverage status: ${coverage.coverageStatus}`);
  console.log(`  weekly-ad promotion passed: ${promotionPassed}`);
  console.log(`  rollout status: ${rollout.status}`);
  console.log(`  recommendation enabled: ${rollout.recommendationEnabled}`);

  console.log("\n=== Done ===\n");

  process.exit(result.offers.length > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
