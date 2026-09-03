import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { LIDL_WEEKLY_AD_HUB_URL } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { fetchWeeklyAdPageContent } from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "lidl-weekly-ad-sample.html";
const LIDL_WEEKLY_AD_URL = LIDL_WEEKLY_AD_HUB_URL;
const LIDL_FLIPP_MERCHANT = "Lidl";

export function createLidlWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("lidl");

  return {
    chain: "lidl",
    label: config?.label ?? "Lidl weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [LIDL_WEEKLY_AD_URL],
    ingestWeeklyAd: ingestLidlWeeklyAd,
  };
}

async function ingestLidlWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("lidl");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Lidl weekly ad ingestion";
  const termsNote =
    config?.termsNote ?? "Lidl weekly-ad prices are directional until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "lidl",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: LIDL_WEEKLY_AD_URL,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "lidl",
      zipCode: input.zipCode,
      merchantName: LIDL_FLIPP_MERCHANT,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    let rawOffers = flippResult.rawOffers;
    let retrievalLabel = flippResult.retrievalLabel;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;
    let captureHtml = "";

    if (rawOffers.length === 0) {
      const pageFetch = await fetchWeeklyAdPageContent({
        url: LIDL_WEEKLY_AD_URL,
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
        chain: "lidl",
        zipCode: input.zipCode,
        sourceUrl: LIDL_WEEKLY_AD_URL,
        html: captureHtml,
        errorMessage:
          "Lidl Flipp lookup and direct page scrape returned no parseable weekly-ad offers.",
      });

      return {
        chain: "lidl",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} could not load Lidl weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed or direct page scrape. Verify deals in store.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "lidl",
      storeId: input.storeId,
      sourceUrl: LIDL_WEEKLY_AD_URL,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "lidl",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Lidl weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "lidl",
      zipCode: input.zipCode,
      sourceUrl: LIDL_WEEKLY_AD_URL,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    return {
      chain: "lidl",
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
