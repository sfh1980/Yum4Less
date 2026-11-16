import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { summarizeRecentUsage } from "@/lib/analytics/usage-summary";
import {
  listAreaInterest,
  type AreaInterestRow,
} from "@/lib/area-interest/area-interest-repository";
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
    const areaInterest = await readAreaInterest();
    return NextResponse.json({
      ok: true,
      usage,
      areaInterest: areaInterest.rows,
      ...(areaInterest.notice ? { areaInterestNotice: areaInterest.notice } : {}),
    });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.usage.GET",
      error,
      "Usage summary could not be loaded.",
      503,
    );
  }
}

async function readAreaInterest(): Promise<{
  rows: AreaInterestRow[];
  notice?: string;
}> {
  try {
    return { rows: await listAreaInterest() };
  } catch {
    return {
      rows: [],
      notice: "Area interest counts need migration 046.",
    };
  }
}
