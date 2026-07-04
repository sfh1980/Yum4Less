import { NextResponse } from "next/server";
import { parseShoppingRouteRequest } from "@/contracts/shopping-route";
import { buildMultiStoreShoppingRoute } from "@/lib/multi-store-shopping-route";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { parseJsonBody } from "@/lib/api-request";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiShoppingRoute");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { ok: false, error: parsedBody.error },
      { status: 400 },
    );
  }

  const parsed = parseShoppingRouteRequest(parsedBody.body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const route = await buildMultiStoreShoppingRoute(parsed.value);

    return NextResponse.json({
      ok: true,
      route,
    });
  } catch (error) {
    return publicApiErrorResponse(
      "api.shopping-route",
      error,
      "Shopping route planning is temporarily unavailable.",
    );
  }
}
