import { describe, expect, it } from "vitest";
import { buildKrogerWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-url";

describe("buildKrogerWeeklyAdUrl", () => {
  it("includes the MVP ZIP in the weekly-ad URL", () => {
    expect(buildKrogerWeeklyAdUrl({ zipCode: "23111" })).toBe(
      "https://www.kroger.com/weeklyad?zipcode=23111",
    );
  });

  it("supports an optional Kroger location id", () => {
    expect(
      buildKrogerWeeklyAdUrl({ zipCode: "23111", locationId: "01400376" }),
    ).toBe("https://www.kroger.com/weeklyad?zipcode=23111&store=01400376");
  });
});
