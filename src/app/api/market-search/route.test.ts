import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const { resolveLocationInput, getMarketSearchExperience } = vi.hoisted(() => ({
  resolveLocationInput: vi.fn(),
  getMarketSearchExperience: vi.fn(),
}));

vi.mock("@/lib/location-resolution", () => ({
  resolveLocationInput,
}));

vi.mock("@/lib/recommendation-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recommendation-service")>();
  return {
    ...actual,
    getMarketSearchExperience,
  };
});

import { POST } from "@/app/api/market-search/route";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import { RATE_LIMITS, resetRateLimitsForTests } from "@/lib/rate-limit";
import * as serverLog from "@/lib/server-log";

const originalDbWriteFlag = process.env.YUM4LESS_ENABLE_API_DB_WRITES;
const originalNodeEnv = process.env.NODE_ENV;

describe("POST /api/market-search", () => {
  beforeEach(() => {
    resolveLocationInput.mockReset();
    getMarketSearchExperience.mockReset();
  });

  afterEach(() => {
    resetRateLimitsForTests();

    if (originalDbWriteFlag === undefined) {
      delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    } else {
      process.env.YUM4LESS_ENABLE_API_DB_WRITES = originalDbWriteFlag;
    }

    if (originalNodeEnv === undefined) {
      deleteProcessEnvKey("NODE_ENV");
    } else {
      stubTestNodeEnv(originalNodeEnv);
    }
  });

  it("keeps Postgres writes disabled on the public route by default", () => {
    delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    deleteProcessEnvKey("NODE_ENV");
    expect(isPublicApiDbWriteEnabled()).toBe(false);
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23111" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Market search payload is invalid.",
    });
  });

  it("rejects non-JSON request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: "{bad json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body must be valid JSON.",
    });
  });

  it.each([
    ["radiusMiles", 0],
    ["radiusMiles", 26],
  ])("rejects out-of-bounds %s=%s", async (field, value) => {
    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({
          zipCode: "23111",
          [field]: value,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Market search payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
  });

  it.each(["2311", "abcde", ""])("rejects invalid ZIP %s", async (zipCode) => {
    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({
          zipCode,
          radiusMiles: 5,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Market search payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the market-search rate limit is exceeded", async () => {
    const request = new Request("http://localhost/api/market-search", {
      method: "POST",
      body: JSON.stringify({ zipCode: "23111" }),
    });
    const { maxRequests } = RATE_LIMITS.apiMarketSearch;

    for (let index = 0; index < maxRequests; index += 1) {
      const response = await POST(request);
      expect(response.status).toBe(400);
    }

    const limited = await POST(request);

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      ok: false,
      error: "Too many requests. Please wait and try again.",
    });
    const retryAfter = limited.headers.get("Retry-After");
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("returns 500 and logs when market search experience throws", async () => {
    const logSpy = vi.spyOn(serverLog, "logServerError").mockImplementation(() => {});
    resolveLocationInput.mockResolvedValue({
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
    getMarketSearchExperience.mockRejectedValue(new Error("service failure"));

    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23111", radiusMiles: 5 }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Market search is temporarily unavailable.",
    });
    expect(logSpy).toHaveBeenCalledWith(
      "api.market-search",
      expect.objectContaining({ message: "service failure" }),
    );
    logSpy.mockRestore();
  });

  it("returns 503 when pricing dependencies are unavailable (M4)", async () => {
    resolveLocationInput.mockResolvedValue({
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
    getMarketSearchExperience.mockResolvedValue({
      market: {
        searchedZipCode: "23111",
        locationLabel: "Mechanicsville, VA",
        searchLatitude: 37.6085,
        searchLongitude: -77.3321,
        radiusMiles: 5,
        nearbyStores: [],
        recommendationReadyStoreCount: 0,
        providerRollout: [],
        providerStoreSearches: [],
        providerPricingPreviews: [],
        providerCoverageRollup: {
          overallCoverageStatus: "none",
          trustGate: "not-available",
          rankedPricingSource: "seed-preview",
          totalTrackedIngredients: 0,
          matchedIngredientCount: 0,
          unmatchedIngredientCount: 0,
          averageMatchConfidence: null,
          usesCachedPreview: false,
          ingredientSummaries: [],
          message: "Unavailable.",
        },
        providerPromotionReadiness: [],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "unavailable",
        saleIngredientChoices: [],
      },
      snapshot: {
        stores: [],
        recipes: [],
        priceObservations: [],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23111", radiusMiles: 5 }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error:
        "Store and meal prices are not loading right now. Try again shortly.",
    });
  });

  it("returns a location resolution failure", async () => {
    resolveLocationInput.mockResolvedValue({
      ok: false,
      error: "Unsupported ZIP.",
      providerConfigured: false,
    });

    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({
          zipCode: "99999",
          radiusMiles: 5,
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unsupported ZIP.",
      providerConfigured: false,
    });
  });

  it("returns market search results for a valid request", async () => {
    resolveLocationInput.mockResolvedValue({
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
    getMarketSearchExperience.mockResolvedValue({
      market: {
        searchedZipCode: "23111",
        locationLabel: "Mechanicsville, VA",
        searchLatitude: 37.6085,
        searchLongitude: -77.3321,
        radiusMiles: 5,
        nearbyStores: [],
        recommendationReadyStoreCount: 0,
        providerRollout: [],
        providerStoreSearches: [],
        providerPricingPreviews: [],
        providerCoverageRollup: {
          overallCoverageStatus: "none",
          trustGate: "not-available",
          rankedPricingSource: "seed-preview",
          totalTrackedIngredients: 5,
          matchedIngredientCount: 0,
          unmatchedIngredientCount: 5,
          averageMatchConfidence: null,
          usesCachedPreview: false,
          ingredientSummaries: [],
          message:
            "No official provider pricing preview was available for this search. Ranked meal pricing stays on trusted seed/DB data only.",
        },
        providerPromotionReadiness: [
          {
            provider: "kroger",
            overallStatus: "blocked",
            gatesPassedCount: 0,
            gatesTotalCount: 6,
            gates: [],
            recommendationPricingPromotionEnabled: false,
            message:
              "Kroger preview promotion is blocked because preview coverage is unavailable or too weak. Ranked meal pricing stays on trusted seed/DB data only.",
          },
        ],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "seed",
        message: "Ready.",
      },
      snapshot: {
        stores: [],
        recipes: [],
        priceObservations: [],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({
          zipCode: "23111",
          radiusMiles: 5,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveLocationInput).toHaveBeenCalledWith({
      zipCode: "23111",
      radiusMiles: 5,
    });
    expect(getMarketSearchExperience).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        zipCode: "23111",
        city: "Mechanicsville",
      }),
      false,
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      market: {
        searchedZipCode: "23111",
        locationLabel: "Mechanicsville, VA",
        searchLatitude: 37.6085,
        searchLongitude: -77.3321,
        radiusMiles: 5,
        nearbyStores: [],
        recommendationReadyStoreCount: 0,
        providerRollout: [],
        providerStoreSearches: [],
        providerPricingPreviews: [],
        providerCoverageRollup: {
          overallCoverageStatus: "none",
          trustGate: "not-available",
          rankedPricingSource: "seed-preview",
          totalTrackedIngredients: 5,
          matchedIngredientCount: 0,
          unmatchedIngredientCount: 5,
          averageMatchConfidence: null,
          usesCachedPreview: false,
          ingredientSummaries: [],
          message:
            "No official provider pricing preview was available for this search. Ranked meal pricing stays on trusted seed/DB data only.",
        },
        providerPromotionReadiness: [
          {
            provider: "kroger",
            overallStatus: "blocked",
            gatesPassedCount: 0,
            gatesTotalCount: 6,
            gates: [],
            recommendationPricingPromotionEnabled: false,
            message:
              "Kroger preview promotion is blocked because preview coverage is unavailable or too weak. Ranked meal pricing stays on trusted seed/DB data only.",
          },
        ],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "seed",
      },
    });
  });

  it("preserves public catalog store ids while stripping internal provider fields", async () => {
    resolveLocationInput.mockResolvedValue({
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
    getMarketSearchExperience.mockResolvedValue({
      market: {
        searchedZipCode: "23111",
        locationLabel: "Mechanicsville, VA",
        searchLatitude: 37.6085,
        searchLongitude: -77.3321,
        radiusMiles: 5,
        nearbyStores: [
          {
            id: "kroger-mechanicsville",
            name: "Kroger Mechanicsville",
            kind: "grocery",
            latitude: 37.6085,
            longitude: -77.3321,
            distanceMiles: 1.2,
            chain: "kroger",
            chainLabel: "Kroger",
            rolloutStatus: "weekly-ad-preview",
            recommendationEnabled: true,
            rolloutNote: "Fixture coverage.",
          },
        ],
        recommendationReadyStoreCount: 1,
        providerRollout: [],
        providerStoreSearches: [
          {
            provider: "kroger",
            status: "cached",
            persistedSnapshotId: "snap-secret-1",
            storeCount: 1,
            stores: [],
          },
        ],
        providerPricingPreviews: [],
        providerCoverageRollup: {
          overallCoverageStatus: "none",
          trustGate: "not-available",
          rankedPricingSource: "seed-preview",
          totalTrackedIngredients: 5,
          matchedIngredientCount: 0,
          unmatchedIngredientCount: 5,
          averageMatchConfidence: null,
          usesCachedPreview: false,
          ingredientSummaries: [],
          message: "Internal only.",
        },
        providerPromotionReadiness: [],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "seed",
        message: "Internal only.",
      },
      snapshot: {
        stores: [],
        recipes: [],
        priceObservations: [],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/market-search", {
        method: "POST",
        body: JSON.stringify({
          zipCode: "23111",
          radiusMiles: 5,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.market.nearbyStores[0]?.id).toBe("kroger-mechanicsville");
    expect(body.market.providerStoreSearches[0]).not.toHaveProperty(
      "persistedSnapshotId",
    );
    expect(body.market).not.toHaveProperty("message");
  });
});
