"use client";

export function SavedPlaceholderPanel() {
  return (
    <div className="panel panel-padding meal-planner-panel flow-panel flow-panel--saved">
      <h2>Saved</h2>
      <p className="panel-copy">
        Saved meals and shopping lists are coming in a later release. For now,
        use the Cook tab after you rank dinners in a session.
      </p>
      <p className="field-hint" role="status">
        Coming soon — no saved data is stored yet.
      </p>
    </div>
  );
}
