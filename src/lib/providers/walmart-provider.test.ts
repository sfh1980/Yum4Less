import { afterEach, describe, expect, it } from "vitest";
import { createWalmartProviderClient } from "@/lib/providers/walmart-provider";

describe("createWalmartProviderClient", () => {
  const originalClientId = process.env.WALMART_CLIENT_ID;
  const originalClientSecret = process.env.WALMART_CLIENT_SECRET;

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.WALMART_CLIENT_ID;
    } else {
      process.env.WALMART_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.WALMART_CLIENT_SECRET;
    } else {
      process.env.WALMART_CLIENT_SECRET = originalClientSecret;
    }
  });

  it("reports not-configured store discovery with seed-preview-aware messaging", async () => {
    delete process.env.WALMART_CLIENT_ID;
    delete process.env.WALMART_CLIENT_SECRET;

    const client = createWalmartProviderClient();

    expect(client.configured).toBe(false);
    expect(client.provider).toBe("walmart");

    const result = await client.searchStoresByLocation({
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      radiusMiles: 5,
    });

    expect(result.status).toBe("not-configured");
    expect(result.provenance).toBe("not-configured");
    expect(result.stores).toEqual([]);
    expect(result.message).toContain("nearby context only");
    expect(result.message).toContain("live, current Walmart pricing is not available");
  });

  it("detects configured credentials while keeping live discovery unwired", async () => {
    process.env.WALMART_CLIENT_ID = "test-client-id";
    process.env.WALMART_CLIENT_SECRET = "test-client-secret";

    const client = createWalmartProviderClient();
    const result = await client.searchStoresByLocation({
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      radiusMiles: 5,
    });

    expect(client.configured).toBe(true);
    expect(result.status).toBe("not-configured");
    expect(result.configured).toBe(true);
    expect(result.message).toContain("credentials are configured");
    expect(result.message).toContain("has not wired an approved official API path yet");
  });

  it("keeps pricing preview inactive while Walmart stays excluded from ranked pricing", async () => {
    delete process.env.WALMART_CLIENT_ID;
    delete process.env.WALMART_CLIENT_SECRET;

    const client = createWalmartProviderClient();
    const result = await client.searchPricingPreview({
      store: {
        provider: "walmart",
        providerStoreId: "unavailable",
        name: "Walmart Supercenter",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
      },
      ingredients: [
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          searchTerm: "Chicken thighs",
        },
      ],
    });

    expect(result.status).toBe("not-configured");
    expect(result.coverageStatus).toBe("none");
    expect(result.message).toContain("Live, actionable Walmart prices are not available");
  });
});
