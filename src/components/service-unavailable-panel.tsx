"use client";

type ServiceUnavailablePanelProps = {
  title?: string;
  body?: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * Honest infrastructure outage surface — not “no stores found.”
 * Used by page error boundaries and shopper panels when APIs return 503.
 */
export function ServiceUnavailablePanel({
  title = "Yum4Less is temporarily unavailable",
  body = "Store and meal prices are not loading right now. This is usually a connection or database issue — not your ZIP or search radius.",
  hint = "Wait a moment and try again. If you run the app yourself, make sure Postgres is up.",
  onRetry,
  retryLabel = "Try again",
}: ServiceUnavailablePanelProps) {
  return (
    <main className="panel panel-padding meal-planner-panel" role="alert">
      <h2>{title}</h2>
      <p className="panel-copy">{body}</p>
      {hint ? <p className="explanation">{hint}</p> : null}
      {onRetry ? (
        <div className="action-row">
          <button className="primary-button" type="button" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : null}
    </main>
  );
}
