import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveZipLocation } = vi.hoisted(() => ({
  resolveZipLocation: vi.fn(),
}));

vi.mock("@/lib/geocoding", () => ({
  resolveZipLocation,
}));

import { GET } from "@/app/api/geocode/zip/route";
import { RATE_LIMITS, resetRateLimitsForTests } from "@/lib/rate-limit";
import * as serverLog from "@/lib/server-log";

const originalGeocodioKey = process.env.GEOCODIO_API_KEY;

describe("GET /api/geocode/zip", () => {
  beforeEach(() => {
    resolveZipLocation.mockReset();
    delete process.env.GEOCODIO_API_KEY;
  });

  afterEach(() => {
    resetRateLimitsForTests();
    if (originalGeocodioKey === undefined) {
      delete process.env.GEOCODIO_API_KEY;
    } else {
      process.env.GEOCODIO_API_KEY = originalGeocodioKey;
    }
  });

  it.each([
    ["http://localhost/api/geocode/zip"],
    ["http://localhost/api/geocode/zip?zip="],
    ["http://localhost/api/geocode/zip?zip=2311"],
    ["http://localhost/api/geocode/zip?zip=abcde"],
    ["http://localhost/api/geocode/zip?zip=231111"],
  ])("rejects invalid ZIP query %s with 400", async (url) => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a valid 5-digit ZIP code.",
      providerConfigured: false,
    });
    expect(resolveZipLocation).not.toHaveBeenCalled();
  });

  it("reflects providerConfigured on invalid ZIP when GEOCODIO_API_KEY is set", async () => {
    process.env.GEOCODIO_API_KEY = "test-key";

    const response = await GET(
      new Request("http://localhost/api/geocode/zip?zip=bad"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a valid 5-digit ZIP code.",
      providerConfigured: true,
    });
  });

  it("returns geocoded location for a valid ZIP", async () => {
    resolveZipLocation.mockResolvedValue({
      ok: true,
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      providerConfigured: false,
    });

    const response = await GET(
      new Request("http://localhost/api/geocode/zip?zip=23111"),
    );

    expect(response.status).toBe(200);
    expect(resolveZipLocation).toHaveBeenCalledWith("23111");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      providerConfigured: false,
    });
  });

  it("returns 500 and logs when geocoding throws", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    resolveZipLocation.mockRejectedValue(new Error("upstream unavailable"));

    const response = await GET(
      new Request("http://localhost/api/geocode/zip?zip=23111"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "ZIP lookup is temporarily unavailable.",
    });
    expect(logSpy).toHaveBeenCalledWith(
      "api.geocode.zip",
      expect.objectContaining({ message: "upstream unavailable" }),
    );
    logSpy.mockRestore();
  });

  it("returns 404 when geocoder rejects non-continental or unsupported ZIP", async () => {
    resolveZipLocation.mockResolvedValue({
      ok: false,
      error:
        "That ZIP is outside the continental US markets Yum4Less supports in this beta.",
      providerConfigured: true,
    });

    const response = await GET(
      new Request("http://localhost/api/geocode/zip?zip=96813"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error:
        "That ZIP is outside the continental US markets Yum4Less supports in this beta.",
      providerConfigured: true,
    });
  });

  it("returns 429 with Retry-After when the geocode rate limit is exceeded", async () => {
    const url = "http://localhost/api/geocode/zip?zip=2311";
    const { maxRequests } = RATE_LIMITS.apiGeocodeZip;

    for (let index = 0; index < maxRequests; index += 1) {
      const response = await GET(new Request(url));
      expect(response.status).toBe(400);
    }

    const limited = await GET(new Request(url));

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      ok: false,
      error: "Too many requests. Please wait and try again.",
    });
    const retryAfter = limited.headers.get("Retry-After");
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
