import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseWholeFoodsWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-whole-foods-weekly-ad";
import { persistWholeFoodsSourceStoreBinding } from "@/lib/whole-foods-catalog-sync";
import {
  buildWholeFoodsSalesFlyerUrl,
} from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-api";
import { fetchWholeFoodsSalesFlyerHtml } from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-fetcher";
import { resolveWholeFoodsStoreForZip } from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-store";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "whole-foods-weekly-ad-sample.html";

export type WholeFoodsWeeklyAdIngestionDeps = {
  resolveStoreForZip?: typeof resolveWholeFoodsStoreForZip;
  fetchSalesFlyerHtml?: typeof fetchWholeFoodsSalesFlyerHtml;
  persistBinding?: typeof persistWholeFoodsSourceStoreBinding;
};

export function createWholeFoodsWeeklyAdIngestionClient(
  deps?: WholeFoodsWeeklyAdIngestionDeps,
): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("whole-foods");

  return {
    chain: "whole-foods",
    label: config?.label ?? "Whole Foods weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [
      "https://www.wholefoodsmarket.com/sales-flyer",
    ],
    ingestWeeklyAd: (input) => ingestWholeFoodsWeeklyAd(input, deps),
  };
}

async function ingestWholeFoodsWeeklyAd(
  input: WeeklyAdIngestionInput,
  deps?: WholeFoodsWeeklyAdIngestionDeps,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("whole-foods");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Whole Foods weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Whole Foods weekly-ad prices are directional store circulars until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "whole-foods",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: "https://www.wholefoodsmarket.com/sales-flyer",
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  const resolveStore = deps?.resolveStoreForZip ?? resolveWholeFoodsStoreForZip;
  const fetchFlyer = deps?.fetchSalesFlyerHtml ?? fetchWholeFoodsSalesFlyerHtml;
  const persistBinding = deps?.persistBinding ?? persistWholeFoodsSourceStoreBinding;

  try {
    const locatorStore = await resolveStore(input.zipCode);
    if (!locatorStore) {
      return {
        chain: "whole-foods",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "none",
        configured: true,
        fallbackUsed: false,
        offers: [],
        message: `${label} could not resolve a nearby Whole Foods store for ZIP ${input.zipCode} via the public locator. Set WHOLE_FOODS_STORE_NUMBER only for local probes — never hardcode a store id in adapters.`,
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

    const page = await fetchFlyer({ storeId: locatorStore.storeId });
    const sourceUrl = page.url || buildWholeFoodsSalesFlyerUrl(locatorStore.storeId);
    const rawOffers = parseWholeFoodsWeeklyAd({ html: page.html });

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "whole-foods",
        zipCode: input.zipCode,
        sourceUrl,
        html: page.html.slice(0, 50_000),
        errorMessage: `Whole Foods store ${locatorStore.storeId} returned no parseable weekly-ad unit prices.`,
      });

      return {
        chain: "whole-foods",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        offers: [],
        message: `${label} resolved Whole Foods store ${locatorStore.storeId} (${locatorStore.locationName}) for ZIP ${input.zipCode}, but found no parseable unit-priced grocery offers. Percent-only lines are skipped.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "whole-foods",
      storeId: input.storeId,
      sourceUrl,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "whole-foods",
      label,
      status: "live",
      provenance: "weekly-ad-scrape",
      retrievalMode: "live",
      configured: true,
      fallbackUsed: false,
      offers,
      message: `Parsed Whole Foods weekly-ad for store ${locatorStore.storeId} (${locatorStore.locationName}) for ZIP ${input.zipCode} via sales-flyer: ${rawOffers.length} unit-priced offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients. Dinners stay off until membership floors pass.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "whole-foods",
      zipCode: input.zipCode,
      sourceUrl: "https://www.wholefoodsmarket.com/sales-flyer",
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    return {
      chain: "whole-foods",
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
