import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WeeklyAdChain, WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import type { WeeklyAdMatchFunnelSummary } from "@/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis";

export type WeeklyAdBaselineCapture = {
  chain: WeeklyAdChain;
  zipCode: string;
  capturedAt: string;
  retrievalLabel: string;
  rawOffers: WeeklyAdRawOffer[];
  funnel: WeeklyAdMatchFunnelSummary;
};

export function getWeeklyAdBaselineCaptureDir(chain: WeeklyAdChain) {
  return join(process.cwd(), "captures", "weekly-ad-baseline", chain);
}

export function persistWeeklyAdBaselineCapture(input: WeeklyAdBaselineCapture) {
  const timestamp = input.capturedAt.replaceAll(":", "-");
  const captureDir = join(getWeeklyAdBaselineCaptureDir(input.chain), timestamp);
  mkdirSync(captureDir, { recursive: true });

  writeFileSync(
    join(captureDir, "raw-offers.json"),
    JSON.stringify(input.rawOffers, null, 2),
    "utf8",
  );
  writeFileSync(
    join(captureDir, "funnel-summary.json"),
    JSON.stringify(
      {
        chain: input.funnel.chain,
        rawOfferCount: input.funnel.rawOfferCount,
        matchedCount: input.funnel.matchedCount,
        belowThresholdCount: input.funnel.belowThresholdCount,
        noCandidateCount: input.funnel.noCandidateCount,
        guardRejectedOnlyCount: input.funnel.guardRejectedOnlyCount,
        uniqueMatchedIngredientIds: input.funnel.uniqueMatchedIngredientIds,
        zipCode: input.zipCode,
        capturedAt: input.capturedAt,
        retrievalLabel: input.retrievalLabel,
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    join(captureDir, "funnel-probes.json"),
    JSON.stringify(input.funnel.probes, null, 2),
    "utf8",
  );
  writeFileSync(join(captureDir, "latest.txt"), captureDir, "utf8");

  const chainLatest = join(getWeeklyAdBaselineCaptureDir(input.chain), "latest.txt");
  writeFileSync(chainLatest, captureDir, "utf8");

  return captureDir;
}

export function readLatestWeeklyAdBaselineCapture(chain: WeeklyAdChain): WeeklyAdBaselineCapture | null {
  const latestPath = join(getWeeklyAdBaselineCaptureDir(chain), "latest.txt");
  try {
    const captureDir = readFileSync(latestPath, "utf8").trim();
    const meta = JSON.parse(
      readFileSync(join(captureDir, "funnel-summary.json"), "utf8"),
    ) as Pick<WeeklyAdBaselineCapture, "zipCode" | "capturedAt" | "retrievalLabel"> &
      Pick<
        WeeklyAdMatchFunnelSummary,
        | "rawOfferCount"
        | "matchedCount"
        | "belowThresholdCount"
        | "noCandidateCount"
        | "guardRejectedOnlyCount"
        | "uniqueMatchedIngredientIds"
      >;
    const rawOffers = JSON.parse(
      readFileSync(join(captureDir, "raw-offers.json"), "utf8"),
    ) as WeeklyAdRawOffer[];
    const probes = JSON.parse(
      readFileSync(join(captureDir, "funnel-probes.json"), "utf8"),
    ) as WeeklyAdMatchFunnelSummary["probes"];

    return {
      chain,
      zipCode: meta.zipCode,
      capturedAt: meta.capturedAt,
      retrievalLabel: meta.retrievalLabel,
      rawOffers,
      funnel: {
        chain,
        rawOfferCount: meta.rawOfferCount,
        matchedCount: meta.matchedCount,
        belowThresholdCount: meta.belowThresholdCount,
        noCandidateCount: meta.noCandidateCount,
        guardRejectedOnlyCount: meta.guardRejectedOnlyCount,
        uniqueMatchedIngredientIds: meta.uniqueMatchedIngredientIds,
        probes,
      },
    };
  } catch {
    return null;
  }
}
