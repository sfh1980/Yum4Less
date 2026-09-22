import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isValidZipCode, parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { resolveZipLocation } from "@/lib/geocoding";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { runStoreIdentityProximityMatcherNearLocation } from "@/lib/store-identity-proximity-ingest";

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
      { ok: false, error: "Store identity matching needs a configured database." },
      { status: 503 },
    );
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const body = parsedBody.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "ZIP payload is invalid." }, { status: 400 });
  }

  const zipCode = (body as { zipCode?: unknown }).zipCode;
  if (!isValidZipCode(zipCode)) {
    return NextResponse.json({ ok: false, error: "Enter a 5-digit ZIP code." }, { status: 400 });
  }

  const apply = (body as { apply?: unknown }).apply === true;
  const geocoded = await resolveZipLocation(zipCode);
  if (!geocoded.ok) {
    return NextResponse.json({ ok: false, error: geocoded.error }, { status: 400 });
  }

  try {
    const result = await runStoreIdentityProximityMatcherNearLocation({
      latitude: geocoded.location.latitude,
      longitude: geocoded.location.longitude,
      apply,
    });
    return NextResponse.json({ ok: true, zipCode, ...result });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.store-identity.match.POST",
      error,
      "Same-building pins could not be matched.",
    );
  }
}
