import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const { resolveLocationInput, getPantryCoverageExperience } = vi.hoisted(() => ({
  resolveLocationInput: vi.fn(),
  getPantryCoverageExperience: vi.fn(),
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

vi.mock("@/lib/pantry-coverage-service", () => ({
  getPantryCoverageExperience,
}));

import { POST } from "@/app/api/pantry-coverage/route";
import { RecommendationDependencyUnavailableError } from "@/lib/recommendation-service";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalNodeEnv = process.env.NODE_ENV;

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

describe("POST /api/pantry-coverage", () => {
  beforeEach(() => {
    resolveLocationInput.mockReset();
    getPantryCoverageExperience.mockReset();
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
    getPantryCoverageExperience.mockResolvedValue({
      suggestedChecklist: [
        {
          ingredientId: "cumin",
          ingredientName: "Ground cumin",
          category: "seasoning",
          recipeCount: 2,
        },
      ],
      fullyCoveredRecipeCount: 3,
      eligibleRecipeCount: 8,
    });
  });

  afterEach(() => {
    resetRateLimitsForTests();

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      restoreTestNodeEnv(originalNodeEnv);
    }
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/pantry-coverage", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23111" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Pantry coverage request payload is invalid.",
    });
  });

  it("returns pantry coverage experience on valid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/pantry-coverage", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      suggestedChecklist: [
        {
          ingredientId: "cumin",
          ingredientName: "Ground cumin",
          category: "seasoning",
          recipeCount: 2,
        },
      ],
      fullyCoveredRecipeCount: 3,
      eligibleRecipeCount: 8,
    });
    expect(getPantryCoverageExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        zipCode: "23111",
        selectedStoreIds: ["kroger-mechanicsville"],
      }),
      expect.objectContaining({ zipCode: "23111" }),
      false,
      undefined,
    );
  });

  it("passes pantryIngredientIds and includeIngredientCatalog to the service", async () => {
    await POST(
      new Request("http://localhost/api/pantry-coverage", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          pantryIngredientIds: ["olive-oil"],
          includeIngredientCatalog: true,
        }),
      }),
    );

    expect(getPantryCoverageExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        pantryIngredientIds: ["olive-oil"],
        includeIngredientCatalog: true,
      }),
      expect.any(Object),
      false,
      undefined,
    );
  });

  it("returns empty checklist shape when service reports zero near-misses", async () => {
    getPantryCoverageExperience.mockResolvedValue({
      suggestedChecklist: [],
      fullyCoveredRecipeCount: 0,
      eligibleRecipeCount: 5,
      ingredientCatalog: [{ id: "olive-oil", name: "Olive oil", category: "pantry" }],
    });

    const response = await POST(
      new Request("http://localhost/api/pantry-coverage", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          includeIngredientCatalog: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      suggestedChecklist: [],
      fullyCoveredRecipeCount: 0,
      eligibleRecipeCount: 5,
      ingredientCatalog: [{ id: "olive-oil", name: "Olive oil", category: "pantry" }],
    });
  });

  it("returns 503 when dependencies are unavailable", async () => {
    getPantryCoverageExperience.mockRejectedValue(
      new RecommendationDependencyUnavailableError(),
    );

    const response = await POST(
      new Request("http://localhost/api/pantry-coverage", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Store and meal prices are not loading right now. Try again shortly.",
    });
  });
});
