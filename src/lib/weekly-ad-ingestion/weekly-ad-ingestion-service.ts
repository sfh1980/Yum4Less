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
import { createDollarGeneralWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/dollar-general-weekly-ad-ingestion";
import { createTargetWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/target-weekly-ad-ingestion";
import { createWholeFoodsWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-ingestion";
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
import { tryDiscoveredChainFlyers } from "@/lib/weekly-ad-ingestion/discovered-chain-flyer";
import { rejectPendingReviewsMatchingJunk } from "@/lib/owner/ingredient-review-repository";
import { purgeStaleRankedPriceObservations } from "@/lib/price-observation-writes";
import { logServerError } from "@/lib/server-log";
import {
  readWeeklyAdFlyerHash,
  recordWeeklyAdPriceMissReason,
} from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";
import {
  getWeeklyAdIngestionStatusSummaries,
  syncWeeklyAdOffersToPriceObservations,
} from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";
import {
  flyerZipClusterMemberSet,
  storeSharesFlyerZipCluster,
} from "@/lib/geo/active-zip-clusters";

export type WeeklyAdIngestFlyerCluster = {
  activeZipCodes: readonly string[];
  touchingByActiveZip: ReadonlyMap<string, readonly string[]>;
  admittingZipCodesByStoreId: ReadonlyMap<string, readonly string[]>;
};

export { WEEKLY_AD_CHAINS, isWeeklyAdChain };

function requireWeeklyAdZipCode(zipCode: string | undefined): string {
  const trimmed = zipCode?.trim() ?? "";
  if (!/^\d{5}$/.test(trimmed)) {
    throw new Error(
      "Weekly-ad ingest requires a 5-digit zipCode; there is no default market ZIP.",
    );
  }
  return trimmed;
}

export function getWeeklyAdIngestionClients(): WeeklyAdIngestionClient[] {
  return [
    createAldiWeeklyAdIngestionClient(),
    createFoodLionWeeklyAdIngestionClient(),
    createPublixWeeklyAdIngestionClient(),
    createKrogerWeeklyAdIngestionClient(),
    createWalmartWeeklyAdIngestionClient(),
    createLidlWeeklyAdIngestionClient(),
    createDollarGeneralWeeklyAdIngestionClient(),
    createTargetWeeklyAdIngestionClient(),
    createWholeFoodsWeeklyAdIngestionClient(),
  ];
}

export function getWeeklyAdIngestionClient(
  chain: WeeklyAdChain,
): WeeklyAdIngestionClient | undefined {
  return getWeeklyAdIngestionClients().find((client) => client.chain === chain);
}

export async function runWeeklyAdIngestionForStores(input: {
  nearbyStores: Pick<NearbyStoreSummary, "id" | "name" | "chain">[];
  zipCode: string;
  persistToDatabase?: boolean;
  /**
   * When set, a store receives this flyer's prices only if one ZIP that
   * admitted it is in the same connected cluster as zipCode. Omit it and
   * every nearby store is priced, which is what the existing tests cover.
   */
  flyerCluster?: WeeklyAdIngestFlyerCluster;
  /** When set, the opening purge deletes only this source_name. */
  purgeSourceName?: string;
}): Promise<{
  results: WeeklyAdIngestionResult[];
  syncSummaries: WeeklyAdOfferSyncSummary[];
}> {
  const catalog = await loadWeeklyAdMatchCatalog();
  const trackedIngredientIds = isFixtureIngestMode()
    ? WEEKLY_AD_TRACKED_INGREDIENT_IDS
    : trackedIngredientIdsFromCatalog(catalog);
  const zipCode = requireWeeklyAdZipCode(input.zipCode);
  const results: WeeklyAdIngestionResult[] = [];
  const syncSummaries: WeeklyAdOfferSyncSummary[] = [];
  const catalogFields = {
    catalogIngredients: catalog.ingredients,
    extraSearchTermsByIngredientId: catalog.extraSearchTermsByIngredientId,
  };

  if (input.persistToDatabase) {
    enforceFixtureIngestDatabasePolicy();
    await purgeStaleRankedPriceObservations(
      input.purgeSourceName ? { sourceName: input.purgeSourceName } : undefined,
    );
  }

  const nearbyStores = storesPricedFromFlyerCluster(input.nearbyStores, input.flyerCluster, zipCode);
  if (input.flyerCluster && nearbyStores.length !== input.nearbyStores.length) {
    console.info(
      `[weekly-ad] flyer ZIP ${zipCode} cluster keeps ${nearbyStores.length} store(s); skipped ${input.nearbyStores.length - nearbyStores.length} outside the cluster.`,
    );
  }

  const krogerStores = nearbyStores.filter((store) => store.chain === "kroger");
  const nonKrogerStores = nearbyStores.filter((store) => store.chain !== "kroger");

  if (krogerStores.length > 0) {
    try {
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

        if (input.persistToDatabase && result.offers.length > 0) {
          syncSummaries.push(
            ...(await syncWeeklyAdResultAcrossStores({
              chain: "kroger",
              result,
              stores: krogerStores,
            })),
          );
        }
        if (input.persistToDatabase && result.thinPage) {
          await recordWeeklyAdPriceMissReason({
            chain: "kroger",
            reason: "thin-page",
          });
        }
        results.push(result);
      }
    } catch (error) {
      results.push(
        await weeklyAdChainTurnFailure({
          chain: "kroger",
          error,
          persist: Boolean(input.persistToDatabase),
        }),
      );
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

    try {
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

      if (input.persistToDatabase && result.offers.length > 0) {
        syncSummaries.push(
          ...(await syncWeeklyAdResultAcrossStores({
            chain,
            result,
            stores: chainStores,
          })),
        );
      }
      if (input.persistToDatabase && result.thinPage) {
        await recordWeeklyAdPriceMissReason({
          chain,
          reason: "thin-page",
        });
      }
      results.push(result);
    } catch (error) {
      results.push(
        await weeklyAdChainTurnFailure({
          chain,
          error,
          persist: Boolean(input.persistToDatabase),
        }),
      );
    }
  }

  if (input.persistToDatabase && !isFixtureIngestMode()) {
    await tryDiscoveredChainFlyers({
      zipCode,
      stores: nearbyStores,
      trackedIngredientIds,
    });
    try {
      const heal = await rejectPendingReviewsMatchingJunk();
      if (heal.rejected > 0) {
        console.info(
          `[weekly-ad] rejected ${heal.rejected} pending junk review(s) of ${heal.scanned} scanned`,
        );
      }
    } catch (error) {
      logServerError("weekly-ad-ingest.reject-pending-junk", error);
    }
  }

  return { results, syncSummaries };
}

export async function getWeeklyAdIngestionMarketSummaries(input: {
  storeIds: string[];
}) {
  return getWeeklyAdIngestionStatusSummaries(input);
}

/**
 * One chain's throw must not skip the chains after it. The result stays
 * status "error" so the existing fail-loud exit still sees a ranked failure.
 */
async function weeklyAdChainTurnFailure(input: {
  chain: WeeklyAdChain;
  error: unknown;
  persist: boolean;
}): Promise<WeeklyAdIngestionResult> {
  logServerError("weekly-ad-ingest.chain", input.error, { chain: input.chain });
  if (input.persist) {
    await recordWeeklyAdPriceMissReason({
      chain: input.chain,
      reason: "fetch-failed",
    });
  }
  const message =
    input.error instanceof Error ? input.error.message : "Weekly-ad chain failed.";
  return {
    chain: input.chain,
    label: `${input.chain} weekly ad ingestion`,
    status: "error",
    provenance: "weekly-ad-scrape",
    retrievalMode: "none",
    configured: true,
    fallbackUsed: false,
    offers: [],
    message,
    fetchedAt: new Date().toISOString(),
    termsNote: "Weekly-ad prices are directional until verified in store.",
  };
}

function storesPricedFromFlyerCluster<T extends { id: string }>(
  stores: readonly T[],
  flyerCluster: WeeklyAdIngestFlyerCluster | undefined,
  fetchedZipCode: string,
): T[] {
  if (!flyerCluster) {
    return [...stores];
  }
  const members = flyerZipClusterMemberSet({
    flyerZipCode: fetchedZipCode,
    activeZipCodes: flyerCluster.activeZipCodes,
    touchingByActiveZip: flyerCluster.touchingByActiveZip,
  });
  return stores.filter((store) =>
    storeSharesFlyerZipCluster({
      admittingZipCodes: flyerCluster.admittingZipCodesByStoreId.get(store.id) ?? [],
      flyerCluster: members,
    }),
  );
}

/** One chain hash, read before any store write, then one persist decision per store. */
async function syncWeeklyAdResultAcrossStores(input: {
  chain: WeeklyAdChain;
  result: WeeklyAdIngestionResult;
  stores: Array<{ id: string }>;
}): Promise<WeeklyAdOfferSyncSummary[]> {
  const previousFlyerHash = await readWeeklyAdFlyerHash(input.chain);
  const summaries: WeeklyAdOfferSyncSummary[] = [];
  for (const targetStore of input.stores) {
    summaries.push(
      await syncWeeklyAdOffersToPriceObservations({
        result: {
          ...input.result,
          offers: input.result.offers.map((offer) => ({
            ...offer,
            storeId: targetStore.id,
          })),
        },
        previousFlyerHash,
      }),
    );
  }
  return summaries;
}
