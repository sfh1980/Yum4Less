import { afterEach, describe, expect, it } from "vitest";
import {
  isThemealdbRecipeCacheFresh,
  isThemealdbSearchImportEnabled,
  THEMEALDB_RECIPE_CACHE_TTL_HOURS,
} from "@/lib/recipe-import/themealdb-recipe-cache-policy";

describe("themealdb-recipe-cache-policy", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSearchImport = process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSearchImport === undefined) {
      delete process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT;
    } else {
      process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT = originalSearchImport;
    }
  });

  it("treats imports within the 24h TTL as fresh", () => {
    const latest = new Date(Date.now() - (THEMEALDB_RECIPE_CACHE_TTL_HOURS - 1) * 3_600_000);
    expect(isThemealdbRecipeCacheFresh(latest)).toBe(true);
  });

  it("treats imports older than the 24h TTL as stale", () => {
    const latest = new Date(Date.now() - (THEMEALDB_RECIPE_CACHE_TTL_HOURS + 1) * 3_600_000);
    expect(isThemealdbRecipeCacheFresh(latest)).toBe(false);
  });

  it("defaults search import on in non-production unless explicitly disabled", () => {
    process.env.NODE_ENV = "test";
    delete process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT;
    expect(isThemealdbSearchImportEnabled()).toBe(true);

    process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT = "0";
    expect(isThemealdbSearchImportEnabled()).toBe(false);
  });

  it("requires explicit opt-in for search import in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT;
    expect(isThemealdbSearchImportEnabled()).toBe(false);

    process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT = "1";
    expect(isThemealdbSearchImportEnabled()).toBe(true);
  });
});
