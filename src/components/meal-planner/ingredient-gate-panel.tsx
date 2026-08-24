"use client";

import { WizardChoiceButton } from "@/components/meal-planner/wizard-choice-button";

export const USE_ALL_SALE_ITEMS_LABEL = "Use everything on sale";
export const PICK_SALE_ITEMS_LABEL = "Choose specific sale items";

const PANTRY_FOLLOW_UP =
  "Next, you can see if these additional items are in your pantry to give you more dinner options to choose from.";

type IngredientGatePanelProps = {
  ingredientCount: number;
  onPickManually: () => void;
  onUseAll: () => void;
};

export function IngredientGatePanel({
  ingredientCount,
  onPickManually,
  onUseAll,
}: IngredientGatePanelProps) {
  const itemWord = ingredientCount === 1 ? "item" : "items";

  return (
    <div className="ingredient-gate">
      <p className="panel-copy">
        We found <strong>{ingredientCount}</strong> {itemWord} on sale at the
        stores you chose.
      </p>
      <p className="panel-copy">Choose how to use them for dinner ideas:</p>

      <div className="wizard-choice-stack ingredient-gate-actions">
        <WizardChoiceButton
          label={USE_ALL_SALE_ITEMS_LABEL}
          description={`We'll use all of these sale items to suggest dinners. ${PANTRY_FOLLOW_UP}`}
          onClick={onUseAll}
        />
        <WizardChoiceButton
          label={PICK_SALE_ITEMS_LABEL}
          description={`You'll pick which sale items to use. ${PANTRY_FOLLOW_UP}`}
          onClick={onPickManually}
        />
      </div>

      <p className="field-hint ingredient-gate-trust">
        Dinner totals are <strong>estimates</strong>. Check prices in the store.
      </p>
    </div>
  );
}
