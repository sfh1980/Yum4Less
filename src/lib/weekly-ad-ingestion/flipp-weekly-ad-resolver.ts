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

  if (countMatchedOffers(input.chain, rawOffers, input.trackedIngredientIds) === 0) {
    const supplementalSearchTerms = buildSupplementalFlippSearchTerms(
      input.trackedIngredientIds,
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

function buildSupplementalFlippSearchTerms(trackedIngredientIds: string[]) {
  const terms = new Set<string>();
  for (const ingredient of INTERNAL_CATALOG_INGREDIENTS) {
    if (!trackedIngredientIds.includes(ingredient.id)) {
      continue;
    }

    for (const searchTerm of getWeeklyAdIngredientSearchTerms(ingredient)) {
      if (searchTerm.length >= 4) {
        terms.add(searchTerm);
      }
    }
  }

  return [...terms];
}

function countMatchedOffers(
  chain: WeeklyAdChain,
  rawOffers: WeeklyAdRawOffer[],
  trackedIngredientIds: string[],
) {
  return matchWeeklyAdOffers({
    chain,
    storeId: "matching-probe",
    sourceUrl: "flipp://matching-probe",
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
  }).filter((offer) => offer.ingredientId).length;
}
