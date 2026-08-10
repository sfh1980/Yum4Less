import { describe, expect, it } from "vitest";
import { groupAnalyticsEventsBySession } from "@/components/owner/owner-analytics-feed";
import type { PublicAnalyticsEventRow } from "@/lib/analytics/analytics-repository";

function event(
  partial: Partial<PublicAnalyticsEventRow> & Pick<PublicAnalyticsEventRow, "id" | "eventName" | "receivedAt">,
): PublicAnalyticsEventRow {
  return {
    sessionId: null,
    properties: {},
    appEnv: "production",
    ...partial,
  };
}

describe("groupAnalyticsEventsBySession", () => {
  it("groups by session and sorts events oldest-first within each session", () => {
    const groups = groupAnalyticsEventsBySession([
      event({
        id: 3,
        sessionId: "sess-a",
        eventName: "rank_meals_completed",
        receivedAt: "2026-08-06T12:02:00.000Z",
      }),
      event({
        id: 1,
        sessionId: "sess-a",
        eventName: "location_search_started",
        receivedAt: "2026-08-06T12:00:00.000Z",
      }),
      event({
        id: 2,
        sessionId: "sess-b",
        eventName: "location_search_completed",
        receivedAt: "2026-08-06T13:00:00.000Z",
      }),
      event({
        id: 4,
        sessionId: null,
        eventName: "store_pin_selected",
        receivedAt: "2026-08-06T11:00:00.000Z",
      }),
    ]);

    expect(groups.map((group) => group.sessionId)).toEqual([
      "sess-b",
      "sess-a",
      null,
    ]);
    expect(groups[1]!.events.map((row) => row.eventName)).toEqual([
      "location_search_started",
      "rank_meals_completed",
    ]);
  });
});
