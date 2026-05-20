import { afterEach, describe, expect, it } from "vitest";
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
});
