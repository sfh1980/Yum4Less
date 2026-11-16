import type { RateLimitConfig } from "@/lib/rate-limit";

export const AREA_INTEREST_DEFAULT_MAX_PER_MINUTE = 6;
const MAX_PER_MINUTE = 30;

/** Per-IP cap for POST /api/area-interest. Invalid values use the default. */
export function readAreaInterestRateLimit(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const raw = env.YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE?.trim();
  if (!raw) {
    return { windowMs: 60_000, maxRequests: AREA_INTEREST_DEFAULT_MAX_PER_MINUTE };
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PER_MINUTE) {
    return { windowMs: 60_000, maxRequests: AREA_INTEREST_DEFAULT_MAX_PER_MINUTE };
  }

  return { windowMs: 60_000, maxRequests: parsed };
}
