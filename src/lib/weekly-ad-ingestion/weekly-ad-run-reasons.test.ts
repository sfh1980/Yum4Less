import { describe, expect, it } from "vitest";
import {
  chooseWeeklyAdRunMissReason,
  countConsecutiveNoFlyerNights,
  NO_FLYER_RUN_REASON,
  readNoFlyerGraceNights,
} from "@/lib/weekly-ad-ingestion/weekly-ad-run-reasons";

describe("no-flyer grace", () => {
  it("uses the defaults and ignores unusable settings", () => {
    expect(readNoFlyerGraceNights({ NODE_ENV: "test" })).toBe(2);
    expect(
      readNoFlyerGraceNights({ NODE_ENV: "test", YUM4LESS_NO_FLYER_GRACE_NIGHTS: "4" }),
    ).toBe(4);
    expect(
      readNoFlyerGraceNights({ NODE_ENV: "test", YUM4LESS_NO_FLYER_GRACE_NIGHTS: "0" }),
    ).toBe(2);
  });

  it("stores flyer-not-published for a no-flyer night and keeps a real miss", () => {
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: true,
        missDetail: null,
      }),
    ).toBe(NO_FLYER_RUN_REASON);
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: false,
        missDetail: "the page timed out",
      }),
    ).toBe("the page timed out");
    expect(
      chooseWeeklyAdRunMissReason({
        noFlyer: false,
        missDetail: null,
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
