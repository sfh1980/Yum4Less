import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  purgeStaleRankedPriceObservations,
  rankedPricePurgeSourceName,
} from "@/lib/price-observation-writes";

const STORE_ID = "kroger-mechanicsville";
const PUBLIX_RECORD = "purge-limit-publix";
const ALDI_RECORD = "purge-limit-aldi";

describe("ranked purge source limit", () => {
  afterEach(async () => {
    await getDbPool().query(
      `delete from price_observations where source_record_id = any($1::text[])`,
      [[PUBLIX_RECORD, ALDI_RECORD]],
    );
    await resetDbPoolForTests();
  });

  it("rejects a source name that is not a single token", () => {
    expect(rankedPricePurgeSourceName(undefined)).toBeNull();
    expect(rankedPricePurgeSourceName("publix-weekly-ad-scrape")).toBe(
      "publix-weekly-ad-scrape",
    );
    expect(() => rankedPricePurgeSourceName("publix; delete")).toThrow(/not usable/);
  });

  it("deletes only the named source when that source's rows are already ended", async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from price_observations where source_record_id = any($1::text[])`,
      [[PUBLIX_RECORD, ALDI_RECORD]],
    );
    await pool.query(
      `
        insert into price_observations (
          store_id, ingredient_id, price, in_stock, observed_at, last_verified_at,
          source_name, source_record_id, valid_through
        ) values
          ($1, 'broccoli', 2.00, true, now(), now(),
            'publix-weekly-ad-scrape', $2, now() - interval '1 day'),
          ($1, 'chicken-thighs', 3.00, true, now(), now(),
            'aldi-weekly-ad-scrape', $3, now() - interval '1 day')
      `,
      [STORE_ID, PUBLIX_RECORD, ALDI_RECORD],
    );

    await purgeStaleRankedPriceObservations({
      sourceName: "publix-weekly-ad-scrape",
    });

    const left = await pool.query<{ source_name: string }>(
      `
        select source_name
        from price_observations
        where source_record_id = any($1::text[])
        order by source_name
      `,
      [[PUBLIX_RECORD, ALDI_RECORD]],
    );
    expect(left.rows.map((row) => row.source_name)).toEqual(["aldi-weekly-ad-scrape"]);
  });
});
