import { getDbPool } from "@/lib/db";
import type { AnalyticsEventInput } from "@/lib/analytics/analytics-event-types";
import { getAnalyticsSinkKind } from "@/lib/analytics/analytics-policy";

export type StoredAnalyticsEvent = AnalyticsEventInput & {
  receivedAt: string;
};

const memoryEvents: StoredAnalyticsEvent[] = [];
const MAX_MEMORY_EVENTS = 250;

export async function appendAnalyticsEvent(event: AnalyticsEventInput) {
  const storedEvent: StoredAnalyticsEvent = {
    ...event,
    properties: event.properties ?? {},
    receivedAt: new Date().toISOString(),
  };

  switch (getAnalyticsSinkKind()) {
    case "postgres":
      await appendPostgresAnalyticsEvent(storedEvent);
      return;
    case "stdout":
      console.info("yum4less.analytics", JSON.stringify(storedEvent));
      return;
    case "memory":
    default:
      memoryEvents.push(storedEvent);
      if (memoryEvents.length > MAX_MEMORY_EVENTS) {
        memoryEvents.splice(0, memoryEvents.length - MAX_MEMORY_EVENTS);
      }
  }
}

export function getMemoryAnalyticsEventsForTests() {
  return [...memoryEvents];
}

export function resetMemoryAnalyticsEventsForTests() {
  memoryEvents.length = 0;
}

async function appendPostgresAnalyticsEvent(event: StoredAnalyticsEvent) {
  const pool = getDbPool();
  await pool.query(
    `
      insert into analytics_events (event_name, session_id, properties, app_env)
      values ($1, $2, $3::jsonb, $4)
    `,
    [
      event.eventName,
      event.sessionId ?? null,
      JSON.stringify(event.properties ?? {}),
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    ],
  );
}
