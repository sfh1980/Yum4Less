import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { resolveZipLocation } from "@/lib/geocoding";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiGeocodeZip");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get("zip")?.trim();

  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Enter a valid 5-digit ZIP code.",
        providerConfigured: !!process.env.GEOCODIO_API_KEY,
      },
      { status: 400 },
    );
  }

  try {
    const result = await resolveZipLocation(zipCode);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    return publicApiErrorResponse(
      "api.geocode.zip",
      error,
      "ZIP lookup is temporarily unavailable.",
    );
  }
}
