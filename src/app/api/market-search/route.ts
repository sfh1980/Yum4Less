import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { parseMarketSearchRequest } from "@/contracts/market-search";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { sanitizeMarketSummaryForPublicApi } from "@/lib/public-api-response-sanitizer";
import { resolveLocationInput } from "@/lib/location-resolution";
import {
  getMarketSearchExperience,
  RecommendationDependencyUnavailableError,
} from "@/lib/recommendation-service";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiMarketSearch");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const payload = parseMarketSearchRequest(parsedBody.body);

  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        error: "Market search payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const locationResult = await resolveLocationInput(payload);
    if (!locationResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: locationResult.error,
          providerConfigured: locationResult.providerConfigured,
        },
        { status: 404 },
      );
    }

    const experience = await getMarketSearchExperience(
      payload.radiusMiles,
      locationResult.location,
      locationResult.providerConfigured,
    );

    if (experience.market.dataSource === "unavailable") {
      throw new RecommendationDependencyUnavailableError();
    }

    return NextResponse.json({
      ok: true,
      market: sanitizeMarketSummaryForPublicApi(experience.market),
    });
  } catch (error) {
    if (error instanceof RecommendationDependencyUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 503 },
      );
    }

    return publicApiErrorResponse(
      "api.market-search",
      error,
      "Market search is temporarily unavailable.",
    );
  }
}
