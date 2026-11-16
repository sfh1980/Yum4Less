import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  listAreaInterest,
  upsertAreaInterest,
} from "@/lib/area-interest/area-interest-repository";

const ZIPS = ["19104", "20202", "30301"];

describe("area_interest upsert (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query("delete from area_interest where zip = any($1::text[])", [ZIPS]);
    await resetDbPoolForTests();
  });

  it("stores a ZIP, counts a repeat, and lists by request count", async () => {
    const pool = getDbPool();
    const columns = await pool.query<{ column_name: string }>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = 'area_interest'
      `,
    );
    expect(columns.rows.map((row) => row.column_name).sort()).toEqual([
      "first_requested_at",
      "last_requested_at",
      "request_count",
      "zip",
    ]);

    await upsertAreaInterest("30301");
    const first = await listAreaInterest();
    const created = first.find((row) => row.zip === "30301");
    expect(created?.requestCount).toBe(1);

    await upsertAreaInterest("30301");
    await upsertAreaInterest("20202");
    await upsertAreaInterest("20202");
    await upsertAreaInterest("20202");

    const listed = (await listAreaInterest()).filter((row) => ZIPS.includes(row.zip));
    expect(listed.map((row) => [row.zip, row.requestCount])).toEqual([
      ["20202", 3],
      ["30301", 2],
    ]);
    expect(listed.find((row) => row.zip === "30301")?.firstRequestedAt).toBe(
      created?.firstRequestedAt,
    );
    expect(JSON.stringify(listed)).not.toMatch(/session|latitude|email|address/i);
  });
});
