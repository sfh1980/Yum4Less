import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isAnalyticsEnabled } from "@/lib/analytics/analytics-policy";
import {
  ANALYTICS_LIST_LIMITS,
  listRecentAnalyticsEvents,
} from "@/lib/analytics/analytics-repository";
import { appendAnalyticsEvent } from "@/lib/analytics/analytics-sink";
import { validateAnalyticsEventPayload } from "@/lib/analytics/analytics-validation";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { clampListLimit } from "@/lib/list-limit";
import { publicApiErrorResponse } from "@/lib/public-api-error";

/** Owner console: list recent Postgres analytics rows (same admin key as feedback). */
export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiAnalyticsEvents");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = clampListLimit(
    url.searchParams.get("limit"),
    ANALYTICS_LIST_LIMITS.default,
    ANALYTICS_LIST_LIMITS.max,
  );
  const eventName = url.searchParams.get("eventName")?.trim() || undefined;

  try {
    const { events, notice } = await listRecentAnalyticsEvents({
      limit,
      eventName,
    });
    return NextResponse.json({
      ok: true,
      events,
      ...(notice ? { notice } : {}),
    });
  } catch (error) {
    return publicApiErrorResponse(
      "api.analytics.events.GET",
      error,
      "Recent analytics events could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiAnalyticsEvents");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isAnalyticsEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const validated = validateAnalyticsEventPayload(parsedBody.body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  try {
    await appendAnalyticsEvent(validated.event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return publicApiErrorResponse(
      "api.analytics.events",
      error,
      "Analytics event could not be recorded.",
    );
  }
}
