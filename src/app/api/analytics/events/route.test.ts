import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/analytics/events/route";
import {
  getMemoryAnalyticsEventsForTests,
  resetMemoryAnalyticsEventsForTests,
} from "@/lib/analytics/analytics-sink";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalAnalyticsEnabled = process.env.YUM4LESS_ENABLE_ANALYTICS;
const originalAnalyticsSink = process.env.YUM4LESS_ANALYTICS_SINK;
const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

const listRecentAnalyticsEvents = vi.fn();

vi.mock("@/lib/analytics/analytics-repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/analytics/analytics-repository")>();
  return {
    ...actual,
    listRecentAnalyticsEvents: (...args: unknown[]) =>
      listRecentAnalyticsEvents(...args),
  };
});

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

describe("GET /api/analytics/events", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    listRecentAnalyticsEvents.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
  });

  it("returns 401 without admin auth", async () => {
    delete process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

    const response = await GET(new Request("http://localhost/api/analytics/events"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(listRecentAnalyticsEvents).not.toHaveBeenCalled();
  });

  it("returns 401 with the wrong admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "expected-key";

    const response = await GET(
      new Request("http://localhost/api/analytics/events", {
        headers: { Authorization: "Bearer wrong-key" },
      }),
    );

    expect(response.status).toBe(401);
    expect(listRecentAnalyticsEvents).not.toHaveBeenCalled();
  });

  it("returns events when admin auth is valid", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    listRecentAnalyticsEvents.mockResolvedValue({
      events: [
        {
          id: 1,
          receivedAt: "2026-08-05T12:00:00.000Z",
          eventName: "location_search_completed",
          sessionId: "abc",
          properties: { mode: "zip" },
          appEnv: "production",
        },
      ],
      hasMore: false,
    });

    const response = await GET(
      new Request("http://localhost/api/analytics/events?limit=50&offset=0", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      events: [
        {
          id: 1,
          receivedAt: "2026-08-05T12:00:00.000Z",
          eventName: "location_search_completed",
          sessionId: "abc",
          properties: { mode: "zip" },
          appEnv: "production",
        },
      ],
      hasMore: false,
      limit: 50,
      offset: 0,
    });
    expect(listRecentAnalyticsEvents).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      eventName: undefined,
    });
  });

  it("passes notice through when the repository returns one", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    listRecentAnalyticsEvents.mockResolvedValue({
      events: [],
      hasMore: false,
      notice: "Analytics list reads from Postgres only.",
    });

    const response = await GET(
      new Request("http://localhost/api/analytics/events", {
        headers: { "X-Yum4Less-Admin-Key": "test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      events: [],
      hasMore: false,
      limit: 50,
      offset: 0,
      notice: "Analytics list reads from Postgres only.",
    });
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
