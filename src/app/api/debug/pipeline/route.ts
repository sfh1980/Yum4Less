import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { API_LIMITS, clampInteger, isValidZipCode } from "@/lib/api-request";
import { isDebugRoutesEnabled } from "@/lib/debug/debug-routes-policy";
import { getPipelineDebugView } from "@/lib/debug/pipeline-debug-service";
import { resolveLocationInput } from "@/lib/location-resolution";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { RecommendationDependencyUnavailableError } from "@/lib/recommendation-service";

const DEFAULT_RADIUS_MILES = 10;

function parseCoordinate(value: string | null) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function GET(request: Request) {
  if (!isDebugRoutesEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const rateLimit = enforceApiRateLimit(request, "apiDebugPipeline");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get("zip")?.trim();
  const latitude = parseCoordinate(searchParams.get("lat"));
  const longitude = parseCoordinate(searchParams.get("lng"));
  const radiusParam = searchParams.get("radiusMiles");

  const hasCoordinates =
    latitude !== undefined &&
    longitude !== undefined &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);
  const hasZip = Boolean(zipCode);

  if (!hasCoordinates && !hasZip) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide ?zip=23111 or ?lat=37.6&lng=-77.4 for pipeline debug.",
      },
      { status: 400 },
    );
  }

  if (hasCoordinates && hasZip) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide either zip or lat/lng, not both.",
      },
      { status: 400 },
    );
  }

  if (hasZip && !isValidZipCode(zipCode!)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 5-digit ZIP code." },
      { status: 400 },
    );
  }

  if (
    (latitude !== undefined && Number.isNaN(latitude)) ||
    (longitude !== undefined && Number.isNaN(longitude))
  ) {
    return NextResponse.json(
      { ok: false, error: "lat and lng must be valid numbers." },
      { status: 400 },
    );
  }

  const radiusMiles =
    radiusParam === null || radiusParam.trim() === ""
      ? DEFAULT_RADIUS_MILES
      : clampInteger(Number(radiusParam), API_LIMITS.radiusMiles);

  if (radiusMiles === undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: `radiusMiles must be an integer between ${API_LIMITS.radiusMiles.min} and ${API_LIMITS.radiusMiles.max}.`,
      },
      { status: 400 },
    );
  }

  try {
    const locationResult = await resolveLocationInput(
      hasCoordinates
        ? { latitude: latitude!, longitude: longitude! }
        : { zipCode: zipCode! },
    );
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

    const view = await getPipelineDebugView({
      location: locationResult.location,
      radiusMiles,
    });

    if (view.dataSource === "unavailable") {
      throw new RecommendationDependencyUnavailableError(
        "Pipeline debug requires database access.",
      );
    }

    return NextResponse.json(view);
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
      "api.debug.pipeline",
      error,
      "Pipeline debug view is temporarily unavailable.",
    );
  }
}
