"use client";

import type {
  AnalyticsEventName,
  AnalyticsProperties,
} from "@/lib/analytics/analytics-event-types";

const SESSION_STORAGE_KEY = "yum4less_analytics_session_id";

export function trackClientEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (process.env.NEXT_PUBLIC_YUM4LESS_ANALYTICS !== "1") {
    return;
  }

  try {
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getOrCreateSessionId(),
        eventName,
        properties,
      }),
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    // Analytics must never block the meal planning flow.
  }
}

function getOrCreateSessionId() {
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
  return nextId;
}
