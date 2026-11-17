import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  SECURITY_HEADER_SOURCE,
  securityHeaderSourceMatches,
  securityResponseHeaders,
} from "@/lib/security-response-headers";

const COVERED_PATHS = ["/", "/faq", "/api/recommendations"] as const;

describe("security response headers", () => {
  it.each(COVERED_PATHS)("applies the safety headers on %s", async (pathname) => {
    expect(securityHeaderSourceMatches(SECURITY_HEADER_SOURCE, pathname)).toBe(true);

    const rules = await nextConfig.headers?.();
    expect(rules).toBeDefined();

    const matched = (rules ?? []).filter((rule) =>
      securityHeaderSourceMatches(rule.source, pathname),
    );
    expect(matched.length).toBeGreaterThan(0);

    const headers = new Map(
      matched.flatMap((rule) => rule.headers.map((header) => [header.key, header.value] as const)),
    );

    for (const header of securityResponseHeaders()) {
      expect(headers.get(header.key)).toBe(header.value);
    }

    expect(headers.has("Content-Security-Policy")).toBe(false);
    const policy = headers.get("Content-Security-Policy-Report-Only") ?? "";
    expect(policy).not.toMatch(/report-uri|report-to/i);
    expect(policy).toContain("https://*.tile.openstreetmap.org");
    expect(policy).toContain("https://static.cloudflareinsights.com");
    expect(policy).toContain("https://cloudflareinsights.com");
    expect(policy).toContain("https://www.themealdb.com");
    expect(policy).toContain("font-src 'self'");
  });
});
