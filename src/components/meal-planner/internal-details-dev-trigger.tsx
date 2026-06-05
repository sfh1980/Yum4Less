"use client";

type InternalDetailsDevTriggerProps = {
  onOpen: () => void;
};

/** Dev/debug only — hidden unless NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS=1 */
export function InternalDetailsDevTrigger({ onOpen }: InternalDetailsDevTriggerProps) {
  return (
    <p className="internal-details-row internal-details-row--dev">
      <button
        className="internal-details-trigger"
        onClick={onOpen}
        type="button"
      >
        Project &amp; data details (internal)
      </button>
    </p>
  );
}
