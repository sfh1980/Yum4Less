import type { StoreChain } from "@/lib/provider-rollout";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import {
  MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS,
  MIN_WEEKLY_AD_PROMOTION_CONFIDENCE,
  MIN_WEEKLY_AD_PROMOTION_MATCHES,
  WEEKLY_AD_RANKED_PRICING_CHAINS,
  weeklyAdPromotionGatesPass,
  type WeeklyAdStoreCoverage,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";

export type WeeklyAdPromotionGateId =
  | "approved-chain"
  | "weekly-ad-observations"
  | "minimum-ingredient-matches"
  | "average-match-confidence"
  | "freshness-window";

export type WeeklyAdPromotionGate = {
  id: WeeklyAdPromotionGateId;
  label: string;
  passed: boolean;
  note: string;
};

export type WeeklyAdPromotionReadinessStatus =
  | "not-applicable"
  | "blocked"
  | "not-ready"
  | "ready";

export type WeeklyAdPromotionReadiness = {
  chain: StoreChain;
  chainLabel: string;
  storeId?: string;
  overallStatus: WeeklyAdPromotionReadinessStatus;
  gatesPassedCount: number;
  gatesTotalCount: number;
  gates: WeeklyAdPromotionGate[];
  weeklyAdRankedPricingEnabled: boolean;
  message: string;
};

export function buildWeeklyAdPromotionReadiness(input: {
  storeName: string;
  chain: StoreChain;
  storeId: string;
  coverage: WeeklyAdStoreCoverage;
}): WeeklyAdPromotionReadiness {
  const baseRollout = getProviderRolloutForStore(input.storeName);
  const gates = buildWeeklyAdPromotionGates(input.chain, input.coverage);
  const gatesPassedCount = gates.filter((gate) => gate.passed).length;
  const weeklyAdRankedPricingEnabled = weeklyAdPromotionGatesPass(
    input.coverage,
    input.chain,
  );
  const overallStatus = getOverallStatus({
    chain: input.chain,
    gatesPassedCount,
    gatesTotal: gates.length,
    weeklyAdRankedPricingEnabled,
  });

  return {
    chain: input.chain,
    chainLabel: baseRollout.label,
    storeId: input.storeId,
    overallStatus,
    gatesPassedCount,
    gatesTotalCount: gates.length,
    gates,
    weeklyAdRankedPricingEnabled,
    message: buildWeeklyAdPromotionMessage({
      chainLabel: baseRollout.label,
      overallStatus,
      weeklyAdRankedPricingEnabled,
      gatesPassedCount,
      gatesTotal: gates.length,
    }),
  };
}

export function buildWeeklyAdPromotionReadinessForStores(input: {
  stores: Array<{ id: string; name: string; chain: StoreChain }>;
  coverageByStoreId: Map<string, WeeklyAdStoreCoverage>;
}): WeeklyAdPromotionReadiness[] {
  return input.stores
    .filter((store) => WEEKLY_AD_RANKED_PRICING_CHAINS.has(store.chain as never))
    .map((store) =>
      buildWeeklyAdPromotionReadiness({
        storeName: store.name,
        chain: store.chain,
        storeId: store.id,
        coverage:
          input.coverageByStoreId.get(store.id) ??
          emptyCoverage(store.id, store.chain),
      }),
    );
}

export function buildWeeklyAdPromotionMarketMessage(
  readinessList: WeeklyAdPromotionReadiness[],
): string {
  const promoted = readinessList.filter(
    (readiness) => readiness.weeklyAdRankedPricingEnabled,
  );

  if (promoted.length === 0) {
    const lead = readinessList.find(
      (readiness) => readiness.overallStatus === "not-ready",
    );
    if (lead) {
      return `${lead.chainLabel} weekly-ad promotion: ${lead.message}`;
    }

    return "Weekly-ad scraped prices may exist in PostgreSQL, but no chain has passed promotion gates for weekly-ad-backed ranked pricing yet.";
  }

  const labels = promoted.map((readiness) => readiness.chainLabel).join(", ");
  return `${labels} ranked pricing can use scraped weekly-ad observations from PostgreSQL. Prices remain directional—verify package size and in-store tags before checkout.`;
}

function buildWeeklyAdPromotionGates(
  chain: StoreChain,
  coverage: WeeklyAdStoreCoverage,
): WeeklyAdPromotionGate[] {
  return [
    {
      id: "approved-chain",
      label: "Approved rollout chain",
      passed: WEEKLY_AD_RANKED_PRICING_CHAINS.has(chain as never),
      note: WEEKLY_AD_RANKED_PRICING_CHAINS.has(chain as never)
        ? `${chain} is in the approved weekly-ad ranked-pricing rollout.`
        : `${chain} is not in the current weekly-ad ranked-pricing rollout.`,
    },
    {
      id: "weekly-ad-observations",
      label: "Weekly-ad observations present",
      passed: coverage.usesWeeklyAdSource && coverage.matchedIngredientCount > 0,
      note: coverage.usesWeeklyAdSource
        ? `${coverage.matchedIngredientCount} recipe ingredient(s) have scraped weekly-ad price observation(s) in PostgreSQL.`
        : "No scraped weekly-ad price observations were found for this store.",
    },
    {
      id: "minimum-ingredient-matches",
      label: "Minimum ingredient matches",
      passed: coverage.matchedIngredientCount >= MIN_WEEKLY_AD_PROMOTION_MATCHES,
      note:
        coverage.matchedIngredientCount >= MIN_WEEKLY_AD_PROMOTION_MATCHES
          ? `At least ${MIN_WEEKLY_AD_PROMOTION_MATCHES} recipe ingredients matched from weekly-ad data.`
          : `Promotion requires at least ${MIN_WEEKLY_AD_PROMOTION_MATCHES} matched recipe ingredients; currently ${coverage.matchedIngredientCount}.`,
    },
    {
      id: "average-match-confidence",
      label: "Average match confidence",
      passed:
        coverage.averageMatchConfidence !== null &&
        coverage.averageMatchConfidence >= MIN_WEEKLY_AD_PROMOTION_CONFIDENCE,
      note:
        coverage.averageMatchConfidence !== null &&
        coverage.averageMatchConfidence >= MIN_WEEKLY_AD_PROMOTION_CONFIDENCE
          ? `Average accepted match confidence is at least ${(MIN_WEEKLY_AD_PROMOTION_CONFIDENCE * 100).toFixed(0)}%.`
          : `Promotion requires average match confidence of at least ${(MIN_WEEKLY_AD_PROMOTION_CONFIDENCE * 100).toFixed(0)}%.`,
    },
    {
      id: "freshness-window",
      label: "Freshness window",
      passed:
        coverage.maxFreshnessDaysAgo === null ||
        coverage.maxFreshnessDaysAgo <= MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS,
      note:
        coverage.maxFreshnessDaysAgo === null ||
        coverage.maxFreshnessDaysAgo <= MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS
          ? `Weekly-ad observations are within the ${MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS}-day freshness window.`
          : `Weekly-ad observations are older than ${MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS} days and need refresh before promotion.`,
    },
  ];
}

function getOverallStatus(input: {
  chain: StoreChain;
  gatesPassedCount: number;
  gatesTotal: number;
  weeklyAdRankedPricingEnabled: boolean;
}): WeeklyAdPromotionReadinessStatus {
  if (!WEEKLY_AD_RANKED_PRICING_CHAINS.has(input.chain as never)) {
    return "not-applicable";
  }

  if (input.weeklyAdRankedPricingEnabled) {
    return "ready";
  }

  if (input.gatesPassedCount === 0) {
    return "blocked";
  }

  return "not-ready";
}

function buildWeeklyAdPromotionMessage(input: {
  chainLabel: string;
  overallStatus: WeeklyAdPromotionReadinessStatus;
  weeklyAdRankedPricingEnabled: boolean;
  gatesPassedCount: number;
  gatesTotal: number;
}) {
  if (input.overallStatus === "not-applicable") {
    return `${input.chainLabel} is outside the current weekly-ad ranked-pricing rollout.`;
  }

  if (input.weeklyAdRankedPricingEnabled) {
    return `${input.chainLabel} passed weekly-ad promotion gates (${input.gatesPassedCount}/${input.gatesTotal}). Ranked pricing may use scraped weekly-ad observations with explicit verify language.`;
  }

  if (input.overallStatus === "blocked") {
    return `${input.chainLabel} weekly-ad promotion is blocked because no usable scraped observations were found yet.`;
  }

  return `${input.chainLabel} weekly-ad promotion is not ready yet (${input.gatesPassedCount}/${input.gatesTotal} gates passed). Ranked pricing stays on seed/DB coverage until promotion gates pass.`;
}

function emptyCoverage(storeId: string, chain: StoreChain): WeeklyAdStoreCoverage {
  return {
    storeId,
    chain,
    matchedIngredientCount: 0,
    totalRecipeIngredientCount: 0,
    averageMatchConfidence: null,
    maxFreshnessDaysAgo: null,
    coverageStatus: "none",
    usesWeeklyAdSource: false,
  };
}
