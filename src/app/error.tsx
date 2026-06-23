"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="panel panel-padding meal-planner-panel" role="alert">
      <h2>Something went wrong</h2>
      <p className="panel-copy">
        Yum4Less hit an unexpected error while loading this page. Refresh the
        browser or try again — your location search has not been saved to the
        server.
      </p>
      {error.digest ? (
        <p className="field-hint">Reference: {error.digest}</p>
      ) : null}
      <div className="action-row">
        <button className="primary-button" type="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
