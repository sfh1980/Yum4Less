import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/analytics-event-types";
import { ANALYTICS_EVENT_PROPERTY_ALLOWLISTS } from "@/lib/analytics/analytics-validation";

export const ANALYTICS_NEVER_COLLECTED = [
  "Street addresses",
  "Exact GPS coordinates, including a ZIP derived from GPS",
  "Meal titles, ingredient lists, or checkout prices",
  "Internal store IDs or provider store IDs",
  "IP addresses or browser user agents",
  "Names, email addresses, or free-form shopper text",
] as const;

export const ANALYTICS_COLLECTED_WHEN_ENABLED = [
  "Coarse event names such as site opened, location search, rank meals, map-only, recipe opened, and area interest",
  "Anonymous session IDs stored in your browser session storage",
  "Allowlisted coarse properties such as radius buckets, shopping style, result count buckets, and whether setup is complete",
  "A 5-digit ZIP only on map-only and area-interest events, and only when you typed that ZIP",
  "A numeric recipe page id when you open that dinner's full recipe page",
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
