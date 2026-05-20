import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveZipLocation, getRecommendationExperience } = vi.hoisted(() => ({
  resolveZipLocation: vi.fn(),
  getRecommendationExperience: vi.fn(),
}));

vi.mock("@/lib/geocoding", () => ({
  resolveZipLocation,
}));

vi.mock("@/lib/mock-recommendations", () => ({
  getRecommendationExperience,
}));

import { POST } from "@/app/api/recommendations/route";

describe("POST /api/recommendations", () => {
  beforeEach(() => {
    resolveZipLocation.mockReset();
    getRecommendationExperience.mockReset();
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

  it("returns a ZIP lookup failure when location resolution fails", async () => {
    resolveZipLocation.mockResolvedValue({
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

  it("returns recommendation results for a valid request", async () => {
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
    getRecommendationExperience.mockResolvedValue({
      market: {
        searchedZipCode: "23111",
        locationLabel: "Mechanicsville, VA",
        radiusMiles: 5,
        nearbyStores: [],
        lookupSource: "seed",
        providerConfigured: false,
        dataSource: "seed",
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
    expect(resolveZipLocation).toHaveBeenCalledWith("23111");
    expect(getRecommendationExperience).toHaveBeenCalledWith(
      validPayload,
      expect.objectContaining({
        zipCode: "23111",
        city: "Mechanicsville",
      }),
      false,
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      experience: {
        market: {
          searchedZipCode: "23111",
          locationLabel: "Mechanicsville, VA",
          radiusMiles: 5,
          nearbyStores: [],
          lookupSource: "seed",
          providerConfigured: false,
          dataSource: "seed",
          message: "Ready.",
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
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
} as const;
