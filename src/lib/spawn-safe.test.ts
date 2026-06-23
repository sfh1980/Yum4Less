import { describe, expect, it } from "vitest";
import { assertSafeSqlIdentifier } from "../../scripts/lib/spawn-safe.mjs";

describe("spawn-safe", () => {
  it("accepts valid postgres identifiers", () => {
    expect(assertSafeSqlIdentifier("yum4less_test")).toBe("yum4less_test");
    expect(assertSafeSqlIdentifier("provider_search_terms")).toBe(
      "provider_search_terms",
    );
  });

  it("rejects unsafe postgres identifiers", () => {
    expect(() => assertSafeSqlIdentifier("yum4less;drop")).toThrow(/Unsafe/);
    expect(() => assertSafeSqlIdentifier("")).toThrow(/Unsafe/);
  });
});
