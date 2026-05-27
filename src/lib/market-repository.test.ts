import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import { getMarketDataSnapshot } from "@/lib/market-repository";

describe("getMarketDataSnapshot", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("returns unavailable with an empty snapshot when DATABASE_URL is missing", async () => {
    getDbPool.mockImplementation(() => {
      throw new Error("DATABASE_URL is not configured.");
    });

    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("unavailable");
    expect(result.snapshot.stores).toHaveLength(0);
    expect(result.snapshot.recipes).toHaveLength(0);
    expect(result.snapshot.priceObservations).toHaveLength(0);
  });

  it("maps database query results into the normalized market snapshot", async () => {
    getDbPool.mockReturnValue({
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: "kroger-1",
              name: "Kroger Mechanicsville",
              kind: "grocery",
              city: "Mechanicsville",
              state: "VA",
              latitude: "37.6085",
              longitude: "-77.3321",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "lemon-chicken",
              title: "Weeknight Lemon Chicken",
              summary: "A low-cost dinner with one easy store trip.",
              cook_time_minutes: 35,
              difficulty: "easy",
              tags: ["family-friendly"],
              dietary_tags: ["quick"],
              steps: ["Roast everything together."],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              recipe_id: "lemon-chicken",
              ingredient_id: "chicken-thighs",
              display_name: "Chicken thighs",
              quantity_note: "2 lb family pack",
              sort_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              store_id: "kroger-1",
              ingredient_id: "chicken-thighs",
              price: "6.49",
              sale_label: "Weekly deal",
              in_stock: true,
              freshness_days_ago: 1,
            },
          ],
        }),
    });

    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("database");
    expect(result.snapshot.stores).toEqual([
      expect.objectContaining({
        id: "kroger-1",
        latitude: 37.6085,
        longitude: -77.3321,
      }),
    ]);
    expect(result.snapshot.recipes).toEqual([
      expect.objectContaining({
        id: "lemon-chicken",
        dietaryTags: ["quick"],
        ingredients: [
          {
            ingredientId: "chicken-thighs",
            displayName: "Chicken thighs",
            quantityNote: "2 lb family pack",
          },
        ],
      }),
    ]);
    expect(result.snapshot.priceObservations).toEqual([
      {
        storeId: "kroger-1",
        ingredientId: "chicken-thighs",
        price: 6.49,
        saleLabel: "Weekly deal",
        freshnessDaysAgo: 1,
        inStock: true,
      },
    ]);
  });
});
