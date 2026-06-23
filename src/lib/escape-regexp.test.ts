import { describe, expect, it } from "vitest";
import { escapeRegExp, includesWholePhrase } from "@/lib/escape-regexp";

describe("escapeRegExp", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegExp("a+b(c)")).toBe("a\\+b\\(c\\)");
  });
});

describe("includesWholePhrase", () => {
  it("matches whole words only", () => {
    expect(includesWholePhrase("fresh chicken thighs", "chicken")).toBe(true);
    expect(includesWholePhrase("chickenwire", "chicken")).toBe(false);
  });
});
