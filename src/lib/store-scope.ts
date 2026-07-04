import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import {
  type SaleIngredientChoice,
  collectRankableIngredientIdsAtStores,
} from "@/lib/sale-ingredient-offers";

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
