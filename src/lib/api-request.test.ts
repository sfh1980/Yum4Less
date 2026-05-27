import { describe, expect, it } from "vitest";
import {
  API_LIMITS,
  clampInteger,
  clampNumber,
  isValidZipCode,
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
