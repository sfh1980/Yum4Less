import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import { getPricingCoverageStatus } from "@/lib/providers/provider-price-matching";
import type { RankedPricingSource } from "@/lib/price-source-policy";
import type {
  ProviderPricingCoverageStatus,
  ProviderPricingPreviewResult,
  ProviderSearchRetrievalMode,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

export type ProviderPreviewTrustGate =
  | "not-available"
  | "closed"
  | "monitoring";

export type ProviderIngredientCoverageSummary = {
  ingredientId: string;
  ingredientName: string;
  matched: boolean;
  matchConfidence?: number;
  matchReason?: string;
  provider?: StoreDiscoveryProvider;
  providerProductDescription?: string;
  retrievalMode?: ProviderSearchRetrievalMode;
};

export type ProviderCoverageRollup = {
  overallCoverageStatus: ProviderPricingCoverageStatus;
  trustGate: ProviderPreviewTrustGate;
  rankedPricingSource: RankedPricingSource;
  totalTrackedIngredients: number;
  matchedIngredientCount: number;
  unmatchedIngredientCount: number;
  averageMatchConfidence: number | null;
  usesCachedPreview: boolean;
  ingredientSummaries: ProviderIngredientCoverageSummary[];
  message: string;
};

export function buildProviderCoverageRollup(
  previews: ProviderPricingPreviewResult[],
  rankedPricingSource: RankedPricingSource,
): ProviderCoverageRollup {
  return buildSingleProviderCoverageRollup(
    selectPrimaryPricingPreview(previews),
    rankedPricingSource,
  );
}

export function buildSingleProviderCoverageRollup(
  preview: ProviderPricingPreviewResult | undefined,
  rankedPricingSource: RankedPricingSource = "none",
): ProviderCoverageRollup {
  const totalTrackedIngredients = PROVIDER_TRACKED_INGREDIENTS.length;

  if (!preview || preview.status === "not-configured") {
    return {
      overallCoverageStatus: "none",
      trustGate: "not-available",
      rankedPricingSource,
      totalTrackedIngredients,
      matchedIngredientCount: 0,
      unmatchedIngredientCount: totalTrackedIngredients,
      averageMatchConfidence: null,
      usesCachedPreview: false,
      ingredientSummaries: buildUnmatchedSummaries(),
      message: buildRankedPricingMessage(
        rankedPricingSource,
        "No official provider pricing preview was available for this search. Provider previews are informational only.",
      ),
    };
  }

  const ingredientSummaries = buildIngredientSummaries(preview);
  const matchedIngredientCount = ingredientSummaries.filter(
    (summary) => summary.matched,
  ).length;
  const overallCoverageStatus = getPricingCoverageStatus({
    matchedIngredientCount,
    totalTrackedIngredients,
  });
  const trustGate = getPreviewTrustGate(overallCoverageStatus);
  const averageMatchConfidence = averageConfidence(
    ingredientSummaries.filter((summary) => summary.matched),
  );

  return {
    overallCoverageStatus,
    trustGate,
    rankedPricingSource,
    totalTrackedIngredients,
    matchedIngredientCount,
    unmatchedIngredientCount: totalTrackedIngredients - matchedIngredientCount,
    averageMatchConfidence,
    usesCachedPreview: preview.retrievalMode === "cached",
    ingredientSummaries,
    message: buildRollupMessage({
      matchedIngredientCount,
      totalTrackedIngredients,
      overallCoverageStatus,
      trustGate,
      usesCachedPreview: preview.retrievalMode === "cached",
      rankedPricingSource,
    }),
  };
}

export function selectPrimaryPricingPreview(
  previews: ProviderPricingPreviewResult[],
): ProviderPricingPreviewResult | undefined {
  const ranked = [...previews].sort((left, right) => {
    const leftScore = previewPriorityScore(left);
    const rightScore = previewPriorityScore(right);
    return rightScore - leftScore;
  });

  return ranked[0];
}

function previewPriorityScore(preview: ProviderPricingPreviewResult) {
  let score = preview.matchedIngredientCount * 10;

  if (preview.status === "available") {
    score += 20;
  }
  if (preview.retrievalMode === "live") {
    score += 10;
  }
  if (preview.coverageStatus === "strong") {
    score += 8;
  } else if (preview.coverageStatus === "limited") {
    score += 4;
  }

  return score;
}

function buildIngredientSummaries(
  preview: ProviderPricingPreviewResult,
): ProviderIngredientCoverageSummary[] {
  return PROVIDER_TRACKED_INGREDIENTS.map((tracked) => {
    const matchedItem = preview.items.find(
      (item) => item.ingredientId === tracked.ingredientId,
    );

    if (!matchedItem) {
      return {
        ingredientId: tracked.ingredientId,
        ingredientName: tracked.ingredientName,
        matched: false,
      };
    }

    return {
      ingredientId: tracked.ingredientId,
      ingredientName: tracked.ingredientName,
      matched: true,
      matchConfidence: matchedItem.matchConfidence,
      matchReason: matchedItem.matchReason,
      provider: matchedItem.provider,
      providerProductDescription: matchedItem.description,
      retrievalMode: preview.retrievalMode,
    };
  });
}

function buildUnmatchedSummaries(): ProviderIngredientCoverageSummary[] {
  return PROVIDER_TRACKED_INGREDIENTS.map((tracked) => ({
    ingredientId: tracked.ingredientId,
    ingredientName: tracked.ingredientName,
    matched: false,
  }));
}

function getPreviewTrustGate(
  coverageStatus: ProviderPricingCoverageStatus,
): ProviderPreviewTrustGate {
  if (coverageStatus === "none" || coverageStatus === "weak") {
    return "closed";
  }

  return "monitoring";
}

function averageConfidence(
  summaries: ProviderIngredientCoverageSummary[],
): number | null {
  if (summaries.length === 0) {
    return null;
  }

  const total = summaries.reduce(
    (sum, summary) => sum + (summary.matchConfidence ?? 0),
    0,
  );

  return Math.round((total / summaries.length) * 100) / 100;
}

function buildRollupMessage(input: {
  matchedIngredientCount: number;
  totalTrackedIngredients: number;
  overallCoverageStatus: ProviderPricingCoverageStatus;
  trustGate: ProviderPreviewTrustGate;
  usesCachedPreview: boolean;
  rankedPricingSource: RankedPricingSource;
}) {
  const cacheNote = input.usesCachedPreview
    ? " This rollup uses a saved provider preview snapshot, not a fresh live lookup."
    : "";
  const base = `Market-level provider preview coverage: ${input.matchedIngredientCount} of ${input.totalTrackedIngredients} tracked ingredient(s) matched.${cacheNote}`;

  if (input.trustGate === "closed") {
    return buildRankedPricingMessage(
      input.rankedPricingSource,
      `${base} Coverage is still too weak for provider-preview promotion, and ranked meal pricing uses ingested cache rows only.`,
    );
  }

  if (input.overallCoverageStatus === "strong") {
    return buildRankedPricingMessage(
      input.rankedPricingSource,
      `${base} Coverage looks promising, but Yum4Less is still monitoring provider preview quality separately. Ranked meal pricing uses ingested cache rows only.`,
    );
  }

  return buildRankedPricingMessage(
    input.rankedPricingSource,
    `${base} Coverage is limited, so provider previews remain informational only.`,
  );
}

function buildRankedPricingMessage(
  rankedPricingSource: RankedPricingSource,
  prefix: string,
) {
  switch (rankedPricingSource) {
    case "weekly-ad-cache":
      return `${prefix} Ranked meal pricing currently reads scraped weekly-ad observations from PostgreSQL.`;
    case "official-api-cache":
      return `${prefix} Ranked meal pricing currently reads official Kroger API observations from PostgreSQL.`;
    case "mixed-live-cache":
      return `${prefix} Ranked meal pricing currently reads mixed ingested weekly-ad and official API observations from PostgreSQL.`;
    case "limited-coverage":
      return `${prefix} Some ingested prices exist, but ranked meal pricing stays limited until weekly-ad promotion gates pass.`;
    default:
      return `${prefix} No ingested live prices are available yet for ranked meal pricing near this search.`;
  }
}
