import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import { scoreProviderProductMatch } from "@/lib/providers/provider-price-matching";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { shouldRejectWeeklyAdIngredientMatch } from "@/lib/weekly-ad-ingestion/weekly-ad-match-guards";
import type {
  WeeklyAdOffer,
  WeeklyAdRawOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const MIN_WEEKLY_AD_MATCH_CONFIDENCE = 0.45;

export function matchWeeklyAdOffers(input: {
  chain: WeeklyAdOffer["chain"];
  storeId: string;
  sourceUrl: string;
  observedAt: string;
  rawOffers: WeeklyAdRawOffer[];
  trackedIngredientIds: string[];
}): WeeklyAdOffer[] {
  const trackedIngredients = INTERNAL_CATALOG_INGREDIENTS.filter((ingredient) =>
    input.trackedIngredientIds.includes(ingredient.id),
  );

  const offers: WeeklyAdOffer[] = [];

  for (const rawOffer of input.rawOffers) {
    let bestMatch:
      | {
          ingredientId: string;
          matchConfidence: number;
        }
      | undefined;

    for (const ingredient of trackedIngredients) {
      for (const searchTerm of getWeeklyAdIngredientSearchTerms(ingredient)) {
        if (
          shouldRejectWeeklyAdIngredientMatch({
            ingredientId: ingredient.id,
            productName: rawOffer.productName,
          })
        ) {
          continue;
        }

        const scored = scoreProviderProductMatch({
          ingredient: {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            searchTerm,
          },
          description: rawOffer.productName,
          inStock: true,
        });

        if (
          scored.matchConfidence >= MIN_WEEKLY_AD_MATCH_CONFIDENCE &&
          (!bestMatch || scored.matchConfidence > bestMatch.matchConfidence)
        ) {
          bestMatch = {
            ingredientId: ingredient.id,
            matchConfidence: scored.matchConfidence,
          };
        }
      }
    }

    offers.push({
      chain: input.chain,
      storeId: input.storeId,
      ingredientId: bestMatch?.ingredientId,
      productName: rawOffer.productName,
      price: rawOffer.price,
      saleLabel: rawOffer.saleLabel,
      validThrough: rawOffer.validThrough,
      sourceUrl: input.sourceUrl,
      observedAt: input.observedAt,
      confidenceScore: bestMatch?.matchConfidence ?? 0.25,
      matchConfidence: bestMatch?.matchConfidence,
    });
  }

  return offers;
}
