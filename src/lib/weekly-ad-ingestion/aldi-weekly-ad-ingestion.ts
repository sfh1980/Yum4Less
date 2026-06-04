import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
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
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "aldi",
      zipCode: input.zipCode,
      merchantName: ALDI_FLIPP_MERCHANT,
      trackedIngredientIds: input.trackedIngredientIds,
    });
    let rawOffers = flippResult.rawOffers;
    let retrievalLabel = flippResult.retrievalLabel;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;
    let captureHtml = "";

    if (rawOffers.length === 0) {
      const pageFetch = await fetchWeeklyAdPageContent({
        url: ALDI_WEEKLY_SPECIALS_URL,
        fetchStrategy: config?.fetchStrategy ?? "browser-fallback",
        browserWaitSelector: config?.browserWaitSelector,
      });
      captureHtml = pageFetch.html;
      rawOffers = parseWeeklyAdHtml(pageFetch.html);
      retrievalLabel = `${pageFetch.method} scrape`;
      provenance = "weekly-ad-scrape";
      fallbackUsed = pageFetch.method === "browser";
    }

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "aldi",
        zipCode: input.zipCode,
        sourceUrl: ALDI_WEEKLY_SPECIALS_URL,
        html: captureHtml,
        errorMessage:
          "Aldi Flipp lookup and direct page scrape returned no parseable weekly-ad offers.",
      });

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
    captureWeeklyAdArtifacts({
      chain: "aldi",
      zipCode: input.zipCode,
      sourceUrl: ALDI_WEEKLY_SPECIALS_URL,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

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
