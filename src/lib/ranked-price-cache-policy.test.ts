import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  isWithinRankedPriceCache,
  RANKED_PRICE_CACHE_TTL_HOURS,
  RANKED_PRICE_CACHE_TTL_MINUTES,
  RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE,
  RANKED_PRICE_THROUGH_ONLY_SQL_FILTER,
  RANKED_PRICE_WINDOW_SQL_FILTER,
  rankedPriceCacheMissMessage,
  rankedPriceWindowSql,
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
});
