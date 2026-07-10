import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  fetchFlippSearchOffersForMerchant,
  fetchFlippWeeklyAdOffersForMerchantFlyers,
  fetchFlippWeeklyAdOffersForSearchTerms,
  mergeWeeklyAdRawOffers,
  type FlippWeeklyAdMerchantName,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import type {
  WeeklyAdChain,
  WeeklyAdRawOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Cap per-chain Flipp ingredient lookups to keep scheduled ingest bounded. */
export const FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS = 30;

export async function resolveFlippWeeklyAdOffersForChain(input: {
  chain: WeeklyAdChain;
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  trackedIngredientIds: string[];
}): Promise<{ rawOffers: WeeklyAdRawOffer[]; retrievalLabel: string }> {
  const merchantOffers = await fetchFlippSearchOffersForMerchant({
    zipCode: input.zipCode,
    merchantName: input.merchantName,
  });
  const flyerOffers = await fetchFlippWeeklyAdOffersForMerchantFlyers({
    zipCode: input.zipCode,
    merchantName: input.merchantName,
  });

  let rawOffers = mergeWeeklyAdRawOffers(merchantOffers, flyerOffers);
  let retrievalLabel =
    flyerOffers.length > 0
      ? "Flipp syndicated weekly-ad feed + flyer lookup"
      : "Flipp syndicated weekly-ad feed";

  const unmatchedIngredientIds = listUnmatchedTrackedIngredientIds(
    input.chain,
    rawOffers,
    input.trackedIngredientIds,
  );

  if (unmatchedIngredientIds.length > 0) {
    const supplementalSearchTerms = buildSupplementalFlippSearchTermsForIngredients(
      unmatchedIngredientIds,
    );
    if (supplementalSearchTerms.length > 0) {
      const supplementalOffers = await fetchFlippWeeklyAdOffersForSearchTerms({
        zipCode: input.zipCode,
        merchantName: input.merchantName,
        searchTerms: supplementalSearchTerms,
      });
      rawOffers = mergeWeeklyAdRawOffers(rawOffers, supplementalOffers);
      if (supplementalOffers.length > 0) {
        retrievalLabel = `${retrievalLabel} + ingredient searches`;
      }
    }
  }

  return { rawOffers, retrievalLabel };
}

export function buildSupplementalFlippSearchTermsForIngredients(
  unmatchedIngredientIds: string[],
) {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const ingredientId of unmatchedIngredientIds) {
    if (terms.length >= FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS) {
      break;
    }

    const ingredient = INTERNAL_CATALOG_INGREDIENTS.find(
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
  chain: WeeklyAdChain,
  rawOffers: WeeklyAdRawOffer[],
  trackedIngredientIds: string[],
) {
  const matchedOffers = matchWeeklyAdOffers({
    chain,
    storeId: "matching-probe",
    sourceUrl: "flipp://matching-probe",
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
  });

  const matchedIds = new Set(
    matchedOffers
      .map((offer) => offer.ingredientId)
      .filter((ingredientId): ingredientId is string => Boolean(ingredientId)),
  );

  return trackedIngredientIds.filter((ingredientId) => !matchedIds.has(ingredientId));
}
