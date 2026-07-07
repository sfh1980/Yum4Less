import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { parsePantryCoverageRequest } from "@/contracts/pantry-coverage";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import {
  parsePassedMarketSummary,
  trimMarketForRankingPassThrough,
  validatePassedMarketForRanking,
} from "@/lib/market-pass-through";
import {
  buildSearchLocationLabel,
  resolveLocationInput,
} from "@/lib/location-resolution";
import { getPantryCoverageExperience } from "@/lib/pantry-coverage-service";
import { RecommendationDependencyUnavailableError } from "@/lib/recommendation-service";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiPantryCoverage");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const requestBody = parsePantryCoverageRequest(parsedBody.body);

  if (!requestBody) {
    return NextResponse.json(
      {
        ok: false,
        error: "Pantry coverage request payload is invalid.",
      },
      { status: 400 },
    );
  }

  const {
    market: marketPayload,
    pantryIngredientIds,
    includeIngredientCatalog,
    ...preferences
  } = requestBody;

  try {
    const locationResult = await resolveLocationInput({
      zipCode: requestBody.zipCode,
      latitude: requestBody.latitude,
      longitude: requestBody.longitude,
    });
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

    const parsedMarket = parsePassedMarketSummary(marketPayload);
    if (marketPayload !== undefined && parsedMarket === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Market snapshot payload is invalid.",
        },
        { status: 400 },
      );
    }

    let passedMarket;
    if (parsedMarket) {
      const marketValidation = validatePassedMarketForRanking({
        market: parsedMarket,
        preferences,
        location: locationResult.location,
      });
      if (!marketValidation.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: marketValidation.reason,
          },
          { status: 409 },
        );
      }
      passedMarket = {
        ...trimMarketForRankingPassThrough(marketValidation.market),
        locationLabel: buildSearchLocationLabel(locationResult.location),
      };
    }

    const experience = await getPantryCoverageExperience(
      {
        ...preferences,
        ...(pantryIngredientIds ? { pantryIngredientIds } : {}),
        ...(includeIngredientCatalog ? { includeIngredientCatalog: true } : {}),
      },
      locationResult.location,
      locationResult.providerConfigured,
      passedMarket ? { passedMarket } : undefined,
    );

    return NextResponse.json({
      ok: true,
      ...experience,
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
      "api.pantry-coverage",
      error,
      "Pantry coverage is temporarily unavailable.",
    );
  }
}
