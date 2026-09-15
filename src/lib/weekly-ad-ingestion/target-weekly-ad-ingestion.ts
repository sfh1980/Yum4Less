import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseTargetWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-target-weekly-ad";
import { persistTargetSourceStoreBinding } from "@/lib/target-catalog-sync";
import {
  TARGET_WEEKLY_AD_PAGE_URL,
} from "@/lib/weekly-ad-ingestion/target-weekly-ad-api";
import { fetchTargetWeeklyAdPromotionPayloads } from "@/lib/weekly-ad-ingestion/target-weekly-ad-fetcher";
import { resolveTargetStoreForZip } from "@/lib/weekly-ad-ingestion/target-weekly-ad-store";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "target-weekly-ad-sample.html";

export type TargetWeeklyAdIngestionDeps = {
  resolveStoreForZip?: typeof resolveTargetStoreForZip;
  fetchPromotionPayloads?: typeof fetchTargetWeeklyAdPromotionPayloads;
  persistBinding?: typeof persistTargetSourceStoreBinding;
};

export function createTargetWeeklyAdIngestionClient(
  deps?: TargetWeeklyAdIngestionDeps,
): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("target");

  return {
    chain: "target",
    label: config?.label ?? "Target weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [TARGET_WEEKLY_AD_PAGE_URL],
    ingestWeeklyAd: (input) => ingestTargetWeeklyAd(input, deps),
  };
}

async function ingestTargetWeeklyAd(
  input: WeeklyAdIngestionInput,
  deps?: TargetWeeklyAdIngestionDeps,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("target");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Target weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Target weekly-ad prices are directional store circulars until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "target",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: TARGET_WEEKLY_AD_PAGE_URL,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  const resolveStore = deps?.resolveStoreForZip ?? resolveTargetStoreForZip;
  const fetchPayloads =
    deps?.fetchPromotionPayloads ?? fetchTargetWeeklyAdPromotionPayloads;
  const persistBinding = deps?.persistBinding ?? persistTargetSourceStoreBinding;

  try {
    const locatorStore = await resolveStore(input.zipCode);
    if (!locatorStore) {
      return {
        chain: "target",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "none",
        configured: true,
        fallbackUsed: false,
        offers: [],
        message: `${label} could not resolve a nearby Target store for ZIP ${input.zipCode} via the public locator. Set TARGET_STORE_NUMBER only for local probes — never hardcode a store id in adapters.`,
        fetchedAt,
        termsNote,
      };
    }

    if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE !== "1") {
      await persistBinding({
        catalogStoreId: input.storeId,
        locatorStore,
      });
    }

    const payloads = await fetchPayloads({ storeId: locatorStore.storeId });
    const rawOffers = parseTargetWeeklyAd({
      promotionDetails: payloads.details,
      validThroughFallback: payloads.promotions[0]?.saleEndDate,
    });

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "target",
        zipCode: input.zipCode,
        sourceUrl: TARGET_WEEKLY_AD_PAGE_URL,
        html: JSON.stringify(payloads.details).slice(0, 50_000),
        errorMessage: `Target store ${locatorStore.storeId} returned no parseable weekly-ad unit prices.`,
      });

      return {
        chain: "target",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        offers: [],
        message: `${label} resolved Target store ${locatorStore.storeId} (${locatorStore.locationName}) for ZIP ${input.zipCode}, but found no parseable unit-priced grocery offers. BOGO/percent-only lines are skipped.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "target",
      storeId: input.storeId,
      sourceUrl: TARGET_WEEKLY_AD_PAGE_URL,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "target",
      label,
      status: "live",
      provenance: "weekly-ad-scrape",
      retrievalMode: "live",
      configured: true,
      fallbackUsed: false,
      offers,
      message: `Parsed Target weekly-ad for store ${locatorStore.storeId} (${locatorStore.locationName}) via promotions JSON: ${rawOffers.length} unit-priced offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients. Dinners stay off until membership floors pass.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "target",
      zipCode: input.zipCode,
      sourceUrl: TARGET_WEEKLY_AD_PAGE_URL,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    return {
      chain: "target",
      label,
      status: "error",
      provenance: "weekly-ad-scrape",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: false,
      offers: [],
      message:
        error instanceof Error
          ? `${label} fetch failed: ${error.message}`
          : `${label} fetch failed with an unknown error.`,
      fetchedAt,
      termsNote,
    };
  }
}
