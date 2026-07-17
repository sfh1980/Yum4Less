"use client";

import type { MarketSearchState } from "@/components/meal-planner/types";

type IngredientsMarketUnavailableProps = {
  marketSearchLoading: boolean;
  marketSearchState: MarketSearchState;
};

/**
 * Home Ingredients gate when no scoped market is available.
 * Mirrors DealsPanel loading / error / empty treatment so Home never blanks.
 */
export function IngredientsMarketUnavailable({
  marketSearchLoading,
  marketSearchState,
}: IngredientsMarketUnavailableProps) {
  if (marketSearchLoading || marketSearchState.status === "loading") {
    return (
      <div className="panel panel-padding meal-planner-panel flow-panel">
        <h2>Ingredients</h2>
        <p className="panel-copy" role="status">
          Loading sale ingredients from your saved Settings…
        </p>
      </div>
    );
  }

  if (marketSearchState.status === "error") {
    return (
      <div className="panel panel-padding meal-planner-panel flow-panel">
        <h2>Ingredients</h2>
        <p className="field-error" role="alert">
          {marketSearchState.error ??
            "Could not load sale ingredients for your area."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel panel-padding meal-planner-panel flow-panel">
      <h2>Ingredients</h2>
      <p className="panel-copy">
        Complete Settings with a location and store selection to see sale
        ingredients for your selected store(s).
      </p>
    </div>
  );
}
