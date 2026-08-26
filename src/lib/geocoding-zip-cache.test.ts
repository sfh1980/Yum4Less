import { afterEach, describe, expect, it, vi } from "vitest";

const { readZipGeocodeCache } = vi.hoisted(() => ({
  readZipGeocodeCache: vi.fn(),
}));

vi.mock("@/lib/zip-geocode-cache", () => ({
  readZipGeocodeCache,
  upsertZipGeocodeCache: vi.fn(),
}));

import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import {
  resetZipLocationCacheForTests,
  resolveZipLocation,
} from "@/lib/geocoding";

describe("resolveZipLocation durable cache", () => {
  const originalGeocodioKey = process.env.GEOCODIO_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    resetZipLocationCacheForTests();
    readZipGeocodeCache.mockReset();
    if (originalGeocodioKey === undefined) {
      deleteProcessEnvKey("GEOCODIO_API_KEY");
    } else {
      process.env.GEOCODIO_API_KEY = originalGeocodioKey;
    }
    restoreTestNodeEnv(originalNodeEnv);
  });

  it("returns a cached geocode without calling Geocodio", async () => {
    deleteProcessEnvKey("GEOCODIO_API_KEY");
    stubTestNodeEnv("production");
    readZipGeocodeCache.mockResolvedValue({
      zipCode: "10001",
      city: "New York",
      state: "NY",
      latitude: 40.75,
      longitude: -73.99,
      source: "geocodio",
    });

    const result = await resolveZipLocation("10001");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.city).toBe("New York");
      expect(result.location.source).toBe("geocodio");
    }
  });
});
