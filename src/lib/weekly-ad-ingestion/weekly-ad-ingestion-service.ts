import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import { createAldiWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import { createFoodLionWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/food-lion-weekly-ad-ingestion";
import { createPublixWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-ingestion";
import { createKrogerWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion";
import { createWalmartWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-ingestion";
import {
  isWeeklyAdChain,
  WEEKLY_AD_CHAINS,
} from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import type {
  WeeklyAdChain,
  WeeklyAdIngestionClient,
  WeeklyAdIngestionResult,
  WeeklyAdOfferSyncSummary,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { createResearchWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/weekly-ad-research-ingestion";
import { purgeStaleRankedPriceObservations } from "@/lib/price-observation-writes";
import {
  getWeeklyAdIngestionStatusSummaries,
  syncWeeklyAdOffersToPriceObservations,
} from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";

const DEFAULT_ZIP_CODE = process.env.YUM4LESS_PROVIDER_SYNC_ZIP ?? "23111";

export { WEEKLY_AD_CHAINS, isWeeklyAdChain };

export function getWeeklyAdIngestionClients(): WeeklyAdIngestionClient[] {
  return [
    createAldiWeeklyAdIngestionClient(),
    createFoodLionWeeklyAdIngestionClient(),
    createPublixWeeklyAdIngestionClient(),
    createKrogerWeeklyAdIngestionClient(),
    createWalmartWeeklyAdIngestionClient(),
    createResearchWeeklyAdIngestionClient("lidl"),
    createResearchWeeklyAdIngestionClient("dollar-general"),
  ];
}

export function getWeeklyAdIngestionClient(
  chain: WeeklyAdChain,
): WeeklyAdIngestionClient | undefined {
  return getWeeklyAdIngestionClients().find((client) => client.chain === chain);
}

export async function runWeeklyAdIngestionForStores(input: {
  nearbyStores: Pick<NearbyStoreSummary, "id" | "name" | "chain">[];
  zipCode?: string;
  persistToDatabase?: boolean;
}): Promise<{
  results: WeeklyAdIngestionResult[];
  syncSummaries: WeeklyAdOfferSyncSummary[];
}> {
  const trackedIngredientIds = WEEKLY_AD_TRACKED_INGREDIENT_IDS;
  const zipCode = input.zipCode ?? DEFAULT_ZIP_CODE;
  const results: WeeklyAdIngestionResult[] = [];
  const syncSummaries: WeeklyAdOfferSyncSummary[] = [];

  if (input.persistToDatabase) {
    enforceFixtureIngestDatabasePolicy();
    await purgeStaleRankedPriceObservations();
  }

  for (const store of input.nearbyStores) {
    if (!isWeeklyAdChain(store.chain)) {
      continue;
    }

    const client = getWeeklyAdIngestionClient(store.chain);
    if (!client) {
      continue;
    }

    const result = await client.ingestWeeklyAd({
      chain: store.chain,
      storeId: store.id,
      storeName: store.name,
      zipCode,
      trackedIngredientIds,
    });
    results.push(result);

    if (input.persistToDatabase && result.offers.length > 0) {
      syncSummaries.push(
        await syncWeeklyAdOffersToPriceObservations({ result }),
      );
    }
  }

  return { results, syncSummaries };
}

export async function getWeeklyAdIngestionMarketSummaries(input: {
  storeIds: string[];
}) {
  return getWeeklyAdIngestionStatusSummaries(input);
}
