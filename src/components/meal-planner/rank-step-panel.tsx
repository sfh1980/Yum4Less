"use client";

type RankStepPanelProps = {
  rankingPaused: boolean;
  rankLoading: boolean;
  onRankMeals: () => void;
};

export function RankStepPanel({
  rankingPaused,
  rankLoading,
  onRankMeals,
}: RankStepPanelProps) {
  const rankDisabled = rankingPaused || rankLoading;

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--rank">
      <h2>Rank dinners</h2>
      <p className="panel-copy">
        Tap below when you are ready. Yum4Less matches your sale ingredients to
        recipes using saved store prices at your selected store(s) — not live
        checkout totals. Always verify in store.
      </p>
      <p className="field-hint">
        The recipe list is not exhaustive. When TheMealDB meals appear, they come
        from the saved recipe catalog — not looked up live while you browse.
      </p>

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          onClick={onRankMeals}
          disabled={rankDisabled}
        >
          Suggest recipes for my store(s)
        </button>
      </div>
    </div>
  );
}
