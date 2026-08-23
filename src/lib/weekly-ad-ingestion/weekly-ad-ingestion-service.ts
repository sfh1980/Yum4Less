import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { pickPrimaryKrogerStoreForWeeklyAdIngestList } from "@/lib/kroger-catalog-canonical";
import {
  enforceFixtureIngestDatabasePolicy,
  isFixtureIngestMode,
} from "@/lib/fixture-ingest-policy";
import { createAldiWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import { createFoodLionWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/food-lion-weekly-ad-ingestion";
import { createPublixWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-ingestion";
import { createKrogerWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion";
import { createLidlWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/lidl-weekly-ad-ingestion";
import { createWalmartWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-ingestion";
import {
  groupWeeklyAdIngestStoresByChain,
  pickPrimaryWeeklyAdIngestStoreForChain,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingest-store-priority";
import {
  isWeeklyAdChain,
  WEEKLY_AD_CHAINS,
} from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  expandUnmatchedWeeklyAdOffers,
  loadWeeklyAdMatchCatalog,
  trackedIngredientIdsFromCatalog,
} from "@/lib/weekly-ad-ingestion/weekly-ad-match-catalog";
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
    createLidlWeeklyAdIngestionClient(),
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
  const catalog = await loadWeeklyAdMatchCatalog();
  const trackedIngredientIds = isFixtureIngestMode()
    ? WEEKLY_AD_TRACKED_INGREDIENT_IDS
    : trackedIngredientIdsFromCatalog(catalog);
  const zipCode = input.zipCode ?? DEFAULT_ZIP_CODE;
  const results: WeeklyAdIngestionResult[] = [];
  const syncSummaries: WeeklyAdOfferSyncSummary[] = [];
  const catalogFields = {
    catalogIngredients: catalog.ingredients,
    extraSearchTermsByIngredientId: catalog.extraSearchTermsByIngredientId,
  };

  if (input.persistToDatabase) {
    enforceFixtureIngestDatabasePolicy();
    await purgeStaleRankedPriceObservations();
  }

  const krogerStores = input.nearbyStores.filter((store) => store.chain === "kroger");
  const nonKrogerStores = input.nearbyStores.filter((store) => store.chain !== "kroger");

  if (krogerStores.length > 0) {
    const krogerClient = getWeeklyAdIngestionClient("kroger");
    if (krogerClient) {
      const primaryStore = pickPrimaryKrogerStoreForWeeklyAdIngestList(krogerStores);
      const result = await krogerClient.ingestWeeklyAd({
        chain: "kroger",
        storeId: primaryStore.id,
        storeName: primaryStore.name,
        zipCode,
        trackedIngredientIds,
        ...catalogFields,
      });
      result.offers = await expandUnmatchedWeeklyAdOffers({
        chain: "kroger",
        offers: result.offers,
        catalog,
        persist: Boolean(input.persistToDatabase),
      });
      results.push(result);

      if (input.persistToDatabase && result.offers.length > 0) {
        for (const targetStore of krogerStores) {
          const fanOutResult: WeeklyAdIngestionResult = {
            ...result,
            offers: result.offers.map((offer) => ({
              ...offer,
              storeId: targetStore.id,
            })),
          };
          syncSummaries.push(
            await syncWeeklyAdOffersToPriceObservations({ result: fanOutResult }),
          );
        }
      }
    }
  }

  for (const [chain, chainStores] of groupWeeklyAdIngestStoresByChain(nonKrogerStores)) {
    if (!isWeeklyAdChain(chain)) {
      continue;
    }

    const client = getWeeklyAdIngestionClient(chain);
    if (!client) {
      continue;
    }

    const primaryStore = pickPrimaryWeeklyAdIngestStoreForChain(chainStores);
    const result = await client.ingestWeeklyAd({
      chain,
      storeId: primaryStore.id,
      storeName: primaryStore.name,
      zipCode,
      trackedIngredientIds,
      ...catalogFields,
    });
    result.offers = await expandUnmatchedWeeklyAdOffers({
      chain,
      offers: result.offers,
      catalog,
      persist: Boolean(input.persistToDatabase),
    });
    results.push(result);

    if (input.persistToDatabase && result.offers.length > 0) {
      for (const targetStore of chainStores) {
        const fanOutResult: WeeklyAdIngestionResult = {
          ...result,
          offers: result.offers.map((offer) => ({
            ...offer,
            storeId: targetStore.id,
          })),
        };
        syncSummaries.push(
          await syncWeeklyAdOffersToPriceObservations({ result: fanOutResult }),
        );
      }
    }
  }

  return { results, syncSummaries };
}

export async function getWeeklyAdIngestionMarketSummaries(input: {
  storeIds: string[];
}) {
  return getWeeklyAdIngestionStatusSummaries(input);
}
