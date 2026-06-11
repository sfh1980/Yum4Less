"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { FormField } from "@/components/meal-planner/form-field";
import { SaleIngredientPicker } from "@/components/meal-planner/sale-ingredient-picker";
import { radiusHelp, zipCodeHelp } from "@/lib/help-hint-content";
import type { FieldErrors, FormState } from "@/components/meal-planner/types";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

type LocationSearchPanelProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  displayedErrors: FieldErrors;
  market?: RecommendationExperience["market"];
  rankingPaused?: boolean;
  isEditingLocation: boolean;
  focusMealPreferencesToken: number;
  onEditLocation: () => void;
  onResetLocationState: () => void;
  onZipSearch: () => void;
  onBrowserSearch: () => void;
  onRankMeals: () => void;
  selectedIngredientIds: string[];
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
  onSelectAllIngredients: () => void;
  onClearIngredientSelection: () => void;
};

export function LocationSearchPanel({
  form,
  setForm,
  displayedErrors,
  market,
  rankingPaused = false,
  isEditingLocation,
  focusMealPreferencesToken,
  onEditLocation,
  onResetLocationState,
  onZipSearch,
  onBrowserSearch,
  onRankMeals,
  selectedIngredientIds,
  onToggleIngredient,
  onSelectAllIngredients,
  onClearIngredientSelection,
}: LocationSearchPanelProps) {
  const mealPreferencesRef = useRef<HTMLDivElement>(null);
  const showCollapsedLocation = Boolean(market) && !isEditingLocation;

  useEffect(() => {
    if (focusMealPreferencesToken === 0 || !market) {
      return;
    }

    const panel = mealPreferencesRef.current;
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }

    const budgetInput = document.getElementById("budget-cap");
    budgetInput?.focus();
  }, [focusMealPreferencesToken, market]);

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs location-panel">
      {showCollapsedLocation ? (
        <CollapsedLocationSummary
          form={form}
          market={market!}
          onEditLocation={onEditLocation}
        />
      ) : (
        <>
          <h2>Step 1: Find nearby stores</h2>
          <p className="panel-copy">
            Enter any continental US ZIP or use browser location. Yum4Less shows
            nearby stores on the map. For the current production release, ranked
            dinner estimates focus on Kroger-family and Aldi when daily ingest and
            promotion gates pass. Other chains may appear as context; ranked
            pricing for them is planned in upcoming releases.
          </p>

          <div className="form-grid">
            <FormField
              id="zip-code"
              label="ZIP code"
              error={displayedErrors.zipCode}
              helpHint={zipCodeHelp}
              hint="Continental US ZIP codes are supported in beta."
            >
              <input
                id="zip-code"
                aria-invalid={displayedErrors.zipCode ? true : undefined}
                value={form.zipCode}
                onChange={(event) =>
                  setForm((current) => {
                    onResetLocationState();
                    return { ...current, zipCode: event.target.value };
                  })
                }
              />
            </FormField>

            <FormField
              id="radius-miles"
              label="Radius in miles"
              error={displayedErrors.radiusMiles}
              helpHint={radiusHelp}
            >
              <input
                id="radius-miles"
                aria-invalid={displayedErrors.radiusMiles ? true : undefined}
                min={1}
                max={25}
                step={1}
                type="number"
                value={form.radiusMiles}
                onChange={(event) =>
                  setForm((current) => {
                    onResetLocationState();
                    return { ...current, radiusMiles: event.target.value };
                  })
                }
              />
            </FormField>
          </div>

          <div className="action-row">
            <button className="primary-button" type="button" onClick={onZipSearch}>
              Find nearby stores
            </button>
            <button className="secondary-button" type="button" onClick={onBrowserSearch}>
              Use my location
            </button>
          </div>
        </>
      )}

      {market ? (
        <MealPreferencesPanel
          form={form}
          setForm={setForm}
          displayedErrors={displayedErrors}
          market={market}
          onRankMeals={onRankMeals}
          rankingPaused={rankingPaused}
          panelRef={mealPreferencesRef}
          selectedIngredientIds={selectedIngredientIds}
          onToggleIngredient={onToggleIngredient}
          onSelectAllIngredients={onSelectAllIngredients}
          onClearIngredientSelection={onClearIngredientSelection}
        />
      ) : null}
    </div>
  );
}

function CollapsedLocationSummary({
  market,
  form,
  onEditLocation,
}: {
  market: RecommendationExperience["market"];
  form: FormState;
  onEditLocation: () => void;
}) {
  const locationLabel =
    market.searchedZipCode?.trim() || form.zipCode.trim() || market.locationLabel;

  return (
    <div className="collapsed-location-summary">
      <div className="collapsed-location-summary-topline">
        <h2>Location set</h2>
        <button className="secondary-button" onClick={onEditLocation} type="button">
          Edit location
        </button>
      </div>
      <p className="collapsed-location-summary-copy">
        <strong>{locationLabel}</strong> · {market.radiusMiles} mi radius ·{" "}
        {market.nearbyStores.length} store(s) on the map
      </p>
      <p className="field-hint">{market.locationLabel}</p>
    </div>
  );
}

type MealPreferencesPanelProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  displayedErrors: FieldErrors;
  market: RecommendationExperience["market"];
  onRankMeals: () => void;
  rankingPaused: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  selectedIngredientIds: string[];
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
  onSelectAllIngredients: () => void;
  onClearIngredientSelection: () => void;
};

function MealPreferencesPanel({
  form,
  setForm,
  displayedErrors,
  market,
  onRankMeals,
  rankingPaused,
  panelRef,
  selectedIngredientIds,
  onToggleIngredient,
  onSelectAllIngredients,
  onClearIngredientSelection,
}: MealPreferencesPanelProps) {
  const ingredientFirst = form.planningMode === "ingredient-first";
  const rankButtonLabel = ingredientFirst
    ? "Suggest recipes using my selected ingredients"
    : "Rank dinner options";
  const rankDisabled =
    rankingPaused ||
    (ingredientFirst && selectedIngredientIds.length === 0);

  return (
    <div
      className="meal-preferences-panel"
      id="meal-preferences-step"
      ref={panelRef}
    >
      <h3>Step 2: Set meal preferences</h3>
      <p className="panel-copy">
        {ingredientFirst
          ? "Set your budget and shopping constraints first, then pick sale ingredients to cook with. Totals use ingested Kroger-family and Aldi data where gates pass—not live checkout."
          : "Choose your budget, ingredient limit, and store preference before ranking dinner options. Estimates use Kroger official online or weekly-ad data and Aldi weekly-ad data where available—not live checkout totals."}
      </p>

      <div className="form-grid">
        <FormField id="budget-cap" label="Budget cap" error={displayedErrors.budget}>
          <input
            id="budget-cap"
            aria-invalid={displayedErrors.budget ? true : undefined}
            min={5}
            max={40}
            step={0.5}
            type="number"
            value={form.budget}
            onChange={(event) =>
              setForm((current) => ({ ...current, budget: event.target.value }))
            }
          />
        </FormField>

        <FormField
          id="max-ingredients"
          label="Maximum ingredients"
          error={displayedErrors.maxIngredients}
        >
          <input
            id="max-ingredients"
            aria-invalid={displayedErrors.maxIngredients ? true : undefined}
            min={3}
            max={12}
            step={1}
            type="number"
            value={form.maxIngredients}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                maxIngredients: event.target.value,
              }))
            }
          />
        </FormField>

        <FormField
          id="dinners-wanted"
          label="Dinner options wanted"
          error={displayedErrors.dinnersWanted}
        >
          <input
            id="dinners-wanted"
            aria-invalid={displayedErrors.dinnersWanted ? true : undefined}
            min={1}
            max={4}
            step={1}
            type="number"
            value={form.dinnersWanted}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dinnersWanted: event.target.value,
              }))
            }
          />
        </FormField>

        <FormField id="shopping-style" label="Shopping style">
          <select
            id="shopping-style"
            value={form.shoppingStyle}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                shoppingStyle:
                  event.target.value as MealPreferenceForm["shoppingStyle"],
              }))
            }
          >
            <option value="single-store">Single store only</option>
            <option value="multi-store">Multiple stores allowed</option>
          </select>
        </FormField>

        <FormField id="dietary-focus" label="Dietary focus">
          <select
            id="dietary-focus"
            value={form.dietaryFocus}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dietaryFocus:
                  event.target.value as MealPreferenceForm["dietaryFocus"],
              }))
            }
          >
            <option value="anything">Anything</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="quick">Quick meals</option>
          </select>
        </FormField>

      </div>

      <details className="meal-planner-advanced-options">
        <summary>Advanced options</summary>
        <div className="meal-planner-advanced-options-body">
          <FormField
            id="planning-mode"
            label="Planning approach"
            hint={
              ingredientFirst
                ? "Switch here to rank full dinners without picking sale ingredients."
                : "Suggesting recipes from sale ingredients is the default beta path."
            }
          >
            <select
              id="planning-mode"
              value={form.planningMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  planningMode: event.target.value as FormState["planningMode"],
                  externalRecipeOptIn:
                    event.target.value === "ingredient-first"
                      ? current.externalRecipeOptIn
                      : false,
                }))
              }
            >
              <option value="ingredient-first">Suggest recipes from sale ingredients</option>
              <option value="standard">Rank full dinner options (alternate)</option>
            </select>
          </FormField>

          {!ingredientFirst ? (
            <div className="recipe-opt-in-panel">
              <label
                className="recipe-opt-in-label"
                htmlFor="external-recipe-opt-in-standard"
              >
                <input
                  checked={form.externalRecipeOptIn}
                  id="external-recipe-opt-in-standard"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      externalRecipeOptIn: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  Include TheMealDB recipes in ranking (opt-in — verify in store)
                </span>
              </label>
            </div>
          ) : null}
        </div>
      </details>

      {ingredientFirst ? (
        <>
          <div className="recipe-opt-in-panel">
            <label className="recipe-opt-in-label" htmlFor="external-recipe-opt-in">
              <input
                checked={form.externalRecipeOptIn}
                id="external-recipe-opt-in"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    externalRecipeOptIn: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                Also include TheMealDB recipes that match my sale ingredients
                (attribution required — verify prices in store)
              </span>
            </label>
            <p className="field-hint">
              Leave unchecked to rank from Yum4Less&apos;s internal recipe library
              only. TheMealDB meals are opt-in, not automatic.
            </p>
          </div>

          <div className="sale-ingredient-picker-shell sale-ingredient-picker-shell--primary">
            <h4>Step 3: Browse nearby sale ingredients</h4>
            <SaleIngredientPicker
              choices={market.saleIngredientChoices}
              selectedIngredientIds={selectedIngredientIds}
              onToggleIngredient={onToggleIngredient}
              onSelectAll={onSelectAllIngredients}
              onClearSelection={onClearIngredientSelection}
            />
          </div>
        </>
      ) : null}

      {rankingPaused ? (
        <p className="field-hint" role="status">
          Meal estimates are not available for this area yet. Review the map for
          store context and rollout labels.
        </p>
      ) : null}

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          onClick={onRankMeals}
          disabled={rankDisabled}
          aria-disabled={rankDisabled || undefined}
        >
          {rankButtonLabel}
        </button>
      </div>
      {ingredientFirst && selectedIngredientIds.length === 0 && !rankingPaused ? (
        <p className="field-hint" role="status">
          Select at least one sale ingredient, then use Suggest recipes.
        </p>
      ) : null}
    </div>
  );
}
