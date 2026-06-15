import { afterEach, describe, expect, it, vi } from "vitest";
import { resetKrogerAccessTokenCacheForTests } from "@/lib/providers/kroger/kroger-api-client";
import { KROGER_API_SPEC } from "@/lib/providers/kroger/kroger-api-types";
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

    resetKrogerAccessTokenCacheForTests();
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

  it("retries with priority-2 search term when priority-1 has no match at or above 0.45", async () => {
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
                productId: "0001312000026",
                description: "Ore-Ida Seasoned Crispy Mini Frozen Tater Tots",
                brand: "Ore-Ida",
                items: [{ price: { regular: 5.49 }, fulfillment: { instore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                productId: "0001111060338",
                description: "Private Selection Yellow Petite Potatoes Bag",
                brand: "Private Selection",
                items: [{ price: { regular: 3.99 }, fulfillment: { instore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
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
          ingredientId: "baby-potatoes",
          ingredientName: "Baby potatoes",
          searchTerm: "baby gold potatoes",
          fallbackSearchTerm: "petite potatoes",
        },
      ],
    });

    expect(result.matchedIngredientCount).toBe(1);
    expect(result.items[0]?.providerProductId).toBe("0001111060338");
    expect(result.items[0]?.matchConfidence).toBeGreaterThanOrEqual(0.45);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("warms and reuses one products token across parallel ingredient searches in a batch", async () => {
    process.env.KROGER_CLIENT_ID = "client-id";
    process.env.KROGER_CLIENT_SECRET = "client-secret";
    process.env.KROGER_API_ENV = "production";

    const productResponse = (productId: string, description: string) =>
      new Response(
        JSON.stringify({
          data: [
            {
              productId,
              description,
              brand: "Kroger",
              items: [
                {
                  price: { regular: 2.99, promo: 2.49 },
                  fulfillment: { instore: true },
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-products", expires_in: 1800 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        productResponse("0001111000001", "Fresh Chicken Thighs Family Pack"),
      )
      .mockResolvedValueOnce(
        productResponse("0001111000002", "Fresh Broccoli Crowns"),
      )
      .mockResolvedValueOnce(
        productResponse("0001111000003", "Kroger Pure Olive Oil"),
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
          searchTerm: "chicken thigh",
        },
        {
          ingredientId: "broccoli",
          ingredientName: "Broccoli",
          searchTerm: "broccoli",
        },
        {
          ingredientId: "olive-oil",
          ingredientName: "Olive oil",
          searchTerm: "olive oil",
        },
      ],
    });

    expect(result.matchedIngredientCount).toBe(3);
    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes(KROGER_API_SPEC.tokenPath),
    );
    expect(tokenCalls).toHaveLength(1);
  });
});
