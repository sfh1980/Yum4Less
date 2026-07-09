"use client";

import type { CatalogIngredient } from "@/lib/ingredient-category";
import {
  IngredientCatalogCombobox,
  type PantryIngredientAddResult,
} from "@/components/meal-planner/ingredient-catalog-combobox";
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
  ingredientCatalog: CatalogIngredient[];
  selectedPantryIngredientIds: string[];
  onToggleChecklistItem: (ingredientId: string, checked: boolean) => void;
  onAddPantryIngredient: (result: PantryIngredientAddResult) => void;
  onRemovePantryIngredient: (ingredientId: string) => void;
  onContinueToRank: () => void;
};

function buildChecklistNameMap(
  suggestedChecklist: PantryCoverageChecklistItem[],
): Map<string, string> {
  return new Map(
    suggestedChecklist.map((item) => [item.ingredientId, item.ingredientName]),
  );
}

export function PantryStepPanel({
  loading,
  error,
  fullyCoveredRecipeCount,
  eligibleRecipeCount,
  suggestedChecklist,
  pantryRows,
  ingredientCatalog,
  selectedPantryIngredientIds,
  onToggleChecklistItem,
  onAddPantryIngredient,
  onRemovePantryIngredient,
  onContinueToRank,
}: PantryStepPanelProps) {
  const checklistNameById = buildChecklistNameMap(suggestedChecklist);
  const nearMissRecipeCountByIngredientId = new Map(
    suggestedChecklist.map((item) => [item.ingredientId, item.recipeCount]),
  );
  const suggestedIds = new Set(suggestedChecklist.map((item) => item.ingredientId));
  const uncheckedSuggested = suggestedChecklist.filter(
    (item) => !selectedPantryIngredientIds.includes(item.ingredientId),
  );

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--pantry">
      <h2>Pantry check</h2>
      <p className="panel-copy">
        Tell Yum4Less what you already have at home for this session only. Pantry
        items are not saved when you reset the flow or leave.
      </p>

      <div className="pantry-step-summary" role="status" aria-live="polite">
        {loading ? (
          <p className="panel-copy">Updating pantry coverage…</p>
        ) : (
          <>
            <p className="panel-copy">
              <strong>{fullyCoveredRecipeCount}</strong> of{" "}
              <strong>{eligibleRecipeCount}</strong> eligible recipes are fully
              covered with your sale picks plus pantry.
            </p>
            {suggestedChecklist.length > 0 ? (
              <p className="field-hint">
                {suggestedChecklist.length} suggested ingredient
                {suggestedChecklist.length === 1 ? "" : "s"} from nearby
                near-miss meals.
              </p>
            ) : (
              <p className="field-hint">
                No meals are 1–4 items away at your stores right now. You can
                still add pantry staples below.
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

      {uncheckedSuggested.length > 0 ? (
        <section className="pantry-checklist-block" aria-label="Suggested pantry items">
          <h3 className="card-title">Suggested from near-miss meals</h3>
          <ul className="pantry-checklist">
            {uncheckedSuggested.map((item) => (
              <li key={item.ingredientId} className="pantry-checklist-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedPantryIngredientIds.includes(item.ingredientId)}
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
            ))}
          </ul>
        </section>
      ) : null}

      <IngredientCatalogCombobox
        catalog={ingredientCatalog}
        selectedIngredientIds={selectedPantryIngredientIds}
        nearMissRecipeCountByIngredientId={nearMissRecipeCountByIngredientId}
        onSelectIngredient={onAddPantryIngredient}
      />

      {pantryRows.length > 0 ? (
        <section className="pantry-combined-list-block" aria-label="Your pantry selections">
          <h3 className="card-title">Your pantry for this session</h3>
          <ul className="pantry-combined-list">
            {pantryRows.map((row) => (
              <li key={row.ingredientId} className="pantry-combined-list-item">
                <div className="pantry-combined-list-copy">
                  <span className="pantry-combined-list-name">
                    {row.ingredientName ||
                      checklistNameById.get(row.ingredientId) ||
                      row.ingredientId}
                  </span>
                  <span
                    className={
                      row.source === "suggested"
                        ? "pantry-source-badge pantry-source-badge--suggested"
                        : "pantry-source-badge pantry-source-badge--manual"
                    }
                  >
                    {row.source === "suggested" ? "Suggested" : "You added"}
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
        </section>
      ) : null}

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          onClick={onContinueToRank}
        >
          Continue to rank
        </button>
      </div>
    </div>
  );
}
