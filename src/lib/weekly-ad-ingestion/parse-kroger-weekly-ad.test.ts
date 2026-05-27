import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseKrogerWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-kroger-weekly-ad";

describe("parseKrogerWeeklyAd", () => {
  it("parses the existing Kroger fixture embed", () => {
    const html = readFileSync(
      join(
        process.cwd(),
        "src/lib/weekly-ad-ingestion/fixtures/kroger-weekly-ad-sample.html",
      ),
      "utf8",
    );

    const offers = parseKrogerWeeklyAd({ html });
    expect(offers.length).toBe(7);
    expect(offers[0]?.productName).toContain("Chicken Thighs");
  });

  it("parses Kroger public API product payloads captured from network responses", () => {
    const networkJson = readFileSync(
      join(
        process.cwd(),
        "src/lib/weekly-ad-ingestion/fixtures/kroger-products-api-sample.json",
      ),
      "utf8",
    );

    const offers = parseKrogerWeeklyAd({
      html: "<html></html>",
      networkJsonBodies: [networkJson],
    });

    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: "Kroger Fresh Chicken Thighs Family Pack",
          price: 5.79,
          saleLabel: "Weekly deal",
        }),
        expect.objectContaining({
          productName: "Broccoli Crowns",
          price: 1.99,
        }),
      ]),
    );
  });

  it("parses offers embedded in __NEXT_DATA__", () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"offers":[
          {"description":"Kroger Black Beans 15 oz","items":[{"price":{"promo":0.99,"regular":1.29}}],"promoDescription":"Pantry stock-up"}
        ]}}}
      </script>
    `;

    const offers = parseKrogerWeeklyAd({ html });
    expect(offers).toEqual([
      {
        productName: "Kroger Black Beans 15 oz",
        price: 0.99,
        saleLabel: "Pantry stock-up",
        validThrough: undefined,
      },
    ]);
  });
});
