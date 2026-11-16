import { describe, expect, it } from "vitest";
import { validateAnalyticsEventPayload } from "@/lib/analytics/analytics-validation";

const sessionId = "123e4567-e89b-12d3-a456-426614174000";

describe("analytics event validation", () => {
  it("accepts site_opened with setup_complete only", () => {
    expect(
      validateAnalyticsEventPayload({
        sessionId,
        eventName: "site_opened",
        properties: { setup_complete: false },
      }),
    ).toEqual({
      ok: true,
      event: {
        sessionId,
        eventName: "site_opened",
        properties: { setup_complete: false },
      },
    });
  });

  it("accepts map_only_shown with a typed ZIP and without one", () => {
    expect(
      validateAnalyticsEventPayload({
        eventName: "map_only_shown",
        properties: { zip: "30301" },
      }).ok,
    ).toBe(true);
    expect(
      validateAnalyticsEventPayload({
        eventName: "map_only_shown",
        properties: {},
      }).ok,
    ).toBe(true);
  });

  it("accepts recipe_opened with a numeric recipe id", () => {
    expect(
      validateAnalyticsEventPayload({
        eventName: "recipe_opened",
        properties: { recipe_id: "52772" },
      }).ok,
    ).toBe(true);
  });

  it("accepts area_interest_saved with a 5-digit ZIP", () => {
    expect(
      validateAnalyticsEventPayload({
        eventName: "area_interest_saved",
        properties: { zip: "30301" },
      }).ok,
    ).toBe(true);
  });

  it("rejects coordinates, free text, and ZIP on the wrong event", () => {
    expect(
      validateAnalyticsEventPayload({
        eventName: "map_only_shown",
        properties: { latitude: 37.6085, longitude: -77.3739 },
      }),
    ).toMatchObject({ ok: false, error: "Analytics event includes disallowed data." });

    expect(
      validateAnalyticsEventPayload({
        eventName: "map_only_shown",
        properties: { zip: "near the river" },
      }),
    ).toMatchObject({ ok: false, error: "Analytics event includes disallowed data." });

    expect(
      validateAnalyticsEventPayload({
        eventName: "recipe_opened",
        properties: { recipe_id: "Chicken soup for tonight" },
      }),
    ).toMatchObject({ ok: false, error: "Analytics event includes disallowed data." });

    expect(
      validateAnalyticsEventPayload({
        eventName: "site_opened",
        properties: { setup_complete: true, note: "please email me" },
      }),
    ).toMatchObject({ ok: false, error: "Analytics event property is not supported." });

    expect(
      validateAnalyticsEventPayload({
        eventName: "location_search_completed",
        properties: { zip: "30301" },
      }),
    ).toMatchObject({ ok: false, error: "Analytics event property is not supported." });

    expect(
      validateAnalyticsEventPayload({
        eventName: "area_interest_saved",
        properties: {},
      }).ok,
    ).toBe(false);
  });
});
