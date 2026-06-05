import { afterEach, describe, expect, it, vi } from "vitest";
import { createKrogerProviderClient } from "@/lib/providers/kroger-provider";

const originalClientId = process.env.KROGER_CLIENT_ID;
const originalClientSecret = process.env.KROGER_CLIENT_SECRET;
const originalApiEnv = process.env.KROGER_API_ENV;

describe("createKrogerProviderClient", () => {
  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.KROGER_CLIENT_ID;
    } else {
      process.env.KROGER_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.KROGER_CLIENT_SECRET;
    } else {
      process.env.KROGER_CLIENT_SECRET = originalClientSecret;
    }

    if (originalApiEnv === undefined) {
      delete process.env.KROGER_API_ENV;
    } else {
      process.env.KROGER_API_ENV = originalApiEnv;
    }

    vi.unstubAllGlobals();
  });

  it("reports a clear not-configured result when credentials are missing", async () => {
    delete process.env.KROGER_CLIENT_ID;
    delete process.env.KROGER_CLIENT_SECRET;

    const client = createKrogerProviderClient();
    const result = await client.searchStoresByLocation({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
    });

    expect(result.status).toBe("not-configured");
    expect(result.provenance).toBe("not-configured");
    expect(result.configured).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.stores).toEqual([]);
  });

  it("normalizes nearby Kroger stores when the provider responds successfully", async () => {
    process.env.KROGER_CLIENT_ID = "client-id";
    process.env.KROGER_CLIENT_SECRET = "client-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                locationId: "01100479",
                name: "Kroger Mechanicsville",
                address: {
                  addressLine1: "9351 Atlee Rd",
                  city: "Mechanicsville",
                  state: "VA",
                  zipCode: "23116",
                },
                geolocation: {
                  latitude: 37.6652,
                  longitude: -77.3651,
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = createKrogerProviderClient();
    const result = await client.searchStoresByLocation({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
    });

    expect(result.status).toBe("available");
    expect(result.provenance).toBe("official-api");
    expect(result.configured).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.stores).toEqual([
      expect.objectContaining({
        provider: "kroger",
        providerStoreId: "01100479",
        name: "Kroger Mechanicsville",
        city: "Mechanicsville",
      }),
    ]);
  });

  it("does not surface official-online prices in certification even when catalog matches exist", async () => {
    process.env.KROGER_CLIENT_ID = "client-id";
    process.env.KROGER_CLIENT_SECRET = "client-secret";
    process.env.KROGER_API_ENV = "certification";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                productId: "0001111000001",
                description: "Fresh Chicken Thighs Family Pack",
                brand: "Kroger",
                items: [{ fulfillment: { instore: true } }],
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = createKrogerProviderClient();
    const result = await client.searchPricingPreview({
      store: {
        provider: "kroger",
        providerStoreId: "01100479",
        name: "Kroger Mechanicsville",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6652,
        longitude: -77.3651,
      },
      ingredients: [
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          searchTerm: "Chicken thighs",
        },
      ],
    });

    expect(result.status).toBe("available");
    expect(result.items).toEqual([]);
    expect(result.matchedIngredientCount).toBe(0);
    expect(result.message).toContain("certification");
    expect(result.message).toContain("KROGER_API_ENV=production");
  });

  it("builds a Kroger pricing preview for tracked ingredients in production", async () => {
    process.env.KROGER_CLIENT_ID = "client-id";
    process.env.KROGER_CLIENT_SECRET = "client-secret";
    process.env.KROGER_API_ENV = "production";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                productId: "0001111000001",
                description: "Fresh Chicken Thighs Family Pack",
                brand: "Kroger",
                items: [
                  {
                    price: {
                      regular: 6.49,
                      promo: 5.99,
                    },
                    fulfillment: {
                      instore: true,
                    },
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = createKrogerProviderClient();
    const result = await client.searchPricingPreview({
      store: {
        provider: "kroger",
        providerStoreId: "01100479",
        name: "Kroger Mechanicsville",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6652,
        longitude: -77.3651,
      },
      ingredients: [
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          searchTerm: "Chicken thighs",
        },
      ],
    });

    expect(result.status).toBe("available");
    expect(result.coverageStatus).toBe("strong");
    expect(result.matchedIngredientCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        ingredientId: "chicken-thighs",
        providerProductId: "0001111000001",
        regularPrice: 6.49,
        matchConfidence: expect.any(Number),
        matchReason: expect.stringContaining("description contains"),
      }),
    ]);
    expect(result.message).toContain("verify in store");
  });
});
