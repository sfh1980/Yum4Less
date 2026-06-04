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

const FIXTURE_FILE_NAME = "food-lion-weekly-ad-sample.html";
const FOOD_LION_WEEKLY_AD_URL = "https://www.foodlion.com/weekly-ad/";
const FOOD_LION_FLIPP_MERCHANT = "Food Lion";

export function createFoodLionWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("food-lion");

  return {
    chain: "food-lion",
    label: config?.label ?? "Food Lion weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [FOOD_LION_WEEKLY_AD_URL],
    ingestWeeklyAd: ingestFoodLionWeeklyAd,
  };
}

async function ingestFoodLionWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("food-lion");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Food Lion weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Food Lion weekly-ad prices are directional until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "food-lion",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: FOOD_LION_WEEKLY_AD_URL,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "food-lion",
      zipCode: input.zipCode,
      merchantName: FOOD_LION_FLIPP_MERCHANT,
      trackedIngredientIds: input.trackedIngredientIds,
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
          url: FOOD_LION_WEEKLY_AD_URL,
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
        ? " Food Lion direct pages often block automated HTTP access (403/WAF)."
        : "";
      captureWeeklyAdArtifacts({
        chain: "food-lion",
        zipCode: input.zipCode,
        sourceUrl: FOOD_LION_WEEKLY_AD_URL,
        html: captureHtml,
        errorMessage: `Food Lion Flipp lookup and direct page scrape returned no parseable weekly-ad offers.${blockedNote}`,
      });

      return {
        chain: "food-lion",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} could not load Food Lion weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed or direct page scrape.${blockedNote}`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "food-lion",
      storeId: input.storeId,
      sourceUrl: FOOD_LION_WEEKLY_AD_URL,
      observedAt: fetchedAt,
      rawOffers,
      trackedIngredientIds: input.trackedIngredientIds,
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "food-lion",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Food Lion weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "food-lion",
      zipCode: input.zipCode,
      sourceUrl: FOOD_LION_WEEKLY_AD_URL,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    const blocked =
      error instanceof Error &&
      (error.message.includes("HTTP 403") || error.message.includes("HTTP 401"));
    return {
      chain: "food-lion",
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
