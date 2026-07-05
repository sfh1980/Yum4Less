"use client";

import type { Dispatch, SetStateAction } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { FormField } from "@/components/meal-planner/form-field";
import type { FieldErrors, FormState } from "@/components/meal-planner/types";

type WelcomePanelProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  displayedErrors: FieldErrors;
  onContinue: () => void;
};

export function WelcomePanel({
  form,
  setForm,
  displayedErrors,
  onContinue,
}: WelcomePanelProps) {
  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--welcome">
      <h2>Welcome</h2>
      <p className="panel-copy">
        Choose your spending limit and dietary focus for this visit. You can
        change these anytime before ranking — they are not saved in Settings.
      </p>

      <div className="form-grid">
        <FormField
          id="welcome-budget-cap"
          label="How much do you want to spend?"
          error={displayedErrors.budget}
          hint="Per-dinner spending limit. Totals are estimates — verify in store."
        >
          <input
            id="welcome-budget-cap"
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

        <FormField id="welcome-dietary-focus" label="Dietary focus">
          <select
            id="welcome-dietary-focus"
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

      <div className="action-row">
        <button className="primary-button" type="button" onClick={onContinue}>
          Continue to ingredients
        </button>
      </div>
    </div>
  );
}
