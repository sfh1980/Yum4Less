"use client";

import type { Dispatch, SetStateAction } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { WizardChoiceButton } from "@/components/meal-planner/wizard-choice-button";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import type { FormState } from "@/components/meal-planner/types";

const DIETARY_OPTIONS: {
  value: MealPreferenceForm["dietaryFocus"];
  label: string;
}[] = [
  { value: "anything", label: "Anything" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "quick", label: "Quick meals" },
];

type DietaryScreenProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onContinue: () => void;
};

export function DietaryScreen({ form, setForm, onContinue }: DietaryScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="dietary-title">
      <h1 id="dietary-title" className="wizard-title">
        Dietary focus
      </h1>
      <p className="wizard-copy">
        For this visit only — not saved in Settings.
      </p>

      <div
        className="wizard-choice-stack"
        role="radiogroup"
        aria-labelledby="dietary-title"
      >
        {DIETARY_OPTIONS.map((option) => (
          <WizardChoiceButton
            key={option.value}
            label={option.label}
            selected={form.dietaryFocus === option.value}
            onClick={() =>
              setForm((current) => ({
                ...current,
                dietaryFocus: option.value,
              }))
            }
          />
        ))}
      </div>

      <WizardContinueButton onClick={onContinue}>
        Continue to ingredients
      </WizardContinueButton>
    </section>
  );
}
