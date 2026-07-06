import {
  fixturePriceObservations,
  fixtureRecipes,
  fixtureStores,
} from "@/lib/fixtures/market-catalog.fixtures";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
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

/** Default ranking preferences used in merge-gating tests for ZIP 23111. */
export const zip23111RankingPreferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
  planningMode: "standard",
};

const WEEKLY_AD_CHAINS = [
  { storeId: "kroger-mechanicsville", priceSource: "kroger-weekly-ad-scrape" },
  { storeId: "publix-1626", priceSource: "publix-weekly-ad-scrape" },
  { storeId: "walmart-rocketts", priceSource: "walmart-weekly-ad-scrape" },
] as const;

/** Maps legacy fixture day buckets to hours within the 24h promotion gate. */
const LEGACY_FIXTURE_DAY_TO_PROMOTION_FRESHNESS_HOURS: Record<number, number> = {
  1: 4,
  2: 11,
  3: 17,
  4: 23,
};

export function legacyFixtureDayToPromotionFreshnessHours(
  freshnessDaysAgo: number,
): number {
  return (
    LEGACY_FIXTURE_DAY_TO_PROMOTION_FRESHNESS_HOURS[freshnessDaysAgo] ?? 11
  );
}

export function weeklyAdPromotionFreshObservationFields(
  freshnessDaysAgo: number,
): Pick<
  CatalogPriceObservation,
  "freshnessHoursAgo" | "freshnessDaysAgo" | "inStock" | "matchConfidence"
> {
  return {
    freshnessHoursAgo: legacyFixtureDayToPromotionFreshnessHours(freshnessDaysAgo),
    freshnessDaysAgo: 0,
    inStock: true,
    matchConfidence: 0.85,
  };
}

/**
 * Fixture price observations that enable weekly-ad-ranked stores near ZIP 23111.
 * No live APIs — mirrors ingested weekly-ad cache rows used in ranking fixture tests.
 */
export function buildZip23111WeeklyAdPriceObservations(
  storeIds: ReadonlyArray<(typeof WEEKLY_AD_CHAINS)[number]["storeId"]> = [
    "kroger-mechanicsville",
  ],
): CatalogPriceObservation[] {
  const allowed = new Set(storeIds);
  return fixturePriceObservations
    .filter((observation) => allowed.has(observation.storeId as (typeof storeIds)[number]))
    .map((observation) => {
      const chain = WEEKLY_AD_CHAINS.find((entry) => entry.storeId === observation.storeId);
      return {
        ...observation,
        priceSource: chain?.priceSource ?? "kroger-weekly-ad-scrape",
        ...weeklyAdPromotionFreshObservationFields(observation.freshnessDaysAgo),
      };
    });
}

export function buildZip23111RankingSnapshot(
  storeIds: ReadonlyArray<(typeof WEEKLY_AD_CHAINS)[number]["storeId"]> = [
    "kroger-mechanicsville",
  ],
) {
  return {
    stores: fixtureStores,
    recipes: fixtureRecipes,
    priceObservations: buildZip23111WeeklyAdPriceObservations(storeIds),
  };
}

const blackBeanTacoRecipe = fixtureRecipes.find(
  (recipe) => recipe.id === "black-bean-tacos",
)!;

/**
 * Split-store fixture: neither Kroger nor Aldi alone stocks every taco ingredient,
 * but multi-store shopping can still build the meal across production-ranked chains.
 */
export function buildZip23111SplitStoreBlackBeanSnapshot() {
  const priceObservations: CatalogPriceObservation[] = [
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 1.09,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(3),
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "corn-tortillas",
      price: 2.29,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(4),
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "cabbage",
      price: 2.19,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(2),
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "taco-seasoning",
      price: 0.89,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(3),
    },
    {
      storeId: "kroger-mechanicsville",
      ingredientId: "cumin",
      price: 0.79,
      priceSource: "kroger-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(3),
    },
    {
      storeId: "aldi-mechanicsville",
      ingredientId: "lime",
      price: 0.45,
      priceSource: "aldi-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(2),
    },
    {
      storeId: "aldi-mechanicsville",
      ingredientId: "olive-oil",
      price: 2.49,
      priceSource: "aldi-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(4),
    },
    {
      storeId: "aldi-mechanicsville",
      ingredientId: "black-beans",
      price: 0.89,
      priceSource: "aldi-weekly-ad-scrape",
      ...weeklyAdPromotionFreshObservationFields(2),
    },
  ];

  return {
    stores: fixtureStores,
    recipes: [blackBeanTacoRecipe],
    priceObservations,
  };
}
