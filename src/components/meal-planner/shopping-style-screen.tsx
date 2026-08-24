"use client";

import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { WizardChoiceButton } from "@/components/meal-planner/wizard-choice-button";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";

type ShoppingStyleScreenProps = {
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  onShoppingStyleChange: (shoppingStyle: MealPreferenceForm["shoppingStyle"]) => void;
  onContinue: () => void;
};

export function ShoppingStyleScreen({
  shoppingStyle,
  onShoppingStyleChange,
  onContinue,
}: ShoppingStyleScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="shopping-style-title">
      <h1 id="shopping-style-title" className="wizard-title">
        How do you shop?
      </h1>
      <p className="wizard-copy">
        You can change this later in Settings.
      </p>

      <div
        className="wizard-choice-stack"
        role="radiogroup"
        aria-labelledby="shopping-style-title"
      >
        <WizardChoiceButton
          label="One store"
          description="Shop at a single store."
          selected={shoppingStyle === "single-store"}
          onClick={() => onShoppingStyleChange("single-store")}
        />
        <WizardChoiceButton
          label="Several stores"
          description="Shop at more than one store."
          selected={shoppingStyle === "multi-store"}
          onClick={() => onShoppingStyleChange("multi-store")}
        />
      </div>

      <WizardContinueButton onClick={onContinue} />
    </section>
  );
}
