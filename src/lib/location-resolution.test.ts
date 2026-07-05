import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveZipLocation } = vi.hoisted(() => ({
  resolveZipLocation: vi.fn(),
}));

vi.mock("@/lib/geocoding", () => ({
  resolveZipLocation,
}));

import { resolveLocationInput } from "@/lib/location-resolution";

describe("resolveLocationInput", () => {
  const originalGeocodioKey = process.env.GEOCODIO_API_KEY;

  beforeEach(() => {
    resolveZipLocation.mockReset();
    process.env.GEOCODIO_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalGeocodioKey === undefined) {
      delete process.env.GEOCODIO_API_KEY;
    } else {
      process.env.GEOCODIO_API_KEY = originalGeocodioKey;
    }
  });

  it("accepts continental US browser coordinates", async () => {
    const result = await resolveLocationInput({
      latitude: 37.6085,
      longitude: -77.3739,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.source).toBe("browser");
      expect(result.location.city).toBe("Current location");
      expect(result.location.latitude).toBe(37.6085);
    }
    expect(resolveZipLocation).not.toHaveBeenCalled();
  });

  it("rejects browser coordinates outside continental US bounds", async () => {
    const result = await resolveLocationInput({
      latitude: 21.3,
      longitude: -157.8,
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Browser location is outside the continental US markets Yum4Less supports in this beta.",
      providerConfigured: true,
    });
  });

  it("rejects out-of-range latitude and longitude values", async () => {
    const result = await resolveLocationInput({
      latitude: 95,
      longitude: -77.3,
    });

    expect(result).toEqual({
      ok: false,
      error: "Browser location coordinates are out of range.",
      providerConfigured: true,
    });
  });

  it("requires a valid ZIP when coordinates are absent", async () => {
    const result = await resolveLocationInput({ zipCode: "abc" });

    expect(result).toEqual({
      ok: false,
      error: "Enter a valid 5-digit ZIP code or use browser location.",
      providerConfigured: true,
    });
    expect(resolveZipLocation).not.toHaveBeenCalled();
  });

  it("delegates valid ZIP codes to resolveZipLocation", async () => {
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
      providerConfigured: true,
    });

    const result = await resolveLocationInput({ zipCode: "23111" });

    expect(resolveZipLocation).toHaveBeenCalledWith("23111");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.zipCode).toBe("23111");
    }
  });
});
