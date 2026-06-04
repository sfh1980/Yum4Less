import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/analytics/events/route";
import {
  getMemoryAnalyticsEventsForTests,
  resetMemoryAnalyticsEventsForTests,
} from "@/lib/analytics/analytics-sink";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalAnalyticsEnabled = process.env.YUM4LESS_ENABLE_ANALYTICS;
const originalAnalyticsSink = process.env.YUM4LESS_ANALYTICS_SINK;

describe("POST /api/analytics/events", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    resetMemoryAnalyticsEventsForTests();
    restoreEnv("YUM4LESS_ENABLE_ANALYTICS", originalAnalyticsEnabled);
    restoreEnv("YUM4LESS_ANALYTICS_SINK", originalAnalyticsSink);
  });

  it("no-ops when analytics is disabled", async () => {
    delete process.env.YUM4LESS_ENABLE_ANALYTICS;

    const response = await POST(buildAnalyticsRequest({ zipCode: "23111" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(getMemoryAnalyticsEventsForTests()).toHaveLength(0);
  });

  it("stores valid coarse events in the memory sink", async () => {
    process.env.YUM4LESS_ENABLE_ANALYTICS = "1";
    process.env.YUM4LESS_ANALYTICS_SINK = "memory";

    const response = await POST(
      buildAnalyticsRequest({
        sessionId: "123e4567-e89b-12d3-a456-426614174000",
        eventName: "rank_meals_completed",
        properties: {
          result_count_bucket: "1-3",
          market_data_source: "database",
          has_fallback_notice: false,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(getMemoryAnalyticsEventsForTests()).toMatchObject([
      {
        eventName: "rank_meals_completed",
        sessionId: "123e4567-e89b-12d3-a456-426614174000",
        properties: {
          result_count_bucket: "1-3",
          market_data_source: "database",
          has_fallback_notice: false,
        },
      },
    ]);
  });

  it("rejects forbidden analytics properties when enabled", async () => {
    process.env.YUM4LESS_ENABLE_ANALYTICS = "1";
    process.env.YUM4LESS_ANALYTICS_SINK = "memory";

    const response = await POST(
      buildAnalyticsRequest({
        eventName: "location_search_completed",
        properties: { latitude: 37.6085 },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Analytics event includes disallowed data.",
    });
    expect(getMemoryAnalyticsEventsForTests()).toHaveLength(0);
  });

  it("rejects properties that are not allowed for the event", async () => {
    process.env.YUM4LESS_ENABLE_ANALYTICS = "1";
    process.env.YUM4LESS_ANALYTICS_SINK = "memory";

    const response = await POST(
      buildAnalyticsRequest({
        eventName: "rank_meals_completed",
        properties: {
          result_count_bucket: "1-3",
          store_count_bucket: "4-6",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Analytics event property is not supported.",
    });
    expect(getMemoryAnalyticsEventsForTests()).toHaveLength(0);
  });
});

function buildAnalyticsRequest(body: unknown) {
  return new Request("http://localhost/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
