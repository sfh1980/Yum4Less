import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  isMissingMorningReportSchema,
  saveExternalCheck,
} from "@/lib/owner/morning-report-repository";
import {
  morningReportDate,
  type MorningCheckState,
} from "@/lib/owner/morning-report";
import { publicApiErrorResponse } from "@/lib/public-api-error";

const STATES = new Set<MorningCheckState>(["passed", "failed", "not_reported"]);

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerMorningReport");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "The morning note needs a configured database." },
      { status: 503 },
    );
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const body = parsedBody.body as {
    codeTests?: unknown;
    siteCheck?: unknown;
    detail?: unknown;
  };
  if (
    typeof body.codeTests !== "string" ||
    typeof body.siteCheck !== "string" ||
    !STATES.has(body.codeTests as MorningCheckState) ||
    !STATES.has(body.siteCheck as MorningCheckState)
  ) {
    return NextResponse.json(
      { ok: false, error: "The outside check result is invalid." },
      { status: 400 },
    );
  }

  const detail =
    typeof body.detail === "string" ? body.detail.trim().slice(0, 500) : "";

  try {
    await saveExternalCheck({
      reportDate: morningReportDate(),
      codeTests: body.codeTests as MorningCheckState,
      siteCheck: body.siteCheck as MorningCheckState,
      detail,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingMorningReportSchema(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This database has no morning note yet. Apply db/init/039.",
        },
        { status: 503 },
      );
    }
    return publicApiErrorResponse(
      "api.owner.morning-report.external.POST",
      error,
      "The outside check could not be saved.",
    );
  }
}
