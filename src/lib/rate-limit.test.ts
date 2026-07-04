import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeRateLimit,
  getClientIp,
  resetRateLimitsForTests,
  resetUnsafeProxyTrustWarningForTests,
  warnIfUnsafeProxyTrustConfiguration,
} from "@/lib/rate-limit";

const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;
const originalTrustedProxyVerified = process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED;

describe("rate-limit", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    resetUnsafeProxyTrustWarningForTests();
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = originalTrustProxy;
    }
    if (originalTrustedProxyVerified === undefined) {
      delete process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED;
    } else {
      process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED = originalTrustedProxyVerified;
    }
    vi.restoreAllMocks();
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

  it("warns when TRUST_PROXY_HEADERS=1 is set without verified proxy confirmation", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env.TRUST_PROXY_HEADERS = "1";
    delete process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED;

    warnIfUnsafeProxyTrustConfiguration();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("TRUST_PROXY_HEADERS=1 is set without YUM4LESS_TRUSTED_PROXY_VERIFIED=1"),
    );
  });

  it("does not warn when trusted proxy verification is set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED = "1";

    warnIfUnsafeProxyTrustConfiguration();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
