import { getDbPool } from "@/lib/db";
import type { AnalyticsProperties } from "@/lib/analytics/analytics-event-types";
import { getAnalyticsSinkKind } from "@/lib/analytics/analytics-policy";

export const ANALYTICS_LIST_LIMITS = {
  default: 50,
  max: 100,
} as const;

export type PublicAnalyticsEventRow = {
  id: number;
  receivedAt: string;
  eventName: string;
  sessionId: string | null;
  properties: AnalyticsProperties;
  appEnv: string;
};

export type ListRecentAnalyticsEventsResult = {
  events: PublicAnalyticsEventRow[];
  notice?: string;
};

function asAnalyticsProperties(value: unknown): AnalyticsProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const properties: AnalyticsProperties = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      properties[key] = entry;
    }
  }
  return properties;
}

/**
 * Owner console list. Postgres sink only — other sinks return empty + notice
 * (stdout/memory are not durable owner sources of truth).
 */
export async function listRecentAnalyticsEvents(options?: {
  limit?: number;
  eventName?: string;
}): Promise<ListRecentAnalyticsEventsResult> {
  const limit = Math.min(
    ANALYTICS_LIST_LIMITS.max,
    Math.max(1, options?.limit ?? ANALYTICS_LIST_LIMITS.default),
  );
  const eventName = options?.eventName?.trim();

  if (getAnalyticsSinkKind() !== "postgres") {
    return {
      events: [],
      notice:
        "Analytics list reads from Postgres only. Set YUM4LESS_ANALYTICS_SINK=postgres to browse saved events.",
    };
  }

  try {
    const pool = getDbPool();
    const result = eventName
      ? await pool.query<{
          id: number;
          received_at: Date;
          event_name: string;
          session_id: string | null;
          properties: unknown;
          app_env: string;
        }>(
          `
            select id, received_at, event_name, session_id, properties, app_env
            from analytics_events
            where event_name = $1
            order by received_at desc
            limit $2
          `,
          [eventName, limit],
        )
      : await pool.query<{
          id: number;
          received_at: Date;
          event_name: string;
          session_id: string | null;
          properties: unknown;
          app_env: string;
        }>(
          `
            select id, received_at, event_name, session_id, properties, app_env
            from analytics_events
            order by received_at desc
            limit $1
          `,
          [limit],
        );

    return {
      events: result.rows.map((row) => ({
        id: Number(row.id),
        receivedAt: row.received_at.toISOString(),
        eventName: row.event_name,
        sessionId: row.session_id,
        properties: asAnalyticsProperties(row.properties),
        appEnv: row.app_env,
      })),
    };
  } catch {
    return {
      events: [],
      notice:
        "Could not read analytics_events from Postgres. Confirm the migration is applied and DATABASE_URL is set.",
    };
  }
}
