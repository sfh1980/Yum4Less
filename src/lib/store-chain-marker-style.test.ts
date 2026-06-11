import { describe, expect, it } from "vitest";
import {
  deriveStoreMarkerAbbreviation,
  getStoreMarkerStyle,
} from "@/lib/store-chain-marker-style";

describe("store chain marker style", () => {
  it("uses chain abbreviations for known rollout chains", () => {
    expect(deriveStoreMarkerAbbreviation("Kroger", "kroger")).toBe("K");
    expect(deriveStoreMarkerAbbreviation("Food Lion", "food-lion")).toBe("FL");
  });

  it("derives readable abbreviations for unknown catalog stores instead of ?", () => {
    expect(
      deriveStoreMarkerAbbreviation("International Grocery Market", "unknown"),
    ).toBe("IG");
    expect(deriveStoreMarkerAbbreviation("7-Eleven", "unknown")).toBe("7E");
    expect(deriveStoreMarkerAbbreviation("Costco Wholesale", "unknown")).toBe(
      "CW",
    );
  });

  it("applies name-based abbreviations to unknown marker styles", () => {
    const style = getStoreMarkerStyle({
      chain: "unknown",
      storeName: "International Grocery Market",
      recommendationEnabled: false,
    });

    expect(style.abbreviation).toBe("IG");
    expect(style.backgroundColor).toBe("#334155");
  });
});
