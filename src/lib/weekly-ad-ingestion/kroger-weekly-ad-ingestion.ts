import { fetchFlippWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { fetchKrogerOffersFromOfficialApi } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { fetchKrogerWeeklyAdPage } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher";
import { resolveKrogerStoreForWeeklyAd } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-store";
import { buildKrogerWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-url";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseKrogerWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-kroger-weekly-ad";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "kroger-weekly-ad-sample.html";

export function createKrogerWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("kroger");

  return {
    chain: "kroger",
    label: config?.label ?? "Kroger weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [buildKrogerWeeklyAdUrl({ zipCode: "23111" })],
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
    const pageFetch = await fetchKrogerWeeklyAdPage({ url: sourceUrl });
    let rawOffers = parseKrogerWeeklyAd({
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
    });
    let retrievalLabel = `${pageFetch.method} scrape`;
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-scrape";
    let fallbackUsed = pageFetch.method === "browser" || pageFetch.browserFailed === true;

    if (rawOffers.length === 0) {
      const flippOffers = await fetchFlippWeeklyAdOffers({
        zipCode: input.zipCode,
        merchantName: "Kroger",
      });
      if (flippOffers.length > 0) {
        rawOffers = flippOffers;
        retrievalLabel = "Flipp syndicated weekly-ad feed";
        provenance = "weekly-ad-partner-feed";
        fallbackUsed = true;
      }
    }

    if (rawOffers.length === 0) {
      const apiOffers = await fetchKrogerOffersFromOfficialApi({
        zipCode: input.zipCode,
        trackedIngredientIds: input.trackedIngredientIds,
      });
      if (apiOffers.length > 0) {
        rawOffers = apiOffers;
        retrievalLabel = "official Kroger product API fallback";
        provenance = "weekly-ad-partner-feed";
        fallbackUsed = true;
      }
    }

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "kroger",
        zipCode: input.zipCode,
        sourceUrl,
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
        errorMessage: "No Kroger weekly-ad offers parsed from scrape, Flipp feed, or API fallback.",
      });

      return {
        chain: "kroger",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed,
        offers: [],
        message: `${label} loaded via ${pageFetch.method} (${pageFetch.attempts} attempt(s), ${pageFetch.networkJsonBodies.length} network payload(s))${storeContext.locationId ? ` for store ${storeContext.locationId}` : ""}, but Yum4Less could not extract offer rows yet. Set YUM4LESS_WEEKLY_AD_CAPTURE=1 to save HTML/network artifacts for parser work.`,
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
      trackedIngredientIds: input.trackedIngredientIds,
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
