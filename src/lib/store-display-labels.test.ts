import { describe, expect, it } from "vitest";
import {
  APPROXIMATE_LOCATION_LABEL,
  formatSettingsStoreOptionLabel,
  formatStoreCityState,
  formatStoreNameWithLocation,
} from "@/lib/store-display-labels";

describe("store display labels", () => {
  it("formats known city/state metadata directly", () => {
    expect(
      formatStoreCityState({
        city: "Mechanicsville",
        state: "VA",
      }),
    ).toBe("Mechanicsville, VA");
    expect(
      formatStoreNameWithLocation({
        name: "Kroger",
        city: "Mechanicsville",
        state: "VA",
      }),
    ).toBe("Kroger — Mechanicsville, VA");
  });

  it("replaces unknown city/state metadata with approximate location", () => {
    expect(
      formatStoreCityState({
        city: "Unknown",
        state: "Unknown",
      }),
    ).toBe(APPROXIMATE_LOCATION_LABEL);
    expect(
      formatStoreNameWithLocation({
        name: "Food Lion",
        city: "Unknown",
        state: "Unknown",
      }),
    ).toBe(`Food Lion — ${APPROXIMATE_LOCATION_LABEL}`);
  });

  it("uses approximate location when either city or state is unknown", () => {
    expect(
      formatStoreNameWithLocation({
        name: "Food Lion",
        city: "Unknown",
        state: "VA",
      }),
    ).toBe(`Food Lion — ${APPROXIMATE_LOCATION_LABEL}`);
    expect(
      formatStoreNameWithLocation({
        name: "Food Lion",
        city: "Richmond",
        state: "Unknown",
      }),
    ).toBe(`Food Lion — ${APPROXIMATE_LOCATION_LABEL}`);
  });

  it("keeps the settings label honest for approximate locations", () => {
    expect(
      formatSettingsStoreOptionLabel({
        name: "Food Lion",
        city: "Unknown",
        state: "Unknown",
        distanceMiles: 2.4,
      }),
    ).toBe(`Food Lion — ${APPROXIMATE_LOCATION_LABEL} (2.4 mi)`);
  });
});
