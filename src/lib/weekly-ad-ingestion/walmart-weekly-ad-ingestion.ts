import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseWalmartWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-walmart-weekly-ad";
import { fetchWalmartWeeklyAdPage } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-fetcher";
import { buildWalmartWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-url";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "walmart-weekly-ad-sample.html";
const WALMART_FLIPP_MERCHANT = "Walmart";

export function createWalmartWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("walmart");

  return {
    chain: "walmart",
    label: config?.label ?? "Walmart weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [buildWalmartWeeklyAdUrl()],
    ingestWeeklyAd: ingestWalmartWeeklyAd,
  };
}

async function ingestWalmartWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("walmart");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Walmart weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Walmart weekly-ad prices are directional until verified in store.";
  const sourceUrl = buildWalmartWeeklyAdUrl({
    storeId: process.env.WALMART_STORE_ID?.trim(),
  });

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "walmart",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl,
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "walmart",
      zipCode: input.zipCode,
      merchantName: WALMART_FLIPP_MERCHANT,
      trackedIngredientIds: input.trackedIngredientIds,
      catalogIngredients: input.catalogIngredients,
      extraSearchTermsByIngredientId: input.extraSearchTermsByIngredientId,
    });
    let rawOffers = flippResult.rawOffers;
    let retrievalLabel = flippResult.retrievalLabel;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;
    let directScrapeBlocked = false;
    let captureHtml = "";
    let captureNetworkJsonBodies: string[] | undefined;

    // Same shape as Food Lion: Flipp first; retailer HTML only when the feed is empty.
    // Walmart keeps its own page fetcher/parser — do not share Food Lion's HTML path.
    if (rawOffers.length === 0) {
      try {
        const pageFetch = await fetchWalmartWeeklyAdPage({ url: sourceUrl });
        captureHtml = pageFetch.html;
        captureNetworkJsonBodies = pageFetch.networkJsonBodies;
        rawOffers = parseWalmartWeeklyAd({
          html: pageFetch.html,
          networkJsonBodies: pageFetch.networkJsonBodies,
        });
        retrievalLabel = `${pageFetch.method} scrape`;
        provenance =
          pageFetch.method === "browser" ? "weekly-ad-scrape" : "weekly-ad-partner-feed";
        fallbackUsed = pageFetch.method === "browser";

        if (rawOffers.length === 0 && pageFetch.html) {
          captureWeeklyAdArtifacts({
            chain: "walmart",
            zipCode: input.zipCode,
            sourceUrl,
            html: pageFetch.html,
            networkJsonBodies: pageFetch.networkJsonBodies,
            errorMessage:
              "Walmart browser/HTTP scrape returned HTML but no parseable weekly-ad offers.",
          });
        }
      } catch (scrapeError) {
        directScrapeBlocked = true;
        if (rawOffers.length === 0) {
          throw scrapeError;
        }
      }
    }

    if (rawOffers.length === 0) {
      const blockedNote = directScrapeBlocked
        ? " Walmart weekly-ad pages often block automated access (captcha/WAF)."
        : "";
      captureWeeklyAdArtifacts({
        chain: "walmart",
        zipCode: input.zipCode,
        sourceUrl,
        html: captureHtml,
        networkJsonBodies: captureNetworkJsonBodies,
        errorMessage: `Walmart Flipp lookup and direct page scrape returned no parseable weekly-ad offers.${blockedNote}`,
      });

      return {
        chain: "walmart",
        label,
        status: "error",
        provenance: "weekly-ad-partner-feed",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: true,
        offers: [],
        message: `${label} could not load Walmart weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed or direct page scrape.${blockedNote}`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "walmart",
      storeId: input.storeId,
      sourceUrl,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "walmart",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Walmart weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "walmart",
      zipCode: input.zipCode,
      sourceUrl,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    const blockedHint =
      error instanceof Error && /\b(403|captcha|WAF|robot)\b/i.test(error.message)
        ? " Flipp syndicated feed also returned no offers."
        : "";

    return {
      chain: "walmart",
      label,
      status: "error",
      provenance: "weekly-ad-partner-feed",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: true,
      offers: [],
      message:
        error instanceof Error
          ? `${label} fetch failed: ${error.message}${blockedHint}`
          : `${label} fetch failed with an unknown error.`,
      fetchedAt,
      termsNote,
    };
  }
}
