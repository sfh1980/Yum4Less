"use client";

import { useState } from "react";
import {
  hasSavedAreaInterest,
  saveAreaInterest,
} from "@/lib/area-interest/save-area-interest";

export const AREA_INTEREST_BUTTON_LABEL = "Let us know you want dinners here";
export const AREA_INTEREST_THANKS =
  "Thanks. We saved this ZIP. We can't say when dinner estimates will be ready here.";

type MapOnlyCoverageNoticeProps = {
  reason: string;
  zip?: string;
};

/** Tier C reason, plus a ZIP-only waitlist button when the shopper typed a ZIP. */
export function MapOnlyCoverageNotice({ reason, zip }: MapOnlyCoverageNoticeProps) {
  return (
    <div data-testid="map-only-coverage-notice">
      <p className="wizard-copy" role="status">
        {reason}
      </p>
      {zip && /^\d{5}$/.test(zip) ? <AreaInterestControl zip={zip} /> : null}
    </div>
  );
}

function AreaInterestControl({ zip }: { zip: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(() =>
    hasSavedAreaInterest(zip) ? "saved" : "idle",
  );

  async function handleClick() {
    setStatus("saving");
    const result = await saveAreaInterest(zip);
    setStatus(result === "failed" ? "failed" : "saved");
  }

  return (
    <div className="wizard-choice-stack">
      <button
        className="secondary-button"
        disabled={status === "saving" || status === "saved"}
        onClick={() => {
          void handleClick();
        }}
        type="button"
      >
        {AREA_INTEREST_BUTTON_LABEL}
      </button>
      {status === "saved" ? (
        <p className="wizard-copy" role="status">
          {AREA_INTEREST_THANKS}
        </p>
      ) : null}
      {status === "failed" ? (
        <p className="field-error" role="alert">
          We couldn&apos;t save that ZIP. You can try again.
        </p>
      ) : null}
    </div>
  );
}
