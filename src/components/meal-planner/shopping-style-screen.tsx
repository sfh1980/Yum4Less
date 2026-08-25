"use client";

import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { WizardChoiceButton } from "@/components/meal-planner/wizard-choice-button";

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
  function selectStyle(next: MealPreferenceForm["shoppingStyle"]) {
    onShoppingStyleChange(next);
    onContinue();
  }

  return (
    <section className="wizard-screen" aria-labelledby="shopping-style-title">
      <h1 id="shopping-style-title" className="wizard-title">
        How do you shop?
      </h1>
      <p className="wizard-copy">
        You can change this later in Settings.
      </p>

      <div className="wizard-choice-stack">
        <WizardChoiceButton
          label="One store"
          description="Shop at a single store."
          selected={shoppingStyle === "single-store"}
          onClick={() => selectStyle("single-store")}
        />
        <WizardChoiceButton
          label="Several stores"
          description="Shop at more than one store."
          selected={shoppingStyle === "multi-store"}
          onClick={() => selectStyle("multi-store")}
        />
      </div>
    </section>
  );
}
