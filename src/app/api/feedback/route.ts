import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";
import {
  insertCustomerFeedback,
  listRecentCustomerFeedback,
} from "@/lib/feedback/feedback-repository";
import { validateFeedbackPayload } from "@/lib/feedback/feedback-validation";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiFeedback");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackEnabled()) {
    return NextResponse.json({ ok: true, feedback: [] });
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const feedback = await listRecentCustomerFeedback();
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    return publicApiErrorResponse(
      "api.feedback.GET",
      error,
      "Recent feedback could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiFeedback");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Feedback is not enabled on this server." },
      { status: 503 },
    );
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const validated = validateFeedbackPayload(parsedBody.body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  try {
    const id = await insertCustomerFeedback(validated.feedback);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return publicApiErrorResponse(
      "api.feedback.POST",
      error,
      "Feedback could not be saved.",
    );
  }
}
