"use client";

import {
  CUISINE_CHIP_LABELS,
  visibleCuisineChips,
  type CuisineChipId,
  type CuisineFacetCounts,
} from "@/lib/cuisine-chips";

type CuisineChipToolbarProps = {
  cuisineFacetCounts: CuisineFacetCounts;
  selectedCuisineIds: CuisineChipId[];
  onToggleCuisine: (cuisineId: CuisineChipId) => void;
  onClearCuisines: () => void;
};

export function CuisineChipToolbar({
  cuisineFacetCounts,
  selectedCuisineIds,
  onToggleCuisine,
  onClearCuisines,
}: CuisineChipToolbarProps) {
  const visible = visibleCuisineChips(cuisineFacetCounts);
  if (visible.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedCuisineIds);

  return (
    <div className="cuisine-chip-toolbar">
      <p className="field-hint">Filter dinners by cuisine (optional)</p>
      <div className="ingredient-category-chips" role="toolbar" aria-label="Cuisine filters">
        <button
          type="button"
          className={`chip-button${selectedCuisineIds.length === 0 ? " chip-button--active" : ""}`}
          onClick={onClearCuisines}
        >
          Any cuisine
        </button>
        {visible.map((cuisineId) => (
          <button
            key={cuisineId}
            type="button"
            className={`chip-button${selectedSet.has(cuisineId) ? " chip-button--active" : ""}`}
            onClick={() => onToggleCuisine(cuisineId)}
            aria-pressed={selectedSet.has(cuisineId)}
          >
            {CUISINE_CHIP_LABELS[cuisineId]}
          </button>
        ))}
      </div>
    </div>
  );
}
