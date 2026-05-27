import { buildMultiStoreShoppingRoute } from "@/lib/multi-store-shopping-route";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { API_LIMITS, isValidCoordinatePair } from "@/lib/api-request";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiShoppingRoute");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Shopping route payload is invalid." },
      { status: 400 },
    );
  }

  const parsed = parseShoppingRouteRequest(body);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const route = await buildMultiStoreShoppingRoute(parsed.value);

  return Response.json({
    ok: true,
    route,
  });
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
    const storeName = typeof storeRecord.storeName === "string" ? storeRecord.storeName : "";
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

  return {
    ok: true,
    value: {
      home: {
        latitude: homeLatitude,
        longitude: homeLongitude,
        label:
          typeof homeRecord.label === "string" && homeRecord.label.trim()
            ? homeRecord.label.trim()
            : "Home",
      },
      stores: parsedStores as Array<{
        storeName: string;
        latitude: number;
        longitude: number;
      }>,
    },
  };
}
