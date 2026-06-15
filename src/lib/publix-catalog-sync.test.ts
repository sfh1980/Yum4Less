import { describe, expect, it } from "vitest";
import {
  buildPublixCatalogStoreFromLocator,
  buildPublixCatalogStoreId,
} from "@/lib/publix-catalog-sync";

describe("publix-catalog-sync", () => {
  it("maps Publix locator records to map-context catalog stores", () => {
    const store = buildPublixCatalogStoreFromLocator({
      KEY: "1626",
      NAME: "Brandy Creek Commons",
      CITY: "Mechanicsville",
      STATE: "VA",
      ZIP: "23111",
      CLAT: "37.6458",
      CLON: "-77.3989",
    });

    expect(store).toEqual(
      expect.objectContaining({
        id: buildPublixCatalogStoreId(1626),
        sourceName: "publix-store-locator",
        sourceStoreId: "1626",
      }),
    );
  });
});
