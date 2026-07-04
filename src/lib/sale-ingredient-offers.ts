import type {
  CatalogIngredient,
  CatalogPriceObservation,
  CatalogStore,
} from "@/lib/market-catalog-types";
import { isLiveRankedPriceSource } from "@/lib/price-source-policy";

export type SaleIngredientOfferDetail = {
  storeId: string;
  storeName: string;
  price: number;
  saleLabel?: string;
  priceSource?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  trustLabel: "directional" | "estimated";
};

export type SaleIngredientChoice = {
  ingredientId: string;
  ingredientName: string;
  lowestEstimatedPrice: number;
  storeOfferCount: number;
  saleLabel?: string;
  trustLabel: "directional" | "estimated";
  freshnessHoursAgo?: number;
  offers: SaleIngredientOfferDetail[];
};

/** Shopper-facing data-age line for ingredient rows (emphasis E). */
export function formatIngredientPriceAge(input: {
  freshnessHoursAgo?: number;
  freshnessDaysAgo?: number;
}): string | undefined {
  const freshnessHours =
    input.freshnessHoursAgo ??
    (input.freshnessDaysAgo !== undefined
      ? input.freshnessDaysAgo * 24
      : undefined);

  if (freshnessHours === undefined) {
    return undefined;
  }

  if (freshnessHours < 1) {
    return "Prices from less than 1 hour ago";
  }

  if (freshnessHours < 2) {
    return "Prices from ~1 hour ago";
  }

  return `Prices from ~${Math.round(freshnessHours)} hours ago`;
}

/** Card-level data-age line averaged across a meal shopping plan (emphasis E). */
export function formatMealPriceAgeFromShoppingPlan(
  items: { freshnessHoursAgo?: number; freshnessDaysAgo?: number }[],
): string | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const averageHours =
    items.reduce(
      (sum, item) =>
        sum + (item.freshnessHoursAgo ?? (item.freshnessDaysAgo ?? 0) * 24),
      0,
    ) / items.length;

  return formatIngredientPriceAge({ freshnessHoursAgo: averageHours });
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveTrustLabel(observation: CatalogPriceObservation): "directional" | "estimated" {
  if (
    observation.priceSourceKind === "weekly-ad" ||
    observation.priceSource?.includes("-weekly-ad-scrape")
  ) {
    return "directional";
  }

  return "estimated";
}

/**
 * Builds shopper-facing sale ingredient choices from nearby store price rows.
 * Includes weekly-ad sale rows and official online cache rows when present.
 */
export function buildNearbySaleIngredientChoices(input: {
  nearbyStores: Array<Pick<CatalogStore, "id" | "name">>;
  priceObservations: CatalogPriceObservation[];
  ingredients: CatalogIngredient[];
}): SaleIngredientChoice[] {
  const storeNameById = new Map(
    input.nearbyStores.map((store) => [store.id, store.name]),
  );
  const ingredientNameById = new Map(
    (input.ingredients ?? []).map((ingredient) => [ingredient.id, ingredient.name]),
  );
  const nearbyStoreIds = new Set(input.nearbyStores.map((store) => store.id));

  const offersByIngredient = new Map<string, SaleIngredientOfferDetail[]>();

  for (const observation of input.priceObservations) {
    if (!nearbyStoreIds.has(observation.storeId)) {
      continue;
    }

    if (!isLiveRankedPriceSource(observation.priceSource)) {
      continue;
    }

    const storeName = storeNameById.get(observation.storeId);
    if (!storeName) {
      continue;
    }

    const detail: SaleIngredientOfferDetail = {
      storeId: observation.storeId,
      storeName,
      price: observation.price,
      saleLabel: observation.saleLabel,
      priceSource: observation.priceSource,
      freshnessDaysAgo: observation.freshnessDaysAgo,
      freshnessHoursAgo: observation.freshnessHoursAgo,
      trustLabel: resolveTrustLabel(observation),
    };

    const current = offersByIngredient.get(observation.ingredientId) ?? [];
    current.push(detail);
    offersByIngredient.set(observation.ingredientId, current);
  }

  const choices: SaleIngredientChoice[] = [];

  for (const [ingredientId, offers] of offersByIngredient.entries()) {
    const ingredientName =
      ingredientNameById.get(ingredientId) ??
      offers[0]?.saleLabel?.split(" ")[0] ??
      ingredientId.replace(/-/g, " ");

    const sortedOffers = [...offers].sort((left, right) => left.price - right.price);
    const primaryOffer = sortedOffers[0]!;

    const freshnessHoursAgo = Math.min(
      ...sortedOffers.map(
        (offer) => offer.freshnessHoursAgo ?? offer.freshnessDaysAgo * 24,
      ),
    );

    choices.push({
      ingredientId,
      ingredientName,
      lowestEstimatedPrice: roundCurrency(primaryOffer.price),
      storeOfferCount: sortedOffers.length,
      saleLabel: sortedOffers.find((offer) => offer.saleLabel)?.saleLabel,
      trustLabel: primaryOffer.trustLabel,
      freshnessHoursAgo,
      offers: sortedOffers,
    });
  }

  return choices.sort((left, right) =>
    left.ingredientName.localeCompare(right.ingredientName),
  );
}

/** Ingredient IDs with ranked price rows at the given stores (default rank scope). */
export function collectRankableIngredientIdsAtStores(
  observations: CatalogPriceObservation[],
  storeIds?: Set<string>,
): string[] {
  const ids = new Set<string>();

  for (const observation of observations) {
    if (storeIds && !storeIds.has(observation.storeId)) {
      continue;
    }

    if (!isLiveRankedPriceSource(observation.priceSource)) {
      continue;
    }

    ids.add(observation.ingredientId);
  }

  return [...ids].sort();
}

export function filterRecipesBySelectedIngredientIds<T extends { ingredients: Array<{ ingredientId: string }> }>(
  recipes: T[],
  selectedIngredientIds: string[] | undefined,
): T[] {
  if (!selectedIngredientIds || selectedIngredientIds.length === 0) {
    return recipes;
  }

  const selected = new Set(selectedIngredientIds);

  return recipes.filter((recipe) =>
    recipe.ingredients.some((line) => selected.has(line.ingredientId)),
  );
}
