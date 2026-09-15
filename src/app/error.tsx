"use client";

import { ServiceUnavailablePanel } from "@/components/service-unavailable-panel";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <div className="page-shell">
      <ServiceUnavailablePanel
        title="Something went wrong"
        body="Yum4Less hit an unexpected error while loading this page. This is not the same as 'no stores nearby' — refresh or try again."
        hint={
          error.digest
            ? `Reference: ${error.digest}. Your location search has not been saved to the server.`
            : "Your location search has not been saved to the server."
        }
        onRetry={reset}
      />
    </div>
  );
}
