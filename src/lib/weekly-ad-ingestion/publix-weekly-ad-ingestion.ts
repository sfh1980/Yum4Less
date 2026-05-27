import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { fetchPublixWeeklyAdPage } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-fetcher";
import { buildPublixWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-url";
import { resolvePublixStoreForZip } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-store";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "publix-weekly-ad-sample.html";

export function createPublixWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("publix");

  return {
    chain: "publix",
    label: config?.label ?? "Publix weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [buildPublixWeeklyAdUrl({ zipCode: "23111" })],
    ingestWeeklyAd: ingestPublixWeeklyAd,
  };
}

async function ingestPublixWeeklyAd(
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig("publix");
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? "Publix weekly ad ingestion";
  const termsNote =
    config?.termsNote ??
    "Publix weekly-ad prices are directional until verified in store.";

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildWeeklyAdFixtureResult({
      chain: "publix",
      fixtureFileName: FIXTURE_FILE_NAME,
      sourceUrl: buildPublixWeeklyAdUrl({ zipCode: input.zipCode }),
      label,
      fetchedAt,
      termsNote,
      ingestionInput: input,
    });
  }

  const sourceUrl = buildPublixWeeklyAdUrl({ zipCode: input.zipCode });

  try {
    const storeContext = await resolvePublixStoreForZip(input.zipCode);
    const pageFetch = await fetchPublixWeeklyAdPage({
      url: sourceUrl,
      storeCookie: storeContext.storeCookie,
    });
    const rawOffers = parsePublixWeeklyAd({
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
    });

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "publix",
        zipCode: input.zipCode,
        sourceUrl,
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
        errorMessage: storeContext.storeCookie
          ? `No Publix weekly-ad offers parsed for store ${storeContext.storeName ?? storeContext.storeKey ?? "unknown"}.`
          : `No Publix store cookie resolved for ZIP ${input.zipCode}.`,
      });

      return {
        chain: "publix",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: pageFetch.method === "browser",
        offers: [],
        message: storeContext.storeCookie
          ? `${label} loaded ${storeContext.storeName ?? "a nearby Publix store"} via ${pageFetch.method} (${pageFetch.attempts} attempt(s), ${pageFetch.networkJsonBodies.length} network payload(s)), but Yum4Less could not extract offer rows yet. Set YUM4LESS_WEEKLY_AD_CAPTURE=1 to save HTML/network artifacts for parser work.`
          : `${label} could not resolve a nearby Publix store for ZIP ${input.zipCode}. Store selection is required before weekly-ad offers can load.`,
        fetchedAt,
        termsNote,
      };
    }

    const offers = matchWeeklyAdOffers({
      chain: "publix",
      storeId: input.storeId,
      sourceUrl,
      observedAt: fetchedAt,
      rawOffers,
      trackedIngredientIds: input.trackedIngredientIds,
    });
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;

    return {
      chain: "publix",
      label,
      status: "live",
      provenance: "weekly-ad-scrape",
      retrievalMode: "live",
      configured: true,
      fallbackUsed: pageFetch.method === "browser",
      offers,
      message: `Parsed Publix weekly-ad run for ${storeContext.storeName ?? input.storeName} via ${pageFetch.method} extracted ${rawOffers.length} offer(s); ${matchedCount} matched tracked dinner ingredients.`,
      fetchedAt,
      termsNote,
    };
  } catch (error) {
    captureWeeklyAdArtifacts({
      chain: "publix",
      zipCode: input.zipCode,
      sourceUrl,
      html: "",
      errorMessage: error instanceof Error ? error.message : "unknown fetch error",
    });

    return {
      chain: "publix",
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
