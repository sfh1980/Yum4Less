import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  deletePriceObservationsForStore,
  purgeStaleRankedPriceObservations,
} from "@/lib/price-observation-writes";
import {
  countLivePriceObservationsForStore,
  getMarketDataSnapshot,
} from "@/lib/market-repository";
import { runWeeklyAdIngestionForStores } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import {
  buildWeeklyAdStoreCoverage,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";
import { resolveProviderRolloutForStore } from "@/lib/provider-rollout";
import {
  rememberWeeklyAdFlyerHash,
  weeklyAdFlyerContentHash,
} from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";
import { syncWeeklyAdOffersToPriceObservations } from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";
import type {
  WeeklyAdIngestionResult,
  WeeklyAdOffer,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("weekly ad ingest to ranked pricing (integration)", () => {
  beforeEach(async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    await deletePriceObservationsForStore("kroger-mechanicsville");
  });

  afterEach(async () => {
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
    await resetDbPoolForTests();
  });

  it("syncs Kroger fixture offers and passes weekly-ad promotion gates", async () => {
    const { syncSummaries } = await runWeeklyAdIngestionForStores({
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          chain: "kroger",
        },
      ],
      zipCode: "23111",
      persistToDatabase: true,
    });

    expect(syncSummaries[0]?.syncedCount).toBeGreaterThan(0);

    const { snapshot } = await getMarketDataSnapshot();
    const recipeIngredientIds = [
      ...new Set(
        snapshot.recipes.flatMap((recipe) =>
          recipe.ingredients.map((ingredient) => ingredient.ingredientId),
        ),
      ),
    ];

    const scrapedObservations = snapshot.priceObservations.filter(
      (observation) =>
        observation.storeId === "kroger-mechanicsville" &&
        observation.priceSource === "kroger-weekly-ad-scrape",
    );
    expect(scrapedObservations.length).toBeGreaterThan(0);

    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: snapshot.priceObservations,
      recipeIngredientIds,
    });

    expect(weeklyAdPromotionGatesPass(coverage, "kroger")).toBe(true);

    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: coverage.matchedIngredientCount,
      usesWeeklyAdSource: coverage.usesWeeklyAdSource,
      weeklyAdPromotionPassed: weeklyAdPromotionGatesPass(coverage, "kroger"),
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
  });

  it("skips duplicate observations when an identical fixture ingest runs twice", async () => {
    const ingestInput = {
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          chain: "kroger" as const,
        },
      ],
      zipCode: "23111",
      persistToDatabase: true,
    };

    const firstRun = await runWeeklyAdIngestionForStores(ingestInput);
    expect(firstRun.syncSummaries[0]?.syncedCount).toBeGreaterThan(0);

    const countAfterFirst = await countLivePriceObservationsForStore(
      "kroger-mechanicsville",
    );
    expect(countAfterFirst).toBeGreaterThan(0);

    const secondRun = await runWeeklyAdIngestionForStores(ingestInput);
    expect(secondRun.syncSummaries[0]?.syncedCount).toBe(0);
    expect(secondRun.syncSummaries[0]?.skippedCount).toBeGreaterThan(0);

    const countAfterSecond = await countLivePriceObservationsForStore(
      "kroger-mechanicsville",
    );
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

const HASH_STORE_ID = "kroger-mechanicsville";
const WEEKLY_AD_SOURCE = "kroger-weekly-ad-scrape";

function flyerOffer(input: {
  ingredientId: string;
  productName: string;
  price: number;
  observedAt?: string;
}): WeeklyAdOffer {
  return {
    chain: "kroger",
    storeId: HASH_STORE_ID,
    ingredientId: input.ingredientId,
    productName: input.productName,
    price: input.price,
    saleLabel: "Weekly special",
    sourceUrl: "https://example.test/ad",
    observedAt: input.observedAt ?? "2026-10-26T07:00:00.000Z",
    confidenceScore: 0.9,
    matchConfidence: 0.9,
  };
}

function flyerResult(offers: WeeklyAdOffer[]): WeeklyAdIngestionResult {
  return {
    chain: "kroger",
    label: "Kroger",
    status: "cached",
    provenance: "weekly-ad-scrape",
    retrievalMode: "cached",
    configured: true,
    fallbackUsed: false,
    message: "Unchanged flyer",
    fetchedAt: "2026-10-27T07:00:00.000Z",
    termsNote: "Fixture weekly-ad terms.",
    offers,
  };
}

async function insertFlyerRow(input: {
  ingredientId: string;
  productName: string;
  price: number;
  observedAt: Date;
  validThrough: Date | null;
  sourceName?: string;
  sourceKind?: string;
}) {
  const sourceName = input.sourceName ?? WEEKLY_AD_SOURCE;
  await getDbPool().query(
    `
      insert into price_observations (
        store_id, ingredient_id, price, in_stock, observed_at,
        source_name, source_record_id, last_verified_at, valid_through, source_kind
      ) values ($1, $2, $3, true, $4, $5, $6, $4, $7, $8)
    `,
    [
      HASH_STORE_ID,
      input.ingredientId,
      input.price,
      input.observedAt.toISOString(),
      sourceName,
      `${HASH_STORE_ID}:${input.ingredientId}:${input.productName}`,
      input.validThrough?.toISOString() ?? null,
      input.sourceKind ?? "weekly-ad",
    ],
  );
}

async function readFlyerRows(sourceName: string) {
  const result = await getDbPool().query<{
    id: string;
    ingredient_id: string;
    price: string;
    observed_at: Date;
    last_verified_at: Date;
  }>(
    `
      select id::text, ingredient_id, price::text, observed_at, last_verified_at
      from price_observations
      where store_id = $1 and source_name = $2
      order by ingredient_id
    `,
    [HASH_STORE_ID, sourceName],
  );
  return result.rows;
}

function sameInstant(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) < 1000;
}

describe("unchanged weekly-ad flyer hash", () => {
  const originalFlyerHash = process.env.YUM4LESS_FLYER_HASH;
  const originalMaxUnverifiedDays = process.env.YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS;

  beforeEach(async () => {
    process.env.YUM4LESS_FLYER_HASH = "1";
    delete process.env.YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS;
    await deletePriceObservationsForStore(HASH_STORE_ID);
    await getDbPool().query(`delete from weekly_ad_flyer_hashes where chain = 'kroger'`);
  });

  afterEach(async () => {
    await deletePriceObservationsForStore(HASH_STORE_ID);
    await getDbPool().query(`delete from price_observations where store_id = any($1::text[])`, [
      ["flyer-per-store-a", "flyer-per-store-b", "flyer-per-store-c"],
    ]);
    await getDbPool().query(`delete from stores where id = any($1::text[])`, [
      ["flyer-per-store-a", "flyer-per-store-b", "flyer-per-store-c"],
    ]);
    await getDbPool().query(`delete from weekly_ad_flyer_hashes where chain = 'kroger'`);
    if (originalFlyerHash === undefined) {
      delete process.env.YUM4LESS_FLYER_HASH;
    } else {
      process.env.YUM4LESS_FLYER_HASH = originalFlyerHash;
    }
    if (originalMaxUnverifiedDays === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS = originalMaxUnverifiedDays;
    }
    await resetDbPoolForTests();
  });

  it("refreshes last_verified_at and leaves observed_at when the hash is unchanged", async () => {
    const observedAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const offer = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([offer]),
      offerCount: 1,
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 4.49,
      observedAt,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      sourceName: "kroger-official-api",
      sourceKind: "official-online",
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([offer]),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.skippedCount).toBe(1);
    expect(summary.message).toContain("skipped PostgreSQL rewrite");

    const [weekly] = await readFlyerRows(WEEKLY_AD_SOURCE);
    const [official] = await readFlyerRows("kroger-official-api");
    expect(weekly).toBeDefined();
    expect(sameInstant(weekly.observed_at, observedAt)).toBe(true);
    expect(weekly.last_verified_at.getTime()).toBeGreaterThan(observedAt.getTime());
    expect(Date.now() - weekly.last_verified_at.getTime()).toBeLessThan(5 * 60 * 1000);
    expect(sameInstant(official.observed_at, observedAt)).toBe(true);
    expect(sameInstant(official.last_verified_at, observedAt)).toBe(true);
  });

  it("does not refresh a row past valid_through", async () => {
    const observedAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const currentOffer = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
    });
    const expiredOffer = flyerOffer({
      ingredientId: "broccoli",
      productName: "Broccoli",
      price: 1.99,
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([currentOffer, expiredOffer]),
      offerCount: 2,
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await insertFlyerRow({
      ingredientId: "broccoli",
      productName: "Broccoli",
      price: 1.99,
      observedAt,
      validThrough: new Date(Date.now() - 60 * 60 * 1000),
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([currentOffer, expiredOffer]),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.message).toContain("skipped PostgreSQL rewrite");
    const rows = await readFlyerRows(WEEKLY_AD_SOURCE);
    const current = rows.find((row) => row.ingredient_id === "chicken-thighs");
    const expired = rows.find((row) => row.ingredient_id === "broccoli");
    expect(current).toBeDefined();
    expect(expired).toBeDefined();
    expect(sameInstant(current!.observed_at, observedAt)).toBe(true);
    expect(current!.last_verified_at.getTime()).toBeGreaterThan(observedAt.getTime());
    expect(sameInstant(expired!.observed_at, observedAt)).toBe(true);
    expect(sameInstant(expired!.last_verified_at, observedAt)).toBe(true);
  });

  it("rewrites when the flyer hash changed", async () => {
    const observedAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const stored = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
    });
    const rewritten = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 6.49,
      observedAt: "2026-10-27T14:00:00.000Z",
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([stored]),
      offerCount: 1,
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([rewritten]),
    });

    expect(summary.syncedCount).toBe(1);
    expect(summary.message).not.toContain("hash unchanged");
    const [row] = await readFlyerRows(WEEKLY_AD_SOURCE);
    expect(Number(row.price)).toBe(6.49);
    expect(row.observed_at.toISOString()).toBe("2026-10-27T14:00:00.000Z");
  });

  it("writes when the chain has no existing rows", async () => {
    const offer = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt: "2026-10-27T14:00:00.000Z",
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([offer]),
      offerCount: 1,
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([offer]),
    });

    expect(summary.syncedCount).toBe(1);
    expect(summary.message).not.toContain("hash unchanged");
    const rows = await readFlyerRows(WEEKLY_AD_SOURCE);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].price)).toBe(5.99);
  });

  it("does not refresh a row observed longer ago than the unverified-day setting", async () => {
    process.env.YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS = "8";
    const tooOld = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    const stillInside = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldOffer = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
    });
    const freshOffer = flyerOffer({
      ingredientId: "broccoli",
      productName: "Broccoli",
      price: 1.99,
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([oldOffer, freshOffer]),
      offerCount: 2,
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt: tooOld,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await insertFlyerRow({
      ingredientId: "broccoli",
      productName: "Broccoli",
      price: 1.99,
      observedAt: stillInside,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([oldOffer, freshOffer]),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.message).toContain("skipped PostgreSQL rewrite");
    const rows = await readFlyerRows(WEEKLY_AD_SOURCE);
    const oldRow = rows.find((row) => row.ingredient_id === "chicken-thighs");
    const insideRow = rows.find((row) => row.ingredient_id === "broccoli");
    expect(oldRow).toBeDefined();
    expect(insideRow).toBeDefined();
    expect(sameInstant(oldRow!.observed_at, tooOld)).toBe(true);
    expect(sameInstant(oldRow!.last_verified_at, tooOld)).toBe(true);
    expect(sameInstant(insideRow!.observed_at, stillInside)).toBe(true);
    expect(insideRow!.last_verified_at.getTime()).toBeGreaterThan(stillInside.getTime());
  });

  it("purges, then skips, then refreshes a row that is 23.5 hours old", async () => {
    const observedAt = new Date(Date.now() - 23.5 * 60 * 60 * 1000);
    const offer = flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
    });
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: weeklyAdFlyerContentHash([offer]),
      offerCount: 1,
    });
    await insertFlyerRow({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price: 5.99,
      observedAt,
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    await purgeStaleRankedPriceObservations();

    const afterPurge = await readFlyerRows(WEEKLY_AD_SOURCE);
    expect(afterPurge).toHaveLength(1);
    expect(sameInstant(afterPurge[0].observed_at, observedAt)).toBe(true);
    expect(sameInstant(afterPurge[0].last_verified_at, observedAt)).toBe(true);

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([offer]),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.message).toContain("skipped PostgreSQL rewrite");
    const [afterRefresh] = await readFlyerRows(WEEKLY_AD_SOURCE);
    expect(sameInstant(afterRefresh.observed_at, observedAt)).toBe(true);
    expect(afterRefresh.last_verified_at.getTime()).toBeGreaterThan(observedAt.getTime());
  });

  it("writes a new flyer to every target store", async () => {
    await resetPerStoreFixtures();
    const offers = [
      storeFlyerOffer("flyer-per-store-a"),
      storeFlyerOffer("flyer-per-store-b"),
    ];

    for (const offer of offers) {
      const summary = await syncWeeklyAdOffersToPriceObservations({
        result: flyerResult([offer]),
        previousFlyerHash: null,
      });
      expect(summary.syncedCount).toBe(1);
      expect(summary.message).not.toContain("hash unchanged");
    }

    expect(await countWeeklyAdRows("flyer-per-store-a")).toBe(1);
    expect(await countWeeklyAdRows("flyer-per-store-b")).toBe(1);
  });

  it("writes the store that lacks rows and refreshes stores that already have this flyer", async () => {
    await resetPerStoreFixtures();
    const observedAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const validThrough = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const sample = storeFlyerOffer("flyer-per-store-a");
    const previousHash = weeklyAdFlyerContentHash([sample]);
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: previousHash,
      offerCount: 1,
    });
    await insertStoreFlyerRow({
      storeId: "flyer-per-store-a",
      observedAt,
      validThrough,
    });
    await insertStoreFlyerRow({
      storeId: "flyer-per-store-b",
      observedAt,
      validThrough,
    });

    const summaries = [];
    for (const storeId of ["flyer-per-store-a", "flyer-per-store-b", "flyer-per-store-c"]) {
      summaries.push(
        await syncWeeklyAdOffersToPriceObservations({
          result: flyerResult([storeFlyerOffer(storeId)]),
          previousFlyerHash: previousHash,
        }),
      );
    }

    expect(summaries[0]?.syncedCount).toBe(0);
    expect(summaries[0]?.message).toContain("flyer-per-store-a");
    expect(summaries[0]?.message).toContain("skipped PostgreSQL rewrite");
    expect(summaries[1]?.syncedCount).toBe(0);
    expect(summaries[1]?.message).toContain("flyer-per-store-b");
    expect(summaries[2]?.syncedCount).toBe(1);
    expect(summaries[2]?.message).toContain("flyer-per-store-c");
    expect(summaries[2]?.message).not.toContain("hash unchanged");

    const covered = await readStoreFlyerRow("flyer-per-store-a");
    const missing = await readStoreFlyerRow("flyer-per-store-c");
    expect(covered).toBeDefined();
    expect(sameInstant(covered!.observed_at, observedAt)).toBe(true);
    expect(covered!.last_verified_at.getTime()).toBeGreaterThan(observedAt.getTime());
    expect(missing).toBeDefined();
    expect(Number(missing!.price)).toBe(5.99);
    expect(await countWeeklyAdRows("flyer-per-store-b")).toBe(1);
  });

  it("writes when the chain hash matches and no target store has rows", async () => {
    await resetPerStoreFixtures();
    const sample = storeFlyerOffer("flyer-per-store-a");
    const previousHash = weeklyAdFlyerContentHash([sample]);
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: previousHash,
      offerCount: 1,
    });

    for (const storeId of ["flyer-per-store-a", "flyer-per-store-b"]) {
      const summary = await syncWeeklyAdOffersToPriceObservations({
        result: flyerResult([storeFlyerOffer(storeId)]),
        previousFlyerHash: previousHash,
      });
      expect(summary.syncedCount).toBe(1);
      expect(summary.message).not.toContain("hash unchanged");
    }

    expect(await countWeeklyAdRows("flyer-per-store-a")).toBe(1);
    expect(await countWeeklyAdRows("flyer-per-store-b")).toBe(1);
  });

  it("writes a store that only has rows from a different flyer", async () => {
    await resetPerStoreFixtures();
    const chicken = storeFlyerOffer("flyer-per-store-b");
    const previousHash = weeklyAdFlyerContentHash([chicken]);
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: previousHash,
      offerCount: 1,
    });
    await insertStoreFlyerRow({
      storeId: "flyer-per-store-b",
      ingredientId: "broccoli",
      productName: "Broccoli",
      price: 1.99,
      observedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const summary = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([chicken]),
      previousFlyerHash: previousHash,
    });

    expect(summary.syncedCount).toBe(1);
    expect(summary.message).not.toContain("hash unchanged");
    const rows = await readStoreFlyerRows("flyer-per-store-b");
    expect(rows.some((row) => row.ingredient_id === "chicken-thighs")).toBe(true);
  });

  it("writes the new price to later stores when an earlier store already saved the new hash", async () => {
    await resetPerStoreFixtures();
    const oldOffer = storeFlyerOffer("flyer-per-store-b", 5.99);
    const previousHash = weeklyAdFlyerContentHash([oldOffer]);
    await rememberWeeklyAdFlyerHash({
      chain: "kroger",
      contentHash: previousHash,
      offerCount: 1,
    });
    await insertStoreFlyerRow({
      storeId: "flyer-per-store-b",
      price: 5.99,
      observedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      validThrough: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const first = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([storeFlyerOffer("flyer-per-store-a", 6.49)]),
      previousFlyerHash: previousHash,
    });
    const second = await syncWeeklyAdOffersToPriceObservations({
      result: flyerResult([storeFlyerOffer("flyer-per-store-b", 6.49)]),
      previousFlyerHash: previousHash,
    });

    expect(first.syncedCount).toBe(1);
    expect(second.syncedCount).toBe(1);
    const rewritten = await readStoreFlyerRow("flyer-per-store-b");
    expect(Number(rewritten?.price)).toBe(6.49);
  });
});

const PER_STORE_IDS = ["flyer-per-store-a", "flyer-per-store-b", "flyer-per-store-c"];

function storeFlyerOffer(storeId: string, price = 5.99): WeeklyAdOffer {
  return {
    ...flyerOffer({
      ingredientId: "chicken-thighs",
      productName: "Chicken thighs",
      price,
    }),
    storeId,
  };
}

async function resetPerStoreFixtures() {
  const pool = getDbPool();
  await pool.query(`delete from price_observations where store_id = any($1::text[])`, [
    PER_STORE_IDS,
  ]);
  await pool.query(
    `
      insert into stores (
        id, name, kind, city, state, latitude, longitude, source_name, source_store_id
      )
      select id, 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.610000, -77.330000,
        'kroger-weekly-ad-scrape', id
      from unnest($1::text[]) as id
      on conflict (id) do nothing
    `,
    [PER_STORE_IDS],
  );
}

async function insertStoreFlyerRow(input: {
  storeId: string;
  ingredientId?: string;
  productName?: string;
  price?: number;
  observedAt: Date;
  validThrough: Date | null;
}) {
  const ingredientId = input.ingredientId ?? "chicken-thighs";
  const productName = input.productName ?? "Chicken thighs";
  const price = input.price ?? 5.99;
  await getDbPool().query(
    `
      insert into price_observations (
        store_id, ingredient_id, price, in_stock, observed_at,
        source_name, source_record_id, last_verified_at, valid_through, source_kind
      ) values ($1, $2, $3, true, $4, $5, $6, $4, $7, 'weekly-ad')
    `,
    [
      input.storeId,
      ingredientId,
      price,
      input.observedAt.toISOString(),
      WEEKLY_AD_SOURCE,
      `${input.storeId}:${ingredientId}:${productName}`,
      input.validThrough?.toISOString() ?? null,
    ],
  );
}

async function readStoreFlyerRows(storeId: string) {
  const result = await getDbPool().query<{
    ingredient_id: string;
    price: string;
    observed_at: Date;
    last_verified_at: Date;
  }>(
    `
      select ingredient_id, price::text, observed_at, last_verified_at
      from price_observations
      where store_id = $1 and source_name = $2
      order by ingredient_id
    `,
    [storeId, WEEKLY_AD_SOURCE],
  );
  return result.rows;
}

async function readStoreFlyerRow(storeId: string) {
  const rows = await readStoreFlyerRows(storeId);
  return rows[0];
}

async function countWeeklyAdRows(storeId: string) {
  const rows = await readStoreFlyerRows(storeId);
  return rows.length;
}
