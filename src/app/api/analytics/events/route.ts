import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isAnalyticsEnabled } from "@/lib/analytics/analytics-policy";
import { appendAnalyticsEvent } from "@/lib/analytics/analytics-sink";
import { validateAnalyticsEventPayload } from "@/lib/analytics/analytics-validation";

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
  } catch {
    return NextResponse.json(
      { ok: false, error: "Analytics event could not be recorded." },
      { status: 500 },
    );
  }
}
