import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsEventInput,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@/lib/analytics/analytics-event-types";
import { validateAnalyticsProperties } from "@/lib/analytics/analytics-privacy";

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const SESSION_ID_PATTERN = /^[a-f0-9-]{16,64}$/i;
export const ANALYTICS_EVENT_PROPERTY_ALLOWLISTS: Record<
  AnalyticsEventName,
  readonly string[]
> = {
  location_search_started: ["mode", "radius_miles"],
  location_search_completed: [
    "mode",
    "in_mvp_area",
    "radius_miles",
    "store_count_bucket",
    "recommendation_ready_count_bucket",
  ],
  location_search_failed: ["mode", "error_code"],
  rank_meals_started: ["shopping_style", "dietary_focus", "recipe_source"],
  rank_meals_completed: [
    "shopping_style",
    "dietary_focus",
    "recipe_source",
    "result_count_bucket",
    "market_data_source",
    "has_fallback_notice",
  ],
  rank_meals_failed: ["error_code"],
  store_pin_selected: ["chain", "recommendation_enabled"],
};

export function validateAnalyticsEventPayload(
  body: unknown,
): { ok: true; event: AnalyticsEventInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Analytics event payload is invalid." };
  }

  const record = body as Record<string, unknown>;
  if (typeof record.eventName !== "string" || !EVENT_NAME_SET.has(record.eventName)) {
    return { ok: false, error: "Analytics event name is not supported." };
  }

  const sessionId =
    typeof record.sessionId === "string" && SESSION_ID_PATTERN.test(record.sessionId)
      ? record.sessionId
      : undefined;
  const eventName = record.eventName as AnalyticsEventName;
  const propertiesResult = validateAnalyticsProperties(record.properties);

  if (!propertiesResult.ok) {
    return propertiesResult;
  }

  const allowlistResult = validateEventPropertyAllowlist(
    eventName,
    propertiesResult.properties,
  );
  if (!allowlistResult.ok) {
    return allowlistResult;
  }

  return {
    ok: true,
    event: {
      sessionId,
      eventName,
      properties: propertiesResult.properties,
    },
  };
}

function validateEventPropertyAllowlist(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties,
): { ok: true } | { ok: false; error: string } {
  const allowed = new Set(ANALYTICS_EVENT_PROPERTY_ALLOWLISTS[eventName]);

  for (const key of Object.keys(properties)) {
    if (!allowed.has(key)) {
      return { ok: false, error: "Analytics event property is not supported." };
    }
  }

  return { ok: true };
}
