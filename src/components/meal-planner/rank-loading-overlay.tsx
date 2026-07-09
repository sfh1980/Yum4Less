"use client";

import { useModalDialog } from "@/components/use-modal-dialog";

type RankLoadingOverlayProps = {
  open: boolean;
  onClose?: () => void;
};

export function RankLoadingOverlay({
  open,
  onClose = () => undefined,
}: RankLoadingOverlayProps) {
  const modal = useModalDialog({ open, onClose });

  if (!open) {
    return null;
  }

  return (
    <div className="rank-loading-overlay" role="presentation">
      <div
        aria-busy="true"
        aria-labelledby="rank-loading-overlay-title"
        aria-live="polite"
        aria-modal="true"
        className="rank-loading-overlay-card"
        onKeyDown={modal.onKeyDown}
        ref={modal.dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          ref={modal.initialFocusRef}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
          type="button"
        >
          Suggesting recipes
        </button>
        <h2 id="rank-loading-overlay-title">Suggesting recipes</h2>
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
