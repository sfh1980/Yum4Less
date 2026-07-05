export const ANALYTICS_EVENT_NAMES = [
  "location_search_started",
  "location_search_completed",
  "location_search_failed",
  "rank_meals_started",
  "rank_meals_completed",
  "rank_meals_failed",
  "store_pin_selected",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsProperties = Record<string, string | number | boolean>;

export type AnalyticsEventInput = {
  sessionId?: string;
  eventName: AnalyticsEventName;
  properties?: AnalyticsProperties;
};
