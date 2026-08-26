import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { fetchKrogerOffersFromOfficialApi } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { fetchKrogerWeeklyAdPage } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher";
import { resolveKrogerStoreForWeeklyAd } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-store";
import { buildKrogerWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-url";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import { matchWeeklyAdOffers, weeklyAdMatchFieldsFromIngest } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseKrogerWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-kroger-weekly-ad";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "kroger-weekly-ad-sample.html";
const KROGER_FLIPP_MERCHANT = "Kroger";

export function createKrogerWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("kroger");

  return {
    chain: "kroger",
    label: config?.label ?? "Kroger weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [],
    ingestWeeklyAd: ingestKrogerWeeklyAd,
  };
}

async function ingestKrogerWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("kroger");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Kroger weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Kroger weekly-ad prices are directional until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "kroger",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: buildKrogerWeeklyAdUrl({ zipCode: input.zipCode }),
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  const storeContext = await resolveKrogerStoreForWeeklyAd({
    zipCode: input.zipCode,
    storeId: input.storeId,
  });
  const sourceUrl = buildKrogerWeeklyAdUrl({
    zipCode: input.zipCode,
    locationId: storeContext.locationId,
  });

  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "kroger",
      zipCode: input.zipCode,
      merchantName: KROGER_FLIPP_MERCHANT,
      trackedIngredientIds: input.trackedIngredientIds,
      catalogIngredients: input.catalogIngredients,
      extraSearchTermsByIngredientId: input.extraSearchTermsByIngredientId,
    });
    let rawOffers = flippResult.rawOffers;
    let retrievalLabel = flippResult.retrievalLabel;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;
    let captureHtml = "";
    let pageFetchMethod: string | undefined;

    if (rawOffers.length === 0) {
      const pageFetch = await fetchKrogerWeeklyAdPage({ url: sourceUrl });
      captureHtml = pageFetch.html;
      pageFetchMethod = pageFetch.method;
      rawOffers = parseKrogerWeeklyAd({
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
      });
      retrievalLabel = `${pageFetch.method} scrape`;
      provenance = "weekly-ad-scrape";
      fallbackUsed = pageFetch.method === "browser" || pageFetch.browserFailed === true;
    }

    if (rawOffers.length === 0) {
      const apiOffers = await fetchKrogerOffersFromOfficialApi({
        zipCode: input.zipCode,
        trackedIngredientIds: input.trackedIngredientIds,
      });
      if (apiOffers.length > 0) {
        rawOffers = apiOffers;
        retrievalLabel =
          "last-resort partial product API fill (tracked ingredients only; not weekly ad discovery)";
        provenance = "weekly-ad-scrape";
        fallbackUsed = true;
      }
    }

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "kroger",
        zipCode: input.zipCode,
        sourceUrl,
        html: captureHtml,
        errorMessage:
          "No Kroger weekly-ad offers parsed from Flipp feed, direct scrape, or API fallback.",
      });

      const scrapeNote = pageFetchMethod
        ? ` Direct scrape via ${pageFetchMethod} also returned no parseable offers.`
        : "";

      return {
        chain: "kroger",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} could not load Kroger weekly-ad offers for ZIP ${input.zipCode} via Flipp syndicated feed, direct page scrape, or last-resort product API fill.${scrapeNote}${storeContext.locationId ? ` Store context: ${storeContext.locationId}.` : ""} Set YUM4LESS_WEEKLY_AD_CAPTURE=1 to save HTML/network artifacts for parser work.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "kroger",
      storeId: input.storeId,
      sourceUrl,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "kroger",
      label,
      status: "live",
      provenance,
      retrievalMode: "live",
      configured: true,
      fallbackUsed,
      offers,
      message: `Parsed Kroger weekly-ad run via ${retrievalLabel} extracted ${rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "kroger",
      zipCode: input.zipCode,
      sourceUrl,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    return {
      chain: "kroger",
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
