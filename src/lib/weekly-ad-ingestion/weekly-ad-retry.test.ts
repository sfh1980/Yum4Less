import { describe, expect, it } from "vitest";
import {
  bumpWeeklyAdRetryCount,
  parseWeeklyAdRetryState,
  readWeeklyAdRetryMaxPerDay,
  selectWeeklyAdRetryChain,
  weeklyAdRetryDate,
} from "@/lib/weekly-ad-ingestion/weekly-ad-retry";

describe("weekly-ad retry picker", () => {
  it("uses the New York date and a default cap of 6", () => {
    expect(weeklyAdRetryDate(new Date("2026-11-11T08:00:00.000Z"))).toBe("2026-11-11");
    expect(weeklyAdRetryDate(new Date("2026-11-11T04:30:00.000Z"))).toBe("2026-11-10");
    expect(readWeeklyAdRetryMaxPerDay({})).toBe(6);
    expect(readWeeklyAdRetryMaxPerDay({ YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY: "2" })).toBe(2);
    expect(() =>
      readWeeklyAdRetryMaxPerDay({ YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY: "0" }),
    ).toThrow(/1 to 24/);
  });

  it("picks the first chain with no fresh rows that is under the daily cap", () => {
    const candidates = [
      { chainId: "aldi", freshCount: 4 },
      { chainId: "kroger", freshCount: 12 },
      { chainId: "whole-foods", freshCount: 0 },
      { chainId: "publix", freshCount: 0 },
    ];
    expect(
      selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: {},
        maxPerDay: 6,
      }),
    ).toBe("whole-foods");
    expect(
      selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: { "whole-foods": 6 },
        maxPerDay: 6,
      }),
    ).toBe("publix");
    expect(
      selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: { "whole-foods": 6, publix: 6 },
        maxPerDay: 6,
      }),
    ).toBeNull();
  });

  it("retries a thin page even when that chain still has fresh rows", () => {
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "aldi", freshCount: 40 },
          { chainId: "publix", freshCount: 24, thinPage: true },
        ],
        attemptsToday: {},
        maxPerDay: 6,
      }),
    ).toBe("publix");
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "publix", freshCount: 24, thinPage: true },
          { chainId: "whole-foods", freshCount: 0 },
        ],
        attemptsToday: { publix: 6 },
        maxPerDay: 6,
      }),
    ).toBe("whole-foods");
  });

  it("drops yesterday's counts", () => {
    const state = parseWeeklyAdRetryState(
      JSON.stringify({ date: "2026-11-10", counts: { "whole-foods": 6 } }),
      "2026-11-11",
    );
    expect(state.counts).toEqual({});
    expect(bumpWeeklyAdRetryCount(state, "whole-foods").counts).toEqual({
      "whole-foods": 1,
    });
  });
});
