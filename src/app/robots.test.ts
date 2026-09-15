import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.ts", () => {
  it("allows the shopper site and disallows /owner and /api/", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(["/owner", "/api/"]);
    expect(result.sitemap).toBeUndefined();
  });
});
