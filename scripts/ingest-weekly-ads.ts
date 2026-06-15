import { resolveLocationInput } from "@/lib/location-resolution";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import {
  filterCatalogStoresNearLocation,
  parseIngestZipCodesFromEnv,
  resolveIngestRadiusMiles,
} from "@/lib/store-catalog-sync";
import {
  isWeeklyAdChain,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { loadEnvLocal } from "@/lib/load-env-local";
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  enforceFixtureIngestDatabasePolicy();

  const zipCodes = parseIngestZipCodesFromEnv();
  const radiusMiles = resolveIngestRadiusMiles();
  const { snapshot } = await getMarketDataSnapshot();

  const weeklyAdCandidates = snapshot.stores
    .map((store) => {
      const rollout = getProviderRolloutForStore(store.name);
      return {
        id: store.id,
        name: store.name,
        chain: rollout.chain,
        latitude: store.latitude,
        longitude: store.longitude,
      };
    })
    .filter(
      (
        store,
      ): store is {
        id: string;
        name: string;
        chain: WeeklyAdChain;
        latitude: number;
        longitude: number;
      } => isWeeklyAdChain(store.chain),
    );

  const allResults: Awaited<
    ReturnType<typeof runWeeklyAdIngestionForStores>
  >["results"] = [];
  const allSyncSummaries: Awaited<
    ReturnType<typeof runWeeklyAdIngestionForStores>
  >["syncSummaries"] = [];

  for (const zipCode of zipCodes) {
    const locationResult = await resolveLocationInput({ zipCode });

    if (!locationResult.ok) {
      console.warn(
        `Skipping weekly-ad ingest for ZIP ${zipCode}: ${locationResult.error}`,
      );
      continue;
    }

    const nearbyStores = filterCatalogStoresNearLocation(
      weeklyAdCandidates,
      locationResult.location,
      radiusMiles,
    ).map(({ id, name, chain }) => ({ id, name, chain }));

    console.log(
      `Running weekly-ad ingestion for ${nearbyStores.length} chain store(s) within ${radiusMiles} mi of ZIP ${zipCode}...`,
    );

    if (nearbyStores.length === 0) {
      console.warn(
        `  No weekly-ad chain stores in catalog within ${radiusMiles} mi of ZIP ${zipCode}. Run map catalog or seed stores first.`,
      );
      continue;
    }

    const { results, syncSummaries } = await runWeeklyAdIngestionForStores({
      nearbyStores,
      zipCode,
      persistToDatabase: true,
    });

    allResults.push(...results);
    allSyncSummaries.push(...syncSummaries);
  }

  for (const result of allResults) {
    console.log(`\n[${result.chain}] ${result.status} — ${result.message}`);
    console.log(`  offers: ${result.offers.length}, configured: ${result.configured}`);
  }

  for (const summary of allSyncSummaries) {
    console.log(
      `\n[sync:${summary.chain}] synced=${summary.syncedCount}, skipped=${summary.skippedCount}`,
    );
    console.log(`  ${summary.message}`);
  }

  if (process.env.THEMEALDB_IMPORT_AFTER_WEEKLY_AD === "1") {
    const { runSaleDrivenThemealdbImport, summarizeThemealdbImportReport } =
      await import("@/lib/recipe-import/sale-driven-themealdb-import");
    console.log("\nRunning opt-in sale-driven TheMealDB import...");
    const themealdbReport = await runSaleDrivenThemealdbImport();
    console.log(summarizeThemealdbImportReport(themealdbReport));
  }

  if (allResults.length === 0) {
    console.log(
      "\nNo weekly-ad stores matched the configured ingest ZIP(s). Check YUM4LESS_INGEST_ZIPS and catalog rows near those markets.",
    );
  } else if (allResults.every((result) => result.offers.length === 0)) {
    console.log(
      "\nNo offers parsed. For a deterministic local run, use: npm run ingest:weekly-ads:fixture",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
