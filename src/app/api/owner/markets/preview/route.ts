import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  INGEST_OVERLAY_NOTICE,
  MISSING_ACTIVE_MARKETS_MESSAGE,
  inspectOwnerIngestMarket,
  isMissingActiveMarketsSchema,
  parseOwnerMarketZipInput,
} from "@/lib/owner/ingest-markets";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function POST(request: Request) {
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

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const parsedZip = parseOwnerMarketZipInput(parsedBody.body);
  if (!parsedZip.ok) {
    return NextResponse.json({ ok: false, error: parsedZip.error }, { status: 400 });
  }

  try {
    const inspected = await inspectOwnerIngestMarket(parsedZip.zipCode);
    if (!inspected.ok) {
      return NextResponse.json({ ok: false, error: inspected.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      overlayNotice: INGEST_OVERLAY_NOTICE,
      ...inspected.result,
    });
  } catch (error) {
    if (isMissingActiveMarketsSchema(error)) {
      return NextResponse.json(
        { ok: false, error: MISSING_ACTIVE_MARKETS_MESSAGE },
        { status: 503 },
      );
    }
    return publicApiErrorResponse(
      "api.owner.markets.preview.POST",
      error,
      "That ZIP could not be checked.",
    );
  }
}
