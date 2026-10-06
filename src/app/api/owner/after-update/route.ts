import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  isAfterUpdateCheckId,
  type AfterUpdateCheckId,
} from "@/lib/owner/after-update-checks";
import { runAfterUpdateChecks } from "@/lib/owner/after-update-repository";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerAfterUpdate");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "After-update checks need a configured database." },
      { status: 503 },
    );
  }

  const requested = new URL(request.url).searchParams.get("check");
  let ids: readonly AfterUpdateCheckId[] | undefined;
  if (requested) {
    if (!isAfterUpdateCheckId(requested)) {
      return NextResponse.json(
        { ok: false, error: "Unknown check." },
        { status: 400 },
      );
    }
    ids = [requested];
  }

  try {
    const checks = await runAfterUpdateChecks(ids);
    return NextResponse.json({ ok: true, checks });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.after-update.GET",
      error,
      "After-update checks could not be loaded.",
    );
  }
}
