"use client";

import type { Dispatch, SetStateAction } from "react";
import { FormField } from "@/components/meal-planner/form-field";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import type { FormState } from "@/components/meal-planner/types";

type BudgetScreenProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  error?: string;
  onContinue: () => void;
};

export function BudgetScreen({
  form,
  setForm,
  error,
  onContinue,
}: BudgetScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="budget-title">
      <h1 id="budget-title" className="wizard-title">
        How much do you want to spend?
      </h1>
      <p className="wizard-copy">
        Per-dinner spending limit for this visit. Totals are estimates — verify
        in store.
      </p>

      <FormField id="welcome-budget-cap" label="Spending limit" error={error}>
        <input
          id="welcome-budget-cap"
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

      <WizardContinueButton onClick={onContinue} />
    </section>
  );
}
