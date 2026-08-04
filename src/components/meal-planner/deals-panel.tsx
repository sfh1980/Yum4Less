"use client";

import type { RecommendationExperience } from "@/lib/recommendation-service";
import {
  formatShopperPriceWording,
  shopperPriceTierFromOfferFields,
} from "@/lib/shopper-price-wording";
import { formatIngredientPriceAge } from "@/lib/sale-ingredient-offers";
import type { MarketSearchState } from "@/components/meal-planner/types";

type DealsPanelProps = {
  market?: RecommendationExperience["market"];
  marketSearchLoading: boolean;
  marketSearchState: MarketSearchState;
};

export function DealsPanel({
  market,
  marketSearchLoading,
  marketSearchState,
}: DealsPanelProps) {
  if (marketSearchLoading || marketSearchState.status === "loading") {
    return (
      <div className="panel panel-padding meal-planner-panel flow-panel">
        <h2>Deals</h2>
        <p className="panel-copy" role="status">
          Loading sale items at your selected store(s)…
        </p>
      </div>
    );
  }

  if (marketSearchState.status === "error") {
    return (
      <div className="panel panel-padding meal-planner-panel flow-panel">
        <h2>Deals</h2>
        <p className="field-error" role="alert">
          {marketSearchState.error ?? "Could not load deals for your area."}
        </p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="panel panel-padding meal-planner-panel flow-panel">
        <h2>Deals</h2>
        <p className="panel-copy">
          Complete Settings with a location and store selection to browse current
          sale items. This view is read-only — no ranking or meal planning here.
        </p>
      </div>
    );
  }

  const choices = market.saleIngredientChoices;

  return (
    <div className="panel panel-padding meal-planner-panel flow-panel flow-panel--deals">
      <h2>Deals</h2>
      <p className="panel-copy">
        Sale items at your selected store(s). Prices are{" "}
        <strong>estimated</strong> or <strong>directional</strong> — verify in store.
      </p>

      {choices.length === 0 ? (
        <p className="field-hint" role="status">
          No sale items are available for your selected store(s) yet. Try
          different Settings or check back later — prices refresh daily.
        </p>
      ) : (
        <ul className="deals-list">
          {choices.map((choice) => {
            const priceAgeLabel = formatIngredientPriceAge({
              freshnessHoursAgo: choice.freshnessHoursAgo,
            });
            const primaryOffer = choice.offers[0];
            const priceTier = shopperPriceTierFromOfferFields({
              saleLabel: choice.saleLabel ?? primaryOffer?.saleLabel,
              freshnessDaysAgo: primaryOffer?.freshnessDaysAgo ?? 0,
              freshnessHoursAgo:
                choice.freshnessHoursAgo ?? primaryOffer?.freshnessHoursAgo,
              priceSource: primaryOffer?.priceSource,
              trustLabel: choice.trustLabel,
            });

            return (
              <li key={choice.ingredientId} className="deals-list-item">
                <div className="deals-list-item-main">
                  <strong>{choice.ingredientName}</strong>
                  <span className="sale-ingredient-price">
                    {formatShopperPriceWording(
                      choice.lowestEstimatedPrice,
                      priceTier,
                    )}
                  </span>
                </div>
                <div className="deals-list-item-meta">
                  {choice.saleLabel ? <span>{choice.saleLabel}</span> : null}
                  <span className="trust-pill">{choice.trustLabel}</span>
                  {priceAgeLabel ? (
                    <span className="badge-trust">{priceAgeLabel}</span>
                  ) : null}
                  {choice.storeOfferCount > 1 ? (
                    <span>{choice.storeOfferCount} store offers</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
