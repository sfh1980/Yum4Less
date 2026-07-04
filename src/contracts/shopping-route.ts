import { z } from "zod";
import { API_LIMITS, isValidCoordinatePair } from "@/lib/api-request";
import type { buildMultiStoreShoppingRoute } from "@/lib/multi-store-shopping-route";

const homeSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string().trim().max(API_LIMITS.shoppingRouteHomeLabelLength.max).optional(),
  })
  .refine((value) => isValidCoordinatePair(value), {
    message: "Coordinates are out of range.",
  });

const storeStopSchema = z
  .object({
    storeName: z.string().trim().min(1).max(API_LIMITS.shoppingRouteStoreNameLength.max),
    latitude: z.number(),
    longitude: z.number(),
  })
  .refine((value) => isValidCoordinatePair(value), {
    message: "Store coordinates are out of range.",
  });

const shoppingRouteRequestSchema = z.object({
  home: homeSchema,
  stores: z.array(storeStopSchema).min(1).max(API_LIMITS.shoppingRouteStops.max),
});

export type ShoppingRouteRequest = z.infer<typeof shoppingRouteRequestSchema>;

export function parseShoppingRouteRequest(body: unknown):
  | { ok: true; value: Parameters<typeof buildMultiStoreShoppingRoute>[0] }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Shopping route payload is invalid." };
  }

  const record = body as Record<string, unknown>;
  if (!record.home || typeof record.home !== "object") {
    return { ok: false, error: "Home coordinates are required for route planning." };
  }

  const homeRecord = record.home as Record<string, unknown>;
  if (!isValidCoordinatePair(homeRecord)) {
    return { ok: false, error: "Home coordinates are required for route planning." };
  }

  if (!Array.isArray(record.stores) || record.stores.length === 0) {
    return { ok: false, error: "At least one store stop is required for route planning." };
  }

  if (record.stores.length > API_LIMITS.shoppingRouteStops.max) {
    return {
      ok: false,
      error: `Route planning supports up to ${API_LIMITS.shoppingRouteStops.max} store stops.`,
    };
  }

  if (homeRecord.label !== undefined && homeRecord.label !== null) {
    if (typeof homeRecord.label !== "string") {
      return {
        ok: false,
        error: `Home label must be ${API_LIMITS.shoppingRouteHomeLabelLength.max} characters or fewer.`,
      };
    }

    const trimmed = homeRecord.label.trim();
    if (trimmed.length > API_LIMITS.shoppingRouteHomeLabelLength.max) {
      return {
        ok: false,
        error: `Home label must be ${API_LIMITS.shoppingRouteHomeLabelLength.max} characters or fewer.`,
      };
    }
  }

  for (const store of record.stores) {
    if (!store || typeof store !== "object") {
      return { ok: false, error: "Each store stop must include a name and coordinates." };
    }

    const storeRecord = store as Record<string, unknown>;
    const storeName =
      typeof storeRecord.storeName === "string" ? storeRecord.storeName.trim() : "";
    if (
      !storeName ||
      storeName.length > API_LIMITS.shoppingRouteStoreNameLength.max ||
      !isValidCoordinatePair(storeRecord)
    ) {
      return { ok: false, error: "Each store stop must include a name and coordinates." };
    }
  }

  const parsed = shoppingRouteRequestSchema.safeParse({
    home: {
      latitude: Number(homeRecord.latitude),
      longitude: Number(homeRecord.longitude),
      label:
        typeof homeRecord.label === "string" && homeRecord.label.trim()
          ? homeRecord.label.trim()
          : undefined,
    },
    stores: record.stores.map((store) => {
      const storeRecord = store as Record<string, unknown>;
      return {
        storeName: String(storeRecord.storeName).trim(),
        latitude: Number(storeRecord.latitude),
        longitude: Number(storeRecord.longitude),
      };
    }),
  });

  if (!parsed.success) {
    return { ok: false, error: "Each store stop must include a name and coordinates." };
  }

  return {
    ok: true,
    value: {
      home: {
        latitude: parsed.data.home.latitude,
        longitude: parsed.data.home.longitude,
        label: parsed.data.home.label ?? "Home",
      },
      stores: parsed.data.stores,
    },
  };
}
