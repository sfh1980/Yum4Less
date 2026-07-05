import { fixtureRecipes, fixtureStores } from "@/lib/fixtures/market-catalog.fixtures";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { buildZip23111SplitStoreBlackBeanSnapshot } from "@/lib/recommendation-service-ranking.fixture";

export const krogerStore: NearbyStoreSummary = {
  id: "kroger-mechanicsville",
  name: "Kroger",
  kind: "grocery",
  latitude: 37.6153,
  longitude: -77.3491,
  distanceMiles: 1.2,
  chain: "kroger",
  chainLabel: "Kroger",
  rolloutStatus: "weekly-ad-preview",
  recommendationEnabled: true,
  rolloutNote: "Fixture coverage.",
  sourceName: "kroger-weekly-ad-scrape",
  locationProvenance: "bootstrap",
  locationBadge: "Catalog coordinates",
  locationNote: "Seed catalog row.",
};

export const aldiStore: NearbyStoreSummary = {
  id: "aldi-mechanicsville",
  name: "Aldi",
  kind: "grocery",
  latitude: 37.6362,
  longitude: -77.3606,
  distanceMiles: 2.4,
  chain: "aldi",
  chainLabel: "Aldi",
  rolloutStatus: "weekly-ad-preview",
  recommendationEnabled: true,
  rolloutNote: "Fixture coverage.",
  sourceName: "aldi-weekly-ad-scrape",
  locationProvenance: "bootstrap",
  locationBadge: "Catalog coordinates",
  locationNote: "Seed catalog row.",
};

export const blackBeanTacoRecipe = fixtureRecipes.find(
  (recipe) => recipe.id === "black-bean-tacos",
)!;

export function buildWeeklyAdObservation(
  overrides: Partial<CatalogPriceObservation>,
): CatalogPriceObservation {
  return {
    storeId: "kroger-mechanicsville",
    ingredientId: "black-beans",
    price: 1.09,
    priceSource: "kroger-weekly-ad-scrape",
    freshnessDaysAgo: 1,
    inStock: true,
    matchConfidence: 0.85,
    ...overrides,
  };
}

export function buildFullKrogerBlackBeanObservations(): CatalogPriceObservation[] {
  return blackBeanTacoRecipe.ingredients.map((ingredient) =>
    buildWeeklyAdObservation({
      ingredientId: ingredient.ingredientId,
      price: 1.09,
    }),
  );
}

export const splitStoreSnapshot = buildZip23111SplitStoreBlackBeanSnapshot();

export const splitStoreNearbyStores = fixtureStores
  .filter((store) =>
    ["kroger-mechanicsville", "aldi-mechanicsville"].includes(store.id),
  )
  .map((store) => ({
    id: store.id,
    name: store.name,
    kind: store.kind,
    latitude: store.latitude,
    longitude: store.longitude,
    distanceMiles: store.id === "kroger-mechanicsville" ? 1.2 : 2.4,
    chain: store.id === "kroger-mechanicsville" ? ("kroger" as const) : ("aldi" as const),
    chainLabel: store.name,
    rolloutStatus: "weekly-ad-preview" as const,
    recommendationEnabled: true,
    rolloutNote: "Fixture coverage.",
    sourceName:
      store.id === "kroger-mechanicsville"
        ? "kroger-weekly-ad-scrape"
        : "aldi-weekly-ad-scrape",
    locationProvenance: "ingested-catalog" as const,
    locationBadge: "Catalog coordinates",
    locationNote: "Seed catalog row.",
  }));
