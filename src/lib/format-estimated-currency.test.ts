import { describe, expect, it } from "vitest";
import { formatEstimatedCurrency } from "@/lib/format-estimated-currency";

describe("formatEstimatedCurrency", () => {
  it("prefixes amounts with a layman Est. qualifier", () => {
    expect(formatEstimatedCurrency(13.42)).toBe("Est. $13.42");
    expect(formatEstimatedCurrency(6.5)).toBe("Est. $6.50");
  });
});
