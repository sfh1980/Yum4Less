"use client";

type MapOnlyCoverageNoticeProps = {
  reason: string;
};

/** One plain line after a location search finds stores but no ranked dinners. */
export function MapOnlyCoverageNotice({ reason }: MapOnlyCoverageNoticeProps) {
  return (
    <p className="wizard-copy" data-testid="map-only-coverage-notice" role="status">
      {reason}
    </p>
  );
}
