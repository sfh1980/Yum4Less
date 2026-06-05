/**
 * In-memory, per-process rate limits for public API routes.
 *
 * Limits reset on deploy/restart and do not share state across instances.
 * Behind a reverse proxy, set TRUST_PROXY_HEADERS=1 only when the platform
 * strips spoofable X-Forwarded-For from clients; otherwise all clients share
 * the "unknown" IP bucket. Prefer platform or Redis-backed limits in production.
 */
export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type BucketEntry = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, BucketEntry>();

export const RATE_LIMITS = {
  apiAnalyticsEvents: { windowMs: 60_000, maxRequests: 60 },
  apiFeedback: { windowMs: 60_000, maxRequests: 10 },
  apiMarketSearch: { windowMs: 60_000, maxRequests: 30 },
  apiRecommendations: { windowMs: 60_000, maxRequests: 20 },
  apiShoppingRoute: { windowMs: 60_000, maxRequests: 15 },
  apiGeocodeZip: { windowMs: 60_000, maxRequests: 30 },
  geocodioUpstream: { windowMs: 60_000, maxRequests: 20 },
} as const satisfies Record<string, RateLimitConfig>;

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (entry.count >= config.maxRequests) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.windowStart + config.windowMs - now) / 1000),
      ),
    };
  }

  entry.count += 1;
  return { ok: true };
}

export function getClientIp(request: Request): string {
  // Honor forwarded IP only when TRUST_PROXY_HEADERS=1 and a trusted proxy sets it.
  if (process.env.TRUST_PROXY_HEADERS === "1") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim() || "unknown";
    }
  }

  return "unknown";
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
