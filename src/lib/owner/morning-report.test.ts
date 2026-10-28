import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyOutsideResultToMorningNote,
  chainPriceExceptionsInNote,
  composeMissedMorningReport,
  composeMorningReport,
  countConsecutiveRecipeImportMisses,
  describeRecipeImport,
  isDiscordWebhookUrl,
  isMorningZipAddDay,
  judgeLiveSite,
  judgeShopperProbeWithDinners,
  morningReportDate,
  pickMorningZipCandidates,
  previousMorningReportDate,
  recipeImportDidNotFinish,
  describeAddSkipLine,
  type MorningChainPriceFact,
} from "@/lib/owner/morning-report";
import { OSM_OVERPASS_DISABLED_MESSAGE } from "@/lib/osm-food-retail-discovery";

function priceChain(
  overrides: Partial<MorningChainPriceFact> & Pick<MorningChainPriceFact, "displayName">,
): MorningChainPriceFact {
  return {
    admittedStore: true,
    saleSource: true,
    freshOfficialCount: 0,
    freshFlyerCount: 1,
    ...overrides,
  };
}

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

  it("picks surrounding ZIPs in numeric order", () => {
    expect(
      pickMorningZipCandidates({
        zipCodes: ["23230", "23227", "nope", "23221", "23227"],
        activeZipCodes: new Set(["23220"]),
        alreadyAdded: new Set(["23221"]),
        limit: 2,
      }),
    ).toEqual(["23227", "23230"]);
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

    const late = applyOutsideResultToMorningNote(
      [
        "Thursday morning",
        "Code tests were not reported.",
        "The outside site check was not reported.",
        "Last night finished.",
        "Prices are from the last day.",
        "No new areas today.",
        "Discord was not sent. The morning webhook is not set.",
        "Needs you.",
      ].join("\n"),
      { codeTests: "passed", siteCheck: "passed", discordConfigured: true },
    );
    expect(late.needsAttention).toBe(false);
    expect(late.body).toContain("Code tests passed.");
    expect(late.body).toContain("The site answered from outside.");
    expect(late.body).not.toContain("webhook is not set");
    expect(late.body).toContain("Nothing needs you.");

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
    expect(bad.body).toContain("add skipped: last night did not finish.");
    expect(bad.body).toContain("Prices are not from the last day.");
    expect(bad.body.endsWith("Needs you.")).toBe(true);
  });

  it("says when nearby ZIPs run out and when the check itself did not run", () => {
    const empty = composeMorningReport({
      ...quiet,
      addSkipped: "none-left",
      nearbyLeft: false,
    });
    expect(empty.body).toContain("No surrounding areas are left to add.");
    expect(empty.body).toContain("add skipped: no areas left.");
    expect(empty.needsAttention).toBe(true);

    const cloudflare = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      cloudflare: { checked: true, tunnel: "connected", errorCount: 4 },
    });
    expect(cloudflare.body).toContain("Cloudflare saw 4 errors.");
    expect(cloudflare.needsAttention).toBe(true);
    const kept = applyOutsideResultToMorningNote(cloudflare.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(kept.body).toContain("Cloudflare saw 4 errors.");
    expect(kept.needsAttention).toBe(true);
    expect(composeMissedMorningReport("Tuesday").body).toContain(
      "The morning check did not run.",
    );
  });

  it("says store lookup was turned off without needing you", () => {
    const note = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      storeLookupTurnedOff: true,
    });
    expect(note.body).toContain(OSM_OVERPASS_DISABLED_MESSAGE);
    expect(note.needsAttention).toBe(false);
    expect(note.body.endsWith("Nothing needs you.")).toBe(true);

    const kept = applyOutsideResultToMorningNote(note.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(kept.body).toContain(OSM_OVERPASS_DISABLED_MESSAGE);
    expect(kept.needsAttention).toBe(false);
    expect(kept.body.endsWith("Nothing needs you.")).toBe(true);
  });

  it("names a missed recipe import without failing the night or needing you", () => {
    expect(
      recipeImportDidNotFinish([
        { kind: "themealdb-from-sales", status: "succeeded", lastError: "Recipe import did not finish." },
      ]),
    ).toBe(true);
    expect(
      recipeImportDidNotFinish([
        { kind: "themealdb-from-sales", status: "succeeded", lastError: null },
      ]),
    ).toBe(false);

    const note = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      recipeImportFailed: true,
    });
    expect(note.body).toContain("Last night finished.");
    expect(note.body).toContain("Recipe import did not finish.");
    expect(note.needsAttention).toBe(false);
    expect(note.body.endsWith("Nothing needs you.")).toBe(true);
    expect(note.body).not.toContain("Recipe import has missed");
  });

  it("sets Needs you after the recipe import misses the configured mornings", () => {
    expect(
      countConsecutiveRecipeImportMisses([
        "Monday morning\nRecipe import did not finish.\nNothing needs you.",
        "Sunday morning\nRecipe import did not finish.\nNothing needs you.",
        "Saturday morning\nLast night finished.\nNothing needs you.",
      ]),
    ).toBe(2);

    const second = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      recipeImportFailed: true,
      recipeImportPriorMisses: 1,
      recipeImportNeedsYouAfter: 3,
    });
    expect(second.body).toContain("Recipe import did not finish.");
    expect(second.needsAttention).toBe(false);

    const third = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      recipeImportFailed: true,
      recipeImportPriorMisses: 2,
      recipeImportNeedsYouAfter: 3,
    });
    expect(third.body).toContain("Recipe import did not finish.");
    expect(third.body).toContain("Recipe import has missed 3 mornings.");
    expect(third.needsAttention).toBe(true);
    expect(describeRecipeImport({
      failedToday: false,
      priorConsecutiveMisses: 5,
      threshold: 3,
    }).needsAttention).toBe(false);

    const kept = applyOutsideResultToMorningNote(third.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(kept.needsAttention).toBe(true);
    expect(kept.body).toContain("Recipe import has missed 3 mornings.");
  });

  it("imports every morning-report name this file calls", () => {
    const source = readFileSync("src/lib/owner/morning-report.test.ts", "utf8");
    const importEnd = source.indexOf("} from \"@/lib/owner/morning-report\"");
    const importBlock = source.slice(0, importEnd);
    const body = source.slice(importEnd);
    for (const name of [
      "previousMorningReportDate",
      "recipeImportDidNotFinish",
      "describeAddSkipLine",
      "describeRecipeImport",
      "composeMorningReport",
    ]) {
      if (body.includes(`${name}(`)) {
        expect(importBlock, name).toContain(name);
      }
    }
  });

  it("says why an add morning added nothing", () => {
    const census = composeMorningReport({
      ...quiet,
      addErrors: ["Surrounding areas could not be listed."],
    });
    expect(census.body).toContain("add skipped: Surrounding areas could not be listed.");
    expect(describeAddSkipLine({
      addDay: false,
      addedCount: 0,
      addSkipped: "not-add-day",
      addErrors: [],
    })).toBeNull();
    const offDay = composeMorningReport({
      ...quiet,
      addDay: false,
      addSkipped: "not-add-day",
    });
    expect(offDay.body).not.toContain("add skipped:");
  });

  it("prints one all-clear price line and lists only the chains that are missing", () => {
    const clear = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: [
        priceChain({ displayName: "Aldi" }),
        priceChain({ displayName: "Kroger", freshOfficialCount: 4, freshFlyerCount: 0 }),
      ],
      priorChainPriceExceptions: [],
    });
    expect(clear.needsAttention).toBe(false);
    expect(clear.body).toContain("All 2 chains have prices from the last day.");
    expect(clear.body).not.toContain("Prices are from the last day.");
    expect(clear.body).not.toContain("has no prices");

    const one = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: [
        priceChain({ displayName: "Aldi" }),
        priceChain({ displayName: "Lidl", freshFlyerCount: 0 }),
        priceChain({ displayName: "BJ's", admittedStore: false, freshFlyerCount: 0 }),
        priceChain({
          displayName: "Trader Joe's",
          saleSource: false,
          freshFlyerCount: 0,
        }),
      ],
      priorChainPriceExceptions: [],
    });
    expect(one.needsAttention).toBe(false);
    expect(one.body).toContain("Lidl has no prices from the last day.");
    expect(one.body).toContain("1 of 2 chains is missing prices from the last day.");
    expect(one.body).not.toContain("Aldi has no prices");
    expect(one.body).not.toContain("BJ's");
    expect(one.body).not.toContain("Trader Joe's");
    expect(one.body).toContain("Nothing needs you.");
  });

  it("stays quiet when Kroger's official rows are fresh and the flyer is not", () => {
    const note = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: [
        priceChain({
          displayName: "Kroger",
          freshOfficialCount: 12,
          freshFlyerCount: 0,
        }),
      ],
      priorChainPriceExceptions: ["Kroger"],
    });
    expect(note.needsAttention).toBe(false);
    expect(note.body).toContain("All 1 chain has prices from the last day.");
    expect(note.body).not.toContain("Kroger has no prices");
  });

  it("treats the first missing morning as information and the next as Needs you", () => {
    const chains = [
      priceChain({ displayName: "Aldi", freshFlyerCount: 0 }),
      priceChain({ displayName: "Food Lion" }),
    ];
    const first = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: chains,
      priorChainPriceExceptions: [],
    });
    expect(first.needsAttention).toBe(false);
    expect(first.body).toContain("Aldi has no prices from the last day.");
    expect(first.body).toContain("1 of 2 chains is missing prices from the last day.");
    expect(first.body).not.toContain("again");
    expect(first.body).toContain("Nothing needs you.");

    const noPrior = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: chains,
      priorChainPriceExceptions: null,
    });
    expect(noPrior.needsAttention).toBe(false);
    expect(noPrior.body).not.toContain("again");
    expect(noPrior.body).toContain("Nothing needs you.");

    const second = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: chains,
      priorChainPriceExceptions: chainPriceExceptionsInNote(first.body),
    });
    expect(second.needsAttention).toBe(true);
    expect(second.body).toContain(
      "1 of 2 chains is missing prices from the last day again.",
    );
    expect(second.body.endsWith("Needs you.")).toBe(true);

    const kept = applyOutsideResultToMorningNote(second.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(kept.needsAttention).toBe(true);
    expect(kept.body.endsWith("Needs you.")).toBe(true);

    const stillInformation = applyOutsideResultToMorningNote(first.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(stillInformation.needsAttention).toBe(false);
    expect(previousMorningReportDate("2026-10-27")).toBe("2026-10-26");
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
