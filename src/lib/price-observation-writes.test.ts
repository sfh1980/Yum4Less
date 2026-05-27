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

describe("price observation change-aware sync", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("treats matching price, label, source identity, and stock as unchanged", () => {
    expect(
      priceObservationsMateriallyMatch(
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

  it("skips insert when the latest row materially matches", async () => {
    getDbPool.mockReturnValue({
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
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
      }),
    });

    const outcome = await insertPriceObservationIfChanged({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 6.49,
      saleLabel: "Weekly deal",
      observedAt: new Date("2026-05-25T12:00:00.000Z"),
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId:
        "kroger-mechanicsville:chicken-thighs:Kroger Fresh Chicken Thighs",
      confidenceScore: 0.82,
      notes: "fixture",
    });

    expect(outcome).toBe("skipped-unchanged");
    expect(getDbPool().query).toHaveBeenCalledTimes(1);
  });
});
