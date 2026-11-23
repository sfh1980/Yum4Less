import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  isRankedSaleVisible,
  isWithinRankedPriceCache,
  KEEP_DATED_SALE_UNSEEN_DAYS_DEFAULT,
  RANKED_PRICE_CACHE_TTL_HOURS,
  RANKED_PRICE_CACHE_TTL_MINUTES,
  RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE,
  RANKED_PRICE_THROUGH_ONLY_SQL_FILTER,
  RANKED_PRICE_WINDOW_SQL_FILTER,
  rankedPriceCacheMissMessage,
  rankedPriceVisibilitySql,
  rankedPriceWindowSql,
  readKeepDatedSaleUnseenDays,
  resetRankedPriceWindowSqlForTests,
} from "@/lib/ranked-price-cache-policy";

describe("ranked-price-cache-policy", () => {
  it("defines a 24-hour cache window", () => {
    expect(RANKED_PRICE_CACHE_TTL_HOURS).toBe(24);
    expect(RANKED_PRICE_CACHE_TTL_MINUTES).toBe(1440);
  });

  it("treats observations within 24 hours as cache-fresh", () => {
    const observedAt = new Date(Date.now() - 23 * 3_600_000);
    expect(isWithinRankedPriceCache(observedAt)).toBe(true);
  });

  it("treats observations older than 24 hours as stale", () => {
    const observedAt = new Date(Date.now() - 25 * 3_600_000);
    expect(isWithinRankedPriceCache(observedAt)).toBe(false);
  });

  it("prefers last_verified_at when present", () => {
    const observedAt = new Date(Date.now() - 48 * 3_600_000);
    const lastVerifiedAt = new Date(Date.now() - 2 * 3_600_000);
    expect(isWithinRankedPriceCache(observedAt, lastVerifiedAt)).toBe(true);
  });

  it("builds cache-miss copy that mentions the daily schedule", () => {
    expect(rankedPriceCacheMissMessage("provider pricing preview")).toContain(
      "24 hours",
    );
    expect(rankedPriceCacheMissMessage("provider pricing preview")).toContain(
      "daily schedule",
    );
    expect(RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE).toContain("not when you search");
  });

  it("does not name valid_from until the column exists, then keeps that filter", async () => {
    resetRankedPriceWindowSqlForTests();
    const missing = {
      query: async () => ({ rows: [{ present: false }] }),
    } as unknown as Pick<Pool, "query">;
    const before = await rankedPriceWindowSql(missing);
    expect(before).toBe(RANKED_PRICE_THROUGH_ONLY_SQL_FILTER);
    expect(before).not.toContain("valid_from");

    let probes = 0;
    const present = {
      query: async () => {
        probes += 1;
        return { rows: [{ present: true }] };
      },
    } as unknown as Pick<Pool, "query">;
    expect(await rankedPriceWindowSql(present)).toBe(RANKED_PRICE_WINDOW_SQL_FILTER);
    expect(await rankedPriceWindowSql(present)).toBe(RANKED_PRICE_WINDOW_SQL_FILTER);
    expect(probes).toBe(1);

    resetRankedPriceWindowSqlForTests();
    const down = {
      query: async () => {
        throw new Error("database starting");
      },
    } as unknown as Pick<Pool, "query">;
    expect(await rankedPriceWindowSql(down)).toBe(RANKED_PRICE_THROUGH_ONLY_SQL_FILTER);
  });

  it("uses 3 days when the keep-dated setting is unset or unusable", () => {
    expect(readKeepDatedSaleUnseenDays({ NODE_ENV: "test" })).toBe(
      KEEP_DATED_SALE_UNSEEN_DAYS_DEFAULT,
    );
    expect(
      readKeepDatedSaleUnseenDays({
        NODE_ENV: "test",
        YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS: " ",
      }),
    ).toBe(3);
    expect(
      readKeepDatedSaleUnseenDays({
        NODE_ENV: "test",
        YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS: "nope",
      }),
    ).toBe(3);
    expect(
      readKeepDatedSaleUnseenDays({
        NODE_ENV: "test",
        YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS: "0",
      }),
    ).toBe(3);
    expect(
      readKeepDatedSaleUnseenDays({
        NODE_ENV: "test",
        YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS: "5",
      }),
    ).toBe(5);
  });

  it("keeps the Tuesday Lidl shape and drops unseen, undated, and ended rows", () => {
    const tuesday = new Date("2026-11-17T08:00:00.000Z");
    const printedEnd = new Date("2026-11-18T23:59:00.000-05:00");
    const lastSeenSunday = new Date("2026-11-15T08:00:00.000Z");

    expect(
      isRankedSaleVisible({
        validThrough: printedEnd,
        lastSeenAt: lastSeenSunday,
        now: tuesday,
        unseenDays: 3,
      }),
    ).toBe(true);

    expect(
      isRankedSaleVisible({
        validThrough: printedEnd,
        lastSeenAt: new Date("2026-11-13T07:00:00.000Z"),
        now: tuesday,
        unseenDays: 3,
      }),
    ).toBe(false);

    expect(
      isRankedSaleVisible({
        validThrough: null,
        lastSeenAt: new Date(tuesday.getTime() - 25 * 3_600_000),
        now: tuesday,
        unseenDays: 3,
      }),
    ).toBe(false);

    expect(
      isRankedSaleVisible({
        validThrough: null,
        lastSeenAt: new Date(tuesday.getTime() - 23 * 3_600_000),
        now: tuesday,
        unseenDays: 3,
      }),
    ).toBe(true);

    expect(
      isRankedSaleVisible({
        validThrough: new Date("2026-11-16T23:59:00.000-05:00"),
        lastSeenAt: tuesday,
        now: tuesday,
        unseenDays: 3,
      }),
    ).toBe(false);
  });

  it("puts the same keep window in the shared SQL", () => {
    const sql = rankedPriceVisibilitySql({ NODE_ENV: "test" });
    expect(sql).toContain("valid_through is null");
    expect(sql).toContain("valid_through is not null");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("valid_through >= now()");
    expect(sql).toContain("interval '3 days'");
    expect(
      rankedPriceVisibilitySql({
        NODE_ENV: "test",
        YUM4LESS_KEEP_DATED_SALE_UNSEEN_DAYS: "5",
      }),
    ).toContain("interval '5 days'");
  });
});
