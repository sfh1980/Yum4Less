"use client";

import type { SavedMealSnapshot } from "@/lib/saved-meals";

type SavedTabPanelProps = {
  meals: SavedMealSnapshot[];
  onRemove: (mealId: string) => void;
};

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved this session";
  }

  return `Saved ${date.toLocaleDateString()}`;
}

export function SavedTabPanel({ meals, onRemove }: SavedTabPanelProps) {
  return (
    <div className="panel panel-padding meal-planner-panel flow-panel flow-panel--saved">
      <h2>Saved</h2>
      <p className="panel-copy">
        Meals you save stay on this browser only. Totals are estimates from when
        you saved — check the store before you shop.
      </p>

      {meals.length === 0 ? (
        <p className="field-hint" role="status">
          Nothing saved yet. Open a dinner recommendation and tap Save meal.
        </p>
      ) : (
        <ul className="saved-meal-list">
          {meals.map((meal) => (
            <li key={meal.id} className="saved-meal-card">
              <div className="saved-meal-card-topline">
                <h3 className="card-title">{meal.title}</h3>
                <span className="price">Est. ${meal.estimatedTotal.toFixed(2)}</span>
              </div>
              <p className="card-summary">{meal.summary}</p>
              <p className="field-hint">
                {meal.primaryStore} · {meal.cookTimeMinutes} min ·{" "}
                {formatSavedAt(meal.savedAt)}
              </p>
              <p className="field-hint badge-trust">
                {meal.confidenceLabel}. {meal.freshnessLabel}.
              </p>
              {meal.ingredientHighlights.length > 0 ? (
                <p className="ingredient-highlights">
                  Key ingredients: {meal.ingredientHighlights.join(", ")}.
                </p>
              ) : null}
              <button
                className="text-button"
                type="button"
                onClick={() => onRemove(meal.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
