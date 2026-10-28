import { describe, expect, it } from "vitest";
import {
  readThemealdbTimeoutMs,
  THEMEALDB_TIMEOUT_MS_DEFAULT,
} from "@/lib/recipe-import/themealdb-settings";

describe("readThemealdbTimeoutMs", () => {
  it("uses the default when the setting is missing or unusable", () => {
    expect(readThemealdbTimeoutMs({})).toBe(THEMEALDB_TIMEOUT_MS_DEFAULT);
    expect(readThemealdbTimeoutMs({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "soon" })).toBe(
      THEMEALDB_TIMEOUT_MS_DEFAULT,
    );
    expect(readThemealdbTimeoutMs({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "0" })).toBe(
      THEMEALDB_TIMEOUT_MS_DEFAULT,
    );
  });

  it("reads a whole number of milliseconds", () => {
    expect(readThemealdbTimeoutMs({ YUM4LESS_THEMEALDB_TIMEOUT_MS: "20000" })).toBe(
      20_000,
    );
  });
});
