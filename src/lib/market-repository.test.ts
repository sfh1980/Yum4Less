import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import {
  getMarketDataSnapshot,
  getMarketPricingContext,
  getRecipeCatalog,
} from "@/lib/market-repository";
import * as serverLog from "@/lib/server-log";

describe("getMarketDataSnapshot", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("returns unavailable with an empty snapshot when DATABASE_URL is missing", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    getDbPool.mockImplementation(() => {
      throw new Error("DATABASE_URL is not configured.");
    });

    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("unavailable");
    expect(result.snapshot.stores).toHaveLength(0);
    expect(result.snapshot.ingredients).toHaveLength(0);
    expect(result.snapshot.recipes).toHaveLength(0);
    expect(result.snapshot.priceObservations).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledWith(
      "market-repository.getMarketDataSnapshot",
      expect.any(Error),
    );
    logSpy.mockRestore();
  });

  it("logs and returns unavailable when a market query fails", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    getDbPool.mockReturnValue({
      query: vi.fn().mockRejectedValue(new Error("connection reset")),
    });

    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("unavailable");
    expect(logSpy).toHaveBeenCalledWith(
      "market-repository.getMarketDataSnapshot",
      expect.objectContaining({ message: "connection reset" }),
    );
    logSpy.mockRestore();
  });

  it("maps database query results into the normalized market snapshot", async () => {
    getDbPool.mockReturnValue({
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("from stores")) {
          return Promise.resolve({
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
          });
        }

        if (sql.includes("from ingredients")) {
          return Promise.resolve({
            rows: [
              {
                id: "chicken-thighs",
                name: "Chicken thighs",
                category: "protein",
              },
            ],
          });
        }

        if (sql.includes("from recipes")) {
          return Promise.resolve({
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
          });
        }

        if (sql.includes("from recipe_ingredients")) {
          return Promise.resolve({
            rows: [
              {
                recipe_id: "lemon-chicken",
                ingredient_id: "chicken-thighs",
                display_name: "Chicken thighs",
                quantity_note: "2 lb family pack",
                sort_order: 1,
              },
            ],
          });
        }

        if (sql.includes("from price_observations")) {
          return Promise.resolve({
            rows: [
              {
                store_id: "kroger-1",
                ingredient_id: "chicken-thighs",
                price: "6.49",
                sale_label: "Weekly deal",
                in_stock: true,
                source_name: "kroger-weekly-ad-scrape",
                confidence_score: "0.82",
                observed_at: new Date("2026-06-12T12:00:00.000Z"),
                last_verified_at: new Date("2026-06-12T12:00:00.000Z"),
                source_tier: 2,
                freshness_hours_ago: 24,
                freshness_days_ago: 1,
              },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    });

    const result = await getMarketDataSnapshot();
    const queryMock = getDbPool().query;

    expect(result.source).toBe("database");
    expect(result.snapshot.stores).toEqual([
      expect.objectContaining({
        id: "kroger-1",
        latitude: 37.6085,
        longitude: -77.3321,
      }),
    ]);
    expect(result.snapshot.ingredients).toEqual([
      {
        id: "chicken-thighs",
        name: "Chicken thighs",
        category: "protein",
      },
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
        freshnessHoursAgo: 24,
        inStock: true,
        priceSource: "kroger-weekly-ad-scrape",
        priceSourceKind: "weekly-ad",
        priceSourceTier: 2,
        matchConfidence: 0.82,
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("valid_through is null or valid_through >= now()"),
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "coalesce(last_verified_at, observed_at) >= now() - interval '24 hours'",
      ),
    );
  });
});

describe("getMarketPricingContext", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("returns unavailable with empty pricing context when DATABASE_URL is missing", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    getDbPool.mockImplementation(() => {
      throw new Error("DATABASE_URL is not configured.");
    });

    const result = await getMarketPricingContext();

    expect(result.source).toBe("unavailable");
    expect(result.stores).toHaveLength(0);
    expect(result.priceObservations).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledWith(
      "market-repository.getMarketPricingContext",
      expect.any(Error),
    );
    logSpy.mockRestore();
  });

  it("loads stores and ranked price observations without recipes", async () => {
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
              store_id: "kroger-1",
              ingredient_id: "chicken-thighs",
              price: "6.49",
              sale_label: "Weekly deal",
              in_stock: true,
              source_name: "kroger-weekly-ad-scrape",
              confidence_score: "0.82",
              observed_at: new Date("2026-06-12T12:00:00.000Z"),
              last_verified_at: new Date("2026-06-12T12:00:00.000Z"),
              source_tier: 2,
              freshness_hours_ago: 24,
              freshness_days_ago: 1,
            },
          ],
        }),
    });

    const result = await getMarketPricingContext();

    expect(result.source).toBe("database");
    expect(result.stores).toHaveLength(1);
    expect(result.priceObservations).toHaveLength(1);
    expect(getDbPool().query).toHaveBeenCalledTimes(2);
  });
});

describe("getRecipeCatalog", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("returns unavailable with empty recipes when DATABASE_URL is missing", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    getDbPool.mockImplementation(() => {
      throw new Error("DATABASE_URL is not configured.");
    });

    const result = await getRecipeCatalog();

    expect(result.source).toBe("unavailable");
    expect(result.recipes).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledWith(
      "market-repository.getRecipeCatalog",
      expect.any(Error),
    );
    logSpy.mockRestore();
  });

  it("loads recipes with joined ingredients only", async () => {
    getDbPool.mockReturnValue({
      query: vi
        .fn()
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
        }),
    });

    const result = await getRecipeCatalog();

    expect(result.source).toBe("database");
    expect(result.recipes).toEqual([
      expect.objectContaining({
        id: "lemon-chicken",
        ingredients: [
          {
            ingredientId: "chicken-thighs",
            displayName: "Chicken thighs",
            quantityNote: "2 lb family pack",
          },
        ],
      }),
    ]);
    expect(getDbPool().query).toHaveBeenCalledTimes(2);
  });
});
