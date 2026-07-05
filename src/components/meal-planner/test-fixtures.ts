import type { MealRecommendation, RecommendationExperience } from "@/lib/recommendation-service";
import type { FormState, MarketSearchState } from "@/components/meal-planner/types";
import type { SaleIngredientChoice } from "@/lib/sale-ingredient-offers";

export const testForm: FormState = {
  zipCode: "23111",
  radiusMiles: "5",
  budget: "25",
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  theme: "system",
  selectedStoreIds: ["kroger-mechanicsville"],
};

export function buildTestMarket(
  overrides: Partial<RecommendationExperience["market"]> = {},
): RecommendationExperience["market"] {
  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [],
    recommendationReadyStoreCount: 1,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "limited",
      trustGate: "monitoring",
      rankedPricingSource: "weekly-ad-cache",
      totalTrackedIngredients: 97,
      matchedIngredientCount: 12,
      unmatchedIngredientCount: 85,
      averageMatchConfidence: 0.8,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "Fixture coverage rollup.",
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    saleIngredientChoices: buildSaleIngredientChoices(),
    message: "Fixture market search.",
    ...overrides,
  };
}

export function buildSaleIngredientChoices(): SaleIngredientChoice[] {
  return [
    {
      ingredientId: "chicken-thighs",
      ingredientName: "Chicken thighs",
      lowestEstimatedPrice: 6.49,
      storeOfferCount: 1,
      saleLabel: "Weekly ad",
      trustLabel: "estimated",
      freshnessHoursAgo: 12,
      offers: [
        {
          storeId: "kroger-mechanicsville",
          storeName: "Kroger",
          price: 6.49,
          trustLabel: "estimated",
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 12,
        },
      ],
    },
    {
      ingredientId: "black-beans",
      ingredientName: "Black beans",
      lowestEstimatedPrice: 1.09,
      storeOfferCount: 1,
      trustLabel: "directional",
      freshnessHoursAgo: 24,
      offers: [
        {
          storeId: "kroger-mechanicsville",
          storeName: "Kroger",
          price: 1.09,
          trustLabel: "directional",
          freshnessDaysAgo: 1,
          freshnessHoursAgo: 24,
        },
      ],
    },
  ];
}

export function buildTestMeal(
  overrides: Partial<MealRecommendation> = {},
): MealRecommendation {
  return {
    title: "Weeknight Lemon Chicken",
    summary: "Simple roasted chicken with vegetables.",
    estimatedTotal: 13.42,
    storeCount: 1,
    matchedIngredients: 3,
    cookTimeMinutes: 35,
    difficulty: "easy",
    primaryStore: "Kroger",
    ingredientHighlights: ["chicken thighs"],
    instructions: ["Roast until done."],
    shoppingPlan: [
      {
        ingredient: "Chicken thighs",
        quantityNote: "1.5 lb",
        storeName: "Kroger",
        price: 6.49,
        freshnessDaysAgo: 1,
        freshnessHoursAgo: 12,
        priceSource: "kroger-weekly-ad-scrape",
        priceSourceKind: "weekly-ad",
        priceSourceTier: 2,
        matchConfidence: 0.85,
        saleConfidence: {
          level: "advertised-recent",
          label: "Sale price — estimate only",
          note: "Fixture note.",
        },
      },
    ],
    storePlan: [{ storeName: "Kroger", subtotal: 13.42, itemCount: 3 }],
    score: { total: 74, price: 32, convenience: 22, freshness: 12, fit: 8 },
    confidenceLabel: "Single-store estimate",
    tags: [],
    freshnessLabel: "Recent sale prices",
    explanation: "Fits the budget with recent sale price observations.",
    providerPreviewComparisons: [],
    ...overrides,
  };
}

export function buildTierCMarket(): RecommendationExperience["market"] {
  return buildTestMarket({
    recommendationReadyStoreCount: 0,
    saleIngredientChoices: [],
    nearbyStores: [
      {
        id: "context-1",
        name: "Context Store",
        kind: "grocery",
        latitude: 37.6,
        longitude: -77.3,
        distanceMiles: 1,
        chain: "unknown",
        chainLabel: "Other",
        rolloutStatus: "limited-coverage",
        recommendationEnabled: false,
        rolloutNote: "Limited coverage in this beta area.",
        locationProvenance: "osm-context",
        locationBadge: "OSM context pin",
        locationNote: "Fixture context store.",
      },
    ],
    message: "Map context only — ranked meal estimates are limited coverage here.",
  });
}

export function buildReadyMarketSearchState(
  market = buildTestMarket(),
): MarketSearchState {
  return { status: "ready", market };
}

export function buildLoadingMarketSearchState(): MarketSearchState {
  return { status: "loading" };
}

export function buildErrorMarketSearchState(error = "Market search failed."): MarketSearchState {
  return { status: "error", error };
}
