import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { countLivePriceObservationsForStore } from "@/lib/market-repository";
import {
  deletePriceObservationsForStore,
  purgeStaleRankedPriceObservations,
} from "@/lib/price-observation-writes";

const STORE_ID = "kroger-mechanicsville";

describe("valid_from ranked read", () => {
  afterEach(async () => {
    await deletePriceObservationsForStore(STORE_ID);
    await resetDbPoolForTests();
  });

  it("hides a future valid_from from the ranked read and does not purge that row", async () => {
    await deletePriceObservationsForStore(STORE_ID);
    const pool = getDbPool();
    await pool.query(
      `
        insert into price_observations (
          store_id, ingredient_id, price, in_stock, observed_at, last_verified_at,
          source_name, source_record_id, valid_through, valid_from
        ) values
          ($1, 'broccoli', 2.00, true, now(), now(),
            'kroger-weekly-ad-scrape', 'valid-from-open', now() + interval '7 days', null),
          ($1, 'chicken-thighs', 1.00, true, now(), now(),
            'kroger-weekly-ad-scrape', 'valid-from-future', now() + interval '14 days', now() + interval '7 days')
      `,
      [STORE_ID],
    );

    expect(await countLivePriceObservationsForStore(STORE_ID)).toBe(1);

    await purgeStaleRankedPriceObservations();
    const left = await pool.query<{ source_record_id: string }>(
      `
        select source_record_id
        from price_observations
        where store_id = $1
        order by source_record_id
      `,
      [STORE_ID],
    );
    expect(left.rows.map((row) => row.source_record_id)).toEqual([
      "valid-from-future",
      "valid-from-open",
    ]);
    expect(await countLivePriceObservationsForStore(STORE_ID)).toBe(1);
  });
});
