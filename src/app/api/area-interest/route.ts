import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/api-rate-limit";
import { isValidZipCode, parseJsonBody } from "@/lib/api-request";
import { readAreaInterestRateLimit } from "@/lib/area-interest/area-interest-rate-limit";
import { upsertAreaInterest } from "@/lib/area-interest/area-interest-repository";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

/** Saves a shopper-typed ZIP. The response is only `{ ok: true }`. */
export async function POST(request: Request) {
  const rateLimit = consumeRateLimit(
    `apiAreaInterest:${getClientIp(request)}`,
    readAreaInterestRateLimit(),
  );
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const zip = readZip(parsedBody.body);
  if (!zip) {
    return NextResponse.json({ ok: false, error: "Enter a 5-digit ZIP." }, { status: 400 });
  }

  try {
    await upsertAreaInterest(zip);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return publicApiErrorResponse(
      "api.area-interest.POST",
      error,
      "That ZIP could not be saved.",
      503,
    );
  }
}

function readZip(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const zip = (body as { zip?: unknown }).zip;
  if (!isValidZipCode(zip)) {
    return null;
  }
  return zip.trim();
}
