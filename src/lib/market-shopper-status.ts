import type { MarketSummary } from "@/lib/recommendation-service";

export type MarketShopperBlockedStatus = {
  kind: "database-unavailable" | "no-stores-in-radius" | "no-trusted-rollout";
  title: string;
  body: string;
  extra?: string;
};

export type MealRankingPausedStatus = {
  title: string;
  body: string;
};

export function isMarketDatabaseUnavailable(
  market: Pick<MarketSummary, "dataSource">,
): boolean {
  return market.dataSource === "unavailable";
}

export function buildMarketShopperBlockedStatus(
  market: Pick<
    MarketSummary,
    "dataSource" | "nearbyStores" | "recommendationReadyStoreCount"
  >,
): MarketShopperBlockedStatus | null {
  if (market.recommendationReadyStoreCount > 0) {
    return null;
  }

  if (isMarketDatabaseUnavailable(market)) {
    return {
      kind: "database-unavailable",
      title: "Store and meal prices aren't loading",
      body:
        "This usually isn't your ZIP or search radius. Yum4Less couldn't load saved prices from the database, so the map and meal rankings may stay empty.",
      extra:
        "If you're running the app on your own computer, make sure the database is running and try again. Otherwise, wait a moment and refresh the page.",
    };
  }

  if (market.nearbyStores.length === 0) {
    return {
      kind: "no-stores-in-radius",
      title: "No stores in this search area",
      body:
        "Yum4Less found your location but didn't see any saved stores inside the radius you chose.",
      extra:
        "Try a larger radius or a ZIP closer to the supported local area.",
    };
  }

  return {
    kind: "no-trusted-rollout",
    title: "No stores ready for meal rankings yet",
    body:
      "Yum4Less found nearby stores, but none have enough trusted weekly-ad pricing to rank dinners right now.",
    extra:
      "Those stores may show as coming soon or limited coverage on the map.",
  };
}

export function buildMealRankingPausedStatus(
  market: Pick<
    MarketSummary,
    "dataSource" | "nearbyStores" | "recommendationReadyStoreCount"
  >,
): MealRankingPausedStatus {
  if (isMarketDatabaseUnavailable(market)) {
    return {
      title: "Meal rankings need saved prices",
      body:
        "Store and meal prices didn't load from the database, so dinners can't be ranked yet. Fix the data connection before changing ZIP or radius.",
    };
  }

  if (market.nearbyStores.length === 0) {
    return {
      title: "Meal ranking is paused",
      body:
        "No stores showed up in your search area yet. Try a larger radius or a nearby ZIP, then search again.",
    };
  }

  return {
    title: "Meal ranking is paused",
    body:
      "Nearby stores were found, but none are on the trusted pricing rollout yet, so ranked dinners aren't available.",
  };
}
