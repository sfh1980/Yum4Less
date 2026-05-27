import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublixProviderClient } from "@/lib/providers/publix-provider";

describe("createPublixProviderClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports store discovery via the public locator service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Stores: [
            {
              KEY: "01626",
              NAME: "Brandy Creek Commons",
              SHORTNAME: "Brandy Creek Comm",
              OPTION: "ACFHLNOTY",
              ADDR: "6603 Mechanicsville Tpke",
              CITY: "Mechanicsville",
              STATE: "VA",
              ZIP: "23111",
              CLAT: "37.61089900",
              CLON: "-77.33577900",
              DISTANCE: "5",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createPublixProviderClient();

    expect(client.configured).toBe(true);

    const result = await client.searchStoresByLocation({
      location: {
        zipCode: "23111",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
      },
      radiusMiles: 10,
    });

    expect(result.status).toBe("available");
    expect(result.provenance).toBe("website-service");
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0]?.name).toBe("Brandy Creek Commons");
    expect(result.message).toContain("Apify");
  });

  it("keeps pricing preview inactive for the coming-soon rollout", async () => {
    const client = createPublixProviderClient();
    const result = await client.searchPricingPreview({
      store: {
        provider: "publix",
        providerStoreId: "01626",
        name: "Publix",
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
    expect(result.message).toContain("Apify");
  });
});
