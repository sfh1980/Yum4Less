import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  INGEST_OVERLAY_NOTICE,
  MISSING_ACTIVE_MARKETS_MESSAGE,
  isMissingActiveMarketsSchema,
} from "@/lib/owner/ingest-markets";
import { listIngestMarkets } from "@/lib/active-markets";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerMarkets");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Ingest markets need a configured database." },
      { status: 503 },
    );
  }

  try {
    const markets = await listIngestMarkets();
    return NextResponse.json({
      ok: true,
      markets,
      overlayNotice: INGEST_OVERLAY_NOTICE,
    });
  } catch (error) {
    if (isMissingActiveMarketsSchema(error)) {
      return NextResponse.json(
        { ok: false, error: MISSING_ACTIVE_MARKETS_MESSAGE },
        { status: 503 },
      );
    }
    return publicApiErrorResponse(
      "api.owner.markets.GET",
      error,
      MISSING_ACTIVE_MARKETS_MESSAGE,
    );
  }
}
