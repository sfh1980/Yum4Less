import { describe, expect, it } from "vitest";
import { shouldSkipFuelLocation } from "@/lib/ingest/fuel-location";

describe("fuel location skip", () => {
  it("skips Kroger fuel departments when no grocery department is present", () => {
    expect(shouldSkipFuelLocation({ departmentIds: ["10", "92", "93", "95", "96"] })).toBe(
      true,
    );
    expect(shouldSkipFuelLocation({ departmentIds: ["10"], name: "Kroger" })).toBe(true);
  });

  it("keeps a location that also has a grocery department", () => {
    expect(
      shouldSkipFuelLocation({
        departmentIds: ["10", "01"],
        name: "Kroger Fuel Center",
      }),
    ).toBe(false);
    for (const groceryId of ["01", "02", "04", "05", "87", "88"]) {
      expect(shouldSkipFuelLocation({ departmentIds: ["92", groceryId] })).toBe(false);
    }
  });

  it("skips OSM gas_station and fueling_station tags", () => {
    expect(shouldSkipFuelLocation({ osmAmenity: "fueling_station", name: "Shell" })).toBe(
      true,
    );
    expect(shouldSkipFuelLocation({ osmShop: "gas_station", name: "Kroger" })).toBe(true);
  });

  it("uses the word fuel only when departments and place tags are absent", () => {
    expect(shouldSkipFuelLocation({ name: "Kroger Fuel Center" })).toBe(true);
    expect(
      shouldSkipFuelLocation({ osmShop: "supermarket", name: "Kroger Fuel Center" }),
    ).toBe(false);
    expect(shouldSkipFuelLocation({ name: "Kroger" })).toBe(false);
    expect(shouldSkipFuelLocation({ name: "refueling station" })).toBe(false);
  });
});
