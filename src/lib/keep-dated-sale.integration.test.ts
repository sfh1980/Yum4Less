import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { loadRankedPriceObservations } from "@/lib/market-pricing-repository";
import {
  insertPriceObservation,
  purgeStaleRankedPriceObservations,
} from "@/lib/price-observation-writes";
import { KEEP_DATED_SALE_UNSEEN_DAYS_ENV } from "@/lib/ranked-price-cache-policy";

const STORE_ID = "keep-dated-sale-store";
const SOURCE = "keep-dated-weekly-ad-scrape";

async function removeRowsThisTestCreated() {
  const pool = getDbPool();
  await pool.query(
    `delete from price_observations where source_record_id like 'keep-dated-%'`,
  );
  await pool.query(`delete from stores where id = $1`, [STORE_ID]);
}

describe("keep dated sales", () => {
  const originalUnseenDays = process.env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV];

  beforeEach(async () => {
    await removeRowsThisTestCreated();
    await getDbPool().query(
      `
        insert into stores (
          id, name, kind, city, state, latitude, longitude, source_name, source_store_id
        ) values (
          $1, 'Keep Dated Sale', 'grocery', 'Test', 'VA', 37.000000, -77.000000,
          $2, $1
        )
      `,
      [STORE_ID, SOURCE],
    );
  });

  afterEach(async () => {
    if (originalUnseenDays === undefined) {
      delete process.env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV];
    } else {
      process.env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV] = originalUnseenDays;
    }
    await removeRowsThisTestCreated();
    await resetDbPoolForTests();
  });

  it("keeps the Tuesday Lidl shape, drops unseen undated and ended rows, and keeps the current offer beside a cheaper future one", async () => {
    delete process.env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV];
    const now = Date.now();
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "broccoli",
      price: 1.29,
      saleLabel: "This week",
      observedAt: new Date(now - 36 * 3_600_000),
      lastVerifiedAt: new Date(now - 36 * 3_600_000),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-lidl-tuesday",
      confidenceScore: 0.9,
      notes: "printed end still ahead, missed by the night search",
      validThrough: new Date(now + 24 * 3_600_000),
    });
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "chicken-thighs",
      price: 2.49,
      saleLabel: "Unseen too long",
      observedAt: new Date(now - 4 * 24 * 3_600_000),
      lastVerifiedAt: new Date(now - 4 * 24 * 3_600_000),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-unseen",
      confidenceScore: 0.9,
      notes: "printed end ahead but last seen past the keep window",
      validThrough: new Date(now + 2 * 24 * 3_600_000),
    });
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "black-beans",
      price: 0.89,
      saleLabel: "No printed end",
      observedAt: new Date(now - 25 * 3_600_000),
      lastVerifiedAt: new Date(now - 25 * 3_600_000),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-undated",
      confidenceScore: 0.9,
      notes: "no printed end, older than 24 hours",
    });
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "lemon",
      price: 0.5,
      saleLabel: "Ended",
      observedAt: new Date(now),
      lastVerifiedAt: new Date(now),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-expired",
      confidenceScore: 0.9,
      notes: "printed end already passed",
      validThrough: new Date(now - 3_600_000),
    });
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "whole-milk",
      price: 4,
      saleLabel: "Current",
      observedAt: new Date(now - 30 * 3_600_000),
      lastVerifiedAt: new Date(now - 30 * 3_600_000),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-current",
      confidenceScore: 0.9,
      notes: "current offer last seen more than 24 hours ago",
      validThrough: new Date(now + 24 * 3_600_000),
    });
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "whole-milk",
      price: 2,
      saleLabel: "Next week",
      observedAt: new Date(now),
      lastVerifiedAt: new Date(now),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-future",
      confidenceScore: 0.9,
      notes: "cheaper offer that has not started",
      validFrom: new Date(now + 7 * 24 * 3_600_000),
      validThrough: new Date(now + 14 * 24 * 3_600_000),
    });

    await purgeStaleRankedPriceObservations({ sourceName: SOURCE });

    const left = await getDbPool().query<{ source_record_id: string }>(
      `
        select source_record_id
        from price_observations
        where store_id = $1
          and source_record_id like 'keep-dated-%'
        order by source_record_id
      `,
      [STORE_ID],
    );
    expect(left.rows.map((row) => row.source_record_id)).toEqual([
      "keep-dated-current",
      "keep-dated-future",
      "keep-dated-lidl-tuesday",
    ]);

    const ranked = (await loadRankedPriceObservations()).filter(
      (row) => row.storeId === STORE_ID,
    );
    expect(ranked.map((row) => `${row.ingredientId}:${row.price}`).sort()).toEqual([
      "broccoli:1.29",
      "whole-milk:4",
    ]);
  });

  it("drops a dated row once it has been unseen longer than the setting", async () => {
    process.env[KEEP_DATED_SALE_UNSEEN_DAYS_ENV] = "1";
    const now = Date.now();
    await insertPriceObservation({
      storeId: STORE_ID,
      ingredientId: "garlic",
      price: 0.99,
      saleLabel: "Short keep",
      observedAt: new Date(now - 2 * 24 * 3_600_000),
      lastVerifiedAt: new Date(now - 2 * 24 * 3_600_000),
      sourceName: SOURCE,
      sourceRecordId: "keep-dated-short-window",
      confidenceScore: 0.9,
      notes: "inside the default 3 days, outside a 1 day setting",
      validThrough: new Date(now + 5 * 24 * 3_600_000),
    });

    await purgeStaleRankedPriceObservations({ sourceName: SOURCE });

    const left = await getDbPool().query<{ source_record_id: string }>(
      `
        select source_record_id
        from price_observations
        where store_id = $1
          and source_record_id like 'keep-dated-%'
      `,
      [STORE_ID],
    );
    expect(left.rows).toEqual([]);
    const ranked = (await loadRankedPriceObservations()).filter(
      (row) => row.storeId === STORE_ID,
    );
    expect(ranked).toEqual([]);
  });
});
