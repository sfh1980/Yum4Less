import { describe, expect, it } from "vitest";
import {
  API_LIMITS,
  clampInteger,
  clampNumber,
  clampTrimmedString,
  isValidZipCode,
  parseJsonBody,
} from "@/lib/api-request";
import { isWithinMvpBrowserRadius } from "@/lib/mvp-area";

describe("api-request", () => {
  it("validates ZIP codes and bounded integers", () => {
    expect(isValidZipCode("23111")).toBe(true);
    expect(isValidZipCode("2311")).toBe(false);
    expect(clampInteger(10, API_LIMITS.radiusMiles)).toBe(10);
    expect(clampInteger(99, API_LIMITS.radiusMiles)).toBeUndefined();
    expect(clampNumber(25.5, API_LIMITS.budget)).toBe(25.5);
  });

  it("rejects oversized JSON bodies before parsing", async () => {
    const request = new Request("http://localhost/api/example", {
      method: "POST",
      headers: {
        "content-length": String(API_LIMITS.maxJsonBodyBytes + 1),
      },
      body: "{}",
    });

    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      error: "Request body is too large.",
    });
  });

  it("trims and bounds route labels", () => {
    expect(clampTrimmedString(" Kroger ", { max: 20 })).toBe("Kroger");
    expect(clampTrimmedString("   ", { max: 20 })).toBeUndefined();
    expect(clampTrimmedString("x".repeat(21), { max: 20 })).toBeUndefined();
  });
});

describe("mvp-area", () => {
  it("accepts browser coordinates near the MVP center and rejects distant points", () => {
    expect(
      isWithinMvpBrowserRadius({
        latitude: 37.6085,
        longitude: -77.3321,
      }),
    ).toBe(true);

    expect(
      isWithinMvpBrowserRadius({
        latitude: 40.7128,
        longitude: -74.006,
      }),
    ).toBe(false);
  });
});
