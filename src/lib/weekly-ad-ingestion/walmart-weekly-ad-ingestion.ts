import {
  fetchFlippWeeklyAdOffers,
  fetchFlippWeeklyAdOffersForMerchantFlyers,
  fetchFlippWeeklyAdOffersForSearchTerms,
  mergeWeeklyAdRawOffers,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { captureWeeklyAdArtifacts } from "@/lib/weekly-ad-ingestion/weekly-ad-capture";
import { buildWeeklyAdFixtureResult } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { parseWalmartWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-walmart-weekly-ad";
import { fetchWalmartWeeklyAdPage } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-fetcher";
import { buildWalmartWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-url";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import type {
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
  WeeklyAdRawOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const FIXTURE_FILE_NAME = "walmart-weekly-ad-sample.html";

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
    const flippOffers = await fetchFlippWeeklyAdOffers({
      zipCode: input.zipCode,
      merchantName: "Walmart",
    });
    const groceryFlyerOffers = await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: input.zipCode,
      merchantName: "Walmart",
    });

    let rawOffers = mergeWeeklyAdRawOffers(flippOffers, groceryFlyerOffers);
    let retrievalLabel = "Flipp syndicated weekly-ad feed";
    let provenance: WeeklyAdIngestionResult["provenance"] = "weekly-ad-partner-feed";
    let fallbackUsed = true;

    let matchedCount = countMatchedOffers(rawOffers, input);

    if (matchedCount === 0) {
      const supplementalSearchTerms = buildSupplementalFlippSearchTerms(input);
      if (supplementalSearchTerms.length > 0) {
        const supplementalOffers = await fetchFlippWeeklyAdOffersForSearchTerms({
          zipCode: input.zipCode,
          merchantName: "Walmart",
          searchTerms: supplementalSearchTerms,
        });
        rawOffers = mergeWeeklyAdRawOffers(rawOffers, supplementalOffers);
        matchedCount = countMatchedOffers(rawOffers, input);
        if (supplementalOffers.length > 0) {
          retrievalLabel = "Flipp syndicated feed + ingredient searches";
        }
      }
    }

    if (matchedCount === 0) {
      const pageFetch = await fetchWalmartWeeklyAdPage({ url: sourceUrl });
      const scrapedOffers = parseWalmartWeeklyAd({
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
      });

      if (scrapedOffers.length > 0) {
        rawOffers = mergeWeeklyAdRawOffers(rawOffers, scrapedOffers);
        retrievalLabel = `${pageFetch.method} scrape + Flipp syndicated feed`;
        provenance =
          pageFetch.method === "browser" ? "weekly-ad-scrape" : "weekly-ad-partner-feed";
        fallbackUsed = true;
        matchedCount = countMatchedOffers(rawOffers, input);
      } else if (pageFetch.html) {
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
    }

    if (rawOffers.length === 0) {
      captureWeeklyAdArtifacts({
        chain: "walmart",
        zipCode: input.zipCode,
        sourceUrl,
        html: "",
        errorMessage: "No Walmart weekly-ad offers returned from Flipp or browser scrape.",
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
        message: `${label} could not load Walmart weekly-ad offers for ZIP ${input.zipCode} via Flipp or browser scrape.`,
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
    matchedCount = offers.filter((offer) => offer.ingredientId).length;

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
          ? `${label} fetch failed: ${error.message}`
          : `${label} fetch failed with an unknown error.`,
      fetchedAt,
      termsNote,
    };
  }
}

function buildSupplementalFlippSearchTerms(input: WeeklyAdIngestionInput) {
  const catalog = input.catalogIngredients ?? INTERNAL_CATALOG_INGREDIENTS;
  const terms = new Set<string>();
  for (const ingredient of catalog) {
    if (!input.trackedIngredientIds.includes(ingredient.id)) {
      continue;
    }
    for (const searchTerm of getWeeklyAdIngredientSearchTerms(ingredient)) {
      if (searchTerm.length >= 4) {
        terms.add(searchTerm);
      }
    }
    for (const extra of input.extraSearchTermsByIngredientId?.[ingredient.id] ?? []) {
      if (extra.length >= 4) {
        terms.add(extra);
      }
    }
  }
  return [...terms];
}

function countMatchedOffers(
  rawOffers: WeeklyAdRawOffer[],
  input: WeeklyAdIngestionInput,
) {
  return matchWeeklyAdOffers({
    chain: "walmart",
    storeId: input.storeId,
    sourceUrl: buildWalmartWeeklyAdUrl({
      storeId: process.env.WALMART_STORE_ID?.trim(),
    }),
    observedAt: new Date().toISOString(),
    rawOffers,
    ...weeklyAdMatchFieldsFromIngest(input),
  }).filter((offer) => offer.ingredientId).length;
}
