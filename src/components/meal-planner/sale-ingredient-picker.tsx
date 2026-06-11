"use client";

import type { SaleIngredientChoice } from "@/lib/sale-ingredient-offers";
import { formatIngredientPriceAge } from "@/lib/sale-ingredient-offers";
import { formatEstimatedCurrency } from "@/lib/format-estimated-currency";
import { RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE } from "@/lib/ranked-price-cache-policy";

type SaleIngredientPickerProps = {
  choices: SaleIngredientChoice[];
  selectedIngredientIds: string[];
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

export function SaleIngredientPicker({
  choices,
  selectedIngredientIds,
  onToggleIngredient,
  onSelectAll,
  onClearSelection,
}: SaleIngredientPickerProps) {
  if (choices.length === 0) {
    return (
      <p className="field-hint" role="status">
        No sale or cached price ingredients are available for nearby ranked chains
        yet. {RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE} Try another ZIP or check
        back after the next ingest run.
      </p>
    );
  }

  const selectedCount = selectedIngredientIds.length;

  return (
    <div className="sale-ingredient-picker">
      <div className="sale-ingredient-picker-header">
        <p className="panel-copy">
          These items come from ingested weekly ads and official online price
          cache near you. Check what you want to cook with — totals stay{" "}
          <strong>estimated</strong> or <strong>directional</strong>, not
          checkout prices.
        </p>
        <div className="action-row sale-ingredient-picker-actions">
          <button className="secondary-button" type="button" onClick={onSelectAll}>
            Select all
          </button>
          <button className="secondary-button" type="button" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      </div>

      <p className="field-hint" role="status">
        {selectedCount} of {choices.length} ingredient(s) selected
      </p>

      <ul className="sale-ingredient-list">
        {choices.map((choice) => {
          const inputId = `sale-ingredient-${choice.ingredientId}`;
          const checked = selectedIngredientIds.includes(choice.ingredientId);
          const priceAgeLabel = formatIngredientPriceAge({
            freshnessHoursAgo: choice.freshnessHoursAgo,
          });

          return (
            <li key={choice.ingredientId}>
              <label className="sale-ingredient-list-item" htmlFor={inputId}>
                <input
                  checked={checked}
                  id={inputId}
                  onChange={(event) =>
                    onToggleIngredient(choice.ingredientId, event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="sale-ingredient-list-item-body">
                  <span className="sale-ingredient-list-item-topline">
                    <strong>{choice.ingredientName}</strong>
                    <span className="sale-ingredient-price">
                      {formatEstimatedCurrency(choice.lowestEstimatedPrice)}
                    </span>
                  </span>
                  <span className="field-hint">
                    {choice.trustLabel === "directional"
                      ? "Weekly-ad price — directional"
                      : "Online cache — estimated"}
                    {choice.saleLabel ? ` · ${choice.saleLabel}` : ""}
                    {choice.storeOfferCount > 1
                      ? ` · ${choice.storeOfferCount} store offers`
                      : ` · ${choice.offers[0]?.storeName ?? "Nearby store"}`}
                  </span>
                  {priceAgeLabel ? (
                    <span className="field-hint sale-ingredient-freshness">
                      {priceAgeLabel}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
