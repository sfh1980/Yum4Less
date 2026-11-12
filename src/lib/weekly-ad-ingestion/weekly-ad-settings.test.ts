import { describe, expect, it } from "vitest";
import {
  WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT,
  formatWeeklyAdSettingsLine,
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

describe("formatWeeklyAdSettingsLine", () => {
  it("prints effective defaults and leaves secrets out", () => {
    const line = formatWeeklyAdSettingsLine({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:secret@localhost/yum4less",
      KROGER_CLIENT_SECRET: "token-value",
      YUM4LESS_PUBLIX_STORE_URL: "https://services.publix.com/api/v4/savings",
    });
    expect(line.startsWith("[nightly] ")).toBe(true);
    expect(line).toContain("YUM4LESS_WEEKLY_AD_HTTP_RETRIES=3");
    expect(line).toContain("YUM4LESS_PUBLIX_MERGE_SECTION_CARDS=1");
    expect(line).toContain("YUM4LESS_PUBLIX_HARVEST_MIN_SHARE=0.5");
    expect(line).toContain("YUM4LESS_PUBLIX_FEED_MIN_SHARE=0.25");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("token-value");
    expect(line).not.toContain("https://");
    expect(line).not.toContain("DATABASE_URL");
  });

  it("prints merge off only when the setting is 0", () => {
    const line = formatWeeklyAdSettingsLine({
      NODE_ENV: "test",
      YUM4LESS_PUBLIX_MERGE_SECTION_CARDS: "0",
    });
    expect(line).toContain("YUM4LESS_PUBLIX_MERGE_SECTION_CARDS=0");
  });
});
