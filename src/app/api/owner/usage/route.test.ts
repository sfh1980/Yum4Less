import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/usage/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const summarizeRecentUsage = vi.fn();
const listAreaInterest = vi.fn();

vi.mock("@/lib/analytics/usage-summary", () => ({
  summarizeRecentUsage: (...args: unknown[]) => summarizeRecentUsage(...args),
}));

vi.mock("@/lib/area-interest/area-interest-repository", () => ({
  listAreaInterest: (...args: unknown[]) => listAreaInterest(...args),
}));

const originalKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

describe("GET /api/owner/usage", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    summarizeRecentUsage.mockReset();
    listAreaInterest.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 without the owner key and does not query", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "expected-key";
    process.env.DATABASE_URL = "postgresql://example";

    const response = await GET(new Request("http://localhost/api/owner/usage"));

    expect(response.status).toBe(401);
    expect(summarizeRecentUsage).not.toHaveBeenCalled();
    expect(listAreaInterest).not.toHaveBeenCalled();
  });

  it("returns the summary and no session or address fields", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "expected-key";
    process.env.DATABASE_URL = "postgresql://example";
    listAreaInterest.mockResolvedValue([
      {
        zip: "30301",
        requestCount: 4,
        firstRequestedAt: "2026-11-01T00:00:00.000Z",
        lastRequestedAt: "2026-11-09T00:00:00.000Z",
      },
      {
        zip: "20202",
        requestCount: 1,
        firstRequestedAt: "2026-11-02T00:00:00.000Z",
        lastRequestedAt: "2026-11-02T00:00:00.000Z",
      },
    ]);
    summarizeRecentUsage.mockResolvedValue({
      windowDays: 30,
      visitorsByDay: [{ day: "2026-11-09", visitors: 1 }],
      rankedDinnerSessions: 1,
      mapOnlySessions: 2,
      mapOnlyTopZips: [{ zip: "30301", count: 2 }],
      areaInterestTopZips: [{ zip: "30301", count: 1 }],
    });

    const response = await GET(
      new Request("http://localhost/api/owner/usage", {
        headers: { Authorization: "Bearer expected-key" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      usage: {
        windowDays: 30,
        visitorsByDay: [{ day: "2026-11-09", visitors: 1 }],
        rankedDinnerSessions: 1,
        mapOnlySessions: 2,
        mapOnlyTopZips: [{ zip: "30301", count: 2 }],
        areaInterestTopZips: [{ zip: "30301", count: 1 }],
      },
      areaInterest: [
        {
          zip: "30301",
          requestCount: 4,
          firstRequestedAt: "2026-11-01T00:00:00.000Z",
          lastRequestedAt: "2026-11-09T00:00:00.000Z",
        },
        {
          zip: "20202",
          requestCount: 1,
          firstRequestedAt: "2026-11-02T00:00:00.000Z",
          lastRequestedAt: "2026-11-02T00:00:00.000Z",
        },
      ],
    });
    expect(body.areaInterest.map((row: { requestCount: number }) => row.requestCount)).toEqual([
      4, 1,
    ]);
    expect(body.usage).not.toHaveProperty("sessionId");
    expect(body.usage).not.toHaveProperty("latitude");
    expect(body.usage).not.toHaveProperty("longitude");
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude|@|street/i);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
