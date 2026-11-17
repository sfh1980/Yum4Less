import { afterEach, describe, expect, it } from "vitest";
import {
  formatBusinessCalendarDate,
  readBusinessTimeZone,
} from "@/lib/business-time-zone";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";
import { morningReportDate } from "@/lib/owner/morning-report";
import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import { weeklyAdRetryDate } from "@/lib/weekly-ad-ingestion/weekly-ad-retry";

const originalZone = process.env.YUM4LESS_BUSINESS_TIME_ZONE;

afterEach(() => {
  if (originalZone === undefined) {
    delete process.env.YUM4LESS_BUSINESS_TIME_ZONE;
  } else {
    process.env.YUM4LESS_BUSINESS_TIME_ZONE = originalZone;
  }
});

describe("business time zone", () => {
  it("accepts a real IANA zone", () => {
    expect(
      readBusinessTimeZone(
        buildTestProcessEnv({ YUM4LESS_BUSINESS_TIME_ZONE: "America/New_York" }),
      ),
    ).toBe("America/New_York");
  });

  it("rejects an invalid zone and names the setting", () => {
    expect(() =>
      readBusinessTimeZone(buildTestProcessEnv({ YUM4LESS_BUSINESS_TIME_ZONE: "Not/AZone" })),
    ).toThrow(/YUM4LESS_BUSINESS_TIME_ZONE is not a real IANA time zone \(Not\/AZone\)/);
  });

  it("rejects an unset or empty setting and names the setting", () => {
    expect(() => readBusinessTimeZone(buildTestProcessEnv())).toThrow(
      /YUM4LESS_BUSINESS_TIME_ZONE is not set/,
    );
    expect(() =>
      readBusinessTimeZone(buildTestProcessEnv({ YUM4LESS_BUSINESS_TIME_ZONE: "   " })),
    ).toThrow(/YUM4LESS_BUSINESS_TIME_ZONE is not set/);

    delete process.env.YUM4LESS_BUSINESS_TIME_ZONE;
    expect(() => weeklyAdRetryDate(new Date("2026-11-11T04:30:00.000Z"))).toThrow(
      /YUM4LESS_BUSINESS_TIME_ZONE is not set/,
    );
    expect(() => morningReportDate(new Date("2026-11-11T04:30:00.000Z"))).toThrow(
      /YUM4LESS_BUSINESS_TIME_ZONE is not set/,
    );
    expect(() => getWeeklyAdBrowserContextOptions()).toThrow(
      /YUM4LESS_BUSINESS_TIME_ZONE is not set/,
    );
  });

  it("keeps the near-midnight Eastern calendar date used today", () => {
    const nearMidnight = new Date("2026-11-11T04:30:00.000Z");
    expect(formatBusinessCalendarDate(nearMidnight, "America/New_York")).toBe(
      "2026-11-10",
    );
    expect(weeklyAdRetryDate(nearMidnight, "America/New_York")).toBe("2026-11-10");
    expect(morningReportDate(nearMidnight, "America/New_York")).toBe("2026-11-10");
    expect(weeklyAdRetryDate(new Date("2026-11-11T08:00:00.000Z"), "America/New_York")).toBe(
      "2026-11-11",
    );
  });
});
