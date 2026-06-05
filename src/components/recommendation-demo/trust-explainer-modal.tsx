"use client";

import Link from "next/link";
import { useModalDialog } from "@/components/use-modal-dialog";

type TrustExplainerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TrustExplainerModal({ open, onClose }: TrustExplainerModalProps) {
  const modal = useModalDialog({ open, onClose });

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="trust-explainer-title"
        aria-modal="true"
        className="modal-card"
        onKeyDown={modal.onKeyDown}
        ref={modal.dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id="trust-explainer-title">How to read these results</h3>
          <button
            className="secondary-button"
            onClick={onClose}
            ref={modal.initialFocusRef}
            type="button"
          >
            Dismiss
          </button>
        </div>
        <div className="modal-copy">
          <p>
            <strong>Beta MVP:</strong> Yum4Less is still an early local MVP, so
            these meal results should be read as{" "}
            <strong>helpful estimates</strong>, not guaranteed final checkout
            totals.
          </p>
          <p>
            <strong>Chain coverage:</strong> only stores on the trusted rollout
            drive ranked meal pricing today. Other map pins may appear for nearby
            context only—not as live-priced sources for meal totals.
          </p>
          <p>
            <strong>Confidence labels</strong> explain how simple the shopping plan
            is. Single-store estimates are usually easier to follow; multi-store
            plans can save money but depend on more stops.
          </p>
          <p>
            <strong>Freshness</strong> tells you how recent the price information
            is. Online prices checked within the last hour are stronger signals,
            but electronic shelf labels and checkout systems can still change
            before you shop. Older pricing is more directional.
          </p>
          <p>
            <strong>Sale confidence</strong> on each line item tells you how much
            trust to place in an advertised deal. Weekly ads and recently checked
            online prices are not guaranteed checkout totals — verify current
            shelf tags in store.
          </p>
          <p>
            <strong>Fallback</strong> means the app kept working with backup data
            when a preferred source was unavailable. Look for labels like
            estimated, directional, or limited coverage before you shop.
          </p>
          <p>
            <strong>Food Lion and Aldi (beta):</strong> may appear on the map for
            nearby context.{" "}
            <strong>BETA: Food Lion and Aldi meal pricing is coming later</strong>
            —weekly-ad ingest uses the Flipp syndicated feed, but ranked dinners do
            not use these chains yet.
          </p>
          <p>
            <strong>Walmart (beta):</strong> may appear on the map for nearby
            context, but ranked meal pricing does not use Walmart yet in this
            beta. Live, current weekly-ad pricing from Walmart is not available
            for ranked dinners—do not treat Walmart as an actionable price source
            until Yum4Less enables it.
          </p>
          <p>
            Use these labels to judge how much confidence to place in a result
            before deciding what to cook or where to shop.
          </p>
          <p>
            <Link className="text-link" href="/feedback">
              Send feedback or report a wrong price
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
