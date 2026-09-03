import { rememberIngestZipGeocode } from "@/lib/zip-geocode-cache";
import { resolveLocationInput } from "@/lib/location-resolution";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { buildWeeklyAdIngestStoreCandidates } from "@/lib/ingest/weekly-ad-ingest-store-selection";
import {
  filterCatalogStoresNearLocation,
  resolveScheduledIngestZipCodes,
} from "@/lib/store-catalog-sync";
import {
  resolveIngestFenceForZip,
  storePassesIngestFence,
} from "@/lib/market-ingest-fence";
import {
  isWeeklyAdChain,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import { loadEnvLocal } from "@/lib/load-env-local";
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import {
  isWeeklyAdFailLoudChain,
  shouldFailWeeklyAdIngestExit,
} from "@/lib/ingest/ingest-script-exit-policy";
import { loadChainMembership } from "@/lib/chain-membership-repository";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  enforceFixtureIngestDatabasePolicy();

  const membership = await loadChainMembership();
  if (membership.shopperRankedChainIds.length === 0) {
    console.error(
      "chain_registry has no shopper_ranked rows. Apply db/init/026+ or check membership before weekly-ad ingest.",
    );
    process.exit(1);
  }

  const zipCodes = await resolveScheduledIngestZipCodes();
  const { snapshot } = await getMarketDataSnapshot();

  const weeklyAdCandidates = buildWeeklyAdIngestStoreCandidates(snapshot.stores);

  const allResults: Awaited<
    ReturnType<typeof runWeeklyAdIngestionForStores>
  >["results"] = [];
  const allSyncSummaries: Awaited<
    ReturnType<typeof runWeeklyAdIngestionForStores>
  >["syncSummaries"] = [];

  const admittedById = new Map<
    string,
    { id: string; name: string; chain: (typeof weeklyAdCandidates)[number]["chain"] }
  >();
  let flyerZipCode: string | undefined;

  for (const zipCode of zipCodes) {
    const locationResult = await resolveLocationInput({ zipCode });

    if (!locationResult.ok) {
      console.warn(
        `Skipping weekly-ad ingest for ZIP ${zipCode}: ${locationResult.error}`,
      );
      continue;
    }

    await rememberIngestZipGeocode({
      ...locationResult.location,
      zipCode,
    });

    const fence = await resolveIngestFenceForZip(zipCode);
    if (fence.zctaWarning) {
      console.warn(`[ingest-fence:${zipCode}] ${fence.zctaWarning}`);
    }

    const nearbyStores = filterCatalogStoresNearLocation(
      weeklyAdCandidates,
      locationResult.location,
      fence.ingestMiles,
    ).filter((store) =>
      storePassesIngestFence({
        latitude: store.latitude,
        longitude: store.longitude,
        center: locationResult.location,
        fence,
      }),
    );

    console.log(
      `Admitting ${nearbyStores.length} weekly-ad store(s) within ZIP outline (cap ${fence.ingestMiles} mi) of ${zipCode}...`,
    );

    for (const store of nearbyStores) {
      if (!admittedById.has(store.id)) {
        admittedById.set(store.id, {
          id: store.id,
          name: store.name,
          chain: store.chain,
        });
      }
    }
    flyerZipCode ??= zipCode;
  }

  const nearbyStores = [...admittedById.values()];
  if (nearbyStores.length === 0 || !flyerZipCode) {
    console.warn(
      "No weekly-ad chain stores in catalog inside the ingest fence. Run map catalog or seed stores first.",
    );
  } else {
    console.log(
      `Fetching each weekly-ad banner once, then fanning out to ${nearbyStores.length} admitted store(s) (ZIP ${flyerZipCode}).`,
    );
    const { results, syncSummaries } = await runWeeklyAdIngestionForStores({
      nearbyStores,
      zipCode: flyerZipCode,
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
      `\n[sync:${summary.chain}] synced=${summary.syncedCount}, skipped=${summary.skippedCount}, failed=${summary.failedCount}`,
    );
    console.log(`  ${summary.message}`);
  }

  const chainErrors = allResults.filter((result) => result.status === "error");
  const unrankedChainErrors = chainErrors.filter(
    (result) => !isWeeklyAdFailLoudChain(result.chain, membership),
  );
  const unrankedPersistFailures = allSyncSummaries.filter(
    (summary) =>
      summary.failedCount > 0 && !isWeeklyAdFailLoudChain(summary.chain, membership),
  );
  const rankedPersistFailures = allSyncSummaries
    .filter((summary) => isWeeklyAdFailLoudChain(summary.chain, membership))
    .reduce((total, summary) => total + summary.failedCount, 0);

  if (unrankedChainErrors.length > 0 || unrankedPersistFailures.length > 0) {
    const unrankedChains = [
      ...unrankedChainErrors.map((result) => result.chain),
      ...unrankedPersistFailures.map((summary) => summary.chain),
    ]
      .filter((chain): chain is string => Boolean(chain))
      .filter((chain, index, list) => list.indexOf(chain) === index);
    console.warn(
      `\nWeekly-ad unranked chain issue(s) did not fail this run: ${unrankedChains.join(", ")}. Ranked banners still fail the job.`,
    );
  }

  if (shouldFailWeeklyAdIngestExit({
    results: allResults,
    syncSummaries: allSyncSummaries,
    membership,
  })) {
    if (rankedPersistFailures > 0) {
      console.error(
        `\nWeekly-ad ingest finished with ${rankedPersistFailures} ranked persist failure(s). See structured error logs above.`,
      );
    } else if (chainErrors.some((result) => isWeeklyAdFailLoudChain(result.chain, membership))) {
      console.error(
        `\nWeekly-ad ingest finished with ranked chain failure(s). See structured error logs above.`,
      );
    }
    process.exit(1);
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
