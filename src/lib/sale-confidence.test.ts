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
    expect(confidence.note).toContain("legacy sample pricing data");
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
    expect(confidence.note).toContain("Kroger");
  });

  it("labels strong official Kroger API promo matches with verify wording", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly ad special",
      freshnessDaysAgo: 0,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.72,
    });

    expect(confidence.level).toBe("advertised-recent");
    expect(confidence.label).toContain("Kroger");
  });
});
