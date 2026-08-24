import { buildTestMarket } from "@/components/meal-planner/test-fixtures";
import type { MarketSearchResponse } from "@/components/meal-planner/types";

/** Tier C: selectable ranked-chain store on map but zero recommendation-ready stores. */
export function buildTierCMarketSearchResponse(): Extract<
  MarketSearchResponse,
  { ok: true }
> {
  const market = buildTestMarket({
    recommendationReadyStoreCount: 0,
    saleIngredientChoices: [],
    nearbyStores: [
      {
        id: "kroger-mechanicsville",
        name: "Kroger",
        kind: "grocery",
        latitude: 37.61546,
        longitude: -77.32939,
        distanceMiles: 2.1,
        chain: "kroger",
        chainLabel: "Kroger",
        rolloutStatus: "limited-coverage",
        recommendationEnabled: true,
        rolloutNote: "Limited weekly-ad coverage in this beta area.",
        locationProvenance: "bootstrap",
        locationBadge: "Catalog pin",
        locationNote: "Fixture Tier C store.",
      },
    ],
    message: "Map context only — ranked meal estimates are limited coverage here.",
  });

  return { ok: true, market };
}

export function buildMarketSearchErrorResponse(
  status: 400 | 404 | 500,
  error: string,
  providerConfigured = true,
): { status: number; body: MarketSearchResponse } {
  return {
    status,
    body: {
      ok: false,
      error,
      providerConfigured,
    },
  };
}

export function buildRecommendationsErrorResponse(
  status: 400 | 500,
  error: string,
  providerConfigured = true,
): { status: number; body: { ok: false; error: string; providerConfigured: boolean } } {
  return {
    status,
    body: {
      ok: false,
      error,
      providerConfigured,
    },
  };
}
