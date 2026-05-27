import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";

describe("parsePublixWeeklyAd", () => {
  it("parses fixture embedded JSON offers", () => {
    const html = readFileSync(
      join(process.cwd(), "src/lib/weekly-ad-ingestion/fixtures/publix-weekly-ad-sample.html"),
      "utf8",
    );

    const offers = parsePublixWeeklyAd({ html, networkJsonBodies: [] });

    expect(offers.length).toBeGreaterThanOrEqual(5);
    expect(offers.some((offer) => offer.productName.includes("Chicken Thighs"))).toBe(true);
    expect(offers.some((offer) => offer.productName.includes("Broccoli"))).toBe(true);
  });

  it("parses live-style listed savings cards from HTML", () => {
    const meatCard = `
      <div data-qa-automation="listed-savings-card" data-item-code="-2023504479">
        <img alt="Ribeye Steak" fetchpriority="auto" loading="lazy" />
        <div data-qa-automation="prod-title" class="title-wrapper">
          <span class="p-text title">Ribeye Steak</span>
        </div>
        <span class="p-savings-badge savings-badge default">
          <div class="p-savings-badge__text"><span>$12.99 lb</span></div>
        </span>
        <span class="additional-info">save up to $4.33 lb</span>
        <span class="valid-dates">Valid 5/20 - 5/26</span>
      </div>
    `;
    const produceCard = `
      <div data-qa-automation="listed-savings-card" data-item-code="-2023505087">
        <img alt="GreenWise Organic Whole Carrots" fetchpriority="auto" loading="lazy" />
        <div data-qa-automation="prod-title" class="title-wrapper">
          <span class="p-text title">GreenWise Organic Whole Carrots</span>
        </div>
        <span class="p-savings-badge savings-badge default">
          <div class="p-savings-badge__text"><span>$1.69</span></div>
        </span>
        <span class="additional-info">save up to $0.30</span>
      </div>
    `;
    const bogoCard = `
      <div data-qa-automation="listed-savings-card" data-item-code="-2023504572">
        <img alt="Mt. Olive Pickles" fetchpriority="auto" loading="lazy" />
        <div data-qa-automation="prod-title" class="title-wrapper">
          <span class="p-text title">Mt. Olive Pickles</span>
        </div>
        <span class="p-savings-badge savings-badge bogo">
          <div class="p-savings-badge__text"><span>buy 1 get 1 free</span></div>
        </span>
        <span class="additional-info">save up to $4.59</span>
      </div>
    `;
    const digitalCouponCard = `
      <div data-qa-automation="listed-savings-card" data-item-code="-2023504999">
        <img alt="Gatorade" fetchpriority="auto" loading="lazy" />
        <div data-qa-automation="prod-title" class="title-wrapper">
          <span class="p-text title">Gatorade</span>
        </div>
        <span class="p-savings-badge savings-badge default">
          <div class="p-savings-badge__text"><span>Weekly special</span></div>
        </span>
        <span class="additional-info">Save $1.00 with digital coupon on Gatorade</span>
      </div>
    `;

    const offers = parsePublixWeeklyAd({
      html: `${meatCard}${produceCard}${bogoCard}${digitalCouponCard}`,
      networkJsonBodies: [],
    });

    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: "Ribeye Steak",
          price: 12.99,
          saleLabel: expect.stringContaining("estimated per lb"),
        }),
        expect.objectContaining({
          productName: "GreenWise Organic Whole Carrots",
          price: 1.69,
          saleLabel: expect.stringContaining("save up to $0.30"),
        }),
        expect.objectContaining({
          productName: "Mt. Olive Pickles",
          price: 4.59,
          saleLabel: expect.stringContaining("BOGO"),
        }),
        expect.objectContaining({
          productName: "Gatorade",
          price: 1,
          saleLabel: expect.stringContaining("digital coupon"),
        }),
      ]),
    );
  });

  it("parses many offers from a captured live Publix page", () => {
    const capturePath = join(
      process.cwd(),
      "captures/weekly-ad/publix/2026-05-22T17-11-08.692Z/page.html",
    );

    let html: string;
    try {
      html = readFileSync(capturePath, "utf8");
    } catch {
      return;
    }

    const offers = parsePublixWeeklyAd({ html, networkJsonBodies: [] });

    expect(offers.length).toBeGreaterThan(500);
    expect(offers.some((offer) => /chicken/i.test(offer.productName))).toBe(true);
    expect(offers.some((offer) => /carrot|broccoli|cabbage|spinach/i.test(offer.productName))).toBe(
      true,
    );
  });

  it("parses Publix savings GraphQL payloads from network JSON", () => {
    const offers = parsePublixWeeklyAd({
      html: "",
      networkJsonBodies: [
        JSON.stringify({
          data: {
            storeProductsSavingsSearchResult: {
              storeProducts: [
                {
                  title: "Publix Chicken Thighs Family Pack",
                  onSale: true,
                  priceLine: "Starts at $6.49",
                  savingLine: "SAVE UP TO $1",
                },
              ],
            },
          },
        }),
      ],
    });

    expect(offers).toEqual([
      expect.objectContaining({
        productName: "Publix Chicken Thighs Family Pack",
        price: 6.49,
        saleLabel: "SAVE UP TO $1",
      }),
    ]);
  });
});
