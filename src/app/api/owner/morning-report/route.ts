import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  isMissingMorningReportSchema,
  readLatestMorningReport,
} from "@/lib/owner/morning-report-repository";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
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

  try {
    const report = await readLatestMorningReport();
    return NextResponse.json({ ok: true, report });
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
      "api.owner.morning-report.GET",
      error,
      "The morning note could not be loaded.",
    );
  }
}
