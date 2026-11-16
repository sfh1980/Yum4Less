import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { summarizeRecentUsage } from "@/lib/analytics/usage-summary";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { publicApiErrorResponse } from "@/lib/public-api-error";

/** Owner-only, read-only usage counts from analytics_events. */
export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerUsage");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Usage summary needs a configured database." },
      { status: 503 },
    );
  }

  try {
    const usage = await summarizeRecentUsage();
    return NextResponse.json({ ok: true, usage });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.usage.GET",
      error,
      "Usage summary could not be loaded.",
      503,
    );
  }
}
