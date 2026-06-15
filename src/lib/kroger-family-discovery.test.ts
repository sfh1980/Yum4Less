import { describe, expect, it } from "vitest";
import {
  filterKrogerFamilyDiscoveredStores,
  resolveKrogerLocationSearchLimit,
} from "@/lib/kroger-family-discovery";

describe("kroger-family-discovery", () => {
  it("filters to Kroger-family stores and dedupes provider ids", () => {
    const filtered = filterKrogerFamilyDiscoveredStores([
      {
        provider: "kroger",
        providerStoreId: "02900529",
        name: "Kroger",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.61,
        longitude: -77.33,
      },
      {
        provider: "kroger",
        providerStoreId: "02900529",
        name: "Kroger",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.61,
        longitude: -77.33,
      },
      {
        provider: "kroger",
        providerStoreId: "01111111",
        name: "Harris Teeter",
        city: "Richmond",
        state: "VA",
        latitude: 37.58,
        longitude: -77.5,
      },
      {
        provider: "kroger",
        providerStoreId: "09999999",
        name: "Publix",
        city: "Richmond",
        state: "VA",
        latitude: 37.58,
        longitude: -77.5,
      },
    ]);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((store) => store.providerStoreId)).toEqual([
      "02900529",
      "01111111",
    ]);
  });

  it("caps Kroger location search limit", () => {
    expect(resolveKrogerLocationSearchLimit("99")).toBe(50);
    expect(resolveKrogerLocationSearchLimit("12")).toBe(12);
  });
});
