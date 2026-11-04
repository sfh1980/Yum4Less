import { describe, expect, it } from "vitest";
import {
  buildPublixThinCaptureMeta,
  decidePublixCardPoll,
  publixCardCountIsThin,
  readPublixCardMaxWaitMs,
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
      }),
    ).toBe("continue");
  });

  it("stops when a positive count is unchanged across one poll", () => {
    expect(
      decidePublixCardPoll({
        previousCount: 2,
        count: 2,
        rememberedOfferCount: remembered,
        elapsedMs: 1_000,
        maxWaitMs: 20_000,
        samples: 2,
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
      }),
    ).toBe("max-wait");
  });

  it("marks a count under half the memory as thin and leaves an unknown memory alone", () => {
    expect(publixCardCountIsThin(2, remembered)).toBe(true);
    expect(publixCardCountIsThin(294, remembered)).toBe(false);
    expect(publixCardCountIsThin(2, null)).toBe(false);
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
      rememberedOfferCount: 588,
      capturedAt: "2026-11-03T22:00:00.000Z",
    });
  });
});
