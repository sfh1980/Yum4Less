import { afterEach, describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  getClientIp,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;

describe("rate-limit", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = originalTrustProxy;
    }
  });

  it("allows requests under the configured limit", () => {
    const config = { windowMs: 60_000, maxRequests: 2 };

    expect(consumeRateLimit("test-key", config)).toEqual({ ok: true });
    expect(consumeRateLimit("test-key", config)).toEqual({ ok: true });
    expect(consumeRateLimit("test-key", config)).toEqual({
      ok: false,
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("ignores forwarded headers unless proxy trust is enabled", () => {
    delete process.env.TRUST_PROXY_HEADERS;

    const request = new Request("http://localhost/api/recommendations", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("uses forwarded headers when proxy trust is enabled", () => {
    process.env.TRUST_PROXY_HEADERS = "1";

    const request = new Request("http://localhost/api/recommendations", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("uses x-real-ip when proxy trust is enabled and forwarded-for is absent", () => {
    process.env.TRUST_PROXY_HEADERS = "1";

    const request = new Request("http://localhost/api/geocode/zip", {
      headers: {
        "x-real-ip": "198.51.100.5",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.5");
  });

  it("shares one rate-limit bucket for unknown IPs when proxy trust is off", () => {
    delete process.env.TRUST_PROXY_HEADERS;
    const config = { windowMs: 60_000, maxRequests: 1 };

    const firstClient = new Request("http://localhost/api/market-search", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const secondClient = new Request("http://localhost/api/market-search", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });

    expect(consumeRateLimit(`apiMarketSearch:${getClientIp(firstClient)}`, config)).toEqual({
      ok: true,
    });
    expect(consumeRateLimit(`apiMarketSearch:${getClientIp(secondClient)}`, config)).toEqual({
      ok: false,
      retryAfterSeconds: expect.any(Number),
    });
  });
});
