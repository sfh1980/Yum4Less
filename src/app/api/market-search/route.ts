import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import {
  API_LIMITS,
  clampInteger,
  isValidCoordinatePair,
  isValidZipCode,
  parseJsonBody,
} from "@/lib/api-request";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { sanitizeMarketSummaryForPublicApi } from "@/lib/public-api-response-sanitizer";
import { resolveLocationInput } from "@/lib/location-resolution";
import { getMarketSearchExperience } from "@/lib/recommendation-service";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiMarketSearch");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const body = parsedBody.body as Partial<MarketSearchPayload>;
  const payload = validateMarketSearchPayload(body);

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

    return NextResponse.json({
      ok: true,
      market: sanitizeMarketSummaryForPublicApi(experience.market),
    });
  } catch (error) {
    return publicApiErrorResponse(
      "api.market-search",
      error,
      "Market search is temporarily unavailable.",
    );
  }
}

type MarketSearchPayload = {
  zipCode: string;
  radiusMiles: number;
  latitude?: number;
  longitude?: number;
};

function validateMarketSearchPayload(
  body: Partial<MarketSearchPayload>,
): MarketSearchPayload | undefined {
  const radiusMiles = clampInteger(body.radiusMiles, API_LIMITS.radiusMiles);
  const hasCoordinates = isValidCoordinatePair(body);
  const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : "";

  if (radiusMiles === undefined || (!hasCoordinates && !isValidZipCode(zipCode))) {
    return undefined;
  }

  return {
    zipCode: hasCoordinates && !isValidZipCode(zipCode) ? "" : zipCode,
    radiusMiles,
    latitude: body.latitude,
    longitude: body.longitude,
  };
}
