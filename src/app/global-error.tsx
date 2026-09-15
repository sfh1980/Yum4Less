"use client";

import { ServiceUnavailablePanel } from "@/components/service-unavailable-panel";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Root layout crash boundary — must include its own html/body.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell" style={{ padding: "2rem" }}>
          <ServiceUnavailablePanel
            title="Yum4Less could not load"
            body="The app hit a serious error before the page could finish loading. Try again — this is not a 'no grocery stores in your area' result."
            hint={
              error.digest
                ? `Reference: ${error.digest}`
                : "If this keeps happening after a refresh, the site or database may be down."
            }
            onRetry={reset}
          />
        </div>
      </body>
    </html>
  );
}
