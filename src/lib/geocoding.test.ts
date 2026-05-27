import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveZipLocation } from "@/lib/geocoding";

const originalGeocodioKey = process.env.GEOCODIO_API_KEY;

describe("resolveZipLocation", () => {
  afterEach(() => {
    process.env.GEOCODIO_API_KEY = originalGeocodioKey;
  });

  it("returns the seeded local ZIP when no API key is configured", async () => {
    delete process.env.GEOCODIO_API_KEY;

    const result = await resolveZipLocation("23111");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.source).toBe("seed");
      expect(result.location.city).toBe("Mechanicsville");
      expect(result.providerConfigured).toBe(false);
    }
  });

  it("returns a clear error for unsupported ZIPs without live geocoding", async () => {
    delete process.env.GEOCODIO_API_KEY;

    const result = await resolveZipLocation("99999");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.providerConfigured).toBe(false);
      expect(result.error).toContain("GEOCODIO_API_KEY");
    }
  });

  it("rejects geocoded ZIPs outside the MVP service radius", async () => {
    process.env.GEOCODIO_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              location: { lat: 40.7128, lng: -74.006 },
              address_components: {
                city: "New York",
                state: "NY",
              },
            },
          ],
        }),
      }),
    );

    const result = await resolveZipLocation("10001");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("outside the current Yum4Less MVP service area");
      expect(result.providerConfigured).toBe(true);
    }

    vi.unstubAllGlobals();
  });
});
