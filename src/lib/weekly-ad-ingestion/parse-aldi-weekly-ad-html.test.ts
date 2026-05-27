import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";

describe("parseWeeklyAdHtml", () => {
  it("parses embedded JSON weekly-ad offers", () => {
    const fixturePath = join(
      process.cwd(),
      "src/lib/weekly-ad-ingestion/fixtures/aldi-weekly-ad-sample.html",
    );
    const html = readFileSync(fixturePath, "utf8");
    const offers = parseWeeklyAdHtml(html);

    expect(offers.length).toBe(6);
    expect(offers[0]).toEqual({
      productName: "Fresh Chicken Thighs Family Pack",
      price: 4.29,
      saleLabel: "Weekly special",
    });
  });

  it("parses product-card markup when JSON embed is absent", () => {
    const html = `
      <div data-weekly-ad-product="Baby Potatoes" data-price="2.19" data-sale-label="Price drop"></div>
      <div data-weekly-ad-product="Spaghetti" data-price="1.09"></div>
    `;

    expect(parseWeeklyAdHtml(html)).toEqual([
      {
        productName: "Baby Potatoes",
        price: 2.19,
        saleLabel: "Price drop",
      },
      {
        productName: "Spaghetti",
        price: 1.09,
        saleLabel: undefined,
      },
    ]);
  });
});
