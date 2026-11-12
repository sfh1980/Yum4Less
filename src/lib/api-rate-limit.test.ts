import { afterEach, describe, expect, it } from "vitest";
import {
  enforceApiRateLimit,
  rateLimitResponse,
} from "@/lib/api-rate-limit";
import { RATE_LIMITS, resetRateLimitsForTests } from "@/lib/rate-limit";

const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;
const originalHops = process.env.YUM4LESS_TRUSTED_PROXY_HOPS;

describe("api-rate-limit", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = originalTrustProxy;
    }
    if (originalHops === undefined) {
      delete process.env.YUM4LESS_TRUSTED_PROXY_HOPS;
    } else {
      process.env.YUM4LESS_TRUSTED_PROXY_HOPS = originalHops;
    }
  });

  it("rate limits distinct clients when proxy trust is enabled", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "1";
    const config = RATE_LIMITS.apiMarketSearch;

    const first = new Request("http://localhost/api/market-search", {
      headers: { "x-forwarded-for": "203.0.113.50, 198.51.100.2" },
    });
    const second = new Request("http://localhost/api/market-search", {
      headers: { "x-forwarded-for": "203.0.113.99, 192.0.2.8" },
    });

    for (let index = 0; index < config.maxRequests; index += 1) {
      expect(enforceApiRateLimit(first, "apiMarketSearch")).toEqual({ ok: true });
    }

    expect(enforceApiRateLimit(first, "apiMarketSearch")).toEqual({
      ok: false,
      retryAfterSeconds: expect.any(Number),
    });
    expect(enforceApiRateLimit(second, "apiMarketSearch")).toEqual({ ok: true });
  });

  it("returns a generic 429 JSON body with Retry-After", async () => {
    const limited = {
      ok: false as const,
      retryAfterSeconds: 42,
    };
    const response = rateLimitResponse(limited);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Too many requests. Please wait and try again.",
    });
  });
});
