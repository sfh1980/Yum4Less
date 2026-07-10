import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const { resolveLocationInput, getRecommendationExperience } = vi.hoisted(() => ({
  resolveLocationInput: vi.fn(),
  getRecommendationExperience: vi.fn(),
}));

vi.mock("@/lib/location-resolution", async () => {
  const actual = await vi.importActual<typeof import("@/lib/location-resolution")>(
    "@/lib/location-resolution",
  );

  return {
    ...actual,
    resolveLocationInput,
  };
});

vi.mock("@/lib/recommendation-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recommendation-service")>(
    "@/lib/recommendation-service",
  );

  return {
    ...actual,
    getRecommendationExperience,
  };
});

import { POST } from "@/app/api/recommendations/route";
import { RecommendationDependencyUnavailableError } from "@/lib/recommendation-service";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import { RATE_LIMITS, resetRateLimitsForTests } from "@/lib/rate-limit";
import * as serverLog from "@/lib/server-log";

const originalDbWriteFlag = process.env.YUM4LESS_ENABLE_API_DB_WRITES;
const originalNodeEnv = process.env.NODE_ENV;

describe("POST /api/recommendations", () => {
  beforeEach(() => {
    resolveLocationInput.mockReset();
    getRecommendationExperience.mockReset();
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
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23111" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendation request payload is invalid.",
    });
  });

  it("rejects non-JSON request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: "not-json",
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
    ["budget", 4],
    ["budget", 251],
    ["maxIngredients", 2],
    ["maxIngredients", 21],
  ])("rejects out-of-bounds %s=%s", async (field, value) => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ ...validPayload, [field]: value }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendation request payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
  });

  it("rejects non-internal recipe sources on the public API", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          recipeSource: "themealdb",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendation request payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
  });

  it.each([
    ["shoppingStyle", "triple-store"],
    ["dietaryFocus", "paleo"],
    ["recipeSource", "not-a-real-source"],
  ])("rejects invalid enum field %s=%s", async (field, value) => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ ...validPayload, [field]: value }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendation request payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
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
    getRecommendationExperience.mockRejectedValue(
      new RecommendationDependencyUnavailableError(),
    );

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error:
        "Store and meal prices are not loading right now. Try again shortly.",
    });
  });

  it.each([
    ["selectedIngredientIds", "not-an-array"],
    ["selectedIngredientIds", ["valid-id", 123]],
    ["selectedIngredientIds", ["has spaces"]],
    ["selectedIngredientIds", ["UPPERCASE"]],
    ["selectedIngredientIds", [`${"a".repeat(81)}`]],
  ])("rejects invalid selectedIngredientIds payload %s=%s", async (_field, value) => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          planningMode: "ingredient-first",
          selectedIngredientIds: value,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendation request payload is invalid.",
    });
    expect(resolveLocationInput).not.toHaveBeenCalled();
  });

  it("accepts multi-store ranking requests beyond the shopping-route stop cap", async () => {
    const selectedStoreIds = Array.from(
      { length: 9 },
      (_, index) => `store-${index}`,
    );

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
    getRecommendationExperience.mockResolvedValue({
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
          message: "No provider coverage.",
        },
        providerPromotionReadiness: [],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "seed",
        saleIngredientChoices: [],
      },
      recommendations: [],
    });

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          shoppingStyle: "multi-store",
          selectedStoreIds,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveLocationInput).toHaveBeenCalled();
    expect(getRecommendationExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        shoppingStyle: "multi-store",
        selectedStoreIds,
      }),
      expect.anything(),
      false,
      undefined,
    );
  });

  it("returns 429 with Retry-After when the recommendations rate limit is exceeded", async () => {
    const request = new Request("http://localhost/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ zipCode: "23111" }),
    });
    const { maxRequests } = RATE_LIMITS.apiRecommendations;

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

  it("strips internal snapshot and store IDs from public market responses", async () => {
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
    getRecommendationExperience.mockResolvedValue({
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
        recommendationReadyStoreCount: 0,
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
        providerPricingPreviews: [
          {
            provider: "kroger",
            status: "cached",
            persistedSnapshotId: "snap-secret-2",
            matchedIngredientCount: 1,
            unmatchedIngredientCount: 0,
            averageMatchConfidence: 0.9,
            usesCachedPreview: true,
            ingredientSummaries: [],
          },
        ],
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
        providerPriceObservationSync: [
          {
            provider: "kroger",
            internalStoreId: "store-secret-1",
            syncedCount: 1,
            skippedCount: 0,
            status: "synced",
            message: "Internal only.",
          },
        ],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "seed",
        lookupProviderConfigured: false,
        dataSource: "seed",
        saleIngredientChoices: [],
        message: "Internal only.",
      },
      recommendations: [],
    });

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.experience.market.providerStoreSearches[0]).not.toHaveProperty(
      "persistedSnapshotId",
    );
    expect(body.experience.market.providerPricingPreviews[0]).not.toHaveProperty(
      "persistedSnapshotId",
    );
    expect(body.experience.market.providerPriceObservationSync[0]).not.toHaveProperty(
      "internalStoreId",
    );
    expect(body.experience.market.nearbyStores[0]?.id).toBe("kroger-mechanicsville");
    expect(body.experience.market).not.toHaveProperty("message");
  });

  it("returns 500 and logs when recommendation experience throws", async () => {
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
    getRecommendationExperience.mockRejectedValue(new Error("db timeout"));

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Recommendations are temporarily unavailable.",
    });
    expect(logSpy).toHaveBeenCalledWith(
      "api.recommendations",
      expect.objectContaining({ message: "db timeout" }),
    );
    logSpy.mockRestore();
  });

  it("returns a ZIP lookup failure when location resolution fails", async () => {
    resolveLocationInput.mockResolvedValue({
      ok: false,
      error: "Unsupported ZIP.",
      providerConfigured: false,
    });

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unsupported ZIP.",
      providerConfigured: false,
    });
  });

  it("returns recommendation results for a valid browser-location request", async () => {
    resolveLocationInput.mockResolvedValue({
      ok: true,
      location: {
        city: "Current location",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "browser",
      },
      providerConfigured: true,
    });
    getRecommendationExperience.mockResolvedValue({
      market: {
        locationLabel: "Current location",
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
        providerPromotionReadiness: [],
        providerPriceObservationSync: [],
        weeklyAdIngestionStatus: [],
        weeklyAdPromotionReadiness: [],
        lookupSource: "browser",
        lookupProviderConfigured: true,
        dataSource: "database",
        saleIngredientChoices: [],
        message: "Ready.",
      },
      recommendations: [],
    });

    const browserPayload = {
      ...validPayload,
      zipCode: "",
      latitude: 37.6085,
      longitude: -77.3321,
    };

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(browserPayload),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveLocationInput).toHaveBeenCalledWith({
      zipCode: "",
      latitude: 37.6085,
      longitude: -77.3321,
    });
    expect(getRecommendationExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        zipCode: "",
        radiusMiles: 5,
      }),
      expect.objectContaining({
        source: "browser",
      }),
      true,
      undefined,
    );
  });

  it("returns recommendation results for a valid request", async () => {
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
    getRecommendationExperience.mockResolvedValue({
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
        saleIngredientChoices: [],
        message: "Ready.",
      },
      recommendations: [],
    });

    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveLocationInput).toHaveBeenCalledWith({
      zipCode: "23111",
    });
    expect(getRecommendationExperience).toHaveBeenCalledWith(
      {
        ...validPayload,
        planningMode: "ingredient-first",
      },
      expect.objectContaining({
        zipCode: "23111",
        city: "Mechanicsville",
      }),
      false,
      undefined,
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      experience: {
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
          saleIngredientChoices: [],
        },
        recommendations: [],
      },
    });
  });
});

const validPayload = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 16,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
} as const;
