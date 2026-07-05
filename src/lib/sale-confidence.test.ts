import { describe, expect, it } from "vitest";
import { getSaleConfidence } from "@/lib/sale-confidence";

describe("getSaleConfidence", () => {
  it("labels regular prices without a sale tag", () => {
    const confidence = getSaleConfidence({
      freshnessDaysAgo: 1,
      dataSource: "database",
    });

    expect(confidence.level).toBe("regular-price");
    expect(confidence.label).toBe("Regular price estimate");
  });

  it("warns when legacy sample pricing supplies a sale label", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly ad special",
      freshnessDaysAgo: 1,
      dataSource: "database",
      priceSource: "mock-market-data",
    });

    expect(confidence.level).toBe("no-sale-data");
    expect(confidence.note).toContain("sample pricing data");
  });

  it("marks aging database-backed sale references cautiously", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Manager special",
      freshnessDaysAgo: 8,
      dataSource: "database",
    });

    expect(confidence.level).toBe("advertised-stale");
    expect(confidence.note).toContain("Do not assume");
  });

  it("labels weak official Kroger API matches as directional", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly ad special",
      freshnessDaysAgo: 0,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.65,
    });

    expect(confidence.level).toBe("directional-provider-match");
    expect(confidence.note).toContain("online store data");
  });

  it("labels strong official Kroger API promo matches with verify wording", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly ad special",
      freshnessDaysAgo: 0,
      freshnessHoursAgo: 1,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.72,
    });

    expect(confidence.level).toBe("advertised-recent");
    expect(confidence.label).toBe("Recently checked sale price — verify at shelf");
  });

  it("labels strong official Kroger regular prices as checked online estimates", () => {
    const confidence = getSaleConfidence({
      freshnessDaysAgo: 0,
      freshnessHoursAgo: 6,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.9,
    });

    expect(confidence.level).toBe("advertised-recent");
    expect(confidence.label).toBe(
      "Same-day checked store price — verify at shelf",
    );
    expect(confidence.note).toContain("estimate");
  });

  it("downgrades stale weekly-ad rows instead of labeling them recent", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly special",
      freshnessDaysAgo: 9,
      freshnessHoursAgo: 216,
      dataSource: "database",
      priceSource: "kroger-weekly-ad-scrape",
      matchConfidence: 0.9,
    });

    expect(confidence.level).toBe("advertised-stale");
    expect(confidence.label).toBe("Stale sale price — estimate only");
    expect(confidence.note).toContain("9 day(s) old");
  });
});
