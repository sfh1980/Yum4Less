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
        "This usually isn't your ZIP or search radius. Yum4Less couldn't load saved prices, so the map and meal rankings may stay empty.",
      extra:
        "If you're running the app on your own computer, make sure the database is running and try again. Otherwise, wait a moment and refresh the page.",
    };
  }

  if (market.nearbyStores.length === 0) {
    return {
      kind: "no-stores-in-radius",
      title: "No stores in this search area",
      body:
        "Yum4Less found your location but didn't see supported stores inside the radius you chose.",
      extra:
        "Try a larger radius or another ZIP. Coverage varies by area.",
    };
  }

  return {
    kind: "no-trusted-rollout",
    title: "Map ready — meal estimates not available here yet",
    body:
      "Yum4Less found nearby stores, but none have enough sale prices for dinner estimates right now. Other map pins may be for planning only.",
    extra:
      "This is normal in many areas. Prices refresh on a daily schedule — check store labels on the map for limited coverage.",
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
        "Store and meal prices didn't load, so dinners can't be ranked yet. Fix the data connection before changing ZIP or radius.",
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
    title: "Meal estimates not available for this area yet",
    body:
      "Nearby stores are on the map, but dinner estimates need more sale price coverage. Prices refresh on a daily schedule — browse the map for context.",
  };
}
