import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import { getProviderSearchTerms } from "@/lib/provider-search-terms";

const KROGER_FALLBACK_INGREDIENTS = [
  "baby-potatoes",
  "chicken-broth",
  "frozen-broccoli",
  "frozen-mixed-vegetables",
  "chickpeas",
  "dried-oregano",
  "cornstarch",
  "jalapeno",
  "shredded-cheese-blend",
  "bread-loaf",
] as const;

describe("provider_search_terms (integration)", () => {
  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("loads Kroger seed terms with tuned search strings", async () => {
    const pool = getDbPool();
    const terms = await getProviderSearchTerms("kroger", pool);

    expect(terms).toHaveLength(INTERNAL_CATALOG_INGREDIENT_IDS.length);
    expect(terms.map((term) => term.ingredientId).sort()).toEqual(
      [...INTERNAL_CATALOG_INGREDIENT_IDS].sort(),
    );
    expect(terms).toEqual(
      expect.arrayContaining([
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          searchTerm: "chicken thigh",
        },
        {
          ingredientId: "baby-potatoes",
          ingredientName: "Baby potatoes",
          searchTerm: "baby gold potatoes",
        },
        {
          ingredientId: "broccoli",
          ingredientName: "Broccoli",
          searchTerm: "broccoli",
        },
        {
          ingredientId: "lemon",
          ingredientName: "Lemon",
          searchTerm: "lemon",
        },
        {
          ingredientId: "olive-oil",
          ingredientName: "Olive oil",
          searchTerm: "olive oil",
        },
      ]),
    );
  });

  it("loads priority-2 fallback terms for sync when requested", async () => {
    const pool = getDbPool();
    const terms = await getProviderSearchTerms("kroger", pool, {
      includeFallbackTerms: true,
    });

    const babyPotatoes = terms.find((term) => term.ingredientId === "baby-potatoes");
    expect(babyPotatoes).toEqual({
      ingredientId: "baby-potatoes",
      ingredientName: "Baby potatoes",
      searchTerm: "baby gold potatoes",
      fallbackSearchTerm: "petite potatoes",
    });

    const fallbackTerms = terms.filter((term) => term.fallbackSearchTerm !== undefined);
    expect(fallbackTerms).toHaveLength(KROGER_FALLBACK_INGREDIENTS.length);
    expect(fallbackTerms.map((term) => term.ingredientId).sort()).toEqual(
      [...KROGER_FALLBACK_INGREDIENTS].sort(),
    );

    expect(terms.find((term) => term.ingredientId === "chicken-broth")).toEqual({
      ingredientId: "chicken-broth",
      ingredientName: "Chicken broth",
      searchTerm: "chicken broth",
      fallbackSearchTerm: "chicken stock",
    });

    expect(terms.find((term) => term.ingredientId === "chickpeas")).toEqual({
      ingredientId: "chickpeas",
      ingredientName: "Chickpeas",
      searchTerm: "chickpeas",
      fallbackSearchTerm: "garbanzo beans",
    });

    expect(terms.find((term) => term.ingredientId === "bread-loaf")).toEqual({
      ingredientId: "bread-loaf",
      ingredientName: "Sandwich bread",
      searchTerm: "white sandwich bread",
      fallbackSearchTerm: "bread loaf",
    });
  });
});
