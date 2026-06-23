import { describe, expect, it } from "vitest";
import { API_LIMITS } from "@/lib/api-request";
import {
  parsePassedMarketSummary,
  trimMarketForRankingPassThrough,
  validatePassedMarketForRanking,
} from "@/lib/market-pass-through";
import type { MarketSummary } from "@/lib/recommendation-service";

function minimalMarket(overrides: Partial<MarketSummary> = {}): MarketSummary {
  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [
      {
        id: "kroger-1",
        name: "Kroger",
        kind: "grocery",
        latitude: 37.6153,
        longitude: -77.3491,
        distanceMiles: 2.4,
        chain: "kroger",
        chainLabel: "Kroger",
        rolloutStatus: "weekly-ad-preview",
        recommendationEnabled: true,
        rolloutNote: "Fixture note.",
        pricingStatus: "weekly-ad-preview",
        pricingLabel: "Est. weekly-ad prices",
        pricingNote: "Fixture.",
        locationProvenance: "postgres-catalog",
        locationBadge: "Catalog pin",
        locationNote: "Fixture.",
      },
    ],
    recommendationReadyStoreCount: 1,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "limited",
      trustGate: "monitoring",
      rankedPricingSource: "weekly-ad-cache",
      totalTrackedIngredients: 1,
      matchedIngredientCount: 1,
      unmatchedIngredientCount: 0,
      averageMatchConfidence: 0.8,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "Fixture.",
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    saleIngredientChoices: [],
    ...overrides,
  };
}

describe("market pass-through validation (H1–H3)", () => {
  it("accepts a market snapshot that matches location and radius", () => {
    const market = minimalMarket();
    const parsed = parsePassedMarketSummary(market);
    expect(parsed).not.toBeNull();

    const result = validatePassedMarketForRanking({
      market: parsed!,
      preferences: {
        zipCode: "23111",
        radiusMiles: 5,
        budget: 20,
        maxIngredients: 12,
        dinnersWanted: 3,
        shoppingStyle: "single-store",
        dietaryFocus: "anything",
        recipeSource: "internal-library",
        planningMode: "ingredient-first",
      },
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects radius drift between market snapshot and recommendation request", () => {
    const result = validatePassedMarketForRanking({
      market: minimalMarket({ radiusMiles: 5 }),
      preferences: {
        zipCode: "23111",
        radiusMiles: 10,
        budget: 20,
        maxIngredients: 12,
        dinnersWanted: 3,
        shoppingStyle: "single-store",
        dietaryFocus: "anything",
        recipeSource: "internal-library",
        planningMode: "ingredient-first",
      },
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
    });

    expect(result).toEqual({
      ok: false,
      reason:
        "Market snapshot radius does not match the recommendation request. Find nearby stores again after changing radius.",
    });
  });
});

describe("trimMarketForRankingPassThrough", () => {
  it("parses and validates after trimming a large market snapshot", () => {
    const storeTemplate = minimalMarket().nearbyStores[0]!;
    const fatMarket = minimalMarket({
      nearbyStores: Array.from({ length: 120 }, (_, index) => ({
        ...storeTemplate,
        id: `kroger-${index}`,
        name: `Kroger Store ${index}`,
      })),
      recommendationReadyStoreCount: 120,
      saleIngredientChoices: Array.from({ length: 90 }, (_, index) => ({
        ingredientId: `ingredient-${index}`,
        ingredientName: `Ingredient ${index}`,
        lowestEstimatedPrice: 2.5,
        storeOfferCount: 10,
        trustLabel: "estimated" as const,
        offers: Array.from({ length: 10 }, (_, offerIndex) => ({
          storeId: `kroger-${offerIndex}`,
          storeName: `Kroger ${offerIndex}`,
          price: 2.5,
          freshnessDaysAgo: 0,
          trustLabel: "estimated" as const,
        })),
      })),
    });

    const trimmed = trimMarketForRankingPassThrough(fatMarket);
    const parsed = parsePassedMarketSummary(trimmed);
    expect(parsed).not.toBeNull();

    const rankBody = JSON.stringify({
      zipCode: "23111",
      radiusMiles: 5,
      budget: 20,
      market: trimmed,
      selectedIngredientIds: ["chicken-thighs"],
    });
    expect(new TextEncoder().encode(rankBody).length).toBeLessThan(
      API_LIMITS.maxJsonBodyBytes,
    );

    const validation = validatePassedMarketForRanking({
      market: parsed!,
      preferences: {
        zipCode: "23111",
        radiusMiles: 5,
        budget: 20,
        maxIngredients: 12,
        dinnersWanted: 3,
        shoppingStyle: "single-store",
        dietaryFocus: "anything",
        recipeSource: "internal-library",
        planningMode: "ingredient-first",
      },
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
    });
    expect(validation.ok).toBe(true);
    expect(trimmed.nearbyStores[0]).toEqual({
      id: "kroger-0",
      name: "Kroger Store 0",
      recommendationEnabled: true,
    });
    expect(trimmed.saleIngredientChoices).toEqual([]);
    expect(trimmed.providerStoreSearches).toEqual([]);
  });
});
