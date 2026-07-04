import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveLocationInput, getPipelineDebugView } = vi.hoisted(() => ({
  resolveLocationInput: vi.fn(),
  getPipelineDebugView: vi.fn(),
}));

vi.mock("@/lib/location-resolution", () => ({
  resolveLocationInput,
}));

vi.mock("@/lib/debug/pipeline-debug-service", () => ({
  getPipelineDebugView,
}));

import { GET } from "@/app/api/debug/pipeline/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalNodeEnv = process.env.NODE_ENV;
const originalDebugRoutesEnabled = process.env.YUM4LESS_DEBUG_ROUTES_ENABLED;

describe("GET /api/debug/pipeline", () => {
  beforeEach(() => {
    resolveLocationInput.mockReset();
    getPipelineDebugView.mockReset();
    resetRateLimitsForTests();
    process.env.NODE_ENV = "development";
    process.env.YUM4LESS_DEBUG_ROUTES_ENABLED = "1";
  });

  afterEach(() => {
    resetRateLimitsForTests();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalDebugRoutesEnabled === undefined) {
      delete process.env.YUM4LESS_DEBUG_ROUTES_ENABLED;
    } else {
      process.env.YUM4LESS_DEBUG_ROUTES_ENABLED = originalDebugRoutesEnabled;
    }
  });

  it("returns 404 in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.YUM4LESS_DEBUG_ROUTES_ENABLED = "1";

    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=23111"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Not found.",
    });
    expect(getPipelineDebugView).not.toHaveBeenCalled();
  });

  it("returns 404 in non-production without YUM4LESS_DEBUG_ROUTES_ENABLED", async () => {
    delete process.env.YUM4LESS_DEBUG_ROUTES_ENABLED;

    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=23111"),
    );

    expect(response.status).toBe(404);
    expect(getPipelineDebugView).not.toHaveBeenCalled();
  });

  it("returns 400 when neither zip nor coordinates are provided", async () => {
    const response = await GET(new Request("http://localhost/api/debug/pipeline"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("zip=23111"),
    });
  });

  it("returns 400 for an invalid ZIP", async () => {
    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=abc"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a valid 5-digit ZIP code.",
    });
  });

  it("returns 400 when zip and coordinates are both provided", async () => {
    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=23111&lat=37.6&lng=-77.4"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Provide either zip or lat/lng, not both.",
    });
  });

  it("returns pipeline debug JSON for a valid ZIP", async () => {
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

    getPipelineDebugView.mockResolvedValue({
      ok: true,
      zipCode: "23111",
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 10,
      locationLabel: "Mechanicsville, VA",
      dataSource: "database",
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          chain: "kroger",
          chainLabel: "Kroger",
          distanceMiles: 1.2,
          recommendationEnabled: true,
          rolloutStatus: "weekly-ad-preview",
          trustBadge: "Est. sale prices",
        },
      ],
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          sourceName: "kroger-official-api",
          price: 6.49,
          observedAt: "2026-06-13T10:00:00.000Z",
          confidenceScore: 0.9,
          saleLabel: "Kroger promo price",
          validThrough: null,
          freshnessHoursAgo: 2,
        },
      ],
      freshnessSummary: {
        observationCount: 1,
        freshWithin24Hours: 1,
        staleCount: 0,
        countsBySource: { "kroger-official-api": 1 },
      },
      trackedIngredientIds: ["chicken-thighs", "ground-beef"],
      missingIngredientIds: ["ground-beef"],
    });

    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=23111"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.nearbyStores).toHaveLength(1);
    expect(body.priceObservations).toHaveLength(1);
    expect(body).not.toHaveProperty("recipes");
    expect(body).not.toHaveProperty("recommendations");
    expect(getPipelineDebugView).toHaveBeenCalledWith({
      location: expect.objectContaining({ zipCode: "23111" }),
      radiusMiles: 10,
    });
  });

  it("returns pipeline debug JSON for lat/lng coordinates", async () => {
    resolveLocationInput.mockResolvedValue({
      ok: true,
      location: {
        city: "Current location",
        state: "US",
        latitude: 37.6,
        longitude: -77.4,
        source: "browser",
      },
      providerConfigured: true,
    });

    getPipelineDebugView.mockResolvedValue({
      ok: true,
      zipCode: null,
      latitude: 37.6,
      longitude: -77.4,
      radiusMiles: 10,
      locationLabel: "Current location",
      dataSource: "database",
      nearbyStores: [],
      priceObservations: [],
      freshnessSummary: {
        observationCount: 0,
        freshWithin24Hours: 0,
        staleCount: 0,
        countsBySource: {},
      },
      trackedIngredientIds: [],
      missingIngredientIds: [],
    });

    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?lat=37.6&lng=-77.4"),
    );

    expect(response.status).toBe(200);
    expect(resolveLocationInput).toHaveBeenCalledWith({
      latitude: 37.6,
      longitude: -77.4,
    });
  });

  it("returns 503 when the database is unavailable", async () => {
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

    getPipelineDebugView.mockResolvedValue({
      ok: true,
      zipCode: "23111",
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 10,
      locationLabel: "Mechanicsville, VA",
      dataSource: "unavailable",
      nearbyStores: [],
      priceObservations: [],
      freshnessSummary: {
        observationCount: 0,
        freshWithin24Hours: 0,
        staleCount: 0,
        countsBySource: {},
      },
      trackedIngredientIds: [],
      missingIngredientIds: [],
    });

    const response = await GET(
      new Request("http://localhost/api/debug/pipeline?zip=23111"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Pipeline debug requires database access.",
    });
  });
});
