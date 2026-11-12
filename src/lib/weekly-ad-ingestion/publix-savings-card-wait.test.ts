import { describe, expect, it } from "vitest";
import {
  buildPublixThinCaptureMeta,
  PUBLIX_CARD_MAX_WAIT_MS_MAX,
  assessPublixHarvest,
  decidePublixCardPoll,
  nextPublixEqualPositiveSamples,
  nextPublixExpectedCount,
  parsePublixCategoryResultCounts,
  publixCardCountIsThin,
  publixCardScrollStepPx,
  publixCollectedCardsDocument,
  publixListedCardTarget,
  publixPageIsThin,
  rememberPublixCardHtml,
  publixResponseStatusForCapture,
  publixResponseStatusIsRelevant,
  readPublixCardMaxWaitMs,
  readPublixCardScrollViewports,
  readPublixPrintedTotalIsFloor,
  summarizePublixSavingsBody,
  formatPublixSectionLogLine,
  formatPublixHarvestSummaryLine,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";
import { offerCountToRemember } from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";

const remembered = 588;

describe("Publix savings-card settle", () => {
  it("does not stop on the first non-zero count", () => {
    expect(
      decidePublixCardPoll({
        previousCount: null,
        count: 2,
        rememberedOfferCount: remembered,
        elapsedMs: 0,
        maxWaitMs: 20_000,
        samples: 1,
        equalPositiveSamples: 1,
      }),
    ).toBe("continue");
  });

  it("keeps waiting on a stable thin count and stops a stable count that is not thin", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 2,
        count: 2,
        rememberedOfferCount: remembered,
        elapsedMs: 2_000,
        maxWaitMs: 20_000,
        samples: 3,
        equalPositiveSamples: 3,
      }),
    ).toBe("continue");
    expect(
      decidePublixCardPoll({
        previousCount: 2,
        count: 2,
        rememberedOfferCount: remembered,
        elapsedMs: 20_000,
        maxWaitMs: 20_000,
        samples: 4,
        equalPositiveSamples: 4,
      }),
    ).toBe("max-wait");
    expect(
      decidePublixCardPoll({
        previousCount: 80,
        count: 80,
        rememberedOfferCount: null,
        elapsedMs: 2_000,
        maxWaitMs: 20_000,
        samples: 3,
        equalPositiveSamples: 3,
        minCards: 50,
      }),
    ).toBe("stable");
  });

  it("keeps waiting while the count is still climbing", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 2,
        count: 40,
        rememberedOfferCount: remembered,
        elapsedMs: 2_000,
        maxWaitMs: 20_000,
        samples: 3,
        equalPositiveSamples: 1,
      }),
    ).toBe("continue");
  });

  it("stops once the count reaches at least half the remembered offer_count", () => {
    expect(
      decidePublixCardPoll({
        previousCount: null,
        count: 294,
        rememberedOfferCount: remembered,
        elapsedMs: 0,
        maxWaitMs: 20_000,
        samples: 1,
        equalPositiveSamples: 1,
      }),
    ).toBe("half");
  });

  it("does not treat a stuck zero as stable", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 0,
        count: 0,
        rememberedOfferCount: remembered,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
        equalPositiveSamples: 0,
      }),
    ).toBe("continue");
  });

  it("stops at the maximum wait", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 2,
        count: 3,
        rememberedOfferCount: remembered,
        elapsedMs: 20_000,
        maxWaitMs: 20_000,
        samples: 4,
        equalPositiveSamples: 1,
      }),
    ).toBe("max-wait");
  });

  it("counts three equal positive polls and resets when the count changes", () => {
    expect(
      nextPublixEqualPositiveSamples({
        previousCount: null,
        count: 2,
        equalPositiveSamples: 0,
      }),
    ).toBe(1);
    expect(
      nextPublixEqualPositiveSamples({
        previousCount: 2,
        count: 2,
        equalPositiveSamples: 1,
      }),
    ).toBe(2);
    expect(
      nextPublixEqualPositiveSamples({
        previousCount: 2,
        count: 40,
        equalPositiveSamples: 2,
      }),
    ).toBe(1);
    expect(
      nextPublixEqualPositiveSamples({
        previousCount: 0,
        count: 0,
        equalPositiveSamples: 0,
      }),
    ).toBe(0);
  });

  it("marks a count under half the memory as thin, and a small count with no memory as thin", () => {
    expect(publixCardCountIsThin(2, remembered, 50)).toBe(true);
    expect(publixCardCountIsThin(294, remembered, 50)).toBe(false);
    expect(publixCardCountIsThin(5, null, 50)).toBe(true);
    expect(publixCardCountIsThin(50, null, 50)).toBe(false);
    expect(publixCardCountIsThin(5, 133, 50)).toBe(true);
  });

  it("reads the maximum wait setting and falls back when it is unset", () => {
    expect(
      readPublixCardMaxWaitMs(
        buildTestProcessEnv({ YUM4LESS_PUBLIX_CARD_MAX_WAIT_MS: "15000" }),
      ),
    ).toBe(15_000);
    expect(readPublixCardMaxWaitMs(buildTestProcessEnv())).toBe(20_000);
    expect(
      readPublixCardMaxWaitMs(
        buildTestProcessEnv({ YUM4LESS_PUBLIX_CARD_MAX_WAIT_MS: "50" }),
      ),
    ).toBe(20_000);
  });
});

describe("remembered offer_count", () => {
  it("does not lower the stored offer_count on a thin count", () => {
    expect(offerCountToRemember(588, 2)).toBe(588);
    expect(offerCountToRemember(588, 293)).toBe(588);
  });

  it("stores a count that is at least half the memory", () => {
    expect(offerCountToRemember(588, 294)).toBe(294);
    expect(offerCountToRemember(588, 593)).toBe(593);
  });

  it("stores the incoming count when nothing is remembered", () => {
    expect(offerCountToRemember(null, 2)).toBe(2);
    expect(offerCountToRemember(0, 12)).toBe(12);
  });
});

describe("thin Publix capture", () => {
  it("records the HTML companion fields for a thin count", () => {
    expect(
      buildPublixThinCaptureMeta({
        url: "https://www.publix.com/savings/weekly-ad",
        zipCode: "23111",
        gotoStatus: 200,
        extractedCount: 2,
        rememberedOfferCount: 588,
        capturedAt: "2026-11-03T22:00:00.000Z",
      }),
    ).toEqual({
      url: "https://www.publix.com/savings/weekly-ad",
      zipCode: "23111",
      gotoStatus: 200,
      extractedCount: 2,
      parsedOfferCount: null,
      rememberedOfferCount: 588,
      expectedCardCount: null,
      capturedAt: "2026-11-03T22:00:00.000Z",
      responses: [],
    });
  });

  it("writes the parsed-offer count beside the card count", () => {
    expect(
      buildPublixThinCaptureMeta({
        url: "https://www.publix.com/savings/weekly-ad/view-all",
        gotoStatus: 200,
        extractedCount: 168,
        parsedOfferCount: 16,
        rememberedOfferCount: 168,
        expectedCardCount: 220,
        capturedAt: "2026-11-08T16:02:49.740Z",
      }).parsedOfferCount,
    ).toBe(16);
  });

  it("scrolls three viewports by default and keeps the wait at or under 60 seconds", () => {
    expect(readPublixCardScrollViewports(buildTestProcessEnv())).toBe(3);
    expect(
      readPublixCardScrollViewports(
        buildTestProcessEnv({ YUM4LESS_PUBLIX_CARD_SCROLL_VIEWPORTS: "2" }),
      ),
    ).toBe(2);
    expect(
      readPublixCardScrollViewports(
        buildTestProcessEnv({ YUM4LESS_PUBLIX_CARD_SCROLL_VIEWPORTS: "9" }),
      ),
    ).toBe(3);
    expect(publixCardScrollStepPx(720, 3)).toBe(2160);
    expect(readPublixCardMaxWaitMs(buildTestProcessEnv())).toBeLessThanOrEqual(60_000);
    expect(PUBLIX_CARD_MAX_WAIT_MS_MAX).toBe(60_000);
  });

  it("keeps a promotion status and URL and drops the body and a token query", () => {
    expect(publixResponseStatusIsRelevant("https://services.publix.com/v1/graphql")).toBe(true);
    expect(
      publixResponseStatusIsRelevant(
        "https://services.publix.com/api/v4/savings?page=1&pageSize=0",
      ),
    ).toBe(true);
    expect(publixResponseStatusIsRelevant("https://www.google-analytics.com/collect")).toBe(false);
    expect(
      publixResponseStatusIsRelevant(
        "https://www.google.com/ccm/collect?dl=https%3A%2F%2Fwww.publix.com%2Fsavings%2Fweekly-ad",
      ),
    ).toBe(false);
    expect(
      publixResponseStatusForCapture({
        status: 200,
        url: "https://services.publix.com/api/promotions?store=1591&access_token=secret",
      }),
    ).toEqual({
      status: 200,
      url: "https://services.publix.com/api/promotions?store=1591",
    });
    expect(
      buildPublixThinCaptureMeta({
        url: "https://www.publix.com/savings/weekly-ad/view-all",
        gotoStatus: 200,
        extractedCount: 5,
        rememberedOfferCount: 133,
        expectedCardCount: 221,
        capturedAt: "2026-11-07T08:04:21.956Z",
        responses: [
          { status: 403, url: "https://services.publix.com/api/promotions" },
        ],
      }).responses,
    ).toEqual([{ status: 403, url: "https://services.publix.com/api/promotions" }]);
  });
});

describe("printed Publix result count", () => {
  const excerpt = `
    <div class="WeeklyAdCardGrids_weekly-ad-card-grids__virtual-container__amLR7">
      <div id="bogo-grid" data-testid="category-section-bogo" data-weekly-ad-category-id="bogo">
        <h2 id="bogo-heading">BOGO</h2>
        <div><span class="PText_p-text__MArMe">221 results</span></div>
      </div>
    </div>`;

  it("reads the category result count from a shortened heading", () => {
    expect(parsePublixCategoryResultCounts(excerpt)).toEqual([
      { categoryId: "bogo", count: 221 },
    ]);
    expect(publixListedCardTarget(parsePublixCategoryResultCounts(excerpt))).toBe(221);
  });

  it("waits for the printed count and does not stop on a stable short list", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 5,
        count: 5,
        seenCount: 5,
        expectedCount: 221,
        rememberedOfferCount: 133,
        elapsedMs: 3_000,
        maxWaitMs: 20_000,
        samples: 4,
        equalPositiveSamples: 4,
      }),
    ).toBe("continue");
    expect(
      decidePublixCardPoll({
        previousCount: 220,
        count: 221,
        seenCount: 221,
        expectedCount: 221,
        rememberedOfferCount: 133,
        elapsedMs: 4_000,
        maxWaitMs: 20_000,
        samples: 5,
        equalPositiveSamples: 1,
      }),
    ).toBe("listed");
    expect(
      decidePublixCardPoll({
        previousCount: 5,
        count: 5,
        seenCount: 5,
        expectedCount: 221,
        rememberedOfferCount: 133,
        elapsedMs: 20_000,
        maxWaitMs: 20_000,
        samples: 20,
        equalPositiveSamples: 16,
      }),
    ).toBe("max-wait");
  });

  it("keeps a card that scrolled out of the last window", () => {
    const seen = new Map<string, string>();
    rememberPublixCardHtml(seen, [
      { key: "a", html: "<div data-qa-automation=\"listed-savings-card\">one</div>" },
      { key: "b", html: "<div data-qa-automation=\"listed-savings-card\">two</div>" },
    ]);
    rememberPublixCardHtml(seen, [
      { key: "b", html: "<div>replaced</div>" },
      { key: "c", html: "<div data-qa-automation=\"listed-savings-card\">three</div>" },
    ]);
    expect([...seen.keys()]).toEqual(["a", "b", "c"]);
    expect(seen.get("b")).toContain("two");
    expect(publixCollectedCardsDocument(seen.values())).toContain("one");
    expect(publixCollectedCardsDocument(seen.values())).toContain("three");
  });

  it("keeps scrolling past the printed count only when that setting is on", () => {
    const top = `
      <div data-weekly-ad-category-id="bogo"><span>4 results</span></div>
      <div data-qa-automation="listed-savings-card" data-item-code="a"></div>`;
    const both = `
      ${top}
      <div data-qa-automation="listed-savings-card" data-item-code="b"></div>`;
    const keys = (html: string) =>
      [...html.matchAll(/data-item-code="([^"]+)"/g)].map((match) => match[1] ?? "");
    const printed = publixListedCardTarget(parsePublixCategoryResultCounts(top));
    expect(printed).toBe(4);
    expect(keys(top)).toEqual(["a"]);
    expect(keys(both)).toEqual(["a", "b"]);
    expect(readPublixPrintedTotalIsFloor(buildTestProcessEnv())).toBe(false);
    expect(
      readPublixPrintedTotalIsFloor(
        buildTestProcessEnv({ YUM4LESS_PUBLIX_PRINTED_TOTAL_IS_FLOOR: "1" }),
      ),
    ).toBe(true);
    expect(
      decidePublixCardPoll({
        previousCount: 1,
        count: keys(both).length,
        seenCount: keys(both).length,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
        equalPositiveSamples: 1,
        printedTotalIsFloor: false,
        atBottom: true,
        distinctStablePolls: 1,
        distinctCount: keys(both).length,
      }),
    ).toBe("continue");
    expect(
      decidePublixCardPoll({
        previousCount: 1,
        count: keys(both).length,
        seenCount: keys(both).length,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
        equalPositiveSamples: 1,
        printedTotalIsFloor: true,
        atBottom: false,
        distinctStablePolls: 1,
        distinctCount: keys(both).length,
      }),
    ).toBe("continue");
    expect(
      decidePublixCardPoll({
        previousCount: keys(both).length,
        count: keys(both).length,
        seenCount: keys(both).length,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 2_000,
        maxWaitMs: 20_000,
        samples: 3,
        equalPositiveSamples: 3,
        printedTotalIsFloor: true,
        atBottom: true,
        distinctStablePolls: 1,
        distinctCount: keys(both).length,
      }),
    ).toBe("bottom");
    expect(
      decidePublixCardPoll({
        previousCount: keys(both).length,
        count: keys(both).length,
        seenCount: keys(both).length,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 3_000,
        maxWaitMs: 20_000,
        samples: 4,
        equalPositiveSamples: 3,
        printedTotalIsFloor: true,
        atBottom: false,
        distinctStablePolls: 3,
        distinctCount: keys(both).length,
      }),
    ).toBe("stable");
    expect(
      decidePublixCardPoll({
        previousCount: 4,
        count: 4,
        seenCount: 4,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 4_000,
        maxWaitMs: 20_000,
        samples: 5,
        equalPositiveSamples: 1,
        printedTotalIsFloor: true,
        atBottom: false,
        distinctStablePolls: 1,
        distinctCount: 4,
      }),
    ).toBe("continue");
  });

  it("logs a section line and a savings summary without the body or the query", () => {
    const body = JSON.stringify({
      IsPersonalizationEnabled: false,
      WeeklyAdLatestUpdatedDateTime: "2026-11-10T04:00:00Z",
      LanguageId: 1,
      Savings: [],
      access_token: "secret-token",
    });
    const savings = summarizePublixSavingsBody({ status: 200, body });
    expect(savings.keys).toEqual([
      "IsPersonalizationEnabled",
      "LanguageId",
      "Savings",
      "WeeklyAdLatestUpdatedDateTime",
    ]);
    expect(savings.arrayLengths).toEqual([{ name: "Savings", length: 0 }]);
    expect(savings.weeklyAdLatestUpdatedDateTime).toBe("2026-11-10T04:00:00Z");
    expect(savings.byteLength).toBe(Buffer.byteLength(body));
    const section = formatPublixSectionLogLine({
      section: "bogo",
      printed: 4,
      cards: 2,
      offers: 1,
      polls: 3,
      waitMs: 2000,
      stop: "bottom",
    });
    const summary = formatPublixHarvestSummaryLine({
      sections: 1,
      cards: 2,
      offers: 1,
      polls: 3,
      waitMs: 2000,
      harvestCards: 216,
      harvestOffers: 188,
      savings,
    });
    expect(section).toBe(
      "[publix] section=bogo printed=4 cards=2 offers=1 polls=3 waitMs=2000 stop=bottom",
    );
    expect(summary).toContain("savingsStatus=200");
    expect(summary).toContain("savingsArrays=Savings:0");
    expect(summary).toContain("updated=2026-11-10T04:00:00Z");
    expect(summary).toContain("harvestCards=216");
    expect(summary).not.toContain("secret-token");
    expect(summary).not.toContain("pageSize");
    expect(summary).not.toContain(body);
  });

  it("treats five mounted cards as thin when the page says 221 results", () => {
    expect(
      publixPageIsThin({
        seenCount: 5,
        expectedCount: 221,
        rememberedOfferCount: 133,
      }),
    ).toBe(true);
    expect(
      publixPageIsThin({
        seenCount: 221,
        expectedCount: 221,
        rememberedOfferCount: 133,
      }),
    ).toBe(false);
    expect(
      publixPageIsThin({
        seenCount: 80,
        expectedCount: null,
        rememberedOfferCount: null,
        minCards: 50,
      }),
    ).toBe(false);
  });
});

describe("Publix section page printed count", () => {
  // The bogo grid wraps a dairy chip. The old reader took the first
  // "N results" inside the bogo element and called 14 the bogo total.
  const sectionPage = `
    <div data-weekly-ad-category-id="bogo">
      <div data-weekly-ad-category-id="dairy">
        <h2>Dairy</h2>
        <span>14 results</span>
      </div>
      <h2>BOGO</h2>
      <span>225 results</span>
    </div>`;

  it("uses the shown section and ignores another category's number", () => {
    const counts = parsePublixCategoryResultCounts(sectionPage);
    expect(counts).toEqual([
      { categoryId: "dairy", count: 14 },
      { categoryId: "bogo", count: 225 },
    ]);
    expect(publixListedCardTarget(counts, "bogo")).toBe(225);
    expect(publixListedCardTarget(counts, "meat")).toBeNull();
    expect(publixListedCardTarget(counts)).toBeNull();
  });

  it("does not stop as listed or look full from a count that is not this section", () => {
    const counts = parsePublixCategoryResultCounts(sectionPage);
    const printed = publixListedCardTarget(counts, "bogo");
    const unknown = publixListedCardTarget(counts, "meat");
    expect(nextPublixExpectedCount(printed, 14)).toBe(225);
    expect(unknown).toBeNull();
    expect(
      publixPageIsThin({
        seenCount: 39,
        expectedCount: unknown,
        rememberedOfferCount: null,
        minCards: 50,
      }),
    ).toBe(true);
    expect(
      decidePublixCardPoll({
        previousCount: 39,
        count: 39,
        seenCount: 39,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
        equalPositiveSamples: 1,
      }),
    ).toBe("continue");
    expect(
      decidePublixCardPoll({
        previousCount: 39,
        count: 39,
        seenCount: 39,
        expectedCount: unknown,
        rememberedOfferCount: null,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
        equalPositiveSamples: 1,
      }),
    ).not.toBe("listed");
    expect(
      decidePublixCardPoll({
        previousCount: 224,
        count: 225,
        seenCount: 225,
        expectedCount: printed,
        rememberedOfferCount: null,
        elapsedMs: 4_000,
        maxWaitMs: 20_000,
        samples: 5,
        equalPositiveSamples: 1,
      }),
    ).toBe("listed");
  });
});

describe("Publix harvest sanity", () => {
  const sections = [
    { section: "bogo", cards: 225 },
    { section: "meat", cards: 145 },
    { section: "produce", cards: 89 },
    { section: "dairy", cards: 37 },
    { section: "protein", cards: 45 },
  ];

  it("marks the 11-12 harvest thin against the bogo page and the feed", () => {
    expect(
      assessPublixHarvest({
        harvestedCards: 39,
        sections,
        feedItemCount: null,
      }),
    ).toEqual({
      thin: true,
      reason: "saved 39 cards but the bogo page showed 225",
    });
    expect(
      assessPublixHarvest({
        harvestedCards: 39,
        sections: [],
        feedItemCount: 730,
      }),
    ).toEqual({
      thin: true,
      reason: "saved 39 cards but the savings feed listed 730",
    });
  });

  it("does not mark the 3:40pm harvest thin", () => {
    expect(
      assessPublixHarvest({
        harvestedCards: 445,
        sections,
        feedItemCount: 730,
      }),
    ).toEqual({ thin: false, reason: null });
  });

  it("skips the feed check when the feed is empty or missing", () => {
    expect(
      assessPublixHarvest({
        harvestedCards: 445,
        sections,
        feedItemCount: 0,
      }).thin,
    ).toBe(false);
    expect(
      assessPublixHarvest({
        harvestedCards: 445,
        sections,
        feedItemCount: null,
      }).thin,
    ).toBe(false);
  });
});
