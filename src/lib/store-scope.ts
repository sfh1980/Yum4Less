import { collapseSameChainCollocatedCatalogStores } from "@/lib/catalog-store-colocated-identity";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import type {
  MarketSummary,
  NearbyStoreSummary,
  RecommendationExperience,
  ShopperNotice,
} from "@/lib/recommendation-types";
import {
  type SaleIngredientChoice,
  collectRankableIngredientIdsAtStores,
} from "@/lib/sale-ingredient-offers";

export type ResolvedStoreSelectionForRanking = {
  effectiveSelectedStoreIds: string[];
  droppedStoreIds: string[];
  collapsedStoreIds: string[];
  selectionChanged: boolean;
};

function sameSelectedStoreIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const allowed = new Set(right);
  return left.every((id) => allowed.has(id));
}

/**
 * Membership-filter then same-chain collocated collapse for rank/pantry scoping.
 * Stale-filter runs before collapse so retired twins never reach price comparison.
 */
export function resolveSelectedStoreIdsForRanking(input: {
  selectedStoreIds: string[];
  marketNearbyStores: NearbyStoreSummary[];
}): ResolvedStoreSelectionForRanking {
  const marketById = new Map(
    input.marketNearbyStores.map((store) => [store.id, store]),
  );

  const knownStores: NearbyStoreSummary[] = [];
  const droppedStoreIds: string[] = [];

  for (const storeId of input.selectedStoreIds) {
    const store = marketById.get(storeId);
    if (store) {
      knownStores.push(store);
    } else {
      droppedStoreIds.push(storeId);
    }
  }

  const beforeCollapseIds = new Set(knownStores.map((store) => store.id));
  const collapsedStores = collapseSameChainCollocatedCatalogStores(knownStores);
  const effectiveSelectedStoreIds = collapsedStores.map((store) => store.id);
  const collapsedStoreIds = [...beforeCollapseIds].filter(
    (id) => !effectiveSelectedStoreIds.includes(id),
  );

  const selectionChanged = !sameSelectedStoreIdSet(
    input.selectedStoreIds,
    effectiveSelectedStoreIds,
  );

  return {
    effectiveSelectedStoreIds,
    droppedStoreIds,
    collapsedStoreIds,
    selectionChanged,
  };
}

export function buildStoreSelectionSyncNotices(input: {
  droppedStoreIds: string[];
  effectiveSelectedStoreIds: string[];
}): Pick<RecommendationExperience, "shopperNotice" | "supplementaryShopperNotices"> {
  if (input.droppedStoreIds.length === 0) {
    return {};
  }

  if (input.effectiveSelectedStoreIds.length === 0) {
    return {
      shopperNotice: {
        title: "Selected stores unavailable",
        body:
          "Your saved store choices are no longer in this search area. Open Settings, find stores again, and reselect.",
      },
    };
  }

  return {
    supplementaryShopperNotices: [
      {
        title: "Store selection updated",
        body:
          "One or more selected stores are no longer available for this search. Estimates use your remaining stores — review Settings to confirm.",
      },
    ],
  };
}

export function mergeRankingShopperNotices(
  ...layers: Array<
    Pick<RecommendationExperience, "shopperNotice" | "supplementaryShopperNotices"> | undefined
  >
): Pick<RecommendationExperience, "shopperNotice" | "supplementaryShopperNotices"> {
  const primaryNotices: ShopperNotice[] = [];
  const supplementaryNotices: ShopperNotice[] = [];

  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    if (layer.shopperNotice) {
      primaryNotices.push(layer.shopperNotice);
    }
    if (layer.supplementaryShopperNotices) {
      supplementaryNotices.push(...layer.supplementaryShopperNotices);
    }
  }

  const shopperNotice = primaryNotices[0];
  const mergedSupplementary = [...primaryNotices.slice(1), ...supplementaryNotices];

  if (!shopperNotice && mergedSupplementary.length === 0) {
    return {};
  }

  if (!shopperNotice) {
    return { supplementaryShopperNotices: mergedSupplementary };
  }

  if (mergedSupplementary.length === 0) {
    return { shopperNotice };
  }

  return {
    shopperNotice,
    supplementaryShopperNotices: mergedSupplementary,
  };
}

export function filterNearbyStoresBySelection(
  stores: NearbyStoreSummary[],
  selectedStoreIds: string[] | undefined,
): NearbyStoreSummary[] {
  if (!selectedStoreIds || selectedStoreIds.length === 0) {
    return [];
  }

  const allowed = new Set(selectedStoreIds);
  return stores.filter((store) => allowed.has(store.id));
}

export function filterSaleIngredientChoicesByStoreIds(
  choices: SaleIngredientChoice[],
  selectedStoreIds: string[],
): SaleIngredientChoice[] {
  const allowed = new Set(selectedStoreIds);
  const filtered: SaleIngredientChoice[] = [];

  for (const choice of choices) {
    const offers = choice.offers.filter((offer) => allowed.has(offer.storeId));
    if (offers.length === 0) {
      continue;
    }

    const sortedOffers = [...offers].sort((left, right) => left.price - right.price);
    const primaryOffer = sortedOffers[0]!;

    filtered.push({
      ...choice,
      lowestEstimatedPrice: primaryOffer.price,
      storeOfferCount: sortedOffers.length,
      saleLabel: sortedOffers.find((offer) => offer.saleLabel)?.saleLabel,
      trustLabel: primaryOffer.trustLabel,
      freshnessHoursAgo: Math.min(
        ...sortedOffers.map(
          (offer) => offer.freshnessHoursAgo ?? offer.freshnessDaysAgo * 24,
        ),
      ),
      offers: sortedOffers,
    });
  }

  return filtered.sort((left, right) =>
    left.ingredientName.localeCompare(right.ingredientName),
  );
}

export function scopeMarketSummaryToSelectedStores(
  market: MarketSummary,
  selectedStoreIds: string[],
): MarketSummary {
  const nearbyStores = filterNearbyStoresBySelection(market.nearbyStores, selectedStoreIds);

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
    saleIngredientChoices: filterSaleIngredientChoicesByStoreIds(
      market.saleIngredientChoices,
      selectedStoreIds,
    ),
  };
}

export function filterPriceObservationsByStoreIds(
  observations: CatalogPriceObservation[],
  selectedStoreIds: string[],
): CatalogPriceObservation[] {
  const allowed = new Set(selectedStoreIds);
  return observations.filter((observation) => allowed.has(observation.storeId));
}

export function resolveEffectiveSelectedIngredientIds(input: {
  selectedIngredientIds?: string[];
  priceObservations: CatalogPriceObservation[];
  selectedStoreIds: string[];
}): string[] {
  if (input.selectedIngredientIds && input.selectedIngredientIds.length > 0) {
    return input.selectedIngredientIds;
  }

  const scopedObservations = filterPriceObservationsByStoreIds(
    input.priceObservations,
    input.selectedStoreIds,
  );

  return collectRankableIngredientIdsAtStores(scopedObservations);
}

export { collectRankableIngredientIdsAtStores };
