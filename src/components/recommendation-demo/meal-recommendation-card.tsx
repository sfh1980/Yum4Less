"use client";

import type { MealRecommendation, RecommendationExperience } from "@/lib/recommendation-service";
import { HelpHint } from "@/components/help-hint";
import { formatDifficulty } from "@/components/recommendation-demo/form-validation";
import { MultiStoreRoutePanel } from "@/components/recommendation-demo/multi-store-route-panel";
import type { ActiveLocationRequest, FormState } from "@/components/recommendation-demo/types";
import { formatEstimatedCurrency } from "@/lib/format-estimated-currency";
import {
  confidenceLabelHelp,
  freshnessLabelHelp,
  mealPriceSourceHelp,
  mealTotalHelp,
} from "@/lib/help-hint-content";
import { buildMealPriceSourceSummary } from "@/lib/meal-price-source-copy";

type MealRecommendationCardProps = {
  meal: MealRecommendation;
  form: FormState;
  activeLocationRequest?: ActiveLocationRequest;
  market: RecommendationExperience["market"];
};

export function MealRecommendationCard({
  meal,
  form,
  activeLocationRequest,
  market,
}: MealRecommendationCardProps) {
  const priceSource = buildMealPriceSourceSummary({ meal, market });

  return (
    <article className="card recommendation-card">
      <div className="card-topline">
        <h3 className="card-title">{meal.title}</h3>
        <span className="price-with-hint">
          <span
            aria-label={`Estimated total ${formatEstimatedCurrency(meal.estimatedTotal)}`}
            className="price"
          >
            {formatEstimatedCurrency(meal.estimatedTotal)}
          </span>
          <HelpHint
            id={`${meal.title}-total-help`}
            label={`Estimated total for ${meal.title}`}
            popoverContent={mealTotalHelp.popoverContent}
            popoverTitle={mealTotalHelp.popoverTitle}
            tooltip={mealTotalHelp.tooltip}
          />
        </span>
      </div>

      <p className="card-summary">{meal.summary}</p>

      <p className="meal-price-source">
        <span className="meal-price-source-with-hint">
          <span>{priceSource.summary}</span>
          <HelpHint
            id={`${meal.title}-price-source-help`}
            label={`Price source for ${meal.title}`}
            popoverContent={priceSource.detail}
            popoverTitle={mealPriceSourceHelp.popoverTitle}
            tooltip={mealPriceSourceHelp.tooltip}
          />
        </span>
      </p>

      <div className="pill-row">
        <span className="pill-with-hint">
          <span className="pill">{meal.confidenceLabel}</span>
          <HelpHint
            id={`${meal.title}-confidence-help`}
            label={`Confidence label for ${meal.title}`}
            popoverContent={confidenceLabelHelp.popoverContent}
            popoverTitle={confidenceLabelHelp.popoverTitle}
            tooltip={confidenceLabelHelp.tooltip}
          />
        </span>
        <span className="pill">{meal.cookTimeMinutes} min</span>
        <span className="pill">{formatDifficulty(meal.difficulty)}</span>
        <span className="pill">{meal.primaryStore}</span>
        <span className="pill-with-hint">
          <span className="pill">{meal.freshnessLabel}</span>
          <HelpHint
            id={`${meal.title}-freshness-help`}
            label={`Freshness label for ${meal.title}`}
            popoverContent={freshnessLabelHelp.popoverContent}
            popoverTitle={freshnessLabelHelp.popoverTitle}
            tooltip={freshnessLabelHelp.tooltip}
          />
        </span>
      </div>

      <div className="pill-row">
        <span className="pill">{meal.storeCount} store(s)</span>
        <span className="pill">{meal.matchedIngredients} matched ingredients</span>
        {meal.tags.map((tag) => (
          <span className="pill" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <p className="ingredient-highlights">
        Key ingredients: {meal.ingredientHighlights.join(", ")}.
      </p>

      <div className="card-section">
        <h4>Store plan</h4>
        <div className="store-summary-list">
          {meal.storePlan.map((store) => (
            <div className="store-summary-item" key={store.storeName}>
              <strong>{store.storeName}</strong>
              <span>
                {formatEstimatedCurrency(store.subtotal)} · {store.itemCount}{" "}
                item(s)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card-section">
        <h4>Shopping plan</h4>
        <ul className="detail-list">
          {meal.shoppingPlan.map((item) => (
            <li key={`${meal.title}-${item.storeName}-${item.ingredient}`}>
              <strong>{item.ingredient}</strong> from {item.storeName} for{" "}
              {formatEstimatedCurrency(item.price)} ({item.quantityNote})
              {item.saleLabel ? ` · ${item.saleLabel}` : ""}
              <div>
                <span className="sale-confidence-label">
                  {item.saleConfidence.label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {form.shoppingStyle === "multi-store" &&
      activeLocationRequest?.mode === "browser" &&
      meal.storeCount > 1 ? (
        <MultiStoreRoutePanel
          mealTitle={meal.title}
          storeNames={meal.storePlan.map((store) => store.storeName)}
          home={{
            latitude: activeLocationRequest.latitude,
            longitude: activeLocationRequest.longitude,
          }}
          nearbyStores={market.nearbyStores}
        />
      ) : null}

      <div className="card-section">
        <h4>Recipe steps</h4>
        <ol className="detail-list detail-list-numbered">
          {meal.instructions.map((step) => (
            <li key={`${meal.title}-${step}`}>{step}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}
