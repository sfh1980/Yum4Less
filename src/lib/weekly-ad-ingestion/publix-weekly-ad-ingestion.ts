import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { fetchPublixWeeklyAdPage } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-fetcher";
import { publixPageIsThin } from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";
import { loadPublixFlippFlyerOffers } from "@/lib/weekly-ad-ingestion/publix-flipp-flyer-fallback";
import { readWeeklyAdFlyerRawCardCount } from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";
import { buildPublixWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-url";
import { resolvePublixStoreForZip } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-store";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
  WeeklyAdOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "publix-weekly-ad-sample.html";
const PUBLIX_FLIPP_MERCHANT = "Publix";

export function createPublixWeeklyAdIngestionClient(): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig("publix");

  return {
    chain: "publix",
    label: config?.label ?? "Publix weekly ad ingestion",
    configured: true,
    researchTargets: config?.researchTargets ?? [],
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
    const rememberedCardCount = await readWeeklyAdFlyerRawCardCount("publix");
    const pageFetch = await fetchPublixWeeklyAdPage({
      url: sourceUrl,
      storeCookie: storeContext.storeCookie,
      rememberedOfferCount: rememberedCardCount,
      zipCode: input.zipCode,
    });
    const rawOffers = parsePublixWeeklyAd({
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
    });
    const seenCardCount = pageFetch.seenCardCount ?? pageFetch.savingsCardCount;
    const scrapeIsThin =
      typeof seenCardCount === "number" &&
      publixPageIsThin({
        seenCount: seenCardCount,
        expectedCount: pageFetch.expectedCardCount,
        rememberedOfferCount: rememberedCardCount,
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
    }

    if (rawOffers.length === 0 && !scrapeIsThin) {
      return {
        chain: "publix",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: pageFetch.method === "browser",
        offers: [],
        rawCardCount: pageFetch.savingsCardCount,
        thinPage: false,
        message: storeContext.storeCookie
          ? `${label} loaded ${storeContext.storeName ?? "a nearby Publix store"} via ${pageFetch.method} (${pageFetch.attempts} attempt(s), ${pageFetch.networkJsonBodies.length} network payload(s)), but Yum4Less could not extract offer rows yet. Set YUM4LESS_WEEKLY_AD_CAPTURE=1 to save HTML/network artifacts for parser work.`
          : `${label} could not resolve a nearby Publix store for ZIP ${input.zipCode}. Store selection is required before weekly-ad offers can load.`,
        fetchedAt,
        termsNote,
      };
    }

    const scrapeOffers = matchWeeklyAdOffers({
      chain: "publix",
      storeId: input.storeId,
      sourceUrl,
      observedAt: fetchedAt,
      rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input),
    });
    const supplementalResult = await resolvePublixFlippSupplementalOffers({
      input,
      fetchedAt,
      sourceUrl,
      scrapeOffers,
      scrapeIsThin,
    });
    const offers = [...scrapeOffers, ...supplementalResult.offers];
    const matchedCount = offers.filter((offer) => offer.ingredientId).length;
    const supplementalNote =
      supplementalResult.offers.length > 0
        ? scrapeIsThin
          ? ` Added ${supplementalResult.offers.length} Flipp flyer ingredient match(es) not already covered by the scrape.`
          : ` Added ${supplementalResult.offers.length} Flipp supplemental ingredient match(es) not already covered by scrape.`
        : supplementalResult.message
          ? ` ${supplementalResult.message}`
          : "";

    if (offers.length === 0) {
      return {
        chain: "publix",
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: true,
        offers: [],
        rawCardCount: pageFetch.savingsCardCount,
        thinPage: scrapeIsThin,
        message: `${label} parsed no scrape offers.${supplementalNote}`,
        fetchedAt,
        termsNote,
      };
    }

    return {
      chain: "publix",
      label,
      status: "live",
      provenance: "weekly-ad-scrape",
      retrievalMode: "live",
      configured: true,
      fallbackUsed: pageFetch.method === "browser",
      offers,
      rawCardCount: pageFetch.savingsCardCount,
      thinPage: scrapeIsThin,
      message: `Parsed Publix weekly-ad run for ${storeContext.storeName ?? input.storeName} via ${pageFetch.method} extracted ${rawOffers.length} scrape offer(s); ${matchedCount} matched tracked dinner ingredients.${supplementalNote}`,
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

async function resolvePublixFlippSupplementalOffers(input: {
  input: WeeklyAdIngestionInput;
  fetchedAt: string;
  sourceUrl: string;
  scrapeOffers: WeeklyAdOffer[];
  scrapeIsThin: boolean;
}): Promise<{ offers: WeeklyAdOffer[]; message?: string }> {
  if (input.scrapeIsThin) {
    return resolveThinPublixFlippFlyerOffers(input);
  }
  try {
    const flippResult = await resolveFlippWeeklyAdOffersForChain({
      chain: "publix",
      zipCode: input.input.zipCode,
      merchantName: PUBLIX_FLIPP_MERCHANT,
      ...weeklyAdMatchFieldsFromIngest(input.input),
    });

    if (flippResult.rawOffers.length === 0) {
      return { offers: [] };
    }

    const flippOffers = matchWeeklyAdOffers({
      chain: "publix",
      storeId: input.input.storeId,
      sourceUrl: `${input.sourceUrl}#flipp-supplemental`,
      observedAt: input.fetchedAt,
      rawOffers: flippResult.rawOffers,
      ...weeklyAdMatchFieldsFromIngest(input.input),
    });

    return {
      offers: selectPublixSupplementalOffers(input.scrapeOffers, flippOffers),
    };
  } catch (error) {
    return {
      offers: [],
      message:
        error instanceof Error
          ? `Flipp supplemental lookup was unavailable (${error.message}); scrape results still loaded.`
          : "Flipp supplemental lookup was unavailable; scrape results still loaded.",
    };
  }
}

async function resolveThinPublixFlippFlyerOffers(input: {
  input: WeeklyAdIngestionInput;
  fetchedAt: string;
  sourceUrl: string;
  scrapeOffers: WeeklyAdOffer[];
}): Promise<{ offers: WeeklyAdOffer[]; message?: string }> {
  try {
    const loaded = await loadPublixFlippFlyerOffers({
      zipCode: input.input.zipCode,
    });
    if (loaded.offers.length === 0) {
      return {
        offers: [],
        message:
          loaded.message ??
          "Publix Flipp flyer fallback returned no priced items.",
      };
    }
    const flippOffers = matchWeeklyAdOffers({
      chain: "publix",
      storeId: input.input.storeId,
      sourceUrl: `${input.sourceUrl}#flipp-flyer`,
      observedAt: input.fetchedAt,
      rawOffers: loaded.offers,
      ...weeklyAdMatchFieldsFromIngest(input.input),
    });
    return {
      offers: selectPublixSupplementalOffers(input.scrapeOffers, flippOffers),
    };
  } catch (error) {
    return {
      offers: [],
      message:
        error instanceof Error
          ? `Publix Flipp flyer fallback was unavailable (${error.message}); scrape results still loaded.`
          : "Publix Flipp flyer fallback was unavailable; scrape results still loaded.",
    };
  }
}

function selectPublixSupplementalOffers(
  scrapeOffers: WeeklyAdOffer[],
  flippOffers: WeeklyAdOffer[],
): WeeklyAdOffer[] {
  const scrapeIngredientIds = new Set(
    scrapeOffers
      .map((offer) => offer.ingredientId)
      .filter((ingredientId): ingredientId is string => Boolean(ingredientId)),
  );
  const bestSupplementalByIngredient = new Map<string, WeeklyAdOffer>();

  for (const offer of flippOffers) {
    if (!offer.ingredientId || scrapeIngredientIds.has(offer.ingredientId)) {
      continue;
    }

    const current = bestSupplementalByIngredient.get(offer.ingredientId);
    if (!current) {
      bestSupplementalByIngredient.set(offer.ingredientId, offer);
      continue;
    }

    const currentConfidence = current.matchConfidence ?? current.confidenceScore;
    const nextConfidence = offer.matchConfidence ?? offer.confidenceScore;
    if (
      nextConfidence > currentConfidence ||
      (nextConfidence === currentConfidence && offer.price < current.price)
    ) {
      bestSupplementalByIngredient.set(offer.ingredientId, offer);
    }
  }

  return [...bestSupplementalByIngredient.values()];
}
