import { describe, expect, it } from "vitest";
import {
  bumpWeeklyAdRetryCount,
  noteWeeklyAdThinResult,
  parseWeeklyAdRetryState,
  readWeeklyAdRetryMaxPerDay,
  selectWeeklyAdRetryChain,
  WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT,
  weeklyAdRetryDate,
  weeklyAdRetrySkipMessage,
  weeklyAdThinSignature,
  type WeeklyAdRetryState,
} from "@/lib/weekly-ad-ingestion/weekly-ad-retry";

/** Fresh Wednesday: Publix is thin with rows, Whole Foods has none. Live sort_order. */
function wednesdaySlots(input: {
  publixAttempts?: number;
  wholeFoodsWritesAtHour?: number;
  signatureForHour: (hour: number) => string;
}): Array<string | null> {
  let wholeFoodsFresh = 0;
  let state: WeeklyAdRetryState = {
    date: "2026-11-11",
    counts: input.publixAttempts ? { publix: input.publixAttempts } : {},
    thinStamps: {},
  };
  const picks: Array<string | null> = [];
  for (let hour = 6; hour <= 12; hour += 1) {
    const choice = selectWeeklyAdRetryChain({
      candidates: [
        {
          chainId: "publix",
          freshCount: 56,
          thinPage: true,
          sortOrder: 30,
        },
        {
          chainId: "whole-foods",
          freshCount: wholeFoodsFresh,
          sortOrder: 120,
        },
      ],
      attemptsToday: state.counts,
      maxPerDay: WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT,
      thinStamps: state.thinStamps,
    });
    picks.push(choice);
    if (!choice) {
      continue;
    }
    state = bumpWeeklyAdRetryCount(state, choice);
    if (choice === "publix") {
      state = noteWeeklyAdThinResult(state, choice, input.signatureForHour(hour));
    }
    if (choice === "whole-foods" && hour === input.wholeFoodsWritesAtHour) {
      wholeFoodsFresh = 11;
    }
  }
  return picks;
}

describe("weekly-ad retry picker", () => {
  it("uses the New York date and a default cap of 7", () => {
    expect(weeklyAdRetryDate(new Date("2026-11-11T08:00:00.000Z"))).toBe("2026-11-11");
    expect(weeklyAdRetryDate(new Date("2026-11-11T04:30:00.000Z"))).toBe("2026-11-10");
    expect(readWeeklyAdRetryMaxPerDay({})).toBe(7);
    expect(WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT).toBe(7);
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
    const attempts: Record<string, number> = { publix: WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT };
    const picks: Array<string | null> = [];
    for (let hour = 6; hour <= 12; hour += 1) {
      const choice = selectWeeklyAdRetryChain({
        candidates,
        attemptsToday: attempts,
        maxPerDay: WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT,
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
      "whole-foods",
    ]);
    expect(attempts.publix).toBe(7);
    expect(attempts["whole-foods"]).toBe(7);
  });

  it("still stops a thin chain after two identical results once nothing has zero rows", () => {
    const candidates = [
      { chainId: "publix", freshCount: 55, thinPage: true, sortOrder: 30 },
      { chainId: "whole-foods", freshCount: 11, sortOrder: 120 },
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
      state = noteWeeklyAdThinResult(
        state,
        choice,
        weeklyAdThinSignature({ seenCards: 173, parsedOffers: 13 }),
      );
    }
    expect(picks).toEqual(["publix", "publix", null, null, null, null, null]);
    expect(state.counts.publix).toBe(2);
    expect(state.thinStamps.publix).toEqual({ signature: "173:13", identical: 2 });
  });

  it("keeps retrying a thin page when the signature changes and no chain has zero rows", () => {
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
          { chainId: "whole-foods", freshCount: 11, sortOrder: 120 },
          { chainId: "publix", freshCount: 55, thinPage: true, sortOrder: 30 },
        ],
        attemptsToday: { publix: 2 },
        maxPerDay: 6,
        thinStamps: second.thinStamps,
      }),
    ).toBe("publix");
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "publix", freshCount: 55, thinPage: true, sortOrder: 30 },
          { chainId: "whole-foods", freshCount: 0, sortOrder: 120 },
        ],
        attemptsToday: { publix: 2 },
        maxPerDay: 6,
        thinStamps: second.thinStamps,
      }),
    ).toBe("whole-foods");
  });

  it("orders a zero-row chain ahead of an earlier thin chain, and keeps sort_order inside a group", () => {
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "publix", freshCount: 55, thinPage: true, sortOrder: 30 },
          { chainId: "whole-foods", freshCount: 0, sortOrder: 120 },
        ],
        attemptsToday: {},
        maxPerDay: 6,
      }),
    ).toBe("whole-foods");
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "food-lion", freshCount: 57, thinPage: true, sortOrder: 40 },
          { chainId: "publix", freshCount: 55, thinPage: true, sortOrder: 30 },
        ],
        attemptsToday: {},
        maxPerDay: 6,
      }),
    ).toBe("publix");
    expect(
      selectWeeklyAdRetryChain({
        candidates: [
          { chainId: "kroger", freshCount: 0, sortOrder: 10 },
          { chainId: "aldi", freshCount: 0, sortOrder: 10 },
        ],
        attemptsToday: {},
        maxPerDay: 6,
      }),
    ).toBe("aldi");
  });

  it("on Wednesday 2026-11-11 lets Whole Foods use noon when Publix only repeats", () => {
    const picks = wednesdaySlots({
      signatureForHour: () => weeklyAdThinSignature({ seenCards: 173, parsedOffers: 13 }),
    });
    expect(picks).toEqual([
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
    ]);
  });

  it("on Wednesday still gives Whole Foods every slot when Publix's signature changes", () => {
    const picks = wednesdaySlots({
      signatureForHour: (hour) =>
        weeklyAdThinSignature({ seenCards: 170 + hour, parsedOffers: hour }),
    });
    expect(picks).toEqual([
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
    ]);
  });

  it("on Wednesday still gives noon to Whole Foods when Publix has already used its cap", () => {
    const picks = wednesdaySlots({
      publixAttempts: WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT,
      signatureForHour: () => weeklyAdThinSignature({ seenCards: 173, parsedOffers: 13 }),
    });
    expect(picks).toEqual([
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
    ]);
  });

  it("on Wednesday gives noon to Publix after Whole Foods writes rows at 11:00", () => {
    const picks = wednesdaySlots({
      wholeFoodsWritesAtHour: 11,
      signatureForHour: () => weeklyAdThinSignature({ seenCards: 173, parsedOffers: 13 }),
    });
    expect(picks).toEqual([
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "whole-foods",
      "publix",
    ]);
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

  it("says nothing needs a retry when no chain is stale or thin", () => {
    const message = weeklyAdRetrySkipMessage({
      candidates: [{ chainId: "publix", freshCount: 10, thinPage: false }],
      attemptsToday: {},
      maxPerDay: 7,
    });
    expect(message).toBe("[weekly-ad-retry] nothing needs a retry.");
    expect(message).not.toContain("limit");
  });

  it("mentions the daily limit only when a needy chain has hit the cap", () => {
    const message = weeklyAdRetrySkipMessage({
      candidates: [{ chainId: "publix", freshCount: 0 }],
      attemptsToday: { publix: 7 },
      maxPerDay: 7,
    });
    expect(message).toBe(
      "[weekly-ad-retry] a chain needed a retry but has hit today's limit.",
    );
  });

  it("does not mention the limit when a thin chain stopped on an identical page", () => {
    const message = weeklyAdRetrySkipMessage({
      candidates: [{ chainId: "publix", freshCount: 10, thinPage: true }],
      attemptsToday: { publix: 1 },
      maxPerDay: 7,
      thinStamps: { publix: { signature: "39:39", identical: 2 } },
    });
    expect(message).toBe("[weekly-ad-retry] nothing needs a retry.");
    expect(message).not.toContain("limit");
  });
});
