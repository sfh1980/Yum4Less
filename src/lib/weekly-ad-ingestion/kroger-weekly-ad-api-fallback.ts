import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  createKrogerApiClient,
  readKrogerApiCredentialsFromEnv,
} from "@/lib/providers/kroger/kroger-api-client";
import { readKrogerItemPrices } from "@/lib/providers/kroger/kroger-api-types";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export async function fetchKrogerOffersFromOfficialApi(input: {
  zipCode: string;
  trackedIngredientIds: string[];
}): Promise<WeeklyAdRawOffer[]> {
  const credentials = readKrogerApiCredentialsFromEnv();
  if (!credentials) {
    return [];
  }

  const api = createKrogerApiClient(credentials);
  const trackedIngredients = INTERNAL_CATALOG_INGREDIENTS
    .filter((ingredient) => input.trackedIngredientIds.includes(ingredient.id))
    .map((ingredient) => ({
      searchTerm: ingredient.name,
    }));

  if (trackedIngredients.length === 0) {
    return [];
  }

  const locationId =
    process.env.KROGER_LOCATION_ID?.trim() ??
    (await api.resolveLocationIdForZip(input.zipCode));

  if (!locationId) {
    return [];
  }

  const offers: WeeklyAdRawOffer[] = [];

  for (const ingredient of trackedIngredients) {
    const products = await api.searchProducts({
      term: ingredient.searchTerm,
      locationId,
      fulfillment: "ais",
      limit: 1,
    });
    const product = products[0];
    const description = product?.description?.trim();
    const { resolvedPrice, hasPromo } = readKrogerItemPrices(product?.items?.[0]);

    if (!description || resolvedPrice === undefined) {
      continue;
    }

    offers.push({
      productName: description,
      price: resolvedPrice,
      saleLabel: hasPromo ? "Official API promo" : undefined,
    });
  }

  return offers;
}
