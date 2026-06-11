import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbPoolForTests } from "@/lib/db";
import { insertPriceObservation } from "@/lib/price-observation-writes";
import { deleteAllPriceObservations } from "@/lib/test-only/price-observation-writes";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { KROGER_OFFICIAL_PRICE_SOURCE } from "@/lib/price-source-policy";

describe("getMarketDataSnapshot (integration)", () => {
  beforeEach(async () => {
    await deleteAllPriceObservations();
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("loads curated catalog from Docker Postgres without sample pricing rows", async () => {
    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("database");
    expect(result.snapshot.stores.length).toBeGreaterThan(0);
    expect(result.snapshot.recipes.length).toBeGreaterThan(0);
    expect(result.snapshot.priceObservations).toHaveLength(0);
    expect(result.snapshot.stores.some((store) => store.id === "kroger-mechanicsville")).toBe(
      true,
    );
  });

  it("prefers official online prices over newer weekly-ad rows for the same ingredient", async () => {
    const weeklyAdObservedAt = new Date(Date.now() - 4 * 3_600_000);
    const officialObservedAt = new Date(Date.now() - 6 * 3_600_000);

    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 7.25,
      saleLabel: "Kroger weekly-ad special",
      observedAt: weeklyAdObservedAt,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-weekly-ad-chicken-thighs",
      confidenceScore: 0.9,
      notes: "weekly ad test row",
    });
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 7.49,
      observedAt: officialObservedAt,
      sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
      sourceRecordId: "kroger-online-chicken-thighs",
      confidenceScore: 0.95,
      notes: "official online test row",
    });

    const result = await getMarketDataSnapshot();
    const observation = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" &&
        row.ingredientId === "chicken-thighs",
    );

    expect(observation?.priceSource).toBe(KROGER_OFFICIAL_PRICE_SOURCE);
    expect(observation?.price).toBe(7.49);
    expect(observation?.priceSourceKind).toBe("official-online");
    expect(observation?.freshnessHoursAgo).toEqual(expect.any(Number));
  });

  it("excludes expired sale rows from ranked price observation reads", async () => {
    const pastEnd = new Date("2020-01-01T00:00:00.000Z");
    const futureEnd = new Date("2099-12-31T23:59:59.000Z");
    const expiredObservedAt = new Date(Date.now() - 5 * 3_600_000);
    const currentObservedAt = new Date(Date.now() - 3 * 3_600_000);

    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 0.59,
      saleLabel: "Expired weekly deal",
      observedAt: expiredObservedAt,
      validThrough: pastEnd,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-expired-black-beans",
      confidenceScore: 0.8,
      notes: "expired row for integration test",
    });
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 0.79,
      saleLabel: "Current weekly deal",
      observedAt: currentObservedAt,
      validThrough: futureEnd,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-current-black-beans",
      confidenceScore: 0.82,
      notes: "current row for integration test",
    });

    const result = await getMarketDataSnapshot();
    const observation = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" &&
        row.ingredientId === "black-beans",
    );

    expect(observation?.price).toBe(0.79);
    expect(observation?.saleLabel).toBe("Current weekly deal");
  });

  it("excludes ranked price observations older than 24 hours", async () => {
    const staleObservedAt = new Date(Date.now() - 25 * 3_600_000);
    const freshObservedAt = new Date(Date.now() - 2 * 3_600_000);

    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 1.99,
      saleLabel: "Stale weekly deal",
      observedAt: staleObservedAt,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-stale-black-beans",
      confidenceScore: 0.8,
      notes: "stale row for integration test",
    });
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 0.89,
      saleLabel: "Fresh weekly deal",
      observedAt: freshObservedAt,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-fresh-chicken-thighs",
      confidenceScore: 0.82,
      notes: "fresh row for integration test",
    });

    const result = await getMarketDataSnapshot();
    const staleRow = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" && row.ingredientId === "black-beans",
    );
    const freshRow = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" &&
        row.ingredientId === "chicken-thighs",
    );

    expect(staleRow).toBeUndefined();
    expect(freshRow?.price).toBe(0.89);
  });
});
