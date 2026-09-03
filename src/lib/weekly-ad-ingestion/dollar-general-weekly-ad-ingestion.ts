import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { fetchWeeklyAdPageContent } from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "dollar-general-weekly-ad-sample.html";
export const DOLLAR_GENERAL_WEEKLY_AD_URL =
  "https://www.dollargeneral.com/deals/weekly-ads";
export const DOLLAR_GENERAL_FLIPP_MERCHANT = "Dollar General";

export function createDollarGeneralWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("dollar-general");

  return {
    chain: "dollar-general",
    label: config?.label ?? "Dollar General weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [DOLLAR_GENERAL_WEEKLY_AD_URL],
    ingestWeeklyAd: ingestDollarGeneralWeeklyAd,
  };
}

async function ingestDollarGeneralWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("dollar-general");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Dollar General weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Dollar General weekly-ad prices are directional area circulars until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "dollar-general",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: DOLLAR_GENERAL_WEEKLY_AD_URL,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "dollar-general",
      zipCode: input.zipCode,
      merchantName: DOLLAR_GENERAL_FLIPP_MERCHANT,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    let rawOffers = flippResult.rawOffers;
    let retrievalLabel = flippResult.retrievalLabel;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;
    let directScrapeBlocked = false;
    let captureHtml = "";

    if (rawOffers.length === 0) {
      try {
        const pageFetch = await fetchWeeklyAdPageContent({
          url: DOLLAR_GENERAL_WEEKLY_AD_URL,
          fetchStrategy: config?.fetchStrategy ?? "browser-fallback",
          browserWaitSelector: config?.browserWaitSelector,
        });
        captureHtml = pageFetch.html;
        rawOffers = parseWeeklyAdHtml(pageFetch.html);
        retrievalLabel = `${pageFetch.method} scrape`;
        provenance = "weekly-ad-scrape";
        fallbackUsed = pageFetch.method === "browser";
      } catch (scrapeError) {
        directScrapeBlocked = true;
        if (rawOffers.length === 0) {
          throw scrapeError;
        }
      }
    }

    if (rawOffers.length === 0) {
      const blockedNote = directScrapeBlocked
        ? " Dollar General direct pages often wrap a Flipp embed that HTTP cannot parse."
        : "";
      captureWeeklyAdArtifacts({
        chain: "dollar-general",
        zipCode: input.zipCode,
        sourceUrl: DOLLAR_GENERAL_WEEKLY_AD_URL,
        html: captureHtml,
        errorMessage: `Dollar General Flipp lookup and direct page scrape returned no parseable weekly-ad offers.${blockedNote}`,
      });

      return {
        chain: "dollar-general",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} could not load Dollar General weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed or direct page scrape.${blockedNote}`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "dollar-general",
      storeId: input.storeId,
      sourceUrl: DOLLAR_GENERAL_WEEKLY_AD_URL,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "dollar-general",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Dollar General weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients. Prices are an area circular, not this building's shelf tags.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "dollar-general",
      zipCode: input.zipCode,
      sourceUrl: DOLLAR_GENERAL_WEEKLY_AD_URL,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    const blocked =
      error instanceof Error &&
      (error.message.includes("HTTP 403") || error.message.includes("HTTP 401"));
    return {
      chain: "dollar-general",
      label,
      status: "error",
      provenance: "weekly-ad-scrape",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: blocked,
      offers: [],
      message: blocked
        ? `${label} direct page fetch blocked by retailer WAF (HTTP 403). Flipp syndicated feed also returned no offers for ZIP ${input.zipCode}.`
        : error instanceof Error
          ? `${label} fetch failed: ${error.message}`
          : `${label} fetch failed with an unknown error.`,
      fetchedAt,
      termsNote,
    };
  }
}
