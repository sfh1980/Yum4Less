/**
 * In-memory, per-process rate limits for public API routes.
 *
 * Limits reset on deploy/restart and do not share state across instances.
 * Behind a reverse proxy, set TRUST_PROXY_HEADERS=1 and either
 * YUM4LESS_TRUSTED_PROXY_HOPS or YUM4LESS_CLIENT_IP_HEADER. Without one of
 * those, every caller shares the "unknown" bucket.
 * Prefer platform or a shared counter store before running more than one app instance.
 */

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export type RateLimitIncrement = {
  key: string;
  now: number;
  windowMs: number;
  maxRequests: number;
};

/** Enough for a later shared store to replace the in-memory map without route changes. */
export type RateLimitCounterStore = {
  increment(input: RateLimitIncrement): RateLimitResult;
};

type BucketEntry = {
  count: number;
  windowStart: number;
  windowMs: number;
};

const DEFAULT_MAX_BUCKETS = 10_000;
const MAX_BUCKET_KEY_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 64;

const buckets = new Map<string, BucketEntry>();

let unsafeProxyTrustWarningLogged = false;
let missingTrustedProxyHopWarningLogged = false;

/**
 * Logs once when TRUST_PROXY_HEADERS=1 without YUM4LESS_TRUSTED_PROXY_VERIFIED=1.
 * Operators must set the verified flag only after a trusted reverse proxy is configured.
 * Also logs once when that flag is on but neither hop count nor a client-address header is set.
 */
export function warnIfUnsafeProxyTrustConfiguration() {
  if (process.env.TRUST_PROXY_HEADERS !== "1") {
    return;
  }

  if (
    !unsafeProxyTrustWarningLogged &&
    process.env.YUM4LESS_TRUSTED_PROXY_VERIFIED !== "1"
  ) {
    unsafeProxyTrustWarningLogged = true;
    console.warn(
      "[Yum4Less] TRUST_PROXY_HEADERS=1 is set without YUM4LESS_TRUSTED_PROXY_VERIFIED=1. " +
        "Clients can spoof X-Forwarded-For and bypass per-IP rate limits unless a trusted " +
        "reverse proxy strips client-supplied forwarding headers.",
    );
  }

  if (missingTrustedProxyHopWarningLogged) {
    return;
  }
  if (readClientIpHeaderName(process.env) || readTrustedProxyHops(process.env)) {
    return;
  }
  missingTrustedProxyHopWarningLogged = true;
  console.warn(
    "[Yum4Less] TRUST_PROXY_HEADERS=1 is set without YUM4LESS_TRUSTED_PROXY_HOPS or YUM4LESS_CLIENT_IP_HEADER. " +
      "Forwarded addresses are ignored and every caller shares the \"unknown\" bucket. " +
      "Set YUM4LESS_TRUSTED_PROXY_HOPS to the number of proxies in front of the app " +
      "(1 uses the last X-Forwarded-For entry), or set YUM4LESS_CLIENT_IP_HEADER to one trusted header that carries a single address.",
  );
}

warnIfUnsafeProxyTrustConfiguration();

export const RATE_LIMITS = {
  apiAnalyticsEvents: { windowMs: 60_000, maxRequests: 60 },
  apiDebugPipeline: { windowMs: 60_000, maxRequests: 10 },
  apiFeedback: { windowMs: 60_000, maxRequests: 10 },
  apiOwnerIngredientReviews: { windowMs: 60_000, maxRequests: 30 },
  apiOwnerStoreCoverage: { windowMs: 60_000, maxRequests: 30 },
  apiOwnerMarkets: { windowMs: 60_000, maxRequests: 20 },
  apiOwnerAfterUpdate: { windowMs: 60_000, maxRequests: 10 },
  apiOwnerMorningReport: { windowMs: 60_000, maxRequests: 10 },
  apiMarketSearch: { windowMs: 60_000, maxRequests: 30 },
  apiRecommendations: { windowMs: 60_000, maxRequests: 20 },
  apiPantryCoverage: { windowMs: 60_000, maxRequests: 40 },
  apiShoppingRoute: { windowMs: 60_000, maxRequests: 15 },
  apiGeocodeZip: { windowMs: 60_000, maxRequests: 30 },
  geocodioUpstream: { windowMs: 60_000, maxRequests: 20 },
} as const satisfies Record<string, RateLimitConfig>;

const memoryRateLimitStore: RateLimitCounterStore = {
  increment(input) {
    return incrementMemoryBucket(input);
  },
};

let rateLimitStore: RateLimitCounterStore = memoryRateLimitStore;

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): RateLimitResult {
  const storedKey = key.length > MAX_BUCKET_KEY_LENGTH ? "overlong" : key;
  return rateLimitStore.increment({
    key: storedKey,
    now,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });
}

export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== "1") {
    return "unknown";
  }

  const headerName = readClientIpHeaderName(process.env);
  if (headerName) {
    const named = request.headers.get(headerName);
    if (named?.trim()) {
      return normalizeClientAddress(named) ?? "unknown";
    }
  }

  const hops = readTrustedProxyHops(process.env);
  if (!hops) {
    return "unknown";
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) {
    return "unknown";
  }
  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < hops) {
    return "unknown";
  }
  const selected = parts[parts.length - hops];
  return normalizeClientAddress(selected ?? "") ?? "unknown";
}

export function resetRateLimitsForTests() {
  buckets.clear();
  rateLimitStore = memoryRateLimitStore;
}

export function resetUnsafeProxyTrustWarningForTests() {
  unsafeProxyTrustWarningLogged = false;
  missingTrustedProxyHopWarningLogged = false;
}

export function rateLimitBucketCountForTests(): number {
  return buckets.size;
}

/** Test hook. Production keeps the in-memory store. */
export function setRateLimitCounterStoreForTests(store: RateLimitCounterStore) {
  rateLimitStore = store;
}

export function readTrustedProxyHops(
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  const raw = env.YUM4LESS_TRUSTED_PROXY_HOPS?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }
  return parsed;
}

export function readRateLimitMaxBuckets(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.YUM4LESS_RATE_LIMIT_MAX_BUCKETS?.trim() ?? "";
  if (!raw) {
    return DEFAULT_MAX_BUCKETS;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000_000) {
    return DEFAULT_MAX_BUCKETS;
  }
  return parsed;
}

function readClientIpHeaderName(env: NodeJS.ProcessEnv): string | null {
  const raw = env.YUM4LESS_CLIENT_IP_HEADER?.trim() ?? "";
  if (!/^[A-Za-z0-9-]{1,64}$/.test(raw)) {
    return null;
  }
  return raw;
}

function incrementMemoryBucket(input: RateLimitIncrement): RateLimitResult {
  pruneExpiredBuckets(input.now);
  const maxBuckets = readRateLimitMaxBuckets();
  const entry = buckets.get(input.key);
  if (!entry || input.now - entry.windowStart >= entry.windowMs) {
    if (!buckets.has(input.key) && buckets.size >= maxBuckets) {
      // A new caller does not get a private bucket once the map is full.
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil(input.windowMs / 1000)),
      };
    }
    buckets.set(input.key, {
      count: 1,
      windowStart: input.now,
      windowMs: input.windowMs,
    });
    return { ok: true };
  }

  if (entry.count >= input.maxRequests) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.windowStart + entry.windowMs - input.now) / 1000),
      ),
    };
  }

  entry.count += 1;
  return { ok: true };
}

function pruneExpiredBuckets(now: number) {
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= entry.windowMs) {
      buckets.delete(key);
    }
  }
}

export function normalizeClientAddress(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > MAX_ADDRESS_LENGTH) {
    return null;
  }
  let address = trimmed;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(address);
  if (bracketed?.[1]) {
    address = bracketed[1];
  } else {
    const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(address);
    if (withPort?.[1]) {
      address = withPort[1];
    }
  }
  if (isIpv4(address)) {
    return address;
  }
  if (isIpv6(address)) {
    return address.toLowerCase();
  }
  return null;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      return false;
    }
    return Number(part) <= 255;
  });
}

function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.includes(":::")) {
    return false;
  }
  const halves = value.split("::");
  if (halves.length > 2) {
    return false;
  }
  const groups = halves.flatMap((half) => (half === "" ? [] : half.split(":")));
  if (groups.some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) {
    return false;
  }
  if (halves.length === 1) {
    return groups.length === 8;
  }
  return groups.length < 8;
}
