"use client";

export function RankLoadingOverlay() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rank-loading-overlay"
      role="status"
    >
      <div className="rank-loading-overlay-card">
        <h2>Suggesting recipes</h2>
        <p>
          Yum4Less is matching your sale ingredients to dinner ideas using saved
          store prices at your selected store(s).
        </p>
        <p className="field-hint">
          The list is not exhaustive. TheMealDB meals, when they appear, come from
          the saved recipe catalog — not looked up live while you browse.
        </p>
      </div>
    </div>
  );
}
