"use client";

import { CollapsibleCardSection } from "@/components/meal-planner/collapsible-card-section";
import { MapPinIcon } from "@/components/map-pin-icon";
import type { MealRecommendation, RecommendationExperience } from "@/lib/recommendation-service";
import { HelpHint } from "@/components/help-hint";
import { formatDifficulty } from "@/components/meal-planner/form-validation";
import { MultiStoreRoutePanel } from "@/components/meal-planner/multi-store-route-panel";
import type { ActiveLocationRequest, FormState } from "@/components/meal-planner/types";
import {
  formatShopperPriceWording,
  shopperPriceTierFromSaleConfidenceLevel,
  shopperPriceTierFromShoppingPlan,
} from "@/lib/shopper-price-wording";
import { formatMealPriceAgeFromShoppingPlan } from "@/lib/sale-ingredient-offers";
import { FAQ_SLUG } from "@/lib/faq-articles";
import { MEAL_CARD_SHOW_EXTENDED_CHROME } from "@/components/meal-planner/meal-card-chrome";
import { buildMealPriceSourceSummary } from "@/lib/meal-price-source-copy";
import { resolveNearbyStoreByName } from "@/lib/resolve-nearby-store-by-name";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

type MealRecommendationCardProps = {
  meal: MealRecommendation;
  form: FormState;
  activeLocationRequest?: ActiveLocationRequest;
  market: RecommendationExperience["market"];
  onOpenStoreMap: (store: NearbyStoreSummary | null) => void;
  /** Accordion expanded panel: title lives on the trigger button. */
  hideTitle?: boolean;
  isSaved?: boolean;
  onToggleSave?: (meal: MealRecommendation) => void;
  showExtendedChrome?: boolean;
};

function StoreMapTapButton({
  storeName,
  nearbyStores,
  onOpenStoreMap,
  className,
}: {
  storeName: string;
  nearbyStores: NearbyStoreSummary[];
  onOpenStoreMap: (store: NearbyStoreSummary | null) => void;
  className: string;
}) {
  function handleClick() {
    const resolved = resolveNearbyStoreByName(storeName, nearbyStores);
    onOpenStoreMap(resolved ?? null);
  }

  return (
    <button
      type="button"
      className={`store-map-tap-button ${className}`}
      onClick={handleClick}
      aria-label={`Show ${storeName} on map`}
    >
      <MapPinIcon aria-hidden className="store-map-tap-icon" size={14} />
      <span className="store-map-tap-label">{storeName}</span>
    </button>
  );
}

export function MealRecommendationCard({
  meal,
  form,
  activeLocationRequest,
  market,
  onOpenStoreMap,
  hideTitle = false,
  isSaved = false,
  onToggleSave,
  showExtendedChrome = MEAL_CARD_SHOW_EXTENDED_CHROME,
}: MealRecommendationCardProps) {
  const priceSource = buildMealPriceSourceSummary({ meal, market });
  const mealPriceAgeLabel = formatMealPriceAgeFromShoppingPlan(
    meal.shoppingPlan.filter((item) => !item.sourcedFromPantry),
  );
  const hasPantryLines = meal.shoppingPlan.some((item) => item.sourcedFromPantry);
  const nearbyStores = market.nearbyStores;
  const mealPriceTier = shopperPriceTierFromShoppingPlan(meal.shoppingPlan);
  const mealPriceLabel = formatShopperPriceWording(meal.estimatedTotal, mealPriceTier);

  return (
    <article className="card recommendation-card">
      <div
        className={
          hideTitle ? "card-topline card-topline--title-hidden" : "card-topline"
        }
      >
        {hideTitle ? null : <h3 className="card-title">{meal.title}</h3>}
        <span className="price-with-hint">
          <span
            aria-label={mealPriceLabel}
            className="price"
          >
            {mealPriceLabel}
          </span>
          <HelpHint
            id={`${meal.title}-total-help`}
            articleSlug={FAQ_SLUG.mealTotal}
          />
        </span>
      </div>

      {showExtendedChrome ? (
        <>
          <p className="card-summary">{meal.summary}</p>

          {meal.recipeAttribution ? (
            <p className="field-hint recipe-attribution">
              {meal.recipeAttribution}{" "}
              {meal.recipeAttributionUrl ? (
                <a
                  href={meal.recipeAttributionUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View on TheMealDB
                </a>
              ) : null}
            </p>
          ) : null}

          <p className="meal-price-source">
            <span className="meal-price-source-with-hint">
              <span>{priceSource.summary}</span>
              <HelpHint
                id={`${meal.title}-price-source-help`}
                articleSlug={FAQ_SLUG.priceSource}
              />
            </span>
          </p>

          {mealPriceAgeLabel ? (
            <p className="field-hint meal-card-price-age badge-trust">
              {mealPriceAgeLabel}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="pill-row">
        <span className="pill-with-hint">
          <span className="pill pill--trust">{meal.confidenceLabel}</span>
          <HelpHint
            id={`${meal.title}-confidence-help`}
            articleSlug={FAQ_SLUG.confidence}
          />
        </span>
        <span className="pill">{meal.cookTimeMinutes} min</span>
        <span className="pill">{formatDifficulty(meal.difficulty)}</span>
        {showExtendedChrome ? (
          <StoreMapTapButton
            className="pill store-map-tap-button--pill"
            nearbyStores={nearbyStores}
            onOpenStoreMap={onOpenStoreMap}
            storeName={meal.primaryStore}
          />
        ) : null}
        <span className="pill-with-hint">
          <span className="pill pill--trust">{meal.freshnessLabel}</span>
          <HelpHint
            id={`${meal.title}-freshness-help`}
            articleSlug={FAQ_SLUG.freshness}
          />
        </span>
      </div>

      {showExtendedChrome ? (
        <>
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
        </>
      ) : null}

      {onToggleSave ? (
        <button
          className="secondary-button meal-save-button"
          type="button"
          aria-pressed={isSaved}
          onClick={() => onToggleSave(meal)}
        >
          {isSaved ? "Saved" : "Save meal"}
        </button>
      ) : null}

      <CollapsibleCardSection title="Store plan">
        <div className="store-summary-list">
          {meal.storePlan.map((store) => (
            <div className="store-summary-item" key={store.storeName}>
              <StoreMapTapButton
                className="store-map-tap-button--plan"
                nearbyStores={nearbyStores}
                onOpenStoreMap={onOpenStoreMap}
                storeName={store.storeName}
              />
              <span>
                {formatShopperPriceWording(store.subtotal, mealPriceTier)} ·{" "}
                {store.itemCount} item(s)
              </span>
            </div>
          ))}
        </div>
      </CollapsibleCardSection>

      <CollapsibleCardSection title="Shopping plan">
        {form.shoppingStyle === "multi-store" ? (
          <p className="field-hint badge-trust meal-card-price-change-note">
            Estimated prices by store for this session — subject to change in
            store.
          </p>
        ) : null}
        {hasPantryLines ? (
          <p className="field-hint">
            Pantry items are listed for context and are not included in the
            estimated total above.
          </p>
        ) : null}
        <ul className="detail-list">
          {meal.shoppingPlan.map((item) =>
            item.sourcedFromPantry ? (
              <li key={`${meal.title}-${item.ingredientId}-pantry`}>
                <strong>{item.ingredient}</strong> — from your pantry, not
                included in total. ({item.quantityNote})
                <div>
                  <span className="sale-confidence-label badge-trust">
                    {item.pantryNote ?? item.saleConfidence.note}
                  </span>
                </div>
              </li>
            ) : (
              <li key={`${meal.title}-${item.ingredientId}-${item.storeName}`}>
                <strong>{item.ingredient}</strong> from {item.storeName} for{" "}
                {formatShopperPriceWording(
                  item.price,
                  shopperPriceTierFromSaleConfidenceLevel(
                    item.saleConfidence.level,
                  ),
                )}{" "}
                ({item.quantityNote})
                {item.saleLabel ? ` · ${item.saleLabel}` : ""}
                <div>
                  <span className="sale-confidence-label">
                    {item.saleConfidence.label}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      </CollapsibleCardSection>

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

      <CollapsibleCardSection title="Recipe steps">
        <ol className="detail-list detail-list-numbered">
          {meal.instructions.map((step, index) => (
            <li key={`${meal.title}-step-${index}`}>{step}</li>
          ))}
        </ol>
        {meal.recipeAttributionUrl ? (
          <p className="recipe-full-instructions">
            <a
              className="text-link"
              href={meal.recipeAttributionUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open full recipe instructions
            </a>
          </p>
        ) : null}
      </CollapsibleCardSection>
    </article>
  );
}
