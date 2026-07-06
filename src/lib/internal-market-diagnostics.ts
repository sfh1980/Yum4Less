import type { MarketSummary } from "@/lib/recommendation-service";

/** Structured dev/internal lines; replaces the retired market.message blob. */
export function buildInternalMarketDiagnosticLines(
  market: MarketSummary,
): string[] {
  const lines: string[] = [];

  const sourceLabel =
    market.dataSource === "database"
      ? "PostgreSQL catalog with ingested prices"
      : "PostgreSQL unavailable (no ranked pricing path)";

  lines.push(
    `${market.nearbyStores.length} nearby store(s) within ${market.radiusMiles} mi · ${market.recommendationReadyStoreCount} recommendation-ready · ${sourceLabel}`,
  );

  if (market.lookupSource !== "browser" && !market.lookupProviderConfigured) {
    lines.push("ZIP lookup: local seed table (GEOCODIO_API_KEY not configured).");
  } else if (market.lookupSource === "geocodio") {
    lines.push("ZIP lookup: Geocodio.");
  } else if (market.lookupSource === "browser") {
    lines.push("Location: browser geolocation.");
  }

  const storeSearchFallback = market.providerStoreSearches.filter(
    (search) => search.fallbackUsed,
  );
  if (storeSearchFallback.length > 0) {
    lines.push(
      `Provider store discovery fallback: ${storeSearchFallback.map((s) => s.provider).join(", ")}.`,
    );
  }

  const previewFallback = market.providerPricingPreviews.filter(
    (preview) => preview.fallbackUsed,
  );
  if (previewFallback.length > 0) {
    lines.push(
      `Provider pricing preview fallback: ${previewFallback.map((p) => p.provider).join(", ")}.`,
    );
  }

  const synced = market.providerPriceObservationSync.filter(
    (summary) => summary.syncedCount > 0,
  );
  if (synced.length > 0) {
    lines.push(
      synced
        .map(
          (summary) =>
            `${summary.provider}: ${summary.syncedCount} price row(s) synced (${summary.retrievalMode})`,
        )
        .join(" "),
    );
  }

  if (market.weeklyAdIngestionStatus.length > 0) {
    lines.push(
      `${market.weeklyAdIngestionStatus.length} store(s) with all-time scraped weekly-ad rows in PostgreSQL (not a freshness signal).`,
    );
  }

  const rollup = market.providerCoverageRollup;
  if (rollup.trustGate !== "not-available") {
    lines.push(
      `Provider coverage rollup: trust gate ${rollup.trustGate}, ranked source ${rollup.rankedPricingSource}, ${rollup.matchedIngredientCount}/${rollup.totalTrackedIngredients} tracked ingredients matched.`,
    );
    if (rollup.message) {
      lines.push(rollup.message);
    }
  }

  const weeklyAdReady = market.weeklyAdPromotionReadiness.filter(
    (readiness) => readiness.overallStatus !== "not-applicable",
  );
  if (weeklyAdReady.length > 0) {
    lines.push(
      weeklyAdReady
        .map(
          (readiness) =>
            `${readiness.chainLabel} weekly-ad promotion: ${readiness.overallStatus}`,
        )
        .join(" · "),
    );
  }

  if (market.providerPromotionReadiness.length > 0) {
    const promotion = market.providerPromotionReadiness;
    lines.push(
      promotion
        .map(
          (readiness) =>
            `${readiness.provider} promotion: ${readiness.overallStatus} (${readiness.gatesPassedCount}/${readiness.gatesTotalCount} gates)`,
        )
        .join(" · "),
    );
  }

  return lines;
}
