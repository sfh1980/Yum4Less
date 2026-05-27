import { NextResponse } from "next/server";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/rate-limit";

export type ApiRateLimitBucket = keyof typeof RATE_LIMITS;

export function enforceApiRateLimit(
  request: Request,
  bucket: ApiRateLimitBucket,
): RateLimitResult {
  // Bucket key is per-route + client IP (or shared "unknown" without proxy trust).
  const ip = getClientIp(request);
  return consumeRateLimit(`${bucket}:${ip}`, RATE_LIMITS[bucket]);
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
