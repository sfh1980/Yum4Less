import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { weeklyAdTouchingZipFailureMessage } from "@/lib/geo/active-zip-clusters";
import { getDbPool } from "@/lib/db";
import { queryRankedPriceFreshness } from "@/lib/ingest/ingest-freshness-heartbeat";
import { priceSourceFreshnessKind } from "@/lib/owner/morning-chain-prices";
import { loadCachedTouchingZips } from "@/lib/geo/zcta-neighbors";
import { failIngestJobByKind } from "@/lib/ingest-jobs";
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
  type WeeklyAdIngestFlyerCluster,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import { loadEnvLocal } from "@/lib/load-env-local";
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import {
  isWeeklyAdFailLoudChain,
  shouldFailWeeklyAdIngestExit,
} from "@/lib/ingest/ingest-script-exit-policy";
import { loadChainMembership } from "@/lib/chain-membership-repository";
import {
  getWeeklyAdSourceName,
  type WeeklyAdChain,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import {
  readWeeklyAdOnlyChain,
  storesForWeeklyAdOnlyChain,
} from "@/lib/weekly-ad-ingestion/weekly-ad-only-chain";
import {
  bumpWeeklyAdRetryCount,
  parseWeeklyAdRetryState,
  readWeeklyAdRetryMaxPerDay,
  selectWeeklyAdRetryChain,
  weeklyAdRetryDate,
  type WeeklyAdRetryState,
} from "@/lib/weekly-ad-ingestion/weekly-ad-retry";

loadEnvLocal();

async function main() {
  const requestedChain = readWeeklyAdOnlyChain(process.argv);
  const retryStale = process.argv.includes("--retry-stale");
  if (retryStale && requestedChain) {
    throw new Error("--retry-stale chooses the chain. Do not also pass --chain.");
  }
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
    {
      id: string;
      name: string;
      chain: (typeof weeklyAdCandidates)[number]["chain"];
      admittingZipCodes: Set<string>;
    }
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
      const existing = admittedById.get(store.id);
      if (existing) {
        existing.admittingZipCodes.add(zipCode);
        continue;
      }
      admittedById.set(store.id, {
        id: store.id,
        name: store.name,
        chain: store.chain,
        admittingZipCodes: new Set([zipCode]),
      });
    }
    flyerZipCode ??= zipCode;
  }

  const admittedStores = [...admittedById.values()].map(({ id, name, chain }) => ({
    id,
    name,
    chain,
  }));
  let runStores = admittedStores;
  let purgeSourceName: string | undefined;
  const singleChain = Boolean(requestedChain) || retryStale;
  if (requestedChain) {
    runStores = storesForWeeklyAdOnlyChain(admittedStores, requestedChain);
    if (runStores.length === 0) {
      console.error(`No admitted ${requestedChain} store. Weekly-ad wrote nothing.`);
      process.exit(1);
    }
    purgeSourceName = getWeeklyAdSourceName(requestedChain);
    console.log(
      `${requestedChain}-only weekly-ad for ${runStores.length} admitted store(s) (ZIP ${flyerZipCode}). No ingest_jobs row. Stale-row purge is limited to ${purgeSourceName}.`,
    );
  } else if (retryStale) {
    const choice = await chooseStaleWeeklyAdChain(admittedStores);
    if (!choice || !flyerZipCode) {
      console.log(
        "[weekly-ad-retry] no chain with no fresh rows is under today's limit.",
      );
      process.exit(0);
    }
    runStores = admittedStores.filter((store) => store.chain === choice);
    purgeSourceName = getWeeklyAdSourceName(choice);
    console.log(
      `[weekly-ad-retry] ${choice} for ${runStores.length} admitted store(s) (ZIP ${flyerZipCode}). No ingest_jobs row. Stale-row purge is limited to ${purgeSourceName}.`,
    );
  } else if (!admittedStores.some((store) => store.chain === "whole-foods")) {
    console.info(
      "[whole-foods] no rows: no admitted store, so the flyer was not fetched",
    );
  }
  if (!singleChain && (runStores.length === 0 || !flyerZipCode)) {
    console.warn(
      "No weekly-ad chain stores in catalog inside the ingest fence. Run map catalog or seed stores first.",
    );
  } else if (flyerZipCode && runStores.length > 0) {
    if (!singleChain) {
      console.log(
        `Fetching each weekly-ad banner once, then fanning out to ${runStores.length} admitted store(s) (ZIP ${flyerZipCode}).`,
      );
    }
    const flyerCluster = await flyerClusterForFetchedZip({
      activeZipCodes: zipCodes,
      admittedById,
      touchJobTable: !singleChain,
    });
    const { results, syncSummaries } = await runWeeklyAdIngestionForStores({
      nearbyStores: runStores,
      zipCode: flyerZipCode,
      persistToDatabase: true,
      flyerCluster,
      purgeSourceName,
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

  if (!singleChain && process.env.THEMEALDB_IMPORT_AFTER_WEEKLY_AD === "1") {
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

async function chooseStaleWeeklyAdChain(
  stores: readonly { chain: string }[],
): Promise<WeeklyAdChain | null> {
  const chainIds = [...new Set(stores.map((store) => store.chain))].filter(isWeeklyAdChain);
  if (chainIds.length === 0) {
    return null;
  }
  const pool = getDbPool();
  const orderResult = await pool.query<{ chain_id: string; sort_order: number }>(
    `
      select chain_id, sort_order
      from chain_registry
      where chain_id = any($1::text[])
      order by sort_order asc, chain_id asc
    `,
    [chainIds],
  );
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const row of orderResult.rows) {
    if (!seen.has(row.chain_id)) {
      seen.add(row.chain_id);
      ordered.push(row.chain_id);
    }
  }
  for (const chainId of chainIds) {
    if (!seen.has(chainId)) {
      ordered.push(chainId);
    }
  }
  const freshness = await queryRankedPriceFreshness(pool);
  const fresh = new Map<string, number>();
  for (const row of freshness.bySource) {
    const parsed = priceSourceFreshnessKind(row.sourceName);
    if (!parsed) {
      continue;
    }
    fresh.set(parsed.chainId, (fresh.get(parsed.chainId) ?? 0) + row.freshCount);
  }
  const today = weeklyAdRetryDate(new Date());
  const state = readWeeklyAdRetryState(today);
  const choice = selectWeeklyAdRetryChain({
    candidates: ordered.map((chainId) => ({
      chainId,
      freshCount: fresh.get(chainId) ?? 0,
    })),
    attemptsToday: state.counts,
    maxPerDay: readWeeklyAdRetryMaxPerDay(process.env),
  });
  if (!choice || !isWeeklyAdChain(choice)) {
    return null;
  }
  writeWeeklyAdRetryState(bumpWeeklyAdRetryCount(state, choice));
  return choice;
}

function weeklyAdRetryStatePath(): string {
  if (process.env.YUM4LESS_WEEKLY_AD_RETRY_STATE_PATH?.trim()) {
    return process.env.YUM4LESS_WEEKLY_AD_RETRY_STATE_PATH.trim();
  }
  const onTheBox = "/var/log/yum4less/weekly-ad-retry-state.json";
  try {
    mkdirSync(dirname(onTheBox), { recursive: true });
    return onTheBox;
  } catch {
    return join(tmpdir(), "yum4less-weekly-ad-retry-state.json");
  }
}

function readWeeklyAdRetryState(today: string): WeeklyAdRetryState {
  try {
    return parseWeeklyAdRetryState(readFileSync(weeklyAdRetryStatePath(), "utf8"), today);
  } catch {
    return parseWeeklyAdRetryState("", today);
  }
}

function writeWeeklyAdRetryState(state: WeeklyAdRetryState): void {
  const path = weeklyAdRetryStatePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state)}\n`, "utf8");
}

async function flyerClusterForFetchedZip(input: {
  activeZipCodes: readonly string[];
  admittedById: ReadonlyMap<string, { admittingZipCodes: ReadonlySet<string> }>;
  touchJobTable: boolean;
}): Promise<WeeklyAdIngestFlyerCluster> {
  const cached = await loadCachedTouchingZips(input.activeZipCodes);
  if (!cached.ok) {
    const message = weeklyAdTouchingZipFailureMessage(cached.error);
    if (input.touchJobTable) {
      await failIngestJobByKind({ kind: "weekly-ad", error: message }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
      });
    }
    throw new Error(message);
  }

  const admittingZipCodesByStoreId = new Map<string, readonly string[]>();
  for (const [storeId, store] of input.admittedById) {
    admittingZipCodesByStoreId.set(storeId, [...store.admittingZipCodes]);
  }

  return {
    activeZipCodes: input.activeZipCodes,
    touchingByActiveZip: cached.touchingByZip,
    admittingZipCodesByStoreId,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
