import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyOutsideResultToMorningNote,
  datedOutsideCheckLine,
  isBeforeOutsideCheckCutoff,
  outsideCheckStillMissingLine,
  outsideCheckWhenLabel,
  outsideChecksAreReported,
  planOutsideCheckFollowUp,
  readOutsideCheckCutoff,
  chainPriceExceptionsInNote,
  coverageBaselineInNote,
  coverageDropNamesInNote,
  composeMissedMorningReport,
  composeMorningReport,
  countConsecutiveRecipeImportMisses,
  morningZipAddsEnabled,
  describeRecipeImport,
  isDiscordWebhookUrl,
  isMorningZipAddDay,
  judgeLiveSite,
  judgeShopperProbeWithDinners,
  morningReportDate,
  pickMorningZipCandidates,
  previousMorningReportDate,
  recipeImportDidNotFinish,
  rowsPerStoreInNote,
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

  it("shows the last outside result before the cutoff and waits to send Discord once", () => {
    expect(readOutsideCheckCutoff({ NODE_ENV: "test" })).toEqual({ hour: 16, minute: 0 });
    expect(
      readOutsideCheckCutoff({ NODE_ENV: "test", YUM4LESS_OUTSIDE_CHECK_CUTOFF: "nope" }),
    ).toEqual({ hour: 16, minute: 0 });
    expect(isBeforeOutsideCheckCutoff(new Date("2026-10-29T19:59:00Z"))).toBe(true);
    expect(isBeforeOutsideCheckCutoff(new Date("2026-10-29T20:00:00Z"))).toBe(false);
    expect(outsideCheckWhenLabel("2026-10-29", "2026-10-28")).toBe("yesterday");
    expect(outsideCheckWhenLabel("2026-10-29", "2026-10-27")).toBe("2026-10-27");

    const pending = composeMorningReport({
      ...quiet,
      codeTests: "not_reported",
      siteCheck: "not_reported",
      outsideCheckPending: true,
      codeTestsLine: datedOutsideCheckLine("Code tests passed.", "yesterday"),
      siteCheckLine: datedOutsideCheckLine("The site answered from outside.", "yesterday"),
      addSkipped: "not-add-day",
    });
    expect(pending.needsAttention).toBe(false);
    expect(pending.body).toContain("Code tests passed (yesterday).");
    expect(pending.body).toContain("The site answered from outside (yesterday).");
    expect(pending.body).toContain("Nothing needs you.");
    const pendingFailure = composeMorningReport({
      ...quiet,
      codeTests: "not_reported",
      siteCheck: "not_reported",
      outsideCheckPending: true,
      codeTestsLine: datedOutsideCheckLine("Code tests failed.", "yesterday"),
      siteCheckLine: datedOutsideCheckLine(
        "The site did not answer from outside.",
        "yesterday",
      ),
      addSkipped: "not-add-day",
    });
    expect(pendingFailure.needsAttention).toBe(false);
    expect(outsideChecksAreReported("not_reported", "not_reported")).toBe(false);

    const late = composeMorningReport({
      ...quiet,
      codeTests: "not_reported",
      siteCheck: "not_reported",
      addSkipped: "not-add-day",
    });
    expect(late.needsAttention).toBe(true);
    expect(late.body).toContain("Code tests were not reported.");
    expect(late.body.endsWith("Needs you.")).toBe(true);

    const rewritten = applyOutsideResultToMorningNote(pending.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(rewritten.needsAttention).toBe(false);
    expect(rewritten.body).toContain("Code tests passed.");
    expect(rewritten.body).not.toContain("yesterday");
    expect(outsideChecksAreReported("passed", "passed")).toBe(true);
  });

  it("rewrites a missing outside check after the cutoff and sends one alert", () => {
    const pending = composeMorningReport({
      ...quiet,
      codeTests: "not_reported",
      siteCheck: "not_reported",
      outsideCheckPending: true,
      codeTestsLine: datedOutsideCheckLine("Code tests passed.", "yesterday"),
      siteCheckLine: datedOutsideCheckLine("The site answered from outside.", "yesterday"),
      addSkipped: "not-add-day",
    });
    const beforeCutoff = planOutsideCheckFollowUp({
      now: new Date("2026-10-29T19:59:00Z"),
      external: null,
      noteBody: pending.body,
      discordConfigured: true,
    });
    expect(beforeCutoff).toEqual({ action: "none", reason: "before-cutoff" });

    const arrived = planOutsideCheckFollowUp({
      now: new Date("2026-10-29T20:15:00Z"),
      external: { codeTests: "passed", siteCheck: "passed" },
      noteBody: pending.body,
      discordConfigured: true,
    });
    expect(arrived).toEqual({ action: "none", reason: "arrived" });

    const late = planOutsideCheckFollowUp({
      now: new Date("2026-10-29T20:15:00Z"),
      external: null,
      noteBody: pending.body,
      discordConfigured: true,
    });
    expect(late.action).toBe("alert");
    if (late.action !== "alert") {
      return;
    }
    expect(late.body).toContain("Code tests were not reported.");
    expect(late.body).toContain("The outside site check was not reported.");
    expect(late.body).toContain(outsideCheckStillMissingLine({ hour: 16, minute: 0 }));
    expect(late.body.endsWith("Needs you.")).toBe(true);
    expect(late.needsAttention).toBe(true);

    const second = planOutsideCheckFollowUp({
      now: new Date("2026-10-29T20:15:00Z"),
      external: null,
      noteBody: late.body,
      discordConfigured: true,
    });
    expect(second).toEqual({ action: "none", reason: "already-sent" });

    const arrivedLater = applyOutsideResultToMorningNote(late.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(arrivedLater.body).not.toContain("still missing");
    expect(arrivedLater.body).toContain("Code tests passed.");
    expect(arrivedLater.needsAttention).toBe(false);
  });

  it("schedules the outside-check follow-up at 4:15pm New York", () => {
    const crontab = readFileSync("docker/ingest/crontab", "utf8");
    expect(crontab).toContain(
      "15 16 * * * root . /etc/yum4less/ingest.env && cd /app && YUM4LESS_MORNING_REPORT=1 /usr/local/bin/npm run morning:outside-check",
    );
  });

  it("pauses morning ZIP adds only when the switch is 0", () => {
    expect(morningZipAddsEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(morningZipAddsEnabled({ NODE_ENV: "test", YUM4LESS_MORNING_ZIP_ADDS: "1" })).toBe(
      true,
    );
    expect(morningZipAddsEnabled({ NODE_ENV: "test", YUM4LESS_MORNING_ZIP_ADDS: "0" })).toBe(
      false,
    );

    const paused = composeMorningReport({
      ...quiet,
      addDay: true,
      addSkipped: "paused",
    });
    expect(paused.body).toContain("Adds are paused.");
    expect(paused.body).not.toContain("No new areas today.");
    expect(paused.body).not.toContain("Added ");
    expect(paused.needsAttention).toBe(false);
    expect(
      describeAddSkipLine({
        addDay: true,
        addedCount: 0,
        addSkipped: "paused",
        addErrors: [],
      }),
    ).toBeNull();
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

    const unpublished = [
      priceChain({
        displayName: "Whole Foods",
        freshFlyerCount: 0,
        priceMissReason: "flyer-not-published",
      }),
      priceChain({ displayName: "Food Lion" }),
    ];
    const firstUnpublished = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: unpublished,
      priorChainPriceExceptions: [],
    });
    expect(firstUnpublished.needsAttention).toBe(false);
    expect(firstUnpublished.body).toContain("Whole Foods flyer not yet published.");
    expect(firstUnpublished.body).not.toContain("Whole Foods has no prices");
    expect(firstUnpublished.body).toContain("Nothing needs you.");

    const secondUnpublished = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: unpublished,
      priorChainPriceExceptions: chainPriceExceptionsInNote(firstUnpublished.body),
    });
    expect(chainPriceExceptionsInNote(firstUnpublished.body)).toEqual(["Whole Foods"]);
    expect(secondUnpublished.needsAttention).toBe(true);
    expect(secondUnpublished.body).toContain("Whole Foods flyer not yet published.");
    expect(secondUnpublished.body).toContain(
      "1 of 2 chains is missing prices from the last day again.",
    );
    expect(secondUnpublished.body.endsWith("Needs you.")).toBe(true);

    const stillInformation = applyOutsideResultToMorningNote(first.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(stillInformation.needsAttention).toBe(false);
    expect(previousMorningReportDate("2026-10-27")).toBe("2026-10-26");
  });

  it("says when rows per store fall under half, and Needs you on the second morning", () => {
    const chains = [
      priceChain({ displayName: "Aldi", freshFlyerCount: 440, rowsPerStore: 40 }),
      priceChain({
        displayName: "Publix",
        freshFlyerCount: 264,
        rowsPerStore: 24,
        priceMissReason: "thin-page",
      }),
    ];
    const first = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: chains,
      priorChainPriceExceptions: [],
      previousRowsPerStore: { Aldi: 40, Publix: 132 },
      priorCoverageDropNames: [],
    });
    expect(first.needsAttention).toBe(false);
    expect(first.body).toContain("All 2 chains have prices from the last day.");
    expect(first.body).toContain("Publix has 24 rows per store, down from 132.");
    expect(first.body).toContain("Publix weekly ad page was thin.");
    expect(first.body).toContain("Rows per store: Aldi 40, Publix 24.");
    expect(first.body).not.toContain("Price rows per store are down again.");
    expect(first.body).toContain("Nothing needs you.");
    expect(rowsPerStoreInNote(first.body)).toEqual({ Aldi: 40, Publix: 24 });
    expect(coverageDropNamesInNote(first.body)).toEqual(["Publix"]);

    const second = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: chains,
      priorChainPriceExceptions: [],
      previousRowsPerStore: coverageBaselineInNote(first.body),
      priorCoverageDropNames: coverageDropNamesInNote(first.body),
    });
    expect(coverageBaselineInNote(first.body)?.Publix).toBe(132);
    expect(second.needsAttention).toBe(true);
    expect(second.body).toContain("Publix has 24 rows per store, down from 132.");
    expect(second.body).toContain("Price rows per store are down again.");
    expect(second.body.endsWith("Needs you.")).toBe(true);

    const kept = applyOutsideResultToMorningNote(second.body, {
      codeTests: "passed",
      siteCheck: "passed",
      discordConfigured: true,
    });
    expect(kept.needsAttention).toBe(true);
    expect(kept.body).toContain("Publix has 24 rows per store, down from 132.");

    const held = composeMorningReport({
      ...quiet,
      addSkipped: "not-add-day",
      chainPrices: [
        priceChain({ displayName: "Publix", freshFlyerCount: 880, rowsPerStore: 80 }),
      ],
      priorChainPriceExceptions: [],
      previousRowsPerStore: { Publix: 132 },
      priorCoverageDropNames: [],
    });
    expect(held.body).not.toContain("down from");
    expect(held.needsAttention).toBe(false);
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
