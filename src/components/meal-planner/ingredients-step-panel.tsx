"use client";

import { IngredientGatePanel } from "@/components/meal-planner/ingredient-gate-panel";
import { SaleIngredientPicker } from "@/components/meal-planner/sale-ingredient-picker";
import { CuisineChipToolbar } from "@/components/meal-planner/cuisine-chip-toolbar";
import type { IngredientPickMode } from "@/components/meal-planner/ingredient-pick-mode";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { buildMarketShopperBlockedStatus } from "@/lib/market-shopper-status";
import type { CuisineChipId } from "@/lib/cuisine-chips";

type IngredientsStepPanelProps = {
  market: RecommendationExperience["market"];
  rankingPaused: boolean;
  marketSearchLoading: boolean;
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  ingredientPickMode: IngredientPickMode;
  selectedIngredientIds: string[];
  selectedCuisineIds: CuisineChipId[];
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
  onSelectAllIngredients: () => void;
  onClearIngredientSelection: () => void;
  onToggleCuisine: (cuisineId: CuisineChipId) => void;
  onClearCuisines: () => void;
  onContinueToPantry: () => void;
  onPickManually: () => void;
  onUseAllIngredients: () => void;
};

export function IngredientsStepPanel({
  market,
  rankingPaused,
  marketSearchLoading,
  shoppingStyle,
  ingredientPickMode,
  selectedIngredientIds,
  selectedCuisineIds,
  onToggleIngredient,
  onSelectAllIngredients,
  onClearIngredientSelection,
  onToggleCuisine,
  onClearCuisines,
  onContinueToPantry,
  onPickManually,
  onUseAllIngredients,
}: IngredientsStepPanelProps) {
  const ingredientCount = market.saleIngredientChoices.length;
  const continueDisabled =
    rankingPaused ||
    marketSearchLoading ||
    ingredientCount === 0 ||
    (ingredientPickMode === "manual" && selectedIngredientIds.length === 0);
  const showManualPicker = ingredientPickMode === "manual";
  const showGate = ingredientPickMode === "unset" && ingredientCount > 0;
  const blockedStatus = buildMarketShopperBlockedStatus(market);

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--ingredients">
      <h2>Ingredients</h2>

      {ingredientCount > 0 ? (
        <CuisineChipToolbar
          cuisineFacetCounts={market.cuisineFacetCounts ?? {}}
          selectedCuisineIds={selectedCuisineIds}
          onToggleCuisine={onToggleCuisine}
          onClearCuisines={onClearCuisines}
        />
      ) : null}

      {showGate ? (
        <IngredientGatePanel
          ingredientCount={ingredientCount}
          onPickManually={onPickManually}
          onUseAll={onUseAllIngredients}
        />
      ) : null}

      {showManualPicker ? (
        <div className="sale-ingredient-picker-shell sale-ingredient-picker-shell--primary">
          <SaleIngredientPicker
            choices={market.saleIngredientChoices}
            selectedIngredientIds={selectedIngredientIds}
            shoppingStyle={shoppingStyle}
            onToggleIngredient={onToggleIngredient}
            onSelectAll={onSelectAllIngredients}
            onClearSelection={onClearIngredientSelection}
          />
        </div>
      ) : null}

      {ingredientCount === 0 ? (
        <p className="field-hint" role="status">
          No sale ingredients are available for your selected store(s) yet.
        </p>
      ) : null}

      {rankingPaused && blockedStatus ? (
        <div className="card card--infrastructure">
          <h3 className="card-title">{blockedStatus.title}</h3>
          <p className="explanation">{blockedStatus.body}</p>
          {blockedStatus.extra ? (
            <p className="explanation">{blockedStatus.extra}</p>
          ) : null}
        </div>
      ) : rankingPaused ? (
        <p className="field-hint" role="status">
          Meal estimates are not available for this area yet. Try different
          Settings or check back later — prices refresh daily.
        </p>
      ) : null}

      {ingredientPickMode === "manual" ? (
        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={onContinueToPantry}
            disabled={continueDisabled}
          >
            Continue to pantry check
          </button>
        </div>
      ) : null}
    </div>
  );
}
