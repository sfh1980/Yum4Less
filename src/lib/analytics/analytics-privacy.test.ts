import { describe, expect, it } from "vitest";
import { validateAnalyticsProperties } from "@/lib/analytics/analytics-privacy";
import {
  ANALYTICS_EVENT_PROPERTY_ALLOWLISTS,
  CLIENT_STAMPED_ANALYTICS_TRUST_DIMS,
} from "@/lib/analytics/analytics-validation";

describe("analytics privacy", () => {
  it("accepts coarse primitive properties", () => {
    expect(
      validateAnalyticsProperties({
        mode: "zip",
        radius_miles: 5,
        has_fallback_notice: true,
      }),
    ).toEqual({
      ok: true,
      properties: {
        mode: "zip",
        radius_miles: 5,
        has_fallback_notice: true,
      },
    });
  });

  it("rejects location and internal identifiers", () => {
    expect(validateAnalyticsProperties({ latitude: 37.6 })).toEqual({
      ok: false,
      error: "Analytics event includes disallowed data.",
    });
    expect(validateAnalyticsProperties({ storeId: "kroger-mechanicsville" })).toEqual({
      ok: false,
      error: "Analytics event includes disallowed data.",
    });
    expect(validateAnalyticsProperties({ ZipCode: "23111" })).toEqual({
      ok: false,
      error: "Analytics event includes disallowed data.",
    });
  });

  it("rejects case variants before event allowlists run", () => {
    expect(validateAnalyticsProperties({ Radius_Miles: 5 })).toEqual({
      ok: false,
      error: "Analytics property names are invalid.",
    });
  });

  it("documents client-stamped trust dims as allowlisted but non-authoritative", () => {
    const allowlisted = new Set(
      Object.values(ANALYTICS_EVENT_PROPERTY_ALLOWLISTS).flat(),
    );
    for (const dim of CLIENT_STAMPED_ANALYTICS_TRUST_DIMS) {
      expect(allowlisted.has(dim)).toBe(true);
    }
  });
});
