/**
 * Owner diagnostic: weekly-ad match funnel for a required ingest ZIP.
 * Persists raw offers + per-offer probes under captures/weekly-ad-baseline/{chain}/.
 * Not a CI merge gate.
 *
 * Usage:
 *   tsx scripts/analyze-kroger-flipp-match-funnel.ts                    # kroger + food-lion (Flipp)
 *   tsx scripts/analyze-kroger-flipp-match-funnel.ts --chain aldi       # Flipp chain
 *   tsx scripts/analyze-kroger-flipp-match-funnel.ts --chain publix   # Publix browser scrape
 */
import { loadEnvLocal } from "@/lib/load-env-local";
import { resolveRequiredProbeZipCode } from "@/lib/ingest-zip-codes";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import {
  analyzeWeeklyAdMatchFunnel,
  type WeeklyAdOfferMatchProbe,
} from "@/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis";
import { fetchPublixWeeklyAdPage } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-fetcher";
import { buildPublixWeeklyAdUrl } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-url";
import { resolvePublixStoreForZip } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-store";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import { persistWeeklyAdBaselineCapture } from "@/lib/weekly-ad-ingestion/weekly-ad-baseline-capture";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";
import type { WeeklyAdChain, WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

loadEnvLocal();

const zipCode = resolveRequiredProbeZipCode();

type FlippMerchantName = "Kroger" | "Food Lion" | "ALDI";

type FunnelChainEntry =
  | { chain: WeeklyAdChain; kind: "flipp"; merchantName: FlippMerchantName; label: string }
  | { chain: WeeklyAdChain; kind: "publix-scrape"; label: string };

const CHAINS: FunnelChainEntry[] = [
  { chain: "kroger", kind: "flipp", merchantName: "Kroger", label: "Kroger" },
  { chain: "food-lion", kind: "flipp", merchantName: "Food Lion", label: "Food Lion" },
  { chain: "aldi", kind: "flipp", merchantName: "ALDI", label: "ALDI" },
  { chain: "publix", kind: "publix-scrape", label: "Publix" },
];

function bucketProbes(probes: WeeklyAdOfferMatchProbe[]) {
  const matched = probes.filter((p) => p.bestConfidence >= 0.55).length;
  const nearMiss = probes.filter(
    (p) => p.bestConfidence >= 0.45 && p.bestConfidence < 0.55,
  ).length;
  const weakSignal = probes.filter(
    (p) => p.bestConfidence > 0.05 && p.bestConfidence < 0.45,
  ).length;
  const noise = probes.filter((p) => p.bestConfidence <= 0.05).length;
  return { matched, nearMiss, weakSignal, noise };
}

function parseChainFilter(): WeeklyAdChain[] | null {
  const idx = process.argv.indexOf("--chain");
  if (idx === -1) {
    return null;
  }
  const value = process.argv[idx + 1];
  if (!value) {
    throw new Error("--chain requires a chain id (e.g. aldi, kroger, food-lion, publix)");
  }
  const chain = value as WeeklyAdChain;
  if (!CHAINS.some((entry) => entry.chain === chain)) {
    throw new Error(`Unknown chain "${value}". Supported: ${CHAINS.map((c) => c.chain).join(", ")}`);
  }
  return [chain];
}

function printChainReport(
  chain: WeeklyAdChain,
  merchantName: string,
  retrievalLabel: string,
  funnel: ReturnType<typeof analyzeWeeklyAdMatchFunnel>,
  captureDir: string,
) {
  const matchRate = funnel.rawOfferCount
    ? ((funnel.matchedCount / funnel.rawOfferCount) * 100).toFixed(1)
    : "0.0";

  console.log(`\n=== ${merchantName} (${chain}) @ ZIP ${zipCode} ===`);
  console.log(`Retrieval: ${retrievalLabel}`);
  console.log(`Raw offers: ${funnel.rawOfferCount}`);
  const buckets = bucketProbes(funnel.probes);
  console.log(
    `Matched (>=0.55): ${funnel.matchedCount} (${matchRate}%) | below threshold: ${funnel.belowThresholdCount} | no candidate: ${funnel.noCandidateCount} | guard-only: ${funnel.guardRejectedOnlyCount}`,
  );
  console.log(
    `Confidence buckets: matched=${buckets.matched}, near-miss 0.45-0.54=${buckets.nearMiss}, weak 0.06-0.44=${buckets.weakSignal}, noise<=${0.05}=${buckets.noise}`,
  );
  console.log(`Unique ingredients matched: ${funnel.uniqueMatchedIngredientIds.join(", ") || "(none)"}`);
  console.log(`Capture dir: ${captureDir}`);

  const nearMisses = funnel.probes
    .filter((probe) => probe.bestConfidence >= 0.45 && probe.bestConfidence < 0.55)
    .sort((a, b) => b.bestConfidence - a.bestConfidence);
  if (nearMisses.length > 0) {
    console.log("\nNear-misses (0.45-0.54, highest confidence first):");
    for (const probe of nearMisses.slice(0, 12)) {
      console.log(
        `  [${probe.bestConfidence.toFixed(2)} → ${probe.bestIngredientId}] ${probe.productName}`,
      );
      if (probe.bestMatchReason) {
        console.log(`    reason: ${probe.bestMatchReason}`);
      }
    }
  }

  const below = funnel.probes
    .filter(
      (probe) =>
        probe.outcome === "below_threshold" &&
        probe.bestConfidence > 0.05 &&
        probe.bestConfidence < 0.45,
    )
    .sort((a, b) => b.bestConfidence - a.bestConfidence)
    .slice(0, 6);
  if (below.length > 0) {
    console.log("\nWeak-signal samples (0.06-0.44):");
    for (const probe of below) {
      console.log(
        `  [${probe.bestConfidence.toFixed(2)} → ${probe.bestIngredientId}] ${probe.productName}`,
      );
    }
  }

  const matched = funnel.probes.filter((probe) => probe.outcome === "matched").slice(0, 8);
  if (matched.length > 0) {
    console.log("\nMatched samples:");
    for (const probe of matched) {
      console.log(
        `  [${probe.bestConfidence.toFixed(2)} → ${probe.matchedIngredientId}] ${probe.productName}`,
      );
    }
  }

  const noCandidateSamples = funnel.probes
    .filter((probe) => probe.outcome === "no_candidate")
    .slice(0, 6);
  if (noCandidateSamples.length > 0) {
    console.log("\nNo-candidate samples (non-grocery / off-list SKUs):");
    for (const probe of noCandidateSamples) {
      console.log(`  ${probe.productName}`);
    }
  }
}

async function resolveWeeklyAdRawOffersForFunnel(entry: FunnelChainEntry): Promise<{
  rawOffers: WeeklyAdRawOffer[];
  retrievalLabel: string;
  storeId: string;
  sourceUrl: string;
}> {
  if (entry.kind === "publix-scrape") {
    const sourceUrl = buildPublixWeeklyAdUrl({ zipCode });
    const storeContext = await resolvePublixStoreForZip(zipCode);
    const pageFetch = await fetchPublixWeeklyAdPage({
      url: sourceUrl,
      storeCookie: storeContext.storeCookie,
    });
    const rawOffers = parsePublixWeeklyAd({
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
    });
    return {
      rawOffers,
      retrievalLabel: `Publix ${pageFetch.method} scrape (${pageFetch.attempts} attempt(s))`,
      storeId: "publix-1626",
      sourceUrl,
    };
  }

  const flipp = await resolveFlippWeeklyAdOffersForChain({
    chain: entry.chain,
    zipCode,
    merchantName: entry.merchantName,
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });
  return {
    rawOffers: flipp.rawOffers,
    retrievalLabel: flipp.retrievalLabel,
    storeId: `${entry.chain}-mechanicsville`,
    sourceUrl: `flipp://${entry.chain}/${zipCode}`,
  };
}

async function analyzeChain(entry: FunnelChainEntry) {
  const capturedAt = new Date().toISOString();
  const resolved = await resolveWeeklyAdRawOffersForFunnel(entry);

  const funnel = analyzeWeeklyAdMatchFunnel({
    chain: entry.chain,
    storeId: resolved.storeId,
    sourceUrl: resolved.sourceUrl,
    observedAt: capturedAt,
    rawOffers: resolved.rawOffers,
    trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
  });

  const captureDir = persistWeeklyAdBaselineCapture({
    chain: entry.chain,
    zipCode,
    capturedAt,
    retrievalLabel: resolved.retrievalLabel,
    rawOffers: resolved.rawOffers,
    funnel,
  });

  printChainReport(entry.chain, entry.label, resolved.retrievalLabel, funnel, captureDir);
  return funnel;
}

async function main() {
  const chainFilter = parseChainFilter();
  const chainsToRun = chainFilter
    ? CHAINS.filter((entry) => chainFilter.includes(entry.chain))
    : CHAINS.filter((entry) => entry.chain !== "aldi");

  console.log(
    `\nWeekly-ad match-funnel diagnostic (tracked ingredients: ${WEEKLY_AD_TRACKED_INGREDIENT_IDS.length}, chains: ${chainsToRun.map((c) => c.chain).join(", ")})\n`,
  );

  const results: Array<{ chain: WeeklyAdChain; funnel: ReturnType<typeof analyzeWeeklyAdMatchFunnel> }> =
    [];
  for (const entry of chainsToRun) {
    results.push({ chain: entry.chain, funnel: await analyzeChain(entry) });
  }

  if (results.length === 2 && !chainFilter) {
    const [kroger, foodLion] = results;
    if (kroger && foodLion) {
      console.log("\n=== Kroger vs Food Lion (same day, same ZIP) ===");
      console.log(
        `Kroger: ${kroger.funnel.matchedCount}/${kroger.funnel.rawOfferCount} matched (${((kroger.funnel.matchedCount / kroger.funnel.rawOfferCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `Food Lion: ${foodLion.funnel.matchedCount}/${foodLion.funnel.rawOfferCount} matched (${((foodLion.funnel.matchedCount / foodLion.funnel.rawOfferCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `Kroger below-threshold: ${kroger.funnel.belowThresholdCount}; Food Lion below-threshold: ${foodLion.funnel.belowThresholdCount}`,
      );
      console.log(
        `Kroger no-candidate: ${kroger.funnel.noCandidateCount}; Food Lion no-candidate: ${foodLion.funnel.noCandidateCount}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
