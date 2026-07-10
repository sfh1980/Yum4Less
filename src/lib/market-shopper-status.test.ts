import { describe, expect, it } from "vitest";
import {
  buildMarketShopperBlockedStatus,
  buildMealRankingPausedStatus,
  isMarketDatabaseUnavailable,
} from "@/lib/market-shopper-status";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

const baseMarket = {
  nearbyStores: [buildTestNearbyStoreSummary({ id: "store-a", name: "Store A" })],
  recommendationReadyStoreCount: 0,
  dataSource: "database" as const,
};

describe("market-shopper-status", () => {
  it("detects database unavailable", () => {
    expect(
      isMarketDatabaseUnavailable({ dataSource: "unavailable" }),
    ).toBe(true);
    expect(isMarketDatabaseUnavailable({ dataSource: "database" })).toBe(false);
  });

  it("uses infrastructure copy when the database is unavailable", () => {
    const status = buildMarketShopperBlockedStatus({
      ...baseMarket,
      dataSource: "unavailable",
    });

    expect(status?.kind).toBe("database-unavailable");
    expect(status?.title).toMatch(/aren't loading/i);
    expect(status?.body).toMatch(/isn't your ZIP/i);
    expect(status?.extra).not.toMatch(/larger radius/i);
  });

  it("uses radius guidance when the database is healthy but no stores match", () => {
    const status = buildMarketShopperBlockedStatus({
      ...baseMarket,
      dataSource: "database",
      nearbyStores: [],
    });

    expect(status?.kind).toBe("no-stores-in-radius");
    expect(status?.extra).toMatch(/larger radius/i);
  });

  it("separates meal-ranking pause copy for database outages", () => {
    const mealStatus = buildMealRankingPausedStatus({
      ...baseMarket,
      dataSource: "unavailable",
    });

    expect(mealStatus.title).toMatch(/saved prices/i);
    expect(mealStatus.body).toMatch(/didn't load/i);
    expect(mealStatus.body).not.toMatch(/trusted pricing rollout/i);
  });
});
