import { describe, expect, it } from "vitest";
import {
  bumpWeeklyAdRetryCount,
  noteWeeklyAdThinResult,
  parseWeeklyAdRetryState,
  readWeeklyAdRetryMaxPerDay,
  selectWeeklyAdRetryChain,
  weeklyAdRetryDate,
  weeklyAdThinSignature,
  type WeeklyAdRetryState,
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

  it("gives Whole Foods the Wednesday retries when Publix has already used its own cap", () => {
    const candidates = [
      { chainId: "kroger", freshCount: 130 },
      { chainId: "aldi", freshCount: 41 },
      { chainId: "publix", freshCount: 55, thinPage: true },
      { chainId: "food-lion", freshCount: 57 },
      { chainId: "lidl", freshCount: 28 },
      { chainId: "walmart", freshCount: 6 },
      { chainId: "whole-foods", freshCount: 0 },
    ];
    const attempts: Record<string, number> = { publix: 6 };
    const picks: Array<string | null> = [];
    for (let hour = 6; hour <= 12; hour += 1) {
      const choice = selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: attempts,
        maxPerDay: 6,
      });
      picks.push(choice);
      if (choice) {
        attempts[choice] = (attempts[choice] ?? 0) + 1;
      }
    }
    expect(picks).toEqual([
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      null,
    ]);
    expect(attempts.publix).toBe(6);
    expect(attempts["whole-foods"]).toBe(6);
  });

  it("stops identical thin retries after two and gives the later hours to Whole Foods", () => {
    const candidates = [
      { chainId: "publix", freshCount: 55, thinPage: true },
      { chainId: "whole-foods", freshCount: 0 },
    ];
    let state: WeeklyAdRetryState = {
      date: "2026-11-11",
      counts: {},
      thinStamps: {},
    };
    const picks: Array<string | null> = [];
    for (let hour = 6; hour <= 12; hour += 1) {
      const choice = selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: state.counts,
        maxPerDay: 6,
        thinStamps: state.thinStamps,
      });
      picks.push(choice);
      if (!choice) {
        continue;
      }
      state = bumpWeeklyAdRetryCount(state, choice);
      if (choice === "publix") {
        state = noteWeeklyAdThinResult(
          state,
          choice,
          weeklyAdThinSignature({ seenCards: 168, parsedOffers: 16 }),
        );
      }
    }
    expect(picks).toEqual([
      "publix",
      "publix",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
    ]);
    expect(state.counts.publix).toBe(2);
    expect(state.thinStamps.publix).toEqual({ signature: "168:16", identical: 2 });
    expect(state.counts["whole-foods"]).toBe(5);
  });

  it("keeps retrying a thin page when the card count or the offer count changes", () => {
    const first = noteWeeklyAdThinResult(
      { date: "2026-11-11", counts: { publix: 1 }, thinStamps: {} },
      "publix",
      weeklyAdThinSignature({ seenCards: 168, parsedOffers: 16 }),
    );
    const second = noteWeeklyAdThinResult(
      first,
      "publix",
      weeklyAdThinSignature({ seenCards: 220, parsedOffers: 80 }),
    );
    expect(second.thinStamps.publix?.identical).toBe(1);
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "publix", freshCount: 55, thinPage: true },
          { chainId: "whole-foods", freshCount: 0 },
        ],
        attemptsToday: { publix: 2 },
        maxPerDay: 6,
        thinStamps: second.thinStamps,
      }),
    ).toBe("publix");
  });

  it("on a fresh Wednesday gives Publix six thin retries and Whole Foods the noon slot", () => {
    const candidates = [
      { chainId: "publix", freshCount: 55, thinPage: true },
      { chainId: "whole-foods", freshCount: 0 },
    ];
    const attempts: Record<string, number> = {};
    const picks: Array<string | null> = [];
    for (let hour = 6; hour <= 12; hour += 1) {
      const choice = selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: attempts,
        maxPerDay: 6,
      });
      picks.push(choice);
      if (choice) {
        attempts[choice] = (attempts[choice] ?? 0) + 1;
      }
    }
    expect(picks.slice(0, 6).every((pick) => pick === "publix")).toBe(true);
    expect(picks[6]).toBe("whole-foods");
  });

  it("drops yesterday's counts", () => {
    const state = parseWeeklyAdRetryState(
      JSON.stringify({ date: "2026-11-10", counts: { "whole-foods": 6 } }),
      "2026-11-11",
    );
    expect(state.counts).toEqual({});
    expect(state.thinStamps).toEqual({});
    expect(bumpWeeklyAdRetryCount(state, "whole-foods").counts).toEqual({
      "whole-foods": 1,
    });
  });
});
