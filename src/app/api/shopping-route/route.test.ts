import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buildMultiStoreShoppingRoute } = vi.hoisted(() => ({
  buildMultiStoreShoppingRoute: vi.fn(),
}));

vi.mock("@/lib/multi-store-shopping-route", () => ({
  buildMultiStoreShoppingRoute,
}));

import { POST } from "@/app/api/shopping-route/route";
import { RATE_LIMITS, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("POST /api/shopping-route", () => {
  beforeEach(() => {
    buildMultiStoreShoppingRoute.mockReset();
    buildMultiStoreShoppingRoute.mockResolvedValue({ stops: [] });
  });

  afterEach(() => {
    resetRateLimitsForTests();
  });

  it("rejects more than the configured maximum store stops", async () => {
    const stores = Array.from({ length: 9 }, (_, index) => ({
      storeName: `Store ${index + 1}`,
      latitude: 37.6 + index * 0.001,
      longitude: -77.33,
    }));

    const response = await POST(
      new Request("http://localhost/api/shopping-route", {
        method: "POST",
        body: JSON.stringify({
          home: { latitude: 37.6085, longitude: -77.3321 },
          stores,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Route planning supports up to 8 store stops.",
    });
    expect(buildMultiStoreShoppingRoute).not.toHaveBeenCalled();
  });

  it("rejects out-of-range coordinates", async () => {
    const response = await POST(
      new Request("http://localhost/api/shopping-route", {
        method: "POST",
        body: JSON.stringify({
          home: { latitude: 91, longitude: -77.3321 },
          stores: [
            {
              storeName: "Kroger",
              latitude: 37.6652,
              longitude: -77.3651,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Home coordinates are required for route planning.",
    });
    expect(buildMultiStoreShoppingRoute).not.toHaveBeenCalled();
  });

  it("rejects non-JSON request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/shopping-route", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body must be valid JSON.",
    });
    expect(buildMultiStoreShoppingRoute).not.toHaveBeenCalled();
  });

  it("rejects empty store stop lists", async () => {
    const response = await POST(
      new Request("http://localhost/api/shopping-route", {
        method: "POST",
        body: JSON.stringify({
          home: { latitude: 37.6085, longitude: -77.3321 },
          stores: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "At least one store stop is required for route planning.",
    });
    expect(buildMultiStoreShoppingRoute).not.toHaveBeenCalled();
  });

  it("rejects store stops missing a name or coordinates", async () => {
    const response = await POST(
      new Request("http://localhost/api/shopping-route", {
        method: "POST",
        body: JSON.stringify({
          home: { latitude: 37.6085, longitude: -77.3321 },
          stores: [{ storeName: "", latitude: 37.6652, longitude: -77.3651 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Each store stop must include a name and coordinates.",
    });
    expect(buildMultiStoreShoppingRoute).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the shopping-route rate limit is exceeded", async () => {
    const request = new Request("http://localhost/api/shopping-route", {
      method: "POST",
      body: JSON.stringify({ home: { latitude: 91, longitude: -77.3321 }, stores: [] }),
    });
    const { maxRequests } = RATE_LIMITS.apiShoppingRoute;

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
});
