import {
  mockPriceObservations,
  mockRecipes,
  mockStores,
  type MockPriceObservation,
} from "@/lib/mock-market-data";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MealPreferenceForm } from "@/lib/recommendation-service";

/** Merge-gating ZIP 23111 / Mechanicsville fixture location for ranking guards (CI-02). */
export const zip23111MechanicsvilleLocation: ResolvedSearchLocation = {
  zipCode: "23111",
  city: "Mechanicsville",
  state: "VA",
  county: "Hanover County",
  latitude: 37.6085,
  longitude: -77.3321,
  source: "seed",
};

/** Default MVP preferences used in merge-gating ranking tests for ZIP 23111. */
export const zip23111RankingPreferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
};

const WEEKLY_AD_CHAINS = [
  { storeId: "kroger-mechanicsville", priceSource: "kroger-weekly-ad-scrape" },
  { storeId: "publix-atlee", priceSource: "publix-weekly-ad-scrape" },
  { storeId: "walmart-rocketts", priceSource: "walmart-weekly-ad-scrape" },
] as const;

/**
 * Fixture price observations that enable weekly-ad-ranked stores near ZIP 23111.
 * No live APIs — mirrors ingested weekly-ad cache rows used in production-lean MVP tests.
 */
export function buildZip23111WeeklyAdPriceObservations(
  storeIds: ReadonlyArray<(typeof WEEKLY_AD_CHAINS)[number]["storeId"]> = [
    "kroger-mechanicsville",
  ],
): MockPriceObservation[] {
  const allowed = new Set(storeIds);
  return mockPriceObservations
    .filter((observation) => allowed.has(observation.storeId as (typeof storeIds)[number]))
    .map((observation) => {
      const chain = WEEKLY_AD_CHAINS.find((entry) => entry.storeId === observation.storeId);
      return {
        ...observation,
        priceSource: chain?.priceSource ?? "kroger-weekly-ad-scrape",
        matchConfidence: 0.85,
      };
    });
}

export function buildZip23111RankingSnapshot(
  storeIds: ReadonlyArray<(typeof WEEKLY_AD_CHAINS)[number]["storeId"]> = [
    "kroger-mechanicsville",
  ],
) {
  return {
    stores: mockStores,
    recipes: mockRecipes,
    priceObservations: buildZip23111WeeklyAdPriceObservations(storeIds),
  };
}

const blackBeanTacoRecipe = mockRecipes.find(
  (recipe) => recipe.id === "black-bean-tacos",
)!;

/**
 * Split-store fixture: neither Kroger nor Publix alone stocks every taco ingredient,
 * but multi-store shopping can still build the meal across both promotion-ready chains.
 * Walmart is excluded from ranked pricing even when rehearsal rows exist.
 */
export function buildZip23111SplitStoreBlackBeanSnapshot() {
  const weeklyAdBase = {
    freshnessDaysAgo: 1,
    inStock: true,
    matchConfidence: 0.85,
  } as const;

  const priceObservations: MockPriceObservation[] = [
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 1.09,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "corn-tortillas",
      price: 2.29,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "cabbage",
      price: 2.19,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "taco-seasoning",
      price: 0.89,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "cumin",
      price: 0.79,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "publix-atlee",
      ingredientId: "lime",
      price: 0.5,
      priceSource: "publix-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "publix-atlee",
      ingredientId: "olive-oil",
      price: 2.68,
      priceSource: "publix-weekly-ad-scrape",
      ...weeklyAdBase,
    },
    {
      storeId: "publix-atlee",
      ingredientId: "black-beans",
      price: 1.25,
      priceSource: "publix-weekly-ad-scrape",
      ...weeklyAdBase,
    },
  ];

  return {
    stores: mockStores,
    recipes: [blackBeanTacoRecipe],
    priceObservations,
  };
}
