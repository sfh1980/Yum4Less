import { NextResponse } from "next/server";
import { buildMultiStoreShoppingRoute } from "@/lib/multi-store-shopping-route";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import {
  API_LIMITS,
  clampTrimmedString,
  isValidCoordinatePair,
  parseJsonBody,
} from "@/lib/api-request";

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

function parseShoppingRouteRequest(body: unknown):
  | { ok: true; value: Parameters<typeof buildMultiStoreShoppingRoute>[0] }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Shopping route payload is invalid." };
  }

  const record = body as Record<string, unknown>;
  const home = record.home;
  const stores = record.stores;

  if (!home || typeof home !== "object") {
    return { ok: false, error: "Home coordinates are required for route planning." };
  }

  const homeRecord = home as Record<string, unknown>;
  const homeLatitude = Number(homeRecord.latitude);
  const homeLongitude = Number(homeRecord.longitude);

  if (!isValidCoordinatePair(homeRecord)) {
    return { ok: false, error: "Home coordinates are required for route planning." };
  }

  if (!Array.isArray(stores) || stores.length === 0) {
    return { ok: false, error: "At least one store stop is required for route planning." };
  }

  if (stores.length > API_LIMITS.shoppingRouteStops.max) {
    return {
      ok: false,
      error: `Route planning supports up to ${API_LIMITS.shoppingRouteStops.max} store stops.`,
    };
  }

  const parsedStores = stores.map((store) => {
    if (!store || typeof store !== "object") {
      return undefined;
    }

    const storeRecord = store as Record<string, unknown>;
    const storeName = clampTrimmedString(
      storeRecord.storeName,
      API_LIMITS.shoppingRouteStoreNameLength,
    );
    const latitude = Number(storeRecord.latitude);
    const longitude = Number(storeRecord.longitude);

    if (!storeName || !isValidCoordinatePair(storeRecord)) {
      return undefined;
    }

    return { storeName, latitude, longitude };
  });

  if (parsedStores.some((store) => store === undefined)) {
    return { ok: false, error: "Each store stop must include a name and coordinates." };
  }

  const homeLabel = clampOptionalHomeLabel(homeRecord.label);

  if (homeRecord.label !== undefined && !homeLabel) {
    return {
      ok: false,
      error: `Home label must be ${API_LIMITS.shoppingRouteHomeLabelLength.max} characters or fewer.`,
    };
  }

  return {
    ok: true,
    value: {
      home: {
        latitude: homeLatitude,
        longitude: homeLongitude,
        label: homeLabel ?? "Home",
      },
      stores: parsedStores as Array<{
        storeName: string;
        latitude: number;
        longitude: number;
      }>,
    },
  };
}

function clampOptionalHomeLabel(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Home";
  }

  if (trimmed.length > API_LIMITS.shoppingRouteHomeLabelLength.max) {
    return undefined;
  }

  return trimmed;
}
