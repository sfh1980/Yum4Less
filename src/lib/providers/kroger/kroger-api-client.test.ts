import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createKrogerApiClient,
  probeKrogerApiSetup,
  resetKrogerAccessTokenCacheForTests,
} from "@/lib/providers/kroger/kroger-api-client";
import {
  KROGER_API_SPEC,
  getKrogerApiBaseUrl,
} from "@/lib/providers/kroger/kroger-api-types";

const originalApiEnv = process.env.KROGER_API_ENV;

describe("createKrogerApiClient", () => {
  afterEach(() => {
    if (originalApiEnv === undefined) {
      delete process.env.KROGER_API_ENV;
    } else {
      process.env.KROGER_API_ENV = originalApiEnv;
    }
    resetKrogerAccessTokenCacheForTests();
    vi.unstubAllGlobals();
  });

  it("targets the production host when KROGER_API_ENV=production", async () => {
    process.env.KROGER_API_ENV = "production";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-locations" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const api = createKrogerApiClient({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    await api.searchLocations({ zipCodeNear: "23111", limit: 1 });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${KROGER_API_SPEC.productionBaseUrl}${KROGER_API_SPEC.tokenPath}`,
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      `${KROGER_API_SPEC.productionBaseUrl}${KROGER_API_SPEC.locationsPath}`,
    );
  });

  it("builds location search requests from the Location OpenAPI filters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-locations" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ locationId: "01400376", name: "Kroger Mechanicsville" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const api = createKrogerApiClient({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    const locations = await api.searchLocations({
      zipCodeNear: "23111",
      radiusInMiles: 10,
      limit: 1,
      chain: "Kroger",
    });

    expect(locations).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      `${getKrogerApiBaseUrl()}${KROGER_API_SPEC.locationsPath}`,
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("filter.zipCode.near=23111");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("filter.fulfillment");
  });

  it("builds product search requests with product.compact scope and ais fulfillment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-products" }), {
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
                items: [{ price: { regular: 6.49, promo: 5.99 }, fulfillment: { instore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const api = createKrogerApiClient({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    const products = await api.searchProducts({
      term: "chicken thighs",
      locationId: "01400376",
      fulfillment: "ais",
      limit: 3,
    });

    expect(products).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      `scope=${encodeURIComponent(KROGER_API_SPEC.scopes.products)}`,
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("filter.term=chicken+thighs");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("filter.locationId=01400376");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("filter.fulfillment=ais");
  });

  it("reuses one products-scope token across concurrent product searches", async () => {
    let tokenRequestCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
      const urlString = String(url);
      if (urlString.includes(KROGER_API_SPEC.tokenPath)) {
        tokenRequestCount += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "token-products-shared", expires_in: 1800 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                productId: "0001111000001",
                description: "Sample Product",
                items: [{ price: { regular: 1.99 }, fulfillment: { instore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = createKrogerApiClient({
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    await Promise.all([
      api.searchProducts({ term: "broccoli", locationId: "01400376", fulfillment: "ais", limit: 1 }),
      api.searchProducts({ term: "lemon", locationId: "01400376", fulfillment: "ais", limit: 1 }),
      api.searchProducts({ term: "bacon", locationId: "01400376", fulfillment: "ais", limit: 1 }),
    ]);

    expect(tokenRequestCount).toBe(1);
  });

  it("reports missing credentials from the setup probe", async () => {
    delete process.env.KROGER_CLIENT_ID;
    delete process.env.KROGER_CLIENT_SECRET;

    const probe = await probeKrogerApiSetup("23111");

    expect(probe.configured).toBe(false);
    expect(probe.tokenOk).toBe(false);
    expect(probe.message).toContain("credentials are missing");
  });

  it("reports catalog-only certification behavior when prices are absent", async () => {
    process.env.KROGER_API_ENV = "certification";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-locations" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ locationId: "02900529", name: "Kroger Mechanicsville" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-products" }), {
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
                description: "Fresh Broccoli Crowns",
                items: [{ fulfillment: { inStore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              productId: "0001111000001",
              description: "Fresh Broccoli Crowns",
              items: [{ fulfillment: { inStore: true } }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeKrogerApiSetup("23111", {
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    expect(probe.configured).toBe(true);
    expect(probe.tokenOk).toBe(true);
    expect(probe.locationId).toBe("02900529");
    expect(probe.catalogOk).toBe(true);
    expect(probe.pricingAvailable).toBe(false);
    expect(probe.productId).toBe("0001111000001");
    expect(probe.detailCatalogOk).toBe(true);
    expect(probe.productionPromotionReady).toBe(false);
    expect(probe.productionPromotionSteps?.length).toBeGreaterThan(0);
    expect(probe.message).toContain("certification");
  });

  it("marks production promotion ready when production returns store prices", async () => {
    process.env.KROGER_API_ENV = "production";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-locations" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ locationId: "02900529", name: "Kroger Mechanicsville" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-products" }), {
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
                description: "Fresh Broccoli Crowns",
                items: [{ price: { regular: 1.99, promo: 1.49 }, fulfillment: { inStore: true } }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              productId: "0001111000001",
              description: "Fresh Broccoli Crowns",
              items: [{ price: { regular: 1.99, promo: 1.49 }, fulfillment: { inStore: true } }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeKrogerApiSetup("23111", {
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    expect(probe.environment).toBe("production");
    expect(probe.baseUrl).toBe(KROGER_API_SPEC.productionBaseUrl);
    expect(probe.pricingAvailable).toBe(true);
    expect(probe.productionPromotionReady).toBe(true);
    expect(probe.message).toContain("store-specific pricing");
  });
});
