import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import {
  resetZipLocationCacheForTests,
  resolveZipLocation,
} from "@/lib/geocoding";

const originalGeocodioKey = process.env.GEOCODIO_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalCi = process.env.CI;
const originalGithubActions = process.env.GITHUB_ACTIONS;

describe("resolveZipLocation", () => {
  afterEach(() => {
    resetZipLocationCacheForTests();
    process.env.GEOCODIO_API_KEY = originalGeocodioKey;
    if (originalNodeEnv === undefined) {
      deleteProcessEnvKey("NODE_ENV");
    } else {
      stubTestNodeEnv(originalNodeEnv);
    }
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
    if (originalGithubActions === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = originalGithubActions;
    }
  });

  it("returns the seeded local ZIP when no API key is configured in development", async () => {
    delete process.env.GEOCODIO_API_KEY;
    stubTestNodeEnv("development");
    delete process.env.CI;

    const result = await resolveZipLocation("23111");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.source).toBe("seed");
      expect(result.location.city).toBe("Mechanicsville");
      expect(result.providerConfigured).toBe(false);
    }
  });

  it("reuses the first resolved coords for the same ZIP within a process", async () => {
    delete process.env.GEOCODIO_API_KEY;
    stubTestNodeEnv("development");
    delete process.env.CI;

    const first = await resolveZipLocation("23111");
    const second = await resolveZipLocation("23111");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.location).toEqual(first.location);
    }
  });

  it("refuses seed ZIP fallback in production when GEOCODIO_API_KEY is missing", async () => {
    delete process.env.GEOCODIO_API_KEY;
    stubTestNodeEnv("production");
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    const result = await resolveZipLocation("23111");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("GEOCODIO_API_KEY is required in production");
      expect(result.providerConfigured).toBe(false);
    }
  });

  it("allows seed ZIP fallback in production only under CI runners", async () => {
    delete process.env.GEOCODIO_API_KEY;
    stubTestNodeEnv("production");
    process.env.CI = "true";

    const result = await resolveZipLocation("23111");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.source).toBe("seed");
    }
  });

  it("refuses seed fallback in production when Geocodio fails", async () => {
    process.env.GEOCODIO_API_KEY = "test-key";
    stubTestNodeEnv("production");
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const result = await resolveZipLocation("23111");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.providerConfigured).toBe(true);
    }

    vi.unstubAllGlobals();
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

  it("accepts geocoded continental US ZIPs when Geocodio is configured", async () => {
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

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.city).toBe("New York");
      expect(result.location.source).toBe("geocodio");
      expect(result.providerConfigured).toBe(true);
    }

    vi.unstubAllGlobals();
  });

  it("rejects geocoded ZIPs outside the continental US", async () => {
    process.env.GEOCODIO_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              location: { lat: 21.3069, lng: -157.8583 },
              address_components: {
                city: "Honolulu",
                state: "HI",
              },
            },
          ],
        }),
      }),
    );

    const result = await resolveZipLocation("96813");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("continental US");
      expect(result.providerConfigured).toBe(true);
    }

    vi.unstubAllGlobals();
  });
});
