import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import { getSaleIngredientIdsForRanking } from "@/lib/recipe-import/recipe-ranking-eligibility";
import { getOnSaleCatalogIngredientIds } from "@/lib/recipe-import/sale-ingredient-query";

describe("sale ingredient query freshness gating", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("uses the shared 24-hour freshness gate so stale weekly-ad rows are excluded", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      expect(sql).toContain("coalesce(last_verified_at, observed_at) >= now() - interval '24 hours'");

      if (sql.includes("join ingredients")) {
        return Promise.resolve({
          rows: [{ ingredient_id: "broccoli", name: "Broccoli" }],
        });
      }

      return Promise.resolve({
        rows: [{ ingredient_id: "broccoli" }],
      });
    });

    getDbPool.mockReturnValue({ query });

    await expect(getOnSaleCatalogIngredientIds()).resolves.toEqual([
      { ingredientId: "broccoli", ingredientName: "Broccoli" },
    ]);
    await expect(getSaleIngredientIdsForRanking()).resolves.toEqual(new Set(["broccoli"]));
    expect(query).toHaveBeenCalledTimes(2);
  });
});
