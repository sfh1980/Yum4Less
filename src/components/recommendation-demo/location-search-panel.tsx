"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { listSelectableRecipeSources } from "@/lib/recipe-sources/recipe-source-registry";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";
import { FormField } from "@/components/recommendation-demo/form-field";
import { radiusHelp, recipeSourceHelp, zipCodeHelp } from "@/lib/help-hint-content";
import type { FieldErrors, FormState } from "@/components/recommendation-demo/types";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

type LocationSearchPanelProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  displayedErrors: FieldErrors;
  market?: RecommendationExperience["market"];
  isEditingLocation: boolean;
  focusMealPreferencesToken: number;
  onEditLocation: () => void;
  onResetLocationState: () => void;
  onZipSearch: () => void;
  onBrowserSearch: () => void;
  onRankMeals: () => void;
};

export function LocationSearchPanel({
  form,
  setForm,
  displayedErrors,
  market,
  isEditingLocation,
  focusMealPreferencesToken,
  onEditLocation,
  onResetLocationState,
  onZipSearch,
  onBrowserSearch,
  onRankMeals,
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
            Start by setting the local market first. Once Yum4Less knows your ZIP
            or current location and radius, it can show nearby stores on the map
            before you apply meal-specific filters. Ranked meal prices use saved
            weekly ads for supported chains—not live checkout totals.
          </p>

          <div className="form-grid">
            <FormField
              id="zip-code"
              label="ZIP code"
              error={displayedErrors.zipCode}
              helpHint={zipCodeHelp}
              hint="MVP starts with local ZIP 23111."
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
          onRankMeals={onRankMeals}
          panelRef={mealPreferencesRef}
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
  onRankMeals: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
};

function MealPreferencesPanel({
  form,
  setForm,
  displayedErrors,
  onRankMeals,
  panelRef,
}: MealPreferencesPanelProps) {
  return (
    <div
      className="meal-preferences-panel"
      id="meal-preferences-step"
      ref={panelRef}
    >
      <h3>Step 2: Set meal preferences</h3>
      <p className="panel-copy">
        Choose your budget, ingredient limit, and store preference before ranking
        dinner options. Ranked totals use saved weekly ads for supported
        chains—not live checkout.
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

        <FormField
          id="recipe-source"
          label="Recipe source"
          helpHint={recipeSourceHelp}
        >
          <select
            id="recipe-source"
            value={form.recipeSource}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recipeSource: event.target.value as RecipeSourceSelection,
              }))
            }
          >
            {listSelectableRecipeSources().map((source) => (
              <option
                key={source.id}
                value={source.id}
                disabled={source.availability !== "active"}
                title={source.summary}
              >
                {source.label}
                {source.availability !== "active" ? " (research only)" : ""}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="action-row">
        <button className="primary-button" type="button" onClick={onRankMeals}>
          Rank dinner options
        </button>
      </div>
    </div>
  );
}
