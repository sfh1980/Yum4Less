/** Plain-language morning note. ZIP text stays on /owner and Discord, not in analytics. */

export const MORNING_ZIP_BATCH = 3;
export const MORNING_REPORT_TIME_ZONE = "America/New_York";

export const LIVE_SMOKE_PIN = {
  latitude: 37.6085,
  longitude: -77.3739,
} as const;

export const LIVE_SMOKE_RADIUS_MILES = 8;

export type MorningCheckState = "passed" | "failed" | "not_reported";

export type ZipProbeOutcome =
  | "dinners"
  | "map-only"
  | "no-stores"
  | "failed"
  | "waiting";

export type MorningZipAddSkip =
  | "not-add-day"
  | "last-night"
  | "none-left"
  | null;

const ZIP5 = /^\d{5}$/;

export function morningReportDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MORNING_REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function morningWeekday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MORNING_REPORT_TIME_ZONE,
    weekday: "long",
  }).format(now);
}

/** Even UTC day-numbers are add days. Neighbors of an add day are not. */
export function isMorningZipAddDay(reportDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate);
  if (!match) {
    return false;
  }
  const utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Math.floor(utc / 86_400_000) % 2 === 0;
}

export function mergeOffZipCounts(
  groups: readonly { zipCode: string; storeCount: number }[][],
): { zipCode: string; storeCount: number }[] {
  const totals = new Map<string, number>();
  for (const group of groups) {
    for (const row of group) {
      const zipCode = row.zipCode.trim();
      if (!ZIP5.test(zipCode)) {
        continue;
      }
      totals.set(zipCode, Math.max(totals.get(zipCode) ?? 0, row.storeCount));
    }
  }
  return [...totals.entries()].map(([zipCode, storeCount]) => ({
    zipCode,
    storeCount,
  }));
}

export function pickMorningZipCandidates(input: {
  offZips: readonly { zipCode: string; storeCount: number }[];
  activeZipCodes: ReadonlySet<string>;
  alreadyAdded: ReadonlySet<string>;
  limit?: number;
}): string[] {
  const limit = input.limit ?? MORNING_ZIP_BATCH;
  return [...input.offZips]
    .filter(
      (row) =>
        ZIP5.test(row.zipCode) &&
        !input.activeZipCodes.has(row.zipCode) &&
        !input.alreadyAdded.has(row.zipCode),
    )
    .sort(
      (a, b) =>
        b.storeCount - a.storeCount || a.zipCode.localeCompare(b.zipCode),
    )
    .slice(0, limit)
    .map((row) => row.zipCode);
}

export function judgeShopperProbe(input: {
  marketOk: boolean;
  storeCount: number;
  rankOk: boolean;
}): ZipProbeOutcome {
  if (!input.marketOk) {
    return "failed";
  }
  if (input.storeCount <= 0) {
    return "no-stores";
  }
  if (!input.rankOk) {
    return "failed";
  }
  return "map-only";
}

export function judgeShopperProbeWithDinners(input: {
  marketOk: boolean;
  storeCount: number;
  rankOk: boolean;
  dinnerCount: number;
}): ZipProbeOutcome {
  const base = judgeShopperProbe(input);
  if (base === "map-only" && input.dinnerCount > 0) {
    return "dinners";
  }
  return base;
}

export function judgeLiveSite(input: {
  homeOk: boolean;
  faqOk: boolean;
  marketOk: boolean;
  storeCount: number;
  rankOk: boolean;
}): MorningCheckState {
  if (
    input.homeOk &&
    input.faqOk &&
    input.marketOk &&
    input.storeCount > 0 &&
    input.rankOk
  ) {
    return "passed";
  }
  return "failed";
}

export type MorningReportInput = {
  weekday: string;
  codeTests: MorningCheckState;
  siteCheck: MorningCheckState;
  lastNightOk: boolean;
  pricesFresh: boolean;
  addDay: boolean;
  addedZipCodes: readonly string[];
  addSkipped: MorningZipAddSkip;
  addErrors: readonly string[];
  zipResults: readonly { zipCode: string; outcome: ZipProbeOutcome }[];
  nearbyLeft: boolean;
  discordConfigured: boolean;
};

export function composeMorningReport(input: MorningReportInput): {
  body: string;
  needsAttention: boolean;
} {
  const lines: string[] = [`${input.weekday} morning`];
  lines.push(codeLine(input.codeTests));
  lines.push(siteLine(input.siteCheck));
  lines.push(
    input.lastNightOk ? "Last night finished." : "Last night did not finish.",
  );
  lines.push(
    input.pricesFresh
      ? "Prices are from the last day."
      : "Prices are not from the last day.",
  );

  if (input.addedZipCodes.length > 0) {
    const count = input.addedZipCodes.length;
    lines.push(
      `Added ${count} ${count === 1 ? "area" : "areas"}. They will be checked after tonight.`,
    );
  } else if (input.addSkipped === "none-left") {
    lines.push("No nearby areas are left to add.");
  } else if (input.addSkipped === "last-night") {
    lines.push("No new areas were added.");
  } else if (input.addSkipped === "not-add-day") {
    lines.push("No new areas today.");
  }

  for (const error of input.addErrors) {
    lines.push(error);
  }

  const zipLine = summarizeZipResults(input.zipResults);
  if (zipLine) {
    lines.push(zipLine);
  }

  if (input.addDay && input.addSkipped !== "none-left" && input.nearbyLeft) {
    lines.push("Nearby areas are still left.");
  }

  if (!input.discordConfigured) {
    lines.push("Discord was not sent. The morning webhook is not set.");
  }

  const needsAttention =
    input.codeTests !== "passed" ||
    input.siteCheck !== "passed" ||
    !input.lastNightOk ||
    !input.pricesFresh ||
    input.addSkipped === "last-night" ||
    input.addSkipped === "none-left" ||
    input.addErrors.length > 0 ||
    input.zipResults.some((row) => row.outcome === "failed") ||
    !input.discordConfigured;

  lines.push(needsAttention ? "Needs you." : "Nothing needs you.");
  return { body: lines.join("\n"), needsAttention };
}

export function composeMissedMorningReport(weekday: string): {
  body: string;
  needsAttention: true;
} {
  return {
    body: `${weekday} morning\nThe morning check did not run.\nNeeds you.`,
    needsAttention: true,
  };
}

export function appendMorningIssue(
  note: { body: string; needsAttention: boolean },
  line: string,
): { body: string; needsAttention: true } {
  const withoutClose = note.body.replace(/\n(?:Nothing needs you|Needs you)\.$/, "");
  return {
    body: `${withoutClose}\n${line}\nNeeds you.`,
    needsAttention: true,
  };
}

function codeLine(state: MorningCheckState): string {
  if (state === "passed") {
    return "Code tests passed.";
  }
  if (state === "failed") {
    return "Code tests failed.";
  }
  return "Code tests were not reported.";
}

function siteLine(state: MorningCheckState): string {
  if (state === "passed") {
    return "The site answered from outside.";
  }
  if (state === "failed") {
    return "The site did not answer from outside.";
  }
  return "The outside site check was not reported.";
}

function summarizeZipResults(
  results: readonly { zipCode: string; outcome: ZipProbeOutcome }[],
): string | null {
  if (results.length === 0) {
    return null;
  }
  if (results.every((row) => row.outcome === "waiting")) {
    return "New areas are waiting for a finished night.";
  }
  const checked = results.filter((row) => row.outcome !== "waiting");
  if (checked.length === 0) {
    return null;
  }
  const failed = checked.filter((row) => row.outcome === "failed").length;
  const dinners = checked.filter((row) => row.outcome === "dinners").length;
  const mapOnly = checked.filter((row) => row.outcome === "map-only").length;
  const noStores = checked.filter((row) => row.outcome === "no-stores").length;
  const answered = checked.length - failed;
  const parts = [
    `Checked ${checked.length} ${checked.length === 1 ? "area" : "areas"}.`,
  ];
  if (failed === 0) {
    parts.push(
      answered === 1 ? "It answered." : `All ${answered} answered.`,
    );
  } else {
    parts.push(
      `${failed} ${failed === 1 ? "area did" : "areas did"} not answer.`,
    );
  }
  if (mapOnly > 0) {
    parts.push(
      mapOnly === 1 ? "1 is on the map only." : `${mapOnly} are on the map only.`,
    );
  }
  if (dinners > 0) {
    parts.push(
      dinners === 1 ? "1 showed dinners." : `${dinners} showed dinners.`,
    );
  }
  if (noStores > 0) {
    parts.push(
      noStores === 1
        ? "1 answered with no stores yet."
        : `${noStores} answered with no stores yet.`,
    );
  }
  return parts.join(" ");
}

export function isDiscordWebhookUrl(value: string | undefined): boolean {
  const url = value?.trim();
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "discord.com" ||
        parsed.hostname === "discordapp.com") &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}
