"use client";

import { getProviderChainLabel } from "@/lib/providers/provider-labels";
import type {
  MealRecommendation,
  RecommendationExperience,
} from "@/lib/recommendation-service";
import { useModalDialog } from "@/components/use-modal-dialog";
import { buildInternalMarketDiagnosticLines } from "@/lib/internal-market-diagnostics";
import { listSelectableRecipeSources } from "@/lib/recipe-sources/recipe-source-registry";
import { formatStoreCityState } from "@/lib/store-display-labels";

type InternalDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  market?: RecommendationExperience["market"];
  recommendations?: MealRecommendation[];
};

export function InternalDetailsModal({
  open,
  onClose,
  market,
  recommendations,
}: InternalDetailsModalProps) {
  const modal = useModalDialog({ open, onClose });

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="internal-details-title"
        aria-modal="true"
        className="modal-card modal-card-wide"
        onKeyDown={modal.onKeyDown}
        ref={modal.dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id="internal-details-title">Project &amp; data details (internal)</h3>
          <button
            className="secondary-button"
            onClick={onClose}
            ref={modal.initialFocusRef}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="modal-copy">
          <p className="internal-details-note">
            Temporary panel for developers, admins, and investors. End users do not
            need this information to search stores or rank dinners.
          </p>

          {!market ? (
            <p>Run a store search first to populate market diagnostics.</p>
          ) : (
            <>
              <section className="internal-details-section">
                <h4>Market diagnostics</h4>
                <ul className="detail-list">
                  {buildInternalMarketDiagnosticLines(market).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="pill-row">
                  {market.searchedZipCode ? (
                    <span className="pill">ZIP {market.searchedZipCode}</span>
                  ) : null}
                  <span className="pill">{market.locationLabel}</span>
                  <span className="pill">{market.radiusMiles} mile radius</span>
                  <span className="pill">
                    {market.nearbyStores.length} nearby store(s)
                  </span>
                  <span className="pill">
                    {market.recommendationReadyStoreCount} recommendation-ready
                  </span>
                  <span className="pill">{formatLookupSource(market.lookupSource)}</span>
                  <span className="pill">{formatDataSource(market.dataSource)}</span>
                  {market.lookupSource !== "browser" &&
                  !market.lookupProviderConfigured ? (
                    <span className="pill">Geocodio not configured</span>
                  ) : null}
                </div>

                {market.providerPriceObservationSync.some(
                  (summary) => summary.syncedCount > 0,
                ) ? (
                  <div className="pill-row">
                    {market.providerPriceObservationSync
                      .filter((summary) => summary.syncedCount > 0)
                      .map((summary) => (
                        <span className="pill" key={`${summary.provider}-price-sync`}>
                          {summary.syncedCount} checked price observation(s) synced to Postgres (
                          {summary.provider})
                        </span>
                      ))}
                  </div>
                ) : null}

                {market.weeklyAdIngestionStatus.length > 0 ? (
                  <div className="pill-row">
                    <span className="pill" title="Row counts include stale data; use promotion readiness for freshness.">
                      All-time weekly-ad rows in PostgreSQL (not freshness)
                    </span>
                    {market.weeklyAdIngestionStatus.map((summary) => (
                      <span
                        className="pill"
                        key={`${summary.storeId}-${summary.sourceName}`}
                        title={summary.message}
                      >
                        {summary.observationCount} all-time row(s) for {summary.chain}
                      </span>
                    ))}
                  </div>
                ) : null}

                {market.weeklyAdPromotionReadiness.some(
                  (readiness) => readiness.overallStatus !== "not-applicable",
                ) ? (
                  <div className="pill-row">
                    {market.weeklyAdPromotionReadiness
                      .filter(
                        (readiness) => readiness.overallStatus !== "not-applicable",
                      )
                      .map((readiness) => (
                        <span
                          className="pill"
                          key={`${readiness.chain}-weekly-ad-promotion`}
                          title={readiness.message}
                        >
                          {readiness.chainLabel}:{" "}
                          {formatWeeklyAdPromotionStatus(readiness.overallStatus)}
                        </span>
                      ))}
                  </div>
                ) : null}
              </section>

              <section className="internal-details-section">
                <h4>Current chain rollout</h4>
                <div className="store-summary-list">
                  {market.providerRollout.map((provider) => (
                    <div className="store-summary-item" key={provider.chain}>
                      <strong>{provider.label}</strong>
                      <span>{formatRolloutStatus(provider.status)}</span>
                      <p className="field-hint">{provider.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="internal-details-section">
                <h4>Recipe source research</h4>
                <div className="store-summary-list">
                  {listSelectableRecipeSources().map((source) => (
                    <div className="store-summary-item" key={source.id}>
                      <strong>{source.label}</strong>
                      <span>{formatRecipeSourceAvailability(source.availability)}</span>
                      <p className="field-hint">{source.summary}</p>
                      {source.trustNotes.map((note) => (
                        <p className="field-hint" key={`${source.id}-${note}`}>
                          {note}
                        </p>
                      ))}
                      {source.termsUrl ? (
                        <p className="field-hint">
                          Terms:{" "}
                          <a href={source.termsUrl} target="_blank" rel="noreferrer">
                            {source.termsUrl}
                          </a>
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="internal-details-section">
                <h4>Official provider discovery</h4>
                <div className="store-summary-list">
                  {market.providerStoreSearches.map((provider) => (
                    <div className="store-summary-item" key={provider.provider}>
                      <strong>{provider.label}</strong>
                      <span>{formatProviderSearchStatus(provider.status)}</span>
                      <span>{formatProviderRetrievalMode(provider.retrievalMode)}</span>
                      <span>
                        {formatProviderSearchProvenance(provider.provenance)}
                      </span>
                      <p className="field-hint">{provider.message}</p>
                      {provider.persistedSnapshotId ? (
                        <p className="field-hint">
                          Saved local snapshot #{provider.persistedSnapshotId}
                        </p>
                      ) : null}
                      {provider.snapshotAgeMinutes !== undefined ? (
                        <p className="field-hint">
                          Snapshot freshness: {provider.snapshotAgeMinutes} minute(s)
                          old
                        </p>
                      ) : null}
                      {provider.stores.length > 0 ? (
                        <ul className="detail-list">
                          {provider.stores.map((store) => (
                            <li key={`${provider.provider}-${store.providerStoreId}`}>
                              {store.name}
                              {store.addressLine1 ? ` · ${store.addressLine1}` : ""}
                              {formatProviderStoreLocation(store)}
                              {store.zipCode ? ` ${store.zipCode}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="internal-details-section">
                <h4>Official pricing preview</h4>
                <div className="store-summary-list">
                  {market.providerPricingPreviews.map((preview) => (
                    <div
                      className="store-summary-item"
                      key={`${preview.provider}-${preview.providerStoreId}`}
                    >
                      <strong>{preview.label}</strong>
                      <span>{formatProviderSearchStatus(preview.status)}</span>
                      <span>{formatProviderRetrievalMode(preview.retrievalMode)}</span>
                      <span>{formatProviderSearchProvenance(preview.provenance)}</span>
                      <span>{formatPricingCoverageStatus(preview.coverageStatus)}</span>
                      <p className="field-hint">{preview.message}</p>
                      <p className="field-hint">
                        {preview.matchedIngredientCount} of{" "}
                        {preview.totalTrackedIngredients} tracked ingredient(s)
                        matched at {preview.storeName}.
                      </p>
                      {preview.persistedSnapshotId ? (
                        <p className="field-hint">
                          Saved pricing snapshot #{preview.persistedSnapshotId}
                        </p>
                      ) : null}
                      {preview.snapshotAgeMinutes !== undefined ? (
                        <p className="field-hint">
                          Pricing preview freshness: {preview.snapshotAgeMinutes}{" "}
                          minute(s) old
                        </p>
                      ) : null}
                      {preview.items.length > 0 ? (
                        <ul className="detail-list">
                          {preview.items.map((item) => (
                            <li
                              key={`${preview.providerStoreId}-${item.ingredientId}-${item.providerProductId}`}
                            >
                              <strong>{item.ingredientName}</strong>: {item.description}
                              {item.regularPrice !== undefined
                                ? ` · $${item.regularPrice.toFixed(2)}`
                                : ""}
                              {item.promoPrice !== undefined
                                ? ` promo $${item.promoPrice.toFixed(2)}`
                                : ""}
                              {` · match ${(item.matchConfidence * 100).toFixed(0)}%`}
                              {` · ${item.matchReason}`}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="internal-details-section">
                <h4>Provider preview coverage rollup</h4>
                <div className="store-summary-item">
                  <strong>Market-level provider trust gate</strong>
                  <span>
                    {formatPreviewTrustGate(market.providerCoverageRollup.trustGate)}
                  </span>
                  <span>
                    {formatPricingCoverageStatus(
                      market.providerCoverageRollup.overallCoverageStatus,
                    )}
                  </span>
                  <span>
                    Ranked pricing source:{" "}
                    {formatRankedPricingSource(
                      market.providerCoverageRollup.rankedPricingSource,
                    )}
                  </span>
                  {market.providerCoverageRollup.usesCachedPreview ? (
                    <span>Saved provider preview snapshot</span>
                  ) : null}
                  <p className="field-hint">{market.providerCoverageRollup.message}</p>
                  <p className="field-hint">
                    {market.providerCoverageRollup.matchedIngredientCount} matched ·{" "}
                    {market.providerCoverageRollup.unmatchedIngredientCount} unmatched
                    tracked ingredient(s)
                    {market.providerCoverageRollup.averageMatchConfidence !== null
                      ? ` · average match ${(market.providerCoverageRollup.averageMatchConfidence * 100).toFixed(0)}%`
                      : ""}
                  </p>
                  <ul className="detail-list">
                    {market.providerCoverageRollup.ingredientSummaries.map((summary) => (
                      <li key={summary.ingredientId}>
                        <strong>{summary.ingredientName}</strong>
                        {summary.matched
                          ? `: matched${summary.matchConfidence !== undefined ? ` · ${(summary.matchConfidence * 100).toFixed(0)}%` : ""}${summary.providerProductDescription ? ` · ${summary.providerProductDescription}` : ""}`
                          : ": no accepted provider match yet"}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="internal-details-section">
                <h4>Provider promotion readiness</h4>
                <div className="store-summary-list">
                  {market.providerPromotionReadiness.map((readiness) => (
                    <div className="store-summary-item" key={readiness.provider}>
                      <strong>
                        {getProviderChainLabel(readiness.provider)} promotion gate
                        checklist
                      </strong>
                      <span>
                        {formatPromotionReadinessStatus(readiness.overallStatus)}
                      </span>
                      <span>
                        {readiness.gatesPassedCount} of {readiness.gatesTotalCount}{" "}
                        gate(s) passed
                      </span>
                      <span>
                        Ranked pricing promotion:{" "}
                        {readiness.recommendationPricingPromotionEnabled
                          ? "enabled"
                          : "disabled"}
                      </span>
                      <p className="field-hint">{readiness.message}</p>
                      <ul className="detail-list">
                        {readiness.gates.map((gate) => (
                          <li key={`${readiness.provider}-${gate.id}`}>
                            <strong>{gate.label}</strong>:{" "}
                            {gate.passed ? "passed" : "not passed"} · {gate.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {recommendations && recommendations.length > 0 ? (
            <section className="internal-details-section">
              <h4>Ranked meal diagnostics</h4>
              {recommendations.map((meal) => (
                <div className="internal-meal-block" key={meal.title}>
                  <h5>{meal.title}</h5>
                  <p className="field-hint">{meal.explanation}</p>
                  <div className="score-grid">
                    <ScorePill label="Total score" value={meal.score.total} />
                    <ScorePill label="Price fit" value={meal.score.price} />
                    <ScorePill label="Convenience" value={meal.score.convenience} />
                    <ScorePill label="Freshness" value={meal.score.freshness} />
                    <ScorePill label="Filter fit" value={meal.score.fit} />
                  </div>
                  <div className="card-section">
                    <h6>Sale confidence notes</h6>
                    <ul className="detail-list">
                      {meal.shoppingPlan.map((item) => (
                        <li key={`${meal.title}-${item.storeName}-${item.ingredient}`}>
                          <strong>{item.ingredient}</strong>: {item.saleConfidence.label}
                          <p className="field-hint">{item.saleConfidence.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-section">
                    <h6>Directional provider preview comparisons</h6>
                    <div className="store-summary-list">
                      {meal.providerPreviewComparisons.map((comparison) => (
                        <div
                          className="store-summary-item"
                          key={`${meal.title}-${comparison.provider}`}
                        >
                          <strong>{comparison.providerLabel} preview comparison</strong>
                          <span>{comparison.directionalLabel}</span>
                          <span>
                            {formatRecipeComparisonStatus(comparison.comparisonStatus)}
                          </span>
                          <span>
                            Ranked total stays ${meal.estimatedTotal.toFixed(2)} (seed/DB)
                          </span>
                          <p className="field-hint">{comparison.message}</p>
                          {comparison.providerPreviewSubtotal !== null ? (
                            <p className="field-hint">
                              Overlapping ingredients only: seed/DB $
                              {comparison.seedComparedSubtotal.toFixed(2)} vs directional{" "}
                              {comparison.providerLabel} preview $
                              {comparison.providerPreviewSubtotal.toFixed(2)}
                              {comparison.priceDelta !== null
                                ? ` (${formatSignedCurrency(comparison.priceDelta)})`
                                : ""}
                            </p>
                          ) : null}
                          <ul className="detail-list">
                            {comparison.ingredients.map((ingredient) => (
                              <li
                                key={`${meal.title}-${comparison.provider}-${ingredient.ingredientId}`}
                              >
                                <strong>{ingredient.ingredientName}</strong>
                                {ingredient.matched
                                  ? `: seed/DB $${ingredient.seedPrice.toFixed(2)} vs ${comparison.providerLabel} preview $${ingredient.providerPrice?.toFixed(2) ?? "n/a"}${ingredient.priceDelta !== undefined ? ` (${formatSignedCurrency(ingredient.priceDelta)})` : ""}`
                                  : `: no ${comparison.providerLabel} preview match for this recipe ingredient`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="internal-details-section">
            <h4>Environment &amp; architecture glossary</h4>
            <p>
              <strong>GEOCODIO_API_KEY</strong> enables live ZIP geocoding. Without it,
              Yum4Less falls back to a local ZIP lookup table for beta v1 dev and CI.
            </p>
            <p>
              <strong>DATABASE_URL</strong> lets the app read the curated Postgres
              catalog and ranked-eligible price observations. Without it, ranked pricing
              is unavailable.
            </p>
            <p>
              <strong>Weekly-ad preview pricing</strong> means a chain supports ranked
              recommendations using scraped weekly-ad observations stored in PostgreSQL.
              Prices remain directional until verified in store.
            </p>
            <p>
              <strong>Official provider discovery</strong> asks real store APIs about
              nearby locations. That does not yet mean provider pricing drives ranked
              meal totals.
            </p>
            <p>
              <strong>Official pricing preview</strong> is an early lookup for a small
              tracked ingredient set. It measures future coverage but does not drive
              ranked meal pricing in beta v1.
            </p>
            <p>
              <strong>Provider promotion readiness</strong> is a checklist of gates that
              would need to pass before provider preview pricing could influence ranked
              meal totals. Production rollout gates apply equally to Kroger-family,
              Aldi, Publix, and Food Lion; Walmart and other chains remain
              context-only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatLookupSource(source: string) {
  if (source === "geocodio") {
    return "Geocodio lookup";
  }
  if (source === "browser") {
    return "Browser location";
  }
  return "Local ZIP fallback";
}

function formatDataSource(source: string) {
  if (source === "database") {
    return "Postgres catalog + ingested prices";
  }
  return "Postgres unavailable";
}

function formatRecipeSourceAvailability(availability: string) {
  switch (availability) {
    case "active":
      return "Active in beta v1";
    case "research-only":
      return "Research only";
    case "blocked-terms":
      return "Blocked by terms review";
    case "blocked-commercial":
      return "Blocked for commercial use";
    default:
      return availability;
  }
}

function formatWeeklyAdPromotionStatus(status: string) {
  switch (status) {
    case "ready":
      return "Weekly-ad promotion ready";
    case "not-ready":
      return "Weekly-ad promotion not ready";
    case "blocked":
      return "Weekly-ad promotion blocked";
    default:
      return status;
  }
}

function formatRolloutStatus(status: string) {
  switch (status) {
    case "weekly-ad-preview":
      return "Weekly-ad preview pricing";
    case "official-api-preview":
      return "Official API preview pricing";
    case "limited-coverage":
      return "Limited weekly-ad coverage";
    default:
      return "Coming soon";
  }
}

function formatProviderSearchStatus(status: string) {
  switch (status) {
    case "available":
      return "Official provider results";
    case "not-configured":
      return "Not configured";
    case "fallback":
      return "Fallback to local coverage";
    default:
      return "Provider error";
  }
}

function formatProviderSearchProvenance(provenance: string) {
  switch (provenance) {
    case "official-api":
      return "Official API provenance";
    case "fallback-local":
      return "Fallback local provenance";
    default:
      return "Provider not configured";
  }
}

function formatProviderRetrievalMode(retrievalMode: string) {
  switch (retrievalMode) {
    case "live":
      return "Live provider call";
    case "cached":
      return "Saved provider snapshot";
    default:
      return "No provider snapshot";
  }
}

function formatPricingCoverageStatus(status: string) {
  switch (status) {
    case "strong":
      return "Strong preview coverage";
    case "limited":
      return "Limited preview coverage";
    case "weak":
      return "Weak preview coverage";
    default:
      return "No preview coverage";
  }
}

function formatPreviewTrustGate(gate: string) {
  switch (gate) {
    case "monitoring":
      return "Monitoring provider preview coverage";
    case "closed":
      return "Provider preview gate closed";
    default:
      return "Provider preview not available";
  }
}

function formatRankedPricingSource(source: string) {
  switch (source) {
    case "weekly-ad-cache":
      return "Ingested weekly-ad cache pricing";
    case "official-api-cache":
    case "online-cache":
      return "Recently checked online cache pricing";
    case "mixed-online-weekly-ad-cache":
      return "Mixed online and weekly-ad cache pricing";
    case "limited-coverage":
      return "Limited ingested coverage (directional)";
    case "none":
      return "No eligible ingested prices yet";
    default:
      return source;
  }
}

function formatPromotionReadinessStatus(status: string) {
  switch (status) {
    case "ready-but-disabled":
      return "Ready on paper, rollout gate still on";
    case "approaching":
      return "Approaching promotion readiness";
    case "not-ready":
      return "Not ready for promotion";
    default:
      return "Promotion blocked";
  }
}

function formatRecipeComparisonStatus(status: string) {
  switch (status) {
    case "full":
      return "Full overlap on tracked preview ingredients";
    case "partial":
      return "Partial overlap only";
    default:
      return "No overlap available";
  }
}

function formatSignedCurrency(value: number) {
  if (value > 0) {
    return `+$${value.toFixed(2)}`;
  }

  if (value < 0) {
    return `-$${Math.abs(value).toFixed(2)}`;
  }

  return "$0.00";
}

function formatProviderStoreLocation(store: {
  city?: string;
  state?: string;
}) {
  const location = formatStoreCityState(store);
  return location ? ` · ${location}` : "";
}
