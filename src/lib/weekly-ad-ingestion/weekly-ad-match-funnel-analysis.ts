import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import { scoreProviderProductMatchWithBreakdown } from "@/lib/providers/provider-price-matching";
import { getWeeklyAdIngredientSearchTerms } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-search-terms";
import { shouldRejectWeeklyAdIngredientMatch } from "@/lib/weekly-ad-ingestion/weekly-ad-match-guards";
import {
  MIN_WEEKLY_AD_MATCH_CONFIDENCE,
  matchWeeklyAdOffers,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import type {
  WeeklyAdChain,
  WeeklyAdRawOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdOfferMatchOutcome =
  | "matched"
  | "below_threshold"
  | "no_candidate"
  | "guard_rejected_only";

export type WeeklyAdOfferMatchProbe = {
  productName: string;
  price: number;
  outcome: WeeklyAdOfferMatchOutcome;
  bestConfidence: number;
  bestIngredientId?: string;
  bestSearchTerm?: string;
  bestMatchReason?: string;
  matchedIngredientId?: string;
  guardRejectedIngredientIds: string[];
  nearMisses: Array<{
    ingredientId: string;
    searchTerm: string;
    confidence: number;
    matchReason: string;
  }>;
};

export type WeeklyAdMatchFunnelSummary = {
  chain: WeeklyAdChain;
  rawOfferCount: number;
  matchedCount: number;
  belowThresholdCount: number;
  noCandidateCount: number;
  guardRejectedOnlyCount: number;
  uniqueMatchedIngredientIds: string[];
  probes: WeeklyAdOfferMatchProbe[];
};

export function probeWeeklyAdOfferMatch(input: {
  chain: WeeklyAdChain;
  rawOffer: WeeklyAdRawOffer;
  trackedIngredientIds: string[];
}): WeeklyAdOfferMatchProbe {
  const trackedIngredients = INTERNAL_CATALOG_INGREDIENTS.filter((ingredient) =>
    input.trackedIngredientIds.includes(ingredient.id),
  );

  const guardRejectedIngredientIds: string[] = [];
  const nearMisses: WeeklyAdOfferMatchProbe["nearMisses"] = [];
  let bestConfidence = 0;
  let bestIngredientId: string | undefined;
  let bestSearchTerm: string | undefined;
  let bestMatchReason: string | undefined;

  for (const ingredient of trackedIngredients) {
    for (const searchTerm of getWeeklyAdIngredientSearchTerms(ingredient)) {
      if (
        shouldRejectWeeklyAdIngredientMatch({
          ingredientId: ingredient.id,
          productName: input.rawOffer.productName,
        })
      ) {
        if (!guardRejectedIngredientIds.includes(ingredient.id)) {
          guardRejectedIngredientIds.push(ingredient.id);
        }
        continue;
      }

      const scored = scoreProviderProductMatchWithBreakdown({
        ingredient: {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          searchTerm,
        },
        description: input.rawOffer.productName,
        inStock: true,
      });

      if (
        scored.matchConfidence >= 0.25 &&
        scored.matchConfidence < MIN_WEEKLY_AD_MATCH_CONFIDENCE
      ) {
        nearMisses.push({
          ingredientId: ingredient.id,
          searchTerm,
          confidence: scored.matchConfidence,
          matchReason: scored.matchReason,
        });
      }

      if (scored.matchConfidence > bestConfidence) {
        bestConfidence = scored.matchConfidence;
        bestIngredientId = ingredient.id;
        bestSearchTerm = searchTerm;
        bestMatchReason = scored.matchReason;
      }
    }
  }

  nearMisses.sort((a, b) => b.confidence - a.confidence);

  let outcome: WeeklyAdOfferMatchOutcome;
  if (bestConfidence >= MIN_WEEKLY_AD_MATCH_CONFIDENCE) {
    outcome = "matched";
  } else if (
    guardRejectedIngredientIds.length > 0 &&
    bestConfidence <= 0.05 &&
    nearMisses.length === 0
  ) {
    outcome = "guard_rejected_only";
  } else if (bestConfidence <= 0.05 && nearMisses.length === 0) {
    outcome = "no_candidate";
  } else if (bestConfidence > 0.05 || nearMisses.length > 0) {
    outcome = "below_threshold";
  } else {
    outcome = "no_candidate";
  }

  return {
    productName: input.rawOffer.productName,
    price: input.rawOffer.price,
    outcome,
    bestConfidence,
    bestIngredientId,
    bestSearchTerm,
    bestMatchReason,
    matchedIngredientId:
      bestConfidence >= MIN_WEEKLY_AD_MATCH_CONFIDENCE ? bestIngredientId : undefined,
    guardRejectedIngredientIds,
    nearMisses: nearMisses.slice(0, 5),
  };
}

export function analyzeWeeklyAdMatchFunnel(input: {
  chain: WeeklyAdChain;
  storeId: string;
  sourceUrl: string;
  observedAt: string;
  rawOffers: WeeklyAdRawOffer[];
  trackedIngredientIds: string[];
}): WeeklyAdMatchFunnelSummary {
  const probes = input.rawOffers.map((rawOffer) =>
    probeWeeklyAdOfferMatch({
      chain: input.chain,
      rawOffer,
      trackedIngredientIds: input.trackedIngredientIds,
    }),
  );

  const matchedOffers = matchWeeklyAdOffers(input);
  const matchedCount = matchedOffers.filter((offer) => offer.ingredientId).length;

  return {
    chain: input.chain,
    rawOfferCount: input.rawOffers.length,
    matchedCount,
    belowThresholdCount: probes.filter((probe) => probe.outcome === "below_threshold").length,
    noCandidateCount: probes.filter((probe) => probe.outcome === "no_candidate").length,
    guardRejectedOnlyCount: probes.filter((probe) => probe.outcome === "guard_rejected_only")
      .length,
    uniqueMatchedIngredientIds: [
      ...new Set(
        probes
          .map((probe) => probe.matchedIngredientId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    probes,
  };
}
