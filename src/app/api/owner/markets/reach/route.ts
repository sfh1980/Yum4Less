import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { isMissingActiveMarketsSchema, MISSING_ACTIVE_MARKETS_MESSAGE } from "@/lib/owner/ingest-markets";
import { buildOwnerMarketReach } from "@/lib/owner/market-reach-repository";
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

  const zipCode = new URL(request.url).searchParams.get("zip") ?? "";
  try {
    const result = await buildOwnerMarketReach(zipCode);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result.reach });
  } catch (error) {
    if (isMissingActiveMarketsSchema(error)) {
      return NextResponse.json(
        { ok: false, error: MISSING_ACTIVE_MARKETS_MESSAGE },
        { status: 503 },
      );
    }
    return publicApiErrorResponse(
      "api.owner.markets.reach.GET",
      error,
      "That ZIP's nearby stores could not be loaded.",
    );
  }
}
