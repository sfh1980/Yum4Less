import { describe, expect, it } from "vitest";
import {
  readRecipeImportNeedsYouMornings,
  readThemealdbTimeoutMs,
  RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT,
  THEMEALDB_TIMEOUT_MS_DEFAULT,
} from "@/lib/recipe-import/themealdb-settings";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";

describe("readThemealdbTimeoutMs", () => {
  it("uses the default when the setting is missing or unusable", () => {
    expect(readThemealdbTimeoutMs(buildTestProcessEnv())).toBe(THEMEALDB_TIMEOUT_MS_DEFAULT);
    expect(
      readThemealdbTimeoutMs(
        buildTestProcessEnv({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "soon" }),
      ),
    ).toBe(THEMEALDB_TIMEOUT_MS_DEFAULT);
    expect(
      readThemealdbTimeoutMs(buildTestProcessEnv({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "0" })),
    ).toBe(THEMEALDB_TIMEOUT_MS_DEFAULT);
  });

  it("reads a whole number of milliseconds", () => {
    expect(
      readThemealdbTimeoutMs(
        buildTestProcessEnv({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "20000" }),
      ),
    ).toBe(20_000);
  });
});

describe("readRecipeImportNeedsYouMornings", () => {
  it("defaults to three consecutive mornings", () => {
    expect(readRecipeImportNeedsYouMornings(buildTestProcessEnv())).toBe(
      RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT,
    );
    expect(
      readRecipeImportNeedsYouMornings(
        buildTestProcessEnv({ YUM4LESS_RECIPE_IMPORT_NEEDS_YOU_MORNINGS: "0" }),
      ),
    ).toBe(RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT);
  });

  it("reads a whole number of mornings", () => {
    expect(
      readRecipeImportNeedsYouMornings(
        buildTestProcessEnv({ YUM4LESS_RECIPE_IMPORT_NEEDS_YOU_MORNINGS: "5" }),
      ),
    ).toBe(5);
  });
});
