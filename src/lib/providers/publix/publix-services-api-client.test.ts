import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStoreCookie,
  createPublixServicesApiClient,
  searchStoresByZip,
} from "@/lib/providers/publix/publix-services-api-client";
import { PUBLIX_SERVICES_API_SPEC } from "@/lib/providers/publix/publix-services-api-types";

describe("createPublixServicesApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds store lookup requests for ZIP search", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Stores: [
            {
              KEY: "01626",
              NAME: "Brandy Creek Commons",
              SHORTNAME: "Brandy Creek Comm",
              OPTION: "ACFHLNOTY",
              CITY: "Mechanicsville",
              STATE: "VA",
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

    const stores = await searchStoresByZip({ zipCode: "23111", count: 1 });

    expect(stores).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `${PUBLIX_SERVICES_API_SPEC.baseUrl}${PUBLIX_SERVICES_API_SPEC.storeLocationPath}`,
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("zipCode=23111");
  });

  it("builds a store cookie from a locator record", () => {
    const api = createPublixServicesApiClient();
    const cookie = api.buildStoreCookie({
      KEY: "01626",
      NAME: "Brandy Creek Commons",
      SHORTNAME: "Brandy Creek Comm",
      OPTION: "ACFHLNOTY",
    });

    expect(cookie).toEqual({
      StoreName: "Brandy Creek Commons",
      StoreNumber: 1626,
      Option: "ACFHLNOTY",
      ShortStoreName: "Brandy Creek Comm",
    });
  });

  it("returns undefined when store cookie fields are incomplete", () => {
    expect(buildStoreCookie({ KEY: "01626", NAME: "Brandy Creek Commons" })).toBeUndefined();
  });
});
