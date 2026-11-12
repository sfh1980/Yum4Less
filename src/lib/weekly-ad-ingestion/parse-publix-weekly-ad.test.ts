import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parsePublixCardValidRange,
  parsePublixWeeklyAd,
} from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import {
  publixCollectedCardsDocument,
  rememberPublixCardHtml,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";

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
    expect(offers.filter((offer) => offer.validFrom).length).toBe(0);
  });

  it("parses Valid month/day ranges, including a week that crosses New Year", () => {
    const during = parsePublixCardValidRange("Valid 11/11 - 11/18", new Date("2026-11-11T17:00:00Z"));
    expect(during.validFrom).toMatch(/^2026-11-11T00:00:00(?:Z|[+-]\d{2}:00)$/);
    expect(during.validThrough).toMatch(/^2026-11-19T00:00:00(?:Z|[+-]\d{2}:00)$/);

    const singleDigits = parsePublixCardValidRange(
      "Valid 5/4-5/10",
      new Date("2026-05-06T17:00:00Z"),
    );
    expect(singleDigits.validFrom).toMatch(/^2026-05-04T00:00:00/);
    expect(singleDigits.validThrough).toMatch(/^2026-05-11T00:00:00/);

    const spacedDash = parsePublixCardValidRange(
      "Valid 11/11 – 11/18",
      new Date("2026-11-11T17:00:00Z"),
    );
    expect(spacedDash.validFrom).toBe(during.validFrom);
    expect(spacedDash.validThrough).toBe(during.validThrough);

    const fromDecember = parsePublixCardValidRange(
      "Valid 12/30 - 1/5",
      new Date("2026-12-30T17:00:00Z"),
    );
    expect(fromDecember.validFrom).toMatch(/^2026-12-30T00:00:00/);
    expect(fromDecember.validThrough).toMatch(/^2027-01-06T00:00:00/);

    const fromJanuary = parsePublixCardValidRange(
      "Valid 12/30 - 1/5",
      new Date("2027-01-02T17:00:00Z"),
    );
    expect(fromJanuary.validFrom).toMatch(/^2026-12-30T00:00:00/);
    expect(fromJanuary.validThrough).toMatch(/^2027-01-06T00:00:00/);

    expect(parsePublixCardValidRange(undefined)).toEqual({});
    expect(parsePublixCardValidRange("on sale this week")).toEqual({});
    expect(parsePublixCardValidRange("Valid 2/30 - 2/31", new Date("2026-02-01T17:00:00Z"))).toEqual(
      {},
    );
  });

  it("parses a hashed savings card from the thin Publix page", () => {
    // Shortened from publix-thin/2026-11-07T08-04-21.956Z/page.html.
    // The full capture stays untracked. CSS module classes keep the hash suffix.
    const card = `
      <div data-qa-automation="listed-savings-card">
        <div data-qa-automation="prod-title">
          <span class="PCard_title__Cw18N">Publix Boneless Skinless Chicken Breasts</span>
        </div>
        <button aria-label="Publix Boneless Skinless Chicken Breasts">
          <img alt="Publix Boneless Skinless Chicken Breasts" fetchpriority="auto" />
        </button>
        <div class="PSavingsBadge_p-savings-badge__text__veUB0"><span>buy 1 get 1 free</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $5.39 lb</span>
        <span class="PSavingsCard_valid-dates__pso_7">Valid 11/4 - 11/10</span>
      </div>
    `;

    const parsed = parsePublixWeeklyAd({
      html: card,
      networkJsonBodies: [],
      now: new Date("2026-11-07T15:00:00Z"),
    });
    expect(parsed).toEqual([
      expect.objectContaining({
        productName: "Publix Boneless Skinless Chicken Breasts",
        price: 5.39,
        saleLabel: expect.stringContaining("BOGO"),
        validFrom: expect.stringMatching(/^2026-11-04T00:00:00(?:Z|[+-]\d{2}:00)$/),
        validThrough: expect.stringMatching(/^2026-11-11T00:00:00(?:Z|[+-]\d{2}:00)$/),
      }),
    ]);
    expect(parsed[0]?.validFrom?.slice(19)).toBe(parsed[0]?.validThrough?.slice(19));
  });

  it("merges two scroll positions and does not double a card that stayed mounted", () => {
    const top = `
      <div data-qa-automation="listed-savings-card" data-item-code="top">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Publix Chicken</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $3.00</span>
      </div>`;
    const stayed = `
      <div data-qa-automation="listed-savings-card" data-item-code="stay">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Thomas' Bagels</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $8.39</span>
      </div>`;
    const stayedAgain = stayed.replace("Thomas' Bagels", "Replaced Bagels");
    const lower = `
      <div data-qa-automation="listed-savings-card" data-item-code="lower">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Green Beans</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $1.50</span>
      </div>`;
    const seen = new Map<string, string>();
    rememberPublixCardHtml(seen, [
      { key: "top", html: top },
      { key: "stay", html: stayed },
    ]);
    rememberPublixCardHtml(seen, [
      { key: "stay", html: stayedAgain },
      { key: "lower", html: lower },
    ]);
    const finalWindowOnly = parsePublixWeeklyAd({
      html: `${stayedAgain}\n${lower}`,
      networkJsonBodies: [],
    });
    const harvested = parsePublixWeeklyAd({
      html: publixCollectedCardsDocument(seen.values()),
      networkJsonBodies: [],
    });
    expect(finalWindowOnly.map((offer) => offer.productName)).toEqual([
      "Replaced Bagels",
      "Green Beans",
    ]);
    expect(harvested.map((offer) => offer.productName)).toEqual([
      "Publix Chicken",
      "Thomas' Bagels",
      "Green Beans",
    ]);
  });

  it("parses a full static DOM the same way when those cards are also appended", () => {
    const page = `
      <div data-qa-automation="listed-savings-card" data-item-code="a">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Publix Boneless Skinless Chicken Breasts</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $5.39 lb</span>
      </div>
      <div data-qa-automation="listed-savings-card" data-item-code="b">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Thomas' Bagels</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $8.39</span>
      </div>`;
    const alone = parsePublixWeeklyAd({ html: page, networkJsonBodies: [] });
    const withCopies = parsePublixWeeklyAd({
      html: `${page}\n${publixCollectedCardsDocument([page])}`,
      networkJsonBodies: [],
    });
    expect(withCopies).toEqual(alone);
    expect(alone).toHaveLength(2);
  });

  it("parses cards collected while the virtual list scrolled", () => {
    const chicken = `
      <div data-qa-automation="listed-savings-card" data-item-code="a">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Publix Boneless Skinless Chicken Breasts</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $5.39 lb</span>
      </div>`;
    const bagels = `
      <div data-qa-automation="listed-savings-card" data-item-code="b">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">Thomas' Bagels</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $8.39</span>
      </div>`;
    const offers = parsePublixWeeklyAd({
      html: publixCollectedCardsDocument([chicken, bagels]),
      networkJsonBodies: [],
    });
    expect(offers.map((offer) => offer.productName)).toEqual([
      "Publix Boneless Skinless Chicken Breasts",
      "Thomas' Bagels",
    ]);
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
