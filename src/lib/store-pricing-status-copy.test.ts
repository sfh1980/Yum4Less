import { describe, expect, it } from "vitest";
import {
  buildStoreListStatusPill,
  buildStoreMapPricingLabel,
} from "@/lib/store-pricing-status-copy";

describe("store pricing status copy", () => {
  it("labels ranked weekly-ad stores with estimated wording on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
        chain: "kroger",
      }),
    ).toBe("Est. weekly-ad prices");
  });

  it("labels limited-coverage stores as directional on the list pill", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: false,
        rolloutStatus: "limited-coverage",
        chain: "food-lion",
      }),
    ).toBe("Limited coverage — directional");
  });

  it("keeps Walmart context-only on list and map labels", () => {
    expect(
      buildStoreListStatusPill({
        recommendationEnabled: false,
        rolloutStatus: "coming-soon",
        chain: "walmart",
      }),
    ).toBe("Context only — no Walmart pricing");

    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: false,
        rolloutStatus: "coming-soon",
        chain: "walmart",
      }),
    ).toBe("No live Walmart pricing yet");
  });

  it("uses chain-colored ranked map label with verify-in-store wording", () => {
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: true,
        rolloutStatus: "weekly-ad-preview",
        chain: "publix",
      }),
    ).toBe("Est. weekly-ad prices — verify in store");
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
