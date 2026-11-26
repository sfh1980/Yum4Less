import { describe, expect, it } from "vitest";
import {
  chooseWeeklyAdRunMissReason,
  countConsecutiveNoFlyerNights,
  EARLY_AD_RUN_REASON,
  futureValidFromShare,
  NO_FLYER_RUN_REASON,
  offersAreMostlyFuture,
  readEarlyAdShare,
  readNoFlyerGraceNights,
} from "@/lib/weekly-ad-ingestion/weekly-ad-run-reasons";

describe("no-flyer grace and early-ad share", () => {
  it("uses the defaults and ignores unusable settings", () => {
    expect(readNoFlyerGraceNights({ NODE_ENV: "test" })).toBe(2);
    expect(
      readNoFlyerGraceNights({ NODE_ENV: "test", YUM4LESS_NO_FLYER_GRACE_NIGHTS: "4" }),
    ).toBe(4);
    expect(
      readNoFlyerGraceNights({ NODE_ENV: "test", YUM4LESS_NO_FLYER_GRACE_NIGHTS: "0" }),
    ).toBe(2);
    expect(readEarlyAdShare({ NODE_ENV: "test" })).toBe(0.5);
    expect(readEarlyAdShare({ NODE_ENV: "test", YUM4LESS_EARLY_AD_SHARE: "0.8" })).toBe(0.8);
    expect(readEarlyAdShare({ NODE_ENV: "test", YUM4LESS_EARLY_AD_SHARE: "2" })).toBe(0.5);
  });

  it("counts a future-dated share at or above the setting", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const offers = [
      { validFrom: "2026-12-03T00:00:00Z" },
      { validFrom: "2026-12-03T00:00:00Z" },
      { validFrom: "2026-11-20T00:00:00Z" },
      { validFrom: undefined },
    ];
    expect(futureValidFromShare(offers, now)).toBe(0.5);
    expect(offersAreMostlyFuture({ offers, now, share: 0.5 })).toBe(true);
    expect(
      offersAreMostlyFuture({
        offers: [{ validFrom: "2026-11-20T00:00:00Z" }, { validFrom: "2026-12-03T00:00:00Z" }],
        now,
        share: 0.5,
      }),
    ).toBe(true);
    expect(
      offersAreMostlyFuture({
        offers: [
          { validFrom: "2026-11-20T00:00:00Z" },
          { validFrom: "2026-11-20T00:00:00Z" },
          { validFrom: "2026-12-03T00:00:00Z" },
        ],
        now,
        share: 0.5,
      }),
    ).toBe(false);
  });

  it("stores flyer-not-published for a no-flyer night and early-ad only when the share is high", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: true,
        missDetail: null,
        offers: [],
        now,
        earlyAdShare: 0.5,
      }),
    ).toBe(NO_FLYER_RUN_REASON);
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: false,
        missDetail: "the page timed out",
        offers: [{ validFrom: "2026-12-03T00:00:00Z" }],
        now,
        earlyAdShare: 0.5,
      }),
    ).toBe("the page timed out");
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: false,
        missDetail: null,
        offers: [
          { validFrom: "2026-12-03T00:00:00Z" },
          { validFrom: "2026-12-03T00:00:00Z" },
        ],
        now,
        earlyAdShare: 0.5,
      }),
    ).toBe(EARLY_AD_RUN_REASON);
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: false,
        missDetail: null,
        offers: [{ validFrom: "2026-11-20T00:00:00Z" }],
        now,
        earlyAdShare: 0.5,
      }),
    ).toBeNull();
  });

  it("counts consecutive no-flyer nights and stops at a gap or another reason", () => {
    const rows = [
      { runDate: "2026-11-26", missReason: NO_FLYER_RUN_REASON },
      { runDate: "2026-11-25", missReason: NO_FLYER_RUN_REASON },
      { runDate: "2026-11-24", missReason: "the page timed out" },
    ];
    expect(countConsecutiveNoFlyerNights(rows, "2026-11-26")).toBe(2);
    expect(
      countConsecutiveNoFlyerNights(
        [
          { runDate: "2026-11-26", missReason: NO_FLYER_RUN_REASON },
          { runDate: "2026-11-25", missReason: NO_FLYER_RUN_REASON },
          { runDate: "2026-11-24", missReason: NO_FLYER_RUN_REASON },
        ],
        "2026-11-26",
      ),
    ).toBe(3);
    expect(
      countConsecutiveNoFlyerNights(
        [{ runDate: "2026-11-25", missReason: NO_FLYER_RUN_REASON }],
        "2026-11-26",
      ),
    ).toBe(0);
  });
});
