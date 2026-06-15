import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import { getProviderSearchTerms } from "@/lib/provider-search-terms";

function mockPool(rows: Array<{
  ingredient_id: string;
  ingredient_name: string;
  search_term: string;
  priority?: number;
}>) {
  return {
    query: vi.fn().mockResolvedValue({
      rows: rows.map((row, index) => ({
        ...row,
        priority: row.priority ?? index + 1,
        notes: null,
      })),
    }),
  } as unknown as Pool;
}

describe("getProviderSearchTerms", () => {
  it("maps seeded Kroger rows to provider preview ingredients", async () => {
    const pool = mockPool([
      {
        ingredient_id: "chicken-thighs",
        ingredient_name: "Chicken thighs",
        search_term: "chicken thigh",
      },
      {
        ingredient_id: "lemon",
        ingredient_name: "Lemon",
        search_term: "lemon",
      },
    ]);

    const terms = await getProviderSearchTerms("kroger", pool);

    expect(terms).toEqual([
      {
        ingredientId: "chicken-thighs",
        ingredientName: "Chicken thighs",
        searchTerm: "chicken thigh",
      },
      {
        ingredientId: "lemon",
        ingredientName: "Lemon",
        searchTerm: "lemon",
      },
    ]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("provider_search_terms"), [
      "kroger",
    ]);
  });

  it("falls back to static tracked ingredients when no rows exist", async () => {
    const pool = mockPool([]);

    const terms = await getProviderSearchTerms("kroger", pool);

    expect(terms).toEqual(PROVIDER_TRACKED_INGREDIENTS);
  });

  it("maps priority-2 fallback terms when includeFallbackTerms is true", async () => {
    const pool = mockPool([
      {
        ingredient_id: "baby-potatoes",
        ingredient_name: "Baby potatoes",
        search_term: "baby gold potatoes",
      },
      {
        ingredient_id: "baby-potatoes",
        ingredient_name: "Baby potatoes",
        search_term: "petite potatoes",
      },
    ]);

    const terms = await getProviderSearchTerms("kroger", pool, {
      includeFallbackTerms: true,
    });

    expect(terms).toEqual([
      {
        ingredientId: "baby-potatoes",
        ingredientName: "Baby potatoes",
        searchTerm: "baby gold potatoes",
        fallbackSearchTerm: "petite potatoes",
      },
    ]);
  });

  it("falls back when provider is blank", async () => {
    const pool = mockPool([
      {
        ingredient_id: "broccoli",
        ingredient_name: "Broccoli",
        search_term: "broccoli",
      },
    ]);

    const terms = await getProviderSearchTerms("  ", pool);

    expect(terms).toEqual(PROVIDER_TRACKED_INGREDIENTS);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
