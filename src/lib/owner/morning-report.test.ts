import { describe, expect, it } from "vitest";
import {
  composeMissedMorningReport,
  composeMorningReport,
  isDiscordWebhookUrl,
  isMorningZipAddDay,
  judgeLiveSite,
  judgeShopperProbeWithDinners,
  mergeOffZipCounts,
  morningReportDate,
  pickMorningZipCandidates,
} from "@/lib/owner/morning-report";

const quiet = {
  weekday: "Monday",
  codeTests: "passed" as const,
  siteCheck: "passed" as const,
  lastNightOk: true,
  pricesFresh: true,
  addDay: true,
  addedZipCodes: [] as string[],
  addSkipped: null,
  addErrors: [] as string[],
  zipResults: [] as { zipCode: string; outcome: "dinners" }[],
  nearbyLeft: true,
  discordConfigured: true,
};

describe("morning report", () => {
  it("uses the New York calendar date", () => {
    expect(morningReportDate(new Date("2026-10-12T03:30:00Z"))).toBe("2026-10-11");
    expect(morningReportDate(new Date("2026-10-12T16:00:00Z"))).toBe("2026-10-12");
  });

  it("adds ZIPs on even day numbers and skips the next day", () => {
    expect(isMorningZipAddDay("1970-01-01")).toBe(true);
    expect(isMorningZipAddDay("1970-01-02")).toBe(false);
    expect(isMorningZipAddDay("not-a-date")).toBe(false);
  });

  it("picks the fullest nearby ZIPs that are still off", () => {
    expect(
      pickMorningZipCandidates({
        offZips: mergeOffZipCounts([
          [
            { zipCode: "23227", storeCount: 4 },
            { zipCode: "unknown", storeCount: 9 },
          ],
          [{ zipCode: "23227", storeCount: 2 }, { zipCode: "23226", storeCount: 4 }],
        ]),
        activeZipCodes: new Set(["23220"]),
        alreadyAdded: new Set(["23226"]),
        limit: 3,
      }),
    ).toEqual(["23227"]);
  });

  it("treats a normal answer with no dinners as on the map only", () => {
    expect(
      judgeShopperProbeWithDinners({
        marketOk: true,
        storeCount: 2,
        rankOk: true,
        dinnerCount: 0,
      }),
    ).toBe("map-only");
    expect(
      judgeShopperProbeWithDinners({
        marketOk: true,
        storeCount: 2,
        rankOk: true,
        dinnerCount: 1,
      }),
    ).toBe("dinners");
    expect(
      judgeLiveSite({
        homeOk: true,
        faqOk: true,
        marketOk: true,
        storeCount: 1,
        rankOk: true,
      }),
    ).toBe("passed");
    expect(
      judgeLiveSite({
        homeOk: true,
        faqOk: true,
        marketOk: true,
        storeCount: 0,
        rankOk: false,
      }),
    ).toBe("failed");
  });

  it("lists every problem in one note and stays quiet on a good morning", () => {
    const good = composeMorningReport({
      ...quiet,
      addedZipCodes: ["23221", "23222", "23223"],
      zipResults: [
        { zipCode: "23219", outcome: "map-only" },
        { zipCode: "23224", outcome: "map-only" },
        { zipCode: "23225", outcome: "dinners" },
      ],
    });
    expect(good.needsAttention).toBe(false);
    expect(good.body).toContain("Code tests passed.");
    expect(good.body).toContain("Added 3 areas.");
    expect(good.body).toContain("2 are on the map only.");
    expect(good.body).toContain("1 showed dinners.");
    expect(good.body).toContain("Nothing needs you.");

    const bad = composeMorningReport({
      ...quiet,
      codeTests: "failed",
      siteCheck: "failed",
      lastNightOk: false,
      pricesFresh: false,
      addSkipped: "last-night",
      nearbyLeft: false,
    });
    expect(bad.needsAttention).toBe(true);
    expect(bad.body).toContain("Code tests failed.");
    expect(bad.body).toContain("The site did not answer from outside.");
    expect(bad.body).toContain("Last night did not finish.");
    expect(bad.body).toContain("No new areas were added.");
    expect(bad.body).toContain("Prices are not from the last day.");
    expect(bad.body.endsWith("Needs you.")).toBe(true);
  });

  it("says when nearby ZIPs run out and when the check itself did not run", () => {
    const empty = composeMorningReport({
      ...quiet,
      addSkipped: "none-left",
      nearbyLeft: false,
    });
    expect(empty.body).toContain("No nearby areas are left to add.");
    expect(empty.needsAttention).toBe(true);
    expect(composeMissedMorningReport("Tuesday").body).toContain(
      "The morning check did not run.",
    );
  });

  it("accepts only a Discord webhook URL", () => {
    expect(
      isDiscordWebhookUrl("https://discord.com/api/webhooks/1/token"),
    ).toBe(true);
    expect(isDiscordWebhookUrl("https://example.com/api/webhooks/1/token")).toBe(
      false,
    );
    expect(isDiscordWebhookUrl(undefined)).toBe(false);
  });
});
