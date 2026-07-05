import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import {
  getProviderSearchTerms,
  resolveKrogerPreviewTrackedIngredients,
  resolveKrogerSyncTrackedIngredients,
} from "@/lib/provider-search-terms";

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
    expect(terms).toHaveLength(INTERNAL_CATALOG_INGREDIENT_IDS.length);
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

describe("resolveKrogerPreviewTrackedIngredients", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/yum4less_test";
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("loads priority-1 terms from the provided pool", async () => {
    const pool = mockPool([
      {
        ingredient_id: "chicken-thighs",
        ingredient_name: "Chicken thighs",
        search_term: "chicken thigh",
      },
    ]);

    const terms = await resolveKrogerPreviewTrackedIngredients(pool);

    expect(terms).toEqual([
      {
        ingredientId: "chicken-thighs",
        ingredientName: "Chicken thighs",
        searchTerm: "chicken thigh",
      },
    ]);
  });

  it("falls back to full static catalog when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;

    const terms = await resolveKrogerPreviewTrackedIngredients(mockPool([]));

    expect(terms).toEqual(PROVIDER_TRACKED_INGREDIENTS);
    expect(terms).toHaveLength(INTERNAL_CATALOG_INGREDIENT_IDS.length);
  });

  it("falls back to static catalog when the query throws", async () => {
    const pool = {
      query: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as Pool;

    const terms = await resolveKrogerPreviewTrackedIngredients(pool);

    expect(terms).toEqual(PROVIDER_TRACKED_INGREDIENTS);
  });

  it("falls back to static catalog when no rows are returned", async () => {
    const pool = mockPool([]);

    const terms = await resolveKrogerPreviewTrackedIngredients(pool);

    expect(terms).toEqual(PROVIDER_TRACKED_INGREDIENTS);
  });
});

describe("resolveKrogerSyncTrackedIngredients", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/yum4less_test";
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("includes priority-2 fallback terms for sync", async () => {
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

    const terms = await resolveKrogerSyncTrackedIngredients(pool);

    expect(terms).toEqual([
      {
        ingredientId: "baby-potatoes",
        ingredientName: "Baby potatoes",
        searchTerm: "baby gold potatoes",
        fallbackSearchTerm: "petite potatoes",
      },
    ]);
  });
});
