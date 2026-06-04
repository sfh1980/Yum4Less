import type { AnalyticsProperties } from "@/lib/analytics/analytics-event-types";

const FORBIDDEN_PROPERTY_KEYS = new Set([
  "address",
  "home",
  "ingredient",
  "internalStoreId",
  "latitude",
  "longitude",
  "mealTitle",
  "price",
  "providerStoreId",
  "storeId",
  "storeName",
  "userAgent",
  "zip",
  "zipCode",
]);
const FORBIDDEN_PROPERTY_KEYS_NORMALIZED = new Set(
  [...FORBIDDEN_PROPERTY_KEYS].map((key) => key.toLowerCase()),
);

export function validateAnalyticsProperties(
  properties: unknown,
): { ok: true; properties: AnalyticsProperties } | { ok: false; error: string } {
  if (properties === undefined || properties === null) {
    return { ok: true, properties: {} };
  }

  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return { ok: false, error: "Analytics properties must be an object." };
  }

  const safeProperties: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      FORBIDDEN_PROPERTY_KEYS.has(key) ||
      FORBIDDEN_PROPERTY_KEYS_NORMALIZED.has(key.toLowerCase())
    ) {
      return { ok: false, error: "Analytics event includes disallowed data." };
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return { ok: false, error: "Analytics property names are invalid." };
    }

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return { ok: false, error: "Analytics properties must be primitive values." };
    }

    if (typeof value === "string" && value.length > 80) {
      return { ok: false, error: "Analytics property values are too long." };
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      return { ok: false, error: "Analytics numeric properties are invalid." };
    }

    safeProperties[key] = value;
  }

  if (JSON.stringify(safeProperties).length > 2048) {
    return { ok: false, error: "Analytics properties are too large." };
  }

  return { ok: true, properties: safeProperties };
}
