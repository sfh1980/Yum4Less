"use client";

import type { ReactNode } from "react";
import type {
  MealRecommendation,
  RecommendationExperience,
  ShopperNotice,
} from "@/lib/recommendation-service";
import { RecommendationResultsCarousel } from "@/components/recommendation-results-carousel";
import { MealRecommendationCard } from "@/components/meal-planner/meal-recommendation-card";
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
  marketBlocked: boolean;
  activeLocationRequest?: ActiveLocationRequest;
  onOpenTrustExplainer: () => void;
};

export function MealResultsPanel({
  form: _form,
  marketSearchState,
  recommendationState,
  market,
  recommendations,
  shopperNotice,
  marketBlocked,
  activeLocationRequest,
  onOpenTrustExplainer,
}: MealResultsPanelProps) {
  const mealPausedStatus =
    market && marketBlocked ? buildMealRankingPausedStatus(market) : null;
  const resultsPriceSourceLine =
    market &&
    recommendationState.status === "ready" &&
    recommendations.length > 0
      ? buildResultsPanelPriceSourceLine(market)
      : null;

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
          <button
            className="secondary-button"
            type="button"
            onClick={onOpenTrustExplainer}
          >
            How to read these labels
          </button>
          <span className="badge">
            {recommendationState.status === "loading"
              ? "Suggesting recipes..."
              : recommendationState.status === "ready"
                ? `${recommendations.length} recipe(s) suggested`
                : market && !marketBlocked
                  ? "Ready to suggest"
                  : "Waiting for store search"}
          </span>
        </div>
      </div>

      <PricingTrustHeadsUpBanner instanceId="meals" market={market} />

      <div className="warning warning-with-hint">
        <p>
          Beta v1: totals are estimates. Check freshness and confidence labels
          on each result before you shop.
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
        ) : recommendationState.status === "loading" ? (
          <StatusCard
            title="Suggesting recipes"
            body="Yum4Less is matching your selected sale ingredients to recipes using nearby Kroger-family and Aldi estimates where gates pass."
          />
        ) : recommendationState.status === "error" ? (
          <StatusCard
            title="We could not suggest recipes yet"
            body={
              recommendationState.error ??
              "Try searching for stores again or adjusting your filters."
            }
          />
        ) : recommendationState.status !== "ready" ? (
          <StatusCard
            title="Ready when you are"
            body="Select sale ingredients in Step 3, then use Suggest recipes using my selected ingredients."
          />
        ) : shopperNotice ? (
          <StatusCard title={shopperNotice.title} body={shopperNotice.body} />
        ) : recommendations.length === 0 ? (
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
        ) : (
          <RecommendationResultsCarousel ariaLabel="Suggested dinner recipes">
            {recommendations.map((meal) => (
              <MealRecommendationCard
                activeLocationRequest={activeLocationRequest}
                form={_form}
                key={meal.title}
                market={market}
                meal={meal}
              />
            ))}
          </RecommendationResultsCarousel>
        )}
      </div>
    </div>
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
