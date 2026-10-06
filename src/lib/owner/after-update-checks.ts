import { rankedChainIdsHaveKnownAdapters } from "@/lib/chain-membership";
import { FORBIDDEN_TRUST_CLAIM_PATTERNS } from "@/lib/pricing-trust-heads-up-expanded";
import { shouldFailRankedPriceFreshnessExit } from "@/lib/ingest/ingest-freshness-heartbeat";
import type { RankedFreshnessReport } from "@/lib/ingest/ingest-freshness-heartbeat";

/** Same pin as coordinate-first CI. Not a market roster. */
export const AFTER_UPDATE_SHOPPER_PIN = {
  latitude: 37.6085,
  longitude: -77.3739,
} as const;

export const AFTER_UPDATE_CHECK_IDS = [
  "migrations",
  "markets",
  "last-night",
  "freshness",
  "ranked-banners",
  "shopper-read",
] as const;

export type AfterUpdateCheckId = (typeof AFTER_UPDATE_CHECK_IDS)[number];

export type AfterUpdateCheckResult = {
  id: AfterUpdateCheckId;
  title: string;
  ok: boolean;
  detail: string;
};

const TITLES: Record<AfterUpdateCheckId, string> = {
  migrations: "Database updates",
  markets: "ZIP list",
  "last-night": "Last night",
  freshness: "Recent prices",
  "ranked-banners": "Ranked chains",
  "shopper-read": "One shopper search",
};

const ESTIMATE_WORD = /\b(?:estimated|estimate|directional|limited coverage)\b/i;

export function isAfterUpdateCheckId(value: string): value is AfterUpdateCheckId {
  return (AFTER_UPDATE_CHECK_IDS as readonly string[]).includes(value);
}

function result(
  id: AfterUpdateCheckId,
  ok: boolean,
  detail: string,
): AfterUpdateCheckResult {
  return { id, title: TITLES[id], ok, detail };
}

export function judgeMigrations(input: {
  expectedFilenames: readonly string[];
  appliedFilenames: readonly string[] | null;
}): AfterUpdateCheckResult {
  if (input.appliedFilenames === null) {
    return result(
      "migrations",
      false,
      "This database has no migration ledger. Apply db/init before trusting the app.",
    );
  }

  const applied = new Set(input.appliedFilenames);
  const missing = input.expectedFilenames.filter((name) => !applied.has(name));
  if (missing.length > 0) {
    return result(
      "migrations",
      false,
      `This database is missing ${missing.length} update${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
    );
  }

  return result(
    "migrations",
    true,
    `All ${input.expectedFilenames.length} database updates in this app are applied here.`,
  );
}

export function judgeMarkets(input: {
  markets: readonly {
    zipCode: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  overlayActive: boolean;
}): AfterUpdateCheckResult {
  if (input.overlayActive) {
    return result(
      "markets",
      false,
      "A debug ZIP list is set, so the night job will ignore the ZIP table.",
    );
  }

  if (input.markets.length === 0) {
    return result("markets", false, "No ZIPs are turned on for the night job.");
  }

  const missingPoint = input.markets
    .filter((market) => market.latitude === null || market.longitude === null)
    .map((market) => market.zipCode);
  if (missingPoint.length > 0) {
    return result(
      "markets",
      false,
      `These ZIPs have no map point: ${missingPoint.join(", ")}.`,
    );
  }

  const zips = input.markets.map((market) => market.zipCode).join(", ");
  const countLabel =
    input.markets.length === 1
      ? "1 ZIP is"
      : `${input.markets.length} ZIPs are`;
  return result("markets", true, `${countLabel} turned on: ${zips}.`);
}

export type LastNightJob = {
  kind: string;
  status: string;
  lastError: string | null;
};

export function judgeLastNight(input: {
  runDate: string | null;
  jobs: readonly LastNightJob[] | null;
}): AfterUpdateCheckResult {
  if (input.jobs === null) {
    return result(
      "last-night",
      false,
      "This database has no night-job ledger.",
    );
  }

  if (!input.runDate || input.jobs.length === 0) {
    return result("last-night", false, "No night job is recorded.");
  }

  const unfinished = input.jobs.filter(
    (job) => job.status !== "succeeded" && job.status !== "skipped",
  );
  if (unfinished.length > 0) {
    const lines = unfinished.map((job) => {
      const error = job.lastError?.trim();
      return error ? `${job.kind} ${job.status}: ${error}` : `${job.kind} ${job.status}`;
    });
    return result(
      "last-night",
      false,
      `Night ${input.runDate} is not finished. ${lines.join(" ")}`,
    );
  }

  return result(
    "last-night",
    true,
    `Night ${input.runDate} finished (${input.jobs.length} steps).`,
  );
}

export function judgeFreshness(report: RankedFreshnessReport): AfterUpdateCheckResult {
  const sources = report.bySource
    .map((row) => `${row.sourceName} ${row.freshCount}`)
    .join(", ");
  const sourceNote = sources.length > 0 ? ` By chain: ${sources}.` : "";

  if (shouldFailRankedPriceFreshnessExit(report)) {
    return result(
      "freshness",
      false,
      `No ranked prices are from the last 24 hours.${sourceNote}`,
    );
  }

  return result(
    "freshness",
    true,
    `${report.freshTotal} ranked prices are from the last 24 hours.${sourceNote}`,
  );
}

export function judgeRankedBanners(chainIds: readonly string[]): AfterUpdateCheckResult {
  if (chainIds.length === 0) {
    return result(
      "ranked-banners",
      false,
      "No chains are turned on for dinner estimates.",
    );
  }

  if (!rankedChainIdsHaveKnownAdapters(chainIds)) {
    return result(
      "ranked-banners",
      false,
      "A chain is turned on for dinners, and this app has no code for it.",
    );
  }

  return result(
    "ranked-banners",
    true,
    `Dinner chains this app knows how to handle: ${chainIds.join(", ")}.`,
  );
}

export function judgeShopperRead(input: {
  unavailable: boolean;
  errorMessage?: string;
  recommendationCount: number;
  trustText: string;
}): AfterUpdateCheckResult {
  if (input.unavailable) {
    return result(
      "shopper-read",
      false,
      input.errorMessage?.trim() ||
        "Store and meal prices are not loading right now.",
    );
  }

  const forbidden = FORBIDDEN_TRUST_CLAIM_PATTERNS.find((pattern) =>
    pattern.test(input.trustText),
  );
  if (forbidden) {
    return result(
      "shopper-read",
      false,
      "The search text includes a claim we do not make.",
    );
  }

  if (input.recommendationCount > 0 && !ESTIMATE_WORD.test(input.trustText)) {
    return result(
      "shopper-read",
      false,
      "Dinners came back without an estimate label.",
    );
  }

  if (input.recommendationCount === 0) {
    return result(
      "shopper-read",
      true,
      "The search ran and returned no dinners. That can be an honest empty result.",
    );
  }

  return result(
    "shopper-read",
    true,
    `${input.recommendationCount} dinners came back, labeled as estimates.`,
  );
}
