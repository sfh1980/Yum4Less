/**
 * Last-resort **partial enrichment** for Kroger weekly-ad ingest only.
 *
 * Fires after direct scrape and Flipp both return zero offers. Queries the
 * official Products API once per already-tracked dinner ingredient — not general
 * sale discovery. Never Flipp-equivalent coverage; never a primary weekly-ad path.
 */
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  createKrogerApiClient,
  readKrogerApiCredentialsFromEnv,
} from "@/lib/providers/kroger/kroger-api-client";
import { readKrogerItemPrices } from "@/lib/providers/kroger/kroger-api-types";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Distinct from Flipp's "Directional — weekly ad syndicated feed" partner-feed label. */
export const KROGER_WEEKLY_AD_API_PARTIAL_FILL_SALE_LABEL =
  "Partial — tracked-ingredient product API fill (not weekly ad discovery)";

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
      saleLabel: hasPromo
        ? `${KROGER_WEEKLY_AD_API_PARTIAL_FILL_SALE_LABEL} · promo if shown`
        : KROGER_WEEKLY_AD_API_PARTIAL_FILL_SALE_LABEL,
    });
  }

  return offers;
}
