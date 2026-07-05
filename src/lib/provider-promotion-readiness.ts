import type { ProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import { buildSingleProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import { getProviderChainLabel } from "@/lib/providers/provider-labels";
import { getStoreDiscoveryProviders } from "@/lib/providers/provider-registry";
import type {
  ProviderPricingPreviewIngredient,
  ProviderPricingPreviewResult,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

const MIN_AVERAGE_MATCH_CONFIDENCE = 0.7;

export type PromotionReadinessGateId =
  | "provider-configured"
  | "live-preview-data"
  | "official-api-provenance"
  | "strong-tracked-coverage"
  | "average-match-confidence"
  | "mvp-promotion-lock";

export type PromotionReadinessGate = {
  id: PromotionReadinessGateId;
  label: string;
  passed: boolean;
  note: string;
};

export type ProviderPromotionReadinessStatus =
  | "blocked"
  | "not-ready"
  | "approaching"
  | "ready-but-disabled";

export type ProviderPromotionReadiness = {
  provider: StoreDiscoveryProvider;
  overallStatus: ProviderPromotionReadinessStatus;
  gatesPassedCount: number;
  gatesTotalCount: number;
  gates: PromotionReadinessGate[];
  recommendationPricingPromotionEnabled: boolean;
  message: string;
};

export function buildAllProviderPromotionReadiness(input: {
  previews: ProviderPricingPreviewResult[];
  trackedIngredients: ProviderPricingPreviewIngredient[];
}): ProviderPromotionReadiness[] {
  const providers = getStoreDiscoveryProviders();

  return providers.map((providerClient) => {
    const preview = input.previews.find(
      (candidate) => candidate.provider === providerClient.provider,
    );

    return buildProviderPromotionReadiness({
      provider: providerClient.provider,
      coverageRollup: buildSingleProviderCoverageRollup(
        preview,
        "none",
        input.trackedIngredients,
      ),
      preview,
    });
  });
}

export function buildProviderPromotionReadiness(input: {
  provider: StoreDiscoveryProvider;
  coverageRollup: ProviderCoverageRollup;
  preview: ProviderPricingPreviewResult | undefined;
}): ProviderPromotionReadiness {
  const providerLabel = getProviderChainLabel(input.provider);
  const technicalGates = buildTechnicalGates(
    input.provider,
    providerLabel,
    input.coverageRollup,
    input.preview,
  );
  const mvpLockGate: PromotionReadinessGate = {
    id: "mvp-promotion-lock",
    label: "MVP promotion lock",
    passed: false,
    note:
      "Ranked meal pricing uses ingested weekly-ad and official API observations. Provider preview promotion remains informational until explicitly enabled.",
  };
  const gates = [...technicalGates, mvpLockGate];
  const gatesPassedCount = gates.filter((gate) => gate.passed).length;
  const technicalGatesPassedCount = technicalGates.filter((gate) => gate.passed).length;
  const overallStatus = getOverallStatus({
    coverageRollup: input.coverageRollup,
    technicalGatesPassedCount,
    technicalGatesTotal: technicalGates.length,
  });

  return {
    provider: input.provider,
    overallStatus,
    gatesPassedCount,
    gatesTotalCount: gates.length,
    gates,
    recommendationPricingPromotionEnabled: false,
    message: buildPromotionReadinessMessage({
      providerLabel,
      overallStatus,
      technicalGatesPassedCount,
      technicalGatesTotal: technicalGates.length,
    }),
  };
}

export function buildPromotionReadinessMarketMessage(
  readinessList: ProviderPromotionReadiness[],
): string {
  const leadReadiness =
    readinessList.find((readiness) => readiness.overallStatus === "approaching") ??
    readinessList.find((readiness) => readiness.overallStatus === "ready-but-disabled") ??
    readinessList.find(
      (readiness) =>
        readiness.gates.find((gate) => gate.id === "provider-configured")?.passed,
    ) ??
    readinessList[0];

  if (!leadReadiness) {
    return "Provider preview promotion is tracked per chain. Ranked meal pricing uses ingested cache rows from weekly-ad scrape and official API sync.";
  }

  return `${getProviderChainLabel(leadReadiness.provider)} promotion readiness: ${leadReadiness.message}`;
}

function buildTechnicalGates(
  provider: StoreDiscoveryProvider,
  providerLabel: string,
  coverageRollup: ProviderCoverageRollup,
  preview: ProviderPricingPreviewResult | undefined,
): PromotionReadinessGate[] {
  return [
    {
      id: "provider-configured",
      label: "Provider configured",
      passed: Boolean(preview?.configured && preview.status !== "not-configured"),
      note: preview?.configured
        ? `${providerLabel} official pricing preview credentials are configured.`
        : `${providerLabel} official pricing preview is not configured for this environment.`,
    },
    {
      id: "live-preview-data",
      label: "Live preview data",
      passed: preview?.retrievalMode === "live",
      note:
        preview?.retrievalMode === "live"
          ? "The current preview came from a live provider lookup."
          : "Promotion requires a live provider preview, not a saved snapshot or unavailable preview.",
    },
    {
      id: "official-api-provenance",
      label: "Official API provenance",
      passed: preview?.provenance === "official-api",
      note:
        preview?.provenance === "official-api"
          ? `Preview pricing came from the official ${providerLabel} API path.`
          : "Promotion requires official API provenance rather than fallback-local preview data.",
    },
    {
      id: "strong-tracked-coverage",
      label: "Strong tracked coverage",
      passed: coverageRollup.overallCoverageStatus === "strong",
      note:
        coverageRollup.overallCoverageStatus === "strong"
          ? "At least 80% of tracked preview ingredients matched with accepted provider products."
          : "Promotion requires strong tracked-ingredient coverage before ranked meal pricing can change.",
    },
    {
      id: "average-match-confidence",
      label: "Average match confidence",
      passed:
        coverageRollup.averageMatchConfidence !== null &&
        coverageRollup.averageMatchConfidence >= MIN_AVERAGE_MATCH_CONFIDENCE,
      note:
        coverageRollup.averageMatchConfidence !== null &&
        coverageRollup.averageMatchConfidence >= MIN_AVERAGE_MATCH_CONFIDENCE
          ? `Average accepted match confidence is at least ${(MIN_AVERAGE_MATCH_CONFIDENCE * 100).toFixed(0)}%.`
          : `Promotion requires average accepted match confidence of at least ${(MIN_AVERAGE_MATCH_CONFIDENCE * 100).toFixed(0)}%.`,
    },
  ];
}

function getOverallStatus(input: {
  coverageRollup: ProviderCoverageRollup;
  technicalGatesPassedCount: number;
  technicalGatesTotal: number;
}): ProviderPromotionReadinessStatus {
  if (
    input.coverageRollup.trustGate === "not-available" ||
    input.coverageRollup.trustGate === "closed"
  ) {
    return "blocked";
  }

  if (input.technicalGatesPassedCount === input.technicalGatesTotal) {
    return "ready-but-disabled";
  }

  if (input.technicalGatesPassedCount >= 3) {
    return "approaching";
  }

  return "not-ready";
}

function buildPromotionReadinessMessage(input: {
  providerLabel: string;
  overallStatus: ProviderPromotionReadinessStatus;
  technicalGatesPassedCount: number;
  technicalGatesTotal: number;
}) {
  switch (input.overallStatus) {
    case "blocked":
      return `${input.providerLabel} preview promotion is blocked because preview coverage is unavailable or too weak. Ranked meal pricing uses ingested cache rows only.`;
    case "not-ready":
      return `${input.providerLabel} preview promotion is not ready yet (${input.technicalGatesPassedCount}/${input.technicalGatesTotal} technical gates passed). Ranked meal pricing uses ingested cache rows only.`;
    case "approaching":
      return `${input.providerLabel} preview promotion is approaching readiness (${input.technicalGatesPassedCount}/${input.technicalGatesTotal} technical gates passed), but ranked meal pricing still uses ingested cache rows rather than provider preview data.`;
    default:
      return `${input.providerLabel} preview promotion gates are satisfied on paper, but ranked meal pricing still uses ingested cache rows rather than provider preview data.`;
  }
}
