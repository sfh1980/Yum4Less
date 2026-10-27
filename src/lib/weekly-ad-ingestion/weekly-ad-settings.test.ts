import { describe, expect, it } from "vitest";
import {
  WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT,
  readWeeklyAdMaxUnverifiedDays,
} from "@/lib/weekly-ad-ingestion/weekly-ad-settings";

describe("readWeeklyAdMaxUnverifiedDays", () => {
  it("defaults to 8 days when the setting is unset", () => {
    expect(readWeeklyAdMaxUnverifiedDays({ NODE_ENV: "test" })).toBe(
      WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT,
    );
    expect(WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT).toBe(8);
  });

  it("uses a positive whole-day setting and ignores unusable values", () => {
    expect(
      readWeeklyAdMaxUnverifiedDays({
        NODE_ENV: "test",
        YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS: "5",
      }),
    ).toBe(5);
    expect(
      readWeeklyAdMaxUnverifiedDays({
        NODE_ENV: "test",
        YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS: "0",
      }),
    ).toBe(8);
    expect(
      readWeeklyAdMaxUnverifiedDays({
        NODE_ENV: "test",
        YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS: "nope",
      }),
    ).toBe(8);
  });
});
