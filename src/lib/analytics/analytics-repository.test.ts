import { afterEach, describe, expect, it } from "vitest";
import { listRecentAnalyticsEvents } from "@/lib/analytics/analytics-repository";

const originalSink = process.env.YUM4LESS_ANALYTICS_SINK;
const originalNodeEnv = process.env.NODE_ENV;

describe("listRecentAnalyticsEvents", () => {
  afterEach(() => {
    restoreEnv("YUM4LESS_ANALYTICS_SINK", originalSink);
    restoreEnv("NODE_ENV", originalNodeEnv);
  });

  it("returns empty + notice when the sink is not postgres", async () => {
    process.env.YUM4LESS_ANALYTICS_SINK = "memory";

    const result = await listRecentAnalyticsEvents({ limit: 10 });

    expect(result.events).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.notice).toMatch(/Postgres only/i);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
