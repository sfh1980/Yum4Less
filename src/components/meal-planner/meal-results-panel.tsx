"use client";

import { useState, type ReactNode } from "react";
import type {
  MealRecommendation,
  RecommendationExperience,
  ShopperNotice,
} from "@/lib/recommendation-service";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { SingleStoreMapOverlay } from "@/components/single-store-map-overlay";
import { MealResultsAccordion } from "@/components/meal-planner/meal-results-accordion";
import { HelpHint } from "@/components/help-hint";
import { PricingTrustHeadsUpBanner } from "@/components/meal-planner/pricing-trust-heads-up";
import { mealTotalHelp } from "@/lib/help-hint-content";
import { buildResultsPanelPriceSourceLine } from "@/lib/meal-price-source-copy";
import { buildMealRankingPausedStatus } from "@/lib/market-shopper-status";
import type {
  ActiveLocationRequest,
  FormState,
  MarketSearchState,
  RecommendationState,
} from "@/components/meal-planner/types";

type MealResultsPanelProps = {
  form: FormState;
  marketSearchState: MarketSearchState;
  recommendationState: RecommendationState;
  market?: RecommendationExperience["market"];
  recommendations: MealRecommendation[];
  shopperNotice?: ShopperNotice;
  supplementaryShopperNotices?: ShopperNotice[];
  marketBlocked: boolean;
  activeLocationRequest?: ActiveLocationRequest;
  /** Full-screen overlay owns loading copy during rank (slice 5). */
  suppressInlineLoading?: boolean;
};

export function MealResultsPanel({
  form: _form,
  marketSearchState,
  recommendationState,
  market,
  recommendations,
  shopperNotice,
  supplementaryShopperNotices,
  marketBlocked,
  activeLocationRequest,
  suppressInlineLoading = false,
}: MealResultsPanelProps) {
  const [storeMapTarget, setStoreMapTarget] = useState<NearbyStoreSummary | null>(null);
  const [isStoreMapOpen, setIsStoreMapOpen] = useState(false);

  function handleOpenStoreMap(store: NearbyStoreSummary | null) {
    setStoreMapTarget(store);
    setIsStoreMapOpen(true);
  }

  function handleCloseStoreMap() {
    setIsStoreMapOpen(false);
  }

  const mealPausedStatus =
    market && marketBlocked ? buildMealRankingPausedStatus(market) : null;
  const resultsPriceSourceLine =
    market &&
    recommendationState.status === "ready" &&
    recommendations.length > 0
      ? buildResultsPanelPriceSourceLine(market)
      : null;
  const badgeLabel = resolveMealResultsBadgeLabel({
    marketSearchState,
    recommendationState,
    market,
    recommendations,
    marketBlocked,
  });

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--meals">
      <div className="panel-header">
        <div>
          <h2>Dinner recommendations</h2>
          <p className="panel-copy">
            Recipe suggestions, shopping plans, and steps appear here after you
            pick sale ingredients.
          </p>
          {resultsPriceSourceLine ? (
            <p className="panel-copy meal-results-price-source">
              {resultsPriceSourceLine}
            </p>
          ) : null}
        </div>
        <div className="results-actions">
          <span className="badge">{badgeLabel}</span>
        </div>
      </div>

      <PricingTrustHeadsUpBanner
        instanceId="meals"
        market={market}
        trustContext={{
          shoppingStyle: _form.shoppingStyle,
          selectedStoreIds: _form.selectedStoreIds,
          recommendations,
        }}
      />

      <div className="warning warning-with-hint">
        <p>
          Totals are estimates. Check freshness and confidence labels on each
          result before you shop.
        </p>
        <HelpHint
          id="meal-totals-warning-help"
          label="Estimated meal totals help"
          popoverContent={mealTotalHelp.popoverContent}
          popoverTitle={mealTotalHelp.popoverTitle}
          tooltip={mealTotalHelp.tooltip}
        />
      </div>

      <div aria-live="polite" className="results-stack meal-results-stack">
        {marketSearchState.status !== "ready" || !market ? (
          <StatusCard
            title="Meal results will appear here"
            body="Find nearby stores first, set your spending limit and preferences, then select sale ingredients and suggest recipes."
          />
        ) : marketBlocked && mealPausedStatus ? (
          <StatusCard
            title={mealPausedStatus.title}
            body={mealPausedStatus.body}
          />
        ) : recommendationState.status === "loading" && !suppressInlineLoading ? (
          <StatusCard
            title="Suggesting recipes"
            body="Yum4Less is matching your selected sale ingredients to recipes using saved prices at your selected store(s)."
          />
        ) : recommendationState.status === "error" ? (
          <StatusCard
            title={recommendationState.errorTitle ?? "We could not suggest recipes yet"}
            body={
              recommendationState.error ??
              "Try searching for stores again or adjusting your filters."
            }
            extra={
              recommendationState.errorHint ? (
                <p className="explanation">{recommendationState.errorHint}</p>
              ) : null
            }
          />
        ) : recommendationState.status !== "ready" ? (
          <StatusCard
            title="Ready when you are"
            body="Finish pantry check on the Home tab, then tap Suggest recipes for my store(s)."
          />
        ) : (
          <>
            {[shopperNotice, ...(supplementaryShopperNotices ?? [])]
              .filter((notice): notice is ShopperNotice => notice !== undefined)
              .map((notice) => (
                <StatusCard
                  key={notice.title}
                  title={notice.title}
                  body={notice.body}
                />
              ))}
            {recommendations.length === 0 ? (
              hasExplicitEmptyMealNotice(shopperNotice, supplementaryShopperNotices) ? null : (
                <StatusCard
                  title="No recipes match the current filters"
                  body="That is useful feedback, not a failure. Your spending limit or store preference may be too strict for the nearby sale coverage."
                  extra={
                    <p className="explanation">
                      Try raising your spending limit, allowing multiple stores, or
                      selecting different sale ingredients.
                    </p>
                  }
                />
              )
            ) : (
              <>
                <MealResultsAccordion
                  activeLocationRequest={activeLocationRequest}
                  ariaLabel="Suggested dinner recipes"
                  form={_form}
                  market={market}
                  onOpenStoreMap={handleOpenStoreMap}
                  recommendations={recommendations}
                />
              </>
            )}
          </>
        )}
      </div>

      <SingleStoreMapOverlay
        isOpen={isStoreMapOpen}
        store={storeMapTarget}
        onClose={handleCloseStoreMap}
      />
    </div>
  );
}

function resolveMealResultsBadgeLabel(input: {
  marketSearchState: MarketSearchState;
  recommendationState: RecommendationState;
  market?: RecommendationExperience["market"];
  recommendations: MealRecommendation[];
  marketBlocked: boolean;
}): string {
  const { marketSearchState, recommendationState, market, recommendations, marketBlocked } =
    input;

  if (recommendationState.status === "loading") {
    return "Suggesting recipes...";
  }

  if (recommendationState.status === "ready") {
    return `${recommendations.length} recipe(s) suggested`;
  }

  if (recommendationState.status === "error") {
    return recommendationState.errorTitle ?? "Could not suggest recipes";
  }

  if (marketSearchState.status !== "ready" || !market) {
    return "Waiting for store search";
  }

  if (marketBlocked) {
    return "No ranked meals in this area";
  }

  return "Ready to suggest";
}

function hasExplicitEmptyMealNotice(
  shopperNotice?: ShopperNotice,
  supplementaryShopperNotices?: ShopperNotice[],
): boolean {
  const titles = [shopperNotice, ...(supplementaryShopperNotices ?? [])]
    .filter((notice): notice is ShopperNotice => notice !== undefined)
    .map((notice) => notice.title.toLowerCase());

  return titles.some(
    (title) =>
      title.includes("no recipe") ||
      title.includes("no themealdb") ||
      title.includes("no sale ingredients"),
  );
}

function StatusCard({
  title,
  body,
  extra,
}: {
  title: string;
  body: string;
  extra?: ReactNode;
}) {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <p className="explanation">{body}</p>
      {extra}
    </div>
  );
}
