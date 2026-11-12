import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitBucketCountForTests,
  resetRateLimitsForTests,
  resetUnsafeProxyTrustWarningForTests,
  warnIfUnsafeProxyTrustConfiguration,
} from "@/lib/rate-limit";

const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;
const originalTrustedProxyVerified = process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED;
const originalHops = process.env.YUM4LESS_TRUSTED_PROXY_HOPS;
const originalClientIpHeader = process.env.YUM4LESS_CLIENT_IP_HEADER;
const originalMaxBuckets = process.env.YUM4LESS_RATE_LIMIT_MAX_BUCKETS;

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
    restoreEnv("YUM4LESS_TRUSTED_PROXY_HOPS", originalHops);
    restoreEnv("YUM4LESS_CLIENT_IP_HEADER", originalClientIpHeader);
    restoreEnv("YUM4LESS_RATE_LIMIT_MAX_BUCKETS", originalMaxBuckets);
    vi.restoreAllMocks();
  });

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

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

  it("does not trust the first forwarded entry when only TRUST_PROXY_HEADERS is set", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    delete process.env.YUM4LESS_TRUSTED_PROXY_HOPS;
    delete process.env.YUM4LESS_CLIENT_IP_HEADER;

    const request = new Request("http://localhost/api/recommendations", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("ignores a spoofed leading entry and reads hops from the right", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "1";

    const oneHop = new Request("http://localhost/api/recommendations", {
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.2" },
    });
    expect(getClientIp(oneHop)).toBe("198.51.100.2");

    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "2";
    const twoHops = new Request("http://localhost/api/recommendations", {
      headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.2, 192.0.2.1" },
    });
    expect(getClientIp(twoHops)).toBe("198.51.100.2");
  });

  it("treats a short forwarded list as unknown", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "2";

    const request = new Request("http://localhost/api/recommendations", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("prefers the named header over the hop count", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "1";
    process.env.YUM4LESS_CLIENT_IP_HEADER = "X-Real-IP";

    const request = new Request("http://localhost/api/geocode/zip", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
        "x-real-ip": "192.0.2.20",
      },
    });

    expect(getClientIp(request)).toBe("192.0.2.20");
  });

  it("treats an invalid address as unknown", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "1";

    const request = new Request("http://localhost/api/recommendations", {
      headers: { "x-forwarded-for": "not-an-ip, 198.51.100.2:8443" },
    });

    expect(getClientIp(request)).toBe("198.51.100.2");

    const invalid = new Request("http://localhost/api/recommendations", {
      headers: { "x-forwarded-for": "203.0.113.10, forwarded" },
    });
    expect(getClientIp(invalid)).toBe("unknown");
  });

  it("removes expired buckets and refuses a new key once the map is full", () => {
    process.env.YUM4LESS_RATE_LIMIT_MAX_BUCKETS = "2";
    const config = { windowMs: 1_000, maxRequests: 1 };
    const now = 1_000_000;

    expect(consumeRateLimit("a", config, now)).toEqual({ ok: true });
    expect(consumeRateLimit("b", config, now)).toEqual({ ok: true });
    expect(consumeRateLimit("c", config, now)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
    expect(consumeRateLimit("a", config, now)).toEqual({
      ok: false,
      retryAfterSeconds: expect.any(Number),
    });
    expect(rateLimitBucketCountForTests()).toBe(2);

    expect(consumeRateLimit("c", config, now + 1_000)).toEqual({ ok: true });
    expect(rateLimitBucketCountForTests()).toBe(1);
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

  it("does not warn when trusted proxy verification and a hop count are set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_HOPS = "1";

    warnIfUnsafeProxyTrustConfiguration();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when proxy trust is on without a hop count or client header", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env.TRUST_PROXY_HEADERS = "1";
    process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED = "1";
    delete process.env.YUM4LESS_TRUSTED_PROXY_HOPS;
    delete process.env.YUM4LESS_CLIENT_IP_HEADER;

    warnIfUnsafeProxyTrustConfiguration();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("YUM4LESS_TRUSTED_PROXY_HOPS"),
    );
  });
});
