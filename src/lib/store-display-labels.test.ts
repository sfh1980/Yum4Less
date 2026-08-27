import { describe, expect, it } from "vitest";
import {
  APPROXIMATE_LOCATION_LABEL,
  formatSettingsStoreOptionLabel,
  formatStoreCityState,
  formatStoreHeadlineWithOptionalSubtitle,
  formatStoreNameWithLocation,
  formatStraightLineDistanceMiles,
  resolveStoreDisplayHeadline,
  resolveStoreLocatorSubtitle,
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

  it("uses Publix as the headline for locator-backed rows with shopping-center subtitle", () => {
    expect(
      resolveStoreDisplayHeadline({
        name: "Brandy Creek Commons",
        chain: "publix",
        sourceName: "publix-store-locator",
      }),
    ).toBe("Publix");
    expect(
      resolveStoreLocatorSubtitle({
        name: "Brandy Creek Commons",
        chain: "publix",
        sourceName: "publix-weekly-ad-scrape",
      }),
    ).toBe("Brandy Creek Commons");
    expect(
      formatStoreHeadlineWithOptionalSubtitle({
        name: "Brandy Creek Commons",
        chain: "publix",
        sourceName: "publix-store-locator",
      }),
    ).toBe("Publix (Brandy Creek Commons)");
  });

  it("uses Harris Teeter as the headline, not Kroger family", () => {
    expect(
      resolveStoreDisplayHeadline({
        name: "Harris Teeter",
        chain: "kroger",
        sourceName: "kroger-official-api",
      }),
    ).toBe("Harris Teeter");
    expect(
      formatStoreHeadlineWithOptionalSubtitle({
        name: "Harris Teeter",
        chain: "kroger",
        sourceName: "kroger-official-api",
      }),
    ).toBe("Harris Teeter");
  });

  it("normalizes ranked v1 chain casing from OSM brand tags", () => {
    expect(
      resolveStoreDisplayHeadline({
        name: "ALDI",
        chain: "aldi",
        sourceName: "yum4less-market-catalog",
      }),
    ).toBe("Aldi");
    expect(
      formatStoreHeadlineWithOptionalSubtitle({
        name: "ALDI",
        chain: "aldi",
        sourceName: "yum4less-market-catalog",
      }),
    ).toBe("Aldi");
  });

  it("labels nearby distances as straight-line miles", () => {
    expect(formatStraightLineDistanceMiles(2.1)).toBe("2.1 mi straight-line");
    expect(
      formatSettingsStoreOptionLabel({
        name: "Aldi",
        city: "Mechanicsville",
        state: "VA",
        distanceMiles: 2.4,
      }),
    ).toBe("Aldi — Mechanicsville, VA (2.4 mi straight-line)");
  });

  it("keeps the settings label honest for approximate locations", () => {
    expect(
      formatSettingsStoreOptionLabel({
        name: "Food Lion",
        city: "Unknown",
        state: "Unknown",
        distanceMiles: 2.4,
      }),
    ).toBe(`Food Lion — ${APPROXIMATE_LOCATION_LABEL} (2.4 mi straight-line)`);
  });
});
