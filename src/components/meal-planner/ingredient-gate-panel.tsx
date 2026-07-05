"use client";

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
  return (
    <div className="ingredient-gate">
      <p className="panel-copy">
        We found <strong>{ingredientCount}</strong> sale ingredient
        {ingredientCount === 1 ? "" : "s"} at your selected store(s) from saved
        Settings. Store choice is already set — confirm how you want to scope
        ranking.
      </p>

      <div className="ingredient-gate-actions action-row">
        <button className="primary-button" type="button" onClick={onUseAll}>
          Use all {ingredientCount} sale ingredient{ingredientCount === 1 ? "" : "s"}
        </button>
        <button className="secondary-button" type="button" onClick={onPickManually}>
          Pick ingredients manually
        </button>
      </div>

      <p className="field-hint ingredient-gate-trust">
        Totals stay <strong>estimated</strong> or <strong>directional</strong> —
        verify price, package size, and tags in store before checkout.
      </p>
    </div>
  );
}
