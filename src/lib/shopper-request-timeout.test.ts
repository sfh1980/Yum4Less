import { describe, expect, it } from "vitest";
import {
  RANK_TIMEOUT_MS_DEFAULT,
  readRankTimeoutMs,
  readStoreSearchTimeoutMs,
  STORE_SEARCH_TIMEOUT_MS_DEFAULT,
} from "@/lib/shopper-request-timeout";

describe("shopper request timeouts", () => {
  it("uses the defaults when the settings are unset or out of range", () => {
    expect(readStoreSearchTimeoutMs({})).toBe(STORE_SEARCH_TIMEOUT_MS_DEFAULT);
    expect(readRankTimeoutMs({})).toBe(RANK_TIMEOUT_MS_DEFAULT);
    expect(
      readStoreSearchTimeoutMs({ YUM4LESS_STORE_SEARCH_TIMEOUT_MS: "nope" }),
    ).toBe(STORE_SEARCH_TIMEOUT_MS_DEFAULT);
    expect(readRankTimeoutMs({ YUM4LESS_RANK_TIMEOUT_MS: "500" })).toBe(
      RANK_TIMEOUT_MS_DEFAULT,
    );
  });

  it("reads an in-range setting", () => {
    expect(
      readStoreSearchTimeoutMs({ YUM4LESS_STORE_SEARCH_TIMEOUT_MS: "8000" }),
    ).toBe(8000);
    expect(readRankTimeoutMs({ YUM4LESS_RANK_TIMEOUT_MS: "45000" })).toBe(45000);
  });
});
