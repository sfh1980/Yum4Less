import { fetchFlippSearchOffersForMerchant } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { fetchWeeklyAdPageContent } from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "aldi-weekly-ad-sample.html";
const ALDI_WEEKLY_SPECIALS_URL = "https://www.aldi.us/en/weekly-specials/";
const ALDI_FLIPP_MERCHANT = "ALDI";

export function createAldiWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("aldi");

  return {
    chain: "aldi",
    label: config?.label ?? "Aldi weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [ALDI_WEEKLY_SPECIALS_URL],
    ingestWeeklyAd: ingestAldiWeeklyAd,
  };
}

async function ingestAldiWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("aldi");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Aldi weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Aldi weekly-ad prices are directional until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "aldi",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: ALDI_WEEKLY_SPECIALS_URL,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  try {
    let rawOffers = await fetchFlippSearchOffersForMerchant({
      zipCode: input.zipCode,
      merchantName: ALDI_FLIPP_MERCHANT,
    });
    let retrievalLabel = "Flipp syndicated weekly-ad feed";
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;

    if (rawOffers.length === 0) {
      const pageFetch = await fetchWeeklyAdPageContent({
        url: ALDI_WEEKLY_SPECIALS_URL,
        fetchStrategy: config?.fetchStrategy ?? "browser-fallback",
        browserWaitSelector: config?.browserWaitSelector,
      });
      rawOffers = parseWeeklyAdHtml(pageFetch.html);
      retrievalLabel = `${pageFetch.method} scrape`;
      provenance = "weekly-ad-scrape";
      fallbackUsed = pageFetch.method === "browser";
    }

    if (rawOffers.length === 0) {
      return {
        chain: "aldi",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} could not load Aldi weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed or direct page scrape. Aldi pages are JS-heavy; verify deals in store.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "aldi",
      storeId: input.storeId,
      sourceUrl: ALDI_WEEKLY_SPECIALS_URL,
      observedAt: fetchedAt,
      rawOffers,
      trackedIngredientIds: input.trackedIngredientIds,
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "aldi",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Aldi weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    return {
      chain: "aldi",
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
