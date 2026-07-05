import { describe, expect, it } from "vitest";
import {
  buildPublixCatalogStoreFromLocator,
  buildPublixCatalogStoreId,
  PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID,
  PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_NUMBER,
  RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
} from "@/lib/publix-catalog-sync";

describe("publix-catalog-sync", () => {
  it("documents the retired bootstrap slug and canonical Mechanicsville store id", () => {
    expect(RETIRED_PUBLIX_BOOTSTRAP_STORE_ID).toBe("publix-atlee");
    expect(PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_NUMBER).toBe(1626);
    expect(PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID).toBe("publix-1626");
  });

  it("maps Publix locator records to map-context catalog stores", () => {
    const store = buildPublixCatalogStoreFromLocator({
      KEY: "01626",
      NAME: "Brandy Creek Commons",
      CITY: "Mechanicsville",
      STATE: "VA",
      ZIP: "23111",
      CLAT: "37.61089900",
      CLON: "-77.33577900",
    });

    expect(store).toEqual(
      expect.objectContaining({
        id: buildPublixCatalogStoreId(1626),
        latitude: 37.610899,
        longitude: -77.335779,
        sourceName: "publix-store-locator",
        sourceStoreId: "1626",
      }),
    );
  });
});
