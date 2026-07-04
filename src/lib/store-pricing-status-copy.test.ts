import { describe, expect, it } from "vitest";
import {
  buildStoreListStatusPill,
  buildStoreMapPricingLabel,
} from "@/lib/store-pricing-status-copy";

describe("store pricing status copy", () => {
  it("labels official-api-preview stores with estimated store wording on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: true,
        rolloutStatus: "official-api-preview",
        chain: "kroger",
      }),
    ).toBe("Est. store prices");
  });

  it("labels official-api-preview stores consistently across chains on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: true,
        rolloutStatus: "official-api-preview",
        chain: "aldi",
      }),
    ).toBe("Est. store prices");
  });

  it("labels ranked sale stores with estimated wording on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
        chain: "kroger",
      }),
    ).toBe("Est. sale prices");
  });

  it("labels limited-coverage stores as estimate-only on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: false,
        rolloutStatus: "limited-coverage",
        chain: "food-lion",
      }),
    ).toBe("Limited coverage — estimate only");
  });

  it("keeps context-only stores neutral on list and map labels", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: false,
        rolloutStatus: "coming-soon",
        chain: "walmart",
      }),
    ).toBe("Context only — no pricing yet");

    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: false,
        rolloutStatus: "coming-soon",
        chain: "walmart",
      }),
    ).toBe("No dinner estimates yet");
  });

  it("uses chain-colored ranked map label with verify-in-store wording", () => {
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
        chain: "publix",
      }),
    ).toBe("Est. sale prices — verify in store");
  });

  it("labels official-api-preview stores with estimated map wording", () => {
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: true,
        rolloutStatus: "official-api-preview",
        chain: "kroger",
      }),
    ).toBe("Est. store prices — verify in store");
  });

  it("labels official-api-preview stores consistently across chains on the map", () => {
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: true,
        rolloutStatus: "official-api-preview",
        chain: "aldi",
      }),
    ).toBe("Est. store prices — verify in store");
  });

  it("labels unknown OSM pins as future release on the map", () => {
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: false,
        rolloutStatus: "coming-soon",
        chain: "unknown",
      }),
    ).toBe("Available in a future release");
  });
});
