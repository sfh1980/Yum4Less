import type { CatalogIngredient } from "@/lib/ingredient-category";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  mergeWeeklyAdRawOffers,
  readFlippMerchantFlyers,
  readFlippMerchantSearch,
  readFlippSupplementalSearches,
  type FlippWeeklyAdMerchantName,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Cap per-chain Flipp ingredient lookups to keep scheduled ingest bounded. */
export const FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS = 30;

export async function resolveFlippWeeklyAdOffersForChain(input: {
  chain: string;
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  trackedIngredientIds: string[];
  catalogIngredients?: CatalogIngredient[];
  extraSearchTermsByIngredientId?: Record<string, string[]>;
}): Promise<{
  rawOffers: WeeklyAdRawOffer[];
  retrievalLabel: string;
  /**
   * True only when the merchant search and the flyer list both returned the
   * expected JSON and neither one had a current flyer for this merchant, and
   * every supplemental search that ran also returned expected JSON.
   * A thrown request never reaches this flag. An unexpected body or a
   * swallowed item lookup leaves it false.
   */
  noCurrentFlyer: boolean;
}> {
  const merchant = await readFlippMerchantSearch({
    zipCode: input.zipCode,
    merchantName: input.merchantName,
  });
  const flyers = await readFlippMerchantFlyers({
    zipCode: input.zipCode,
    merchantName: input.merchantName,
  });

  let rawOffers = mergeWeeklyAdRawOffers(merchant.offers, flyers.offers);
  let retrievalLabel =
    flyers.offers.length > 0
      ? "Flipp syndicated weekly-ad feed + flyer lookup"
      : "Flipp syndicated weekly-ad feed";
  let supplementalFailed = false;

  const unmatchedIngredientIds = listUnmatchedTrackedIngredientIds(
    input.chain,
    rawOffers,
    input.trackedIngredientIds,
    input.catalogIngredients,
    input.extraSearchTermsByIngredientId,
  );

  if (unmatchedIngredientIds.length > 0) {
    const supplementalSearchTerms = buildSupplementalFlippSearchTermsForIngredients(
      unmatchedIngredientIds,
      input.catalogIngredients,
    );
    if (supplementalSearchTerms.length > 0) {
      const supplemental = await readFlippSupplementalSearches({
        zipCode: input.zipCode,
        merchantName: input.merchantName,
        searchTerms: supplementalSearchTerms,
      });
      rawOffers = mergeWeeklyAdRawOffers(rawOffers, supplemental.offers);
      if (supplemental.requestFailed) {
        supplementalFailed = true;
      }
      if (supplemental.offers.length > 0) {
        retrievalLabel = `${retrievalLabel} + ingredient searches`;
      }
    }
  }

  const noCurrentFlyer =
    rawOffers.length === 0 &&
    merchant.provedEmpty &&
    flyers.provedEmpty &&
    !merchant.requestFailed &&
    !flyers.requestFailed &&
    !supplementalFailed;

  return { rawOffers, retrievalLabel, noCurrentFlyer };
}

export function buildSupplementalFlippSearchTermsForIngredients(
  unmatchedIngredientIds: string[],
  catalogIngredients: CatalogIngredient[] = INTERNAL_CATALOG_INGREDIENTS,
) {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const ingredientId of unmatchedIngredientIds) {
    if (terms.length >= FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS) {
      break;
    }

    const ingredient = catalogIngredients.find(
      (entry) => entry.id === ingredientId,
    );
    if (!ingredient) {
      continue;
    }

    const primaryTerm = getWeeklyAdIngredientSearchTerms(ingredient).find(
      (term) => term.length >= 4,
    );
    if (!primaryTerm) {
      continue;
    }

    const normalized = primaryTerm.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(primaryTerm);
  }

  return terms;
}

function listUnmatchedTrackedIngredientIds(
  chain: string,
  rawOffers: WeeklyAdRawOffer[],
  trackedIngredientIds: string[],
  catalogIngredients?: CatalogIngredient[],
  extraSearchTermsByIngredientId?: Record<string, string[]>,
) {
  const matchedOffers = matchWeeklyAdOffers({
    chain,
    storeId: "matching-probe",
    sourceUrl: "flipp://matching-probe",
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
    catalogIngredients,
    extraSearchTermsByIngredientId,
  });

  const matchedIds = new Set(
    matchedOffers
      .map((offer) => offer.ingredientId)
      .filter((ingredientId): ingredientId is string => Boolean(ingredientId)),
  );

  return trackedIngredientIds.filter((ingredientId) => !matchedIds.has(ingredientId));
}
