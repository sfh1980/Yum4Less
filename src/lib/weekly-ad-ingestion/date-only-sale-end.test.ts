import { describe, expect, it } from "vitest";
import { parseFlippWeeklyAdItems } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { parseTargetWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-target-weekly-ad";
import { extendDateOnlySaleEnd } from "@/lib/weekly-ad-ingestion/date-only-sale-end";

describe("extendDateOnlySaleEnd", () => {
  it("extends a standard-time pair that shares 05:00:00Z by one day", () => {
    expect(
      extendDateOnlySaleEnd({
        start: "2026-10-28T05:00:00Z",
        end: "2026-11-03T05:00:00Z",
      }),
    ).toBe("2026-11-04T05:00:00Z");
  });

  it("extends a daylight-time pair that shares 05:00:00Z by one day", () => {
    expect(
      extendDateOnlySaleEnd({
        start: "2026-10-21T05:00:00Z",
        end: "2026-10-27T05:00:00Z",
      }),
    ).toBe("2026-10-28T05:00:00Z");
  });

  it("keeps a written offset and does not convert it to Z", () => {
    expect(
      extendDateOnlySaleEnd({
        start: "2026-10-28T00:00:00-05:00",
        end: "2026-11-03T00:00:00-05:00",
      }),
    ).toBe("2026-11-04T00:00:00-05:00");
  });

  it("leaves a Flipp end that is not a whole hour unchanged", () => {
    const flippEnd = "2026-05-27T03:59:59+00:00";
    expect(extendDateOnlySaleEnd({ start: flippEnd, end: flippEnd })).toBe(flippEnd);
    expect(extendDateOnlySaleEnd({ start: null, end: flippEnd })).toBe(flippEnd);

    const offers = parseFlippWeeklyAdItems([
      {
        name: "Boneless Strip Steaks",
        current_price: 9.99,
        valid_to: flippEnd,
      },
    ]);
    expect(offers[0]?.validThrough).toBe(flippEnd);
  });

  it("leaves a Target end-of-day clock time unchanged", () => {
    const targetEnd = "09/19/2026 11:59:00 PM";
    expect(extendDateOnlySaleEnd({ start: targetEnd, end: targetEnd })).toBe(targetEnd);
    expect(extendDateOnlySaleEnd({ start: null, end: targetEnd })).toBe(targetEnd);

    const offers = parseTargetWeeklyAd({
      promotionDetails: [
        {
          sale_end_date: targetEnd,
          pages: [{ hotspots: [{ title: "Cottage cheese", price: "2.99" }] }],
        },
      ],
    });
    expect(offers[0]?.validThrough).toBe(targetEnd);
  });

  it("leaves a null end null", () => {
    expect(
      extendDateOnlySaleEnd({ start: "2026-10-28T05:00:00Z", end: null }),
    ).toBeNull();
    expect(
      extendDateOnlySaleEnd({ start: "2026-10-28T05:00:00Z", end: undefined }),
    ).toBeUndefined();
  });

  it("leaves an end whose clock time differs from the start unchanged", () => {
    const end = "2026-11-03T04:00:00Z";
    expect(
      extendDateOnlySaleEnd({ start: "2026-10-28T05:00:00Z", end }),
    ).toBe(end);
    expect(
      extendDateOnlySaleEnd({
        start: "2026-10-28T05:00:00Z",
        end: "2026-11-03T05:00:00-05:00",
      }),
    ).toBe("2026-11-03T05:00:00-05:00");
  });

  it("leaves an end unchanged when the start is missing", () => {
    expect(
      extendDateOnlySaleEnd({ start: undefined, end: "2026-11-03T05:00:00Z" }),
    ).toBe("2026-11-03T05:00:00Z");
  });
});
