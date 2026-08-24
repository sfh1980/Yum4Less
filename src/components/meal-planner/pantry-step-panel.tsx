"use client";

import { useState } from "react";
import type { PantryCoverageChecklistItem } from "@/contracts/pantry-coverage";

export type PantryItemSource = "suggested" | "manual";

export type PantryListRow = {
  ingredientId: string;
  ingredientName: string;
  source: PantryItemSource;
  recipeCount?: number;
};

type PantryStepPanelProps = {
  loading: boolean;
  error?: string;
  fullyCoveredRecipeCount: number;
  eligibleRecipeCount: number;
  suggestedChecklist: PantryCoverageChecklistItem[];
  pantryRows: PantryListRow[];
  selectedPantryIngredientIds: string[];
  onToggleChecklistItem: (ingredientId: string, checked: boolean) => void;
  onRemovePantryIngredient: (ingredientId: string) => void;
  rankingPaused: boolean;
  rankLoading: boolean;
  onSuggestRecipes: () => void;
};

export function PantryStepPanel({
  loading,
  error,
  fullyCoveredRecipeCount,
  eligibleRecipeCount,
  suggestedChecklist,
  pantryRows,
  selectedPantryIngredientIds,
  onToggleChecklistItem,
  onRemovePantryIngredient,
  rankingPaused,
  rankLoading,
  onSuggestRecipes,
}: PantryStepPanelProps) {
  const suggestDisabled = rankingPaused || rankLoading;
  const [pantryListExpanded, setPantryListExpanded] = useState(false);

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--pantry">
      <h2>Pantry check</h2>
      <p className="panel-copy">
        Check what you already have at home for this session only. These picks
        come from meals that are only a few ingredients away. Pantry items are
        not saved when you reset the flow or leave.
      </p>

      <div className="pantry-step-summary pantry-step-summary--sticky" role="status" aria-live="polite">
        {loading ? (
          <p className="panel-copy">Updating pantry coverage…</p>
        ) : (
          <>
            <p className="panel-copy pantry-step-summary-count">
              <strong>{fullyCoveredRecipeCount}</strong> of{" "}
              <strong>{eligibleRecipeCount}</strong> dinners can be shown next
              with your sale picks plus pantry.
            </p>
            {suggestedChecklist.length > 0 ? (
              <p className="field-hint">
                {suggestedChecklist.length} suggested ingredient
                {suggestedChecklist.length === 1 ? "" : "s"} from nearby
                near-miss meals. Checking items can open more dinners.
              </p>
            ) : (
              <p className="field-hint">
                No meals are 1–4 items away at your stores right now. You can
                still suggest recipes from this week&apos;s sales.
              </p>
            )}
          </>
        )}
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {suggestedChecklist.length > 0 ? (
        <section className="pantry-checklist-block" aria-label="Suggested pantry items">
          <h3 className="card-title">Suggested from near-miss meals</h3>
          <ul className="pantry-checklist">
            {suggestedChecklist.map((item) => {
              const checked = selectedPantryIngredientIds.includes(item.ingredientId);
              return (
                <li
                  key={item.ingredientId}
                  className={
                    checked
                      ? "pantry-checklist-item pantry-checklist-item--checked"
                      : "pantry-checklist-item"
                  }
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onToggleChecklistItem(item.ingredientId, event.target.checked)
                      }
                    />
                    <span>{item.ingredientName}</span>
                    <span className="pantry-checklist-meta">
                      missing in {item.recipeCount} recipe
                      {item.recipeCount === 1 ? "" : "s"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {pantryRows.length > 0 ? (
        <section className="pantry-combined-list-block" aria-label="Your pantry selections">
          <h3 className="card-title pantry-combined-list-heading">
            <button
              type="button"
              className="pantry-combined-list-trigger"
              aria-expanded={pantryListExpanded}
              onClick={() => setPantryListExpanded((current) => !current)}
            >
              Your pantry for this session ({pantryRows.length}{" "}
              {pantryRows.length === 1 ? "item" : "items"})
            </button>
          </h3>
          {pantryListExpanded ? (
            <ul className="pantry-combined-list">
              {pantryRows.map((row) => (
                <li key={row.ingredientId} className="pantry-combined-list-item">
                  <div className="pantry-combined-list-copy">
                    <span className="pantry-combined-list-name">
                      {row.ingredientName || row.ingredientId}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onRemovePantryIngredient(row.ingredientId)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          onClick={onSuggestRecipes}
          disabled={suggestDisabled}
        >
          Suggest recipes for my store(s)
        </button>
      </div>
    </div>
  );
}
