import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import {
  countRankableThemealdbRecipes,
  ensureThemealdbRecipesForSearch,
  shouldRefreshThemealdbRecipesOnSearch,
} from "@/lib/recipe-import/ensure-themealdb-recipes-for-search";
import { runSaleDrivenThemealdbImport } from "@/lib/recipe-import/sale-driven-themealdb-import";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";

vi.mock("@/lib/recipe-import/sale-driven-themealdb-import", () => ({
  runSaleDrivenThemealdbImport: vi.fn(async () => ({
    saleIngredientCount: 0,
    apiFilterCalls: 0,
    candidateMealCount: 0,
    importedCount: 0,
    skipped: [],
    imported: [],
    aliasSavedCount: 0,
    newIngredientCount: 0,
  })),
}));

vi.mock("@/lib/db", () => ({
  getDbPool: vi.fn(() => ({
    query: vi.fn(async () => ({ rows: [{ latest_import_at: null }] })),
  })),
}));

const themealdbRecipe: CatalogRecipeRecord = {
  id: "themealdb-52772-teriyaki",
  title: "Teriyaki Chicken",
  summary: "Sale-matched import",
  cookTimeMinutes: 45,
  difficulty: "medium",
  tags: ["chicken"],
  dietaryTags: [],
  ingredients: [
    { ingredientId: "chicken-breast", displayName: "Chicken", quantityNote: "1 lb" },
    { ingredientId: "soy-sauce", displayName: "Soy sauce", quantityNote: "2 tbsp" },
    { ingredientId: "garlic", displayName: "Garlic", quantityNote: "2 cloves" },
  ],
  steps: ["Cook"],
  sourceName: THEMEALDB_SOURCE_NAME,
  sourceRecipeId: "52772",
  eligibleForRanking: false,
};

const saleIngredientIds = new Set([
  "chicken-breast",
  "soy-sauce",
  "garlic",
  "onion",
]);

describe("shouldRefreshThemealdbRecipesOnSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips refresh when rankable recipes exist and cache is fresh", () => {
    expect(
      shouldRefreshThemealdbRecipesOnSearch({
        recipes: [themealdbRecipe],
        saleIngredientIds,
        latestImportAt: new Date(),
      }),
    ).toBe(false);
  });

  it("requests refresh when no rankable recipes exist and imports cache is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));

    expect(
      shouldRefreshThemealdbRecipesOnSearch({
        recipes: [themealdbRecipe],
        saleIngredientIds: new Set(["onion"]),
        latestImportAt: new Date("2026-06-08T12:00:00Z"),
      }),
    ).toBe(true);
  });

  it("skips refresh when no rankable recipes exist but imports cache is fresh", () => {
    expect(
      shouldRefreshThemealdbRecipesOnSearch({
        recipes: [themealdbRecipe],
        saleIngredientIds: new Set(["onion"]),
        latestImportAt: new Date(),
      }),
    ).toBe(false);
  });

  it("requests refresh when cache is stale even if recipes exist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));

    expect(
      shouldRefreshThemealdbRecipesOnSearch({
        recipes: [themealdbRecipe],
        saleIngredientIds,
        latestImportAt: new Date("2026-06-08T12:00:00Z"),
      }),
    ).toBe(true);
  });
});

describe("countRankableThemealdbRecipes", () => {
  it("scopes to selected sale ingredients in ingredient-first mode", () => {
    expect(
      countRankableThemealdbRecipes({
        recipes: [themealdbRecipe],
        saleIngredientIds,
        selectedIngredientIds: ["chicken-breast"],
      }),
    ).toBe(1);

    expect(
      countRankableThemealdbRecipes({
        recipes: [themealdbRecipe],
        saleIngredientIds,
        selectedIngredientIds: ["onion"],
      }),
    ).toBe(0);
  });
});

describe("ensureThemealdbRecipesForSearch", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    delete process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT;
    stubTestNodeEnv("test");
  });

  it("skips Postgres writes when public API write flag is unset", async () => {
    const result = await ensureThemealdbRecipesForSearch({
      recipes: [],
      saleIngredientIds,
      selectedIngredientIds: ["chicken-breast"],
    });

    expect(result.status).toBe("import-skipped");
    expect(runSaleDrivenThemealdbImport).not.toHaveBeenCalled();
  });

  it("never imports from the search path in production", async () => {
    stubTestNodeEnv("production");
    process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT = "1";
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";

    const result = await ensureThemealdbRecipesForSearch({
      recipes: [],
      saleIngredientIds,
      selectedIngredientIds: ["chicken-breast"],
    });

    expect(result.status).toBe("import-skipped");
    expect(runSaleDrivenThemealdbImport).not.toHaveBeenCalled();
  });
});
