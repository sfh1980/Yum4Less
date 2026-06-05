import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/analytics-event-types";
import { ANALYTICS_EVENT_PROPERTY_ALLOWLISTS } from "@/lib/analytics/analytics-validation";

export const ANALYTICS_NEVER_COLLECTED = [
  "Raw ZIP codes or street addresses",
  "Exact GPS coordinates",
  "Meal titles, ingredient lists, or checkout prices",
  "Internal store IDs or provider store IDs",
  "IP addresses or browser user agents",
  "Free-form feedback text (use the feedback form instead)",
] as const;

export const ANALYTICS_COLLECTED_WHEN_ENABLED = [
  "Coarse event names such as location search started or rank meals completed",
  "Anonymous session IDs stored in your browser session storage",
  "Allowlisted coarse properties such as radius buckets, shopping style, and result count buckets",
] as const;

export function getAnalyticsEventAllowlistForDisplay() {
  return ANALYTICS_EVENT_NAMES.map((eventName) => ({
    eventName,
    properties: [...ANALYTICS_EVENT_PROPERTY_ALLOWLISTS[eventName]],
  }));
}

export function isClientAnalyticsEnabled() {
  return process.env.NEXT_PUBLIC_YUM4LESS_ANALYTICS === "1";
}

export function isServerAnalyticsEnabled() {
  return process.env.YUM4LESS_ENABLE_ANALYTICS === "1";
}
