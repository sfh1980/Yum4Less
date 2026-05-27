import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import {
  isWeeklyAdChain,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

const DEFAULT_ZIP = process.env.YUM4LESS_INGEST_ZIP ?? "23111";

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const { snapshot } = await getMarketDataSnapshot();
  const nearbyStores = snapshot.stores
    .map((store) => {
      const rollout = getProviderRolloutForStore(store.name);
      return {
        id: store.id,
        name: store.name,
        chain: rollout.chain,
      };
    })
    .filter((store): store is { id: string; name: string; chain: WeeklyAdChain } =>
      isWeeklyAdChain(store.chain),
    );

  console.log(
    `Running weekly-ad ingestion for ${nearbyStores.length} local chain store(s) near ZIP ${DEFAULT_ZIP}...`,
  );

  const { results, syncSummaries } = await runWeeklyAdIngestionForStores({
    nearbyStores,
    zipCode: DEFAULT_ZIP,
    persistToDatabase: true,
  });

  for (const result of results) {
    console.log(`\n[${result.chain}] ${result.status} — ${result.message}`);
    console.log(`  offers: ${result.offers.length}, configured: ${result.configured}`);
  }

  for (const summary of syncSummaries) {
    console.log(
      `\n[sync:${summary.chain}] synced=${summary.syncedCount}, skipped=${summary.skippedCount}`,
    );
    console.log(`  ${summary.message}`);
  }

  if (results.every((result) => result.offers.length === 0)) {
    console.log(
      "\nNo offers parsed. For a deterministic local run, use: npm run ingest:weekly-ads:fixture",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
