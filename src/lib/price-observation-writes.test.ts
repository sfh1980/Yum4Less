import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import {
  insertPriceObservationIfChanged,
  priceObservationsMateriallyMatch,
} from "@/lib/price-observation-writes";
import { KROGER_OFFICIAL_PRICE_SOURCE } from "@/lib/price-source-policy";

describe("price observation change-aware sync", () => {
  function mockDbPool(query: ReturnType<typeof vi.fn>) {
    const client = {
      query,
      release: vi.fn(),
    };
    getDbPool.mockReturnValue({
      query,
      connect: vi.fn().mockResolvedValue(client),
    });
    return client;
  }

  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("treats matching price, label, source identity, and stock as unchanged", () => {
    expect(
      priceObservationsMateriallyMatch(
        {
          id: 1,
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 6.49,
          saleLabel: "Weekly deal",
          inStock: true,
          sourceName: "kroger-weekly-ad-scrape",
          sourceRecordId:
            "kroger-mechanicsville:chicken-thighs:Kroger Fresh Chicken Thighs",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 6.49,
          saleLabel: "Weekly deal",
          inStock: true,
          sourceName: "kroger-weekly-ad-scrape",
          sourceRecordId:
            "kroger-mechanicsville:chicken-thighs:Kroger Fresh Chicken Thighs",
        },
      ),
    ).toBe(true);
  });

  it("skips insert when the current row materially matches and purges duplicate rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            store_id: "kroger-mechanicsville",
            ingredient_id: "chicken-thighs",
            price: "6.49",
            sale_label: "Weekly deal",
            in_stock: true,
            source_name: "kroger-weekly-ad-scrape",
            source_record_id:
              "kroger-mechanicsville:chicken-thighs:Kroger Fresh Chicken Thighs",
          },
        ],
      })
      .mockResolvedValue({ rowCount: 1 });
    mockDbPool(query);

    const outcome = await insertPriceObservationIfChanged({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 6.49,
      saleLabel: "Weekly deal",
      observedAt: new Date("2026-05-25T12:00:00.000Z"),
      validThrough: new Date("2026-06-01T23:59:59.000Z"),
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId:
        "kroger-mechanicsville:chicken-thighs:Kroger Fresh Chicken Thighs",
      confidenceScore: 0.82,
      notes: "fixture",
    });

    expect(outcome).toBe("skipped-unchanged");
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1]?.[0]).toContain("update price_observations");
    expect(query.mock.calls[2]?.[0]).toContain("delete from price_observations");
    expect(query.mock.calls[2]?.[1]).toEqual([
      "kroger-mechanicsville",
      "chicken-thighs",
      1,
    ]);
  });

  it("replaces weekly-ad rows when official API pricing is ingested", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            store_id: "kroger-mechanicsville",
            ingredient_id: "chicken-thighs",
            price: "5.79",
            sale_label: "Weekly-ad price",
            in_stock: true,
            source_name: "kroger-weekly-ad-scrape",
            source_record_id: "kroger-weekly-ad-chicken-thighs",
          },
        ],
      })
      .mockResolvedValue({ rowCount: 1 });
    mockDbPool(query);

    const outcome = await insertPriceObservationIfChanged({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 3.99,
      observedAt: new Date("2026-06-12T12:00:00.000Z"),
      sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
      sourceRecordId: "0001111000001",
      confidenceScore: 0.9,
      notes: "official api",
    });

    expect(outcome).toBe("inserted");
    expect(query.mock.calls[1]?.[0]).toBe("begin");
    expect(query.mock.calls[2]?.[0]).toContain("delete from price_observations");
    expect(query.mock.calls[2]?.[1]).toEqual([
      "kroger-mechanicsville",
      "chicken-thighs",
      null,
    ]);
    expect(query.mock.calls[3]?.[0]).toContain("insert into price_observations");
    expect(query.mock.calls[4]?.[0]).toBe("commit");
  });

  it("rolls back the delete when insert fails inside the replace transaction", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("select")) {
        return {
          rows: [
            {
              id: 9,
              store_id: "kroger-mechanicsville",
              ingredient_id: "chicken-thighs",
              price: "5.79",
              sale_label: "Weekly-ad price",
              in_stock: true,
              source_name: "kroger-weekly-ad-scrape",
              source_record_id: "kroger-weekly-ad-chicken-thighs",
            },
          ],
        };
      }

      if (sql === "begin" || sql === "rollback" || sql.includes("delete from price_observations")) {
        return { rowCount: 1 };
      }

      if (sql.includes("insert into price_observations")) {
        throw new Error("insert failed");
      }

      return { rowCount: 0 };
    });
    const client = mockDbPool(query);

    await expect(
      insertPriceObservationIfChanged({
        storeId: "kroger-mechanicsville",
        ingredientId: "chicken-thighs",
        price: 3.99,
        observedAt: new Date("2026-06-12T12:00:00.000Z"),
        sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
        sourceRecordId: "0001111000001",
        confidenceScore: 0.9,
        notes: "official api",
      }),
    ).rejects.toThrow("insert failed");

    expect(query.mock.calls[1]?.[0]).toBe("begin");
    expect(query.mock.calls[2]?.[0]).toContain("delete from price_observations");
    expect(query.mock.calls[3]?.[0]).toContain("insert into price_observations");
    expect(query.mock.calls[4]?.[0]).toBe("rollback");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("skips weekly-ad writes when a fresher official API row is current", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: 4,
          store_id: "kroger-mechanicsville",
          ingredient_id: "chicken-thighs",
          price: "3.99",
          sale_label: null,
          in_stock: true,
          source_name: KROGER_OFFICIAL_PRICE_SOURCE,
          source_record_id: "0001111000001",
        },
      ],
    });
    getDbPool.mockReturnValue({ query });

    const outcome = await insertPriceObservationIfChanged({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 5.79,
      observedAt: new Date("2026-06-12T12:00:00.000Z"),
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-weekly-ad-chicken-thighs",
      confidenceScore: 0.82,
      notes: "weekly ad",
    });

    expect(outcome).toBe("skipped-superseded");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
