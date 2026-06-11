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
            <strong>Beta v1:</strong> Yum4Less is an early beta — read meal
            results as <strong>helpful estimates</strong>, not guaranteed final
            checkout totals.
          </p>
          <p>
            <strong>Chain coverage:</strong> the current production release
            ranks dinners from <strong>Kroger-family and Aldi</strong> when daily
            ingest and promotion gates pass. Other map pins (Publix, Food Lion,
            Walmart, OSM, and others) are context or coming in upcoming
            releases—not live-priced sources for meal totals today.
          </p>
          <p>
            <strong>Confidence labels</strong> explain how simple the shopping plan
            is. Single-store estimates are usually easier to follow; multi-store
            plans can save money but depend on more stops.
          </p>
          <p>
            <strong>Freshness</strong> tells you how recent the price information
            is. Ranked reads use a <strong>24-hour cache</strong> refreshed by daily
            ingest — fresher rows are stronger signals, but electronic shelf labels
            and checkout systems can still change before you shop. Older pricing is
            more directional.
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
            <strong>Kroger family and Aldi (production focus):</strong> ranked
            dinner estimates use official Kroger online prices and/or weekly-ad
            data when ingested near you and promotion gates pass. Totals are{" "}
            <strong>estimated and directional</strong>—verify in store.
          </p>
          <p>
            <strong>Other chains (upcoming releases):</strong> Publix, Food Lion,
            and additional retailers may appear on the map for context. Ranked
            pricing for them is not part of the current production release.
          </p>
          <p>
            <strong>Walmart and other map pins:</strong> may appear for nearby
            context only in this beta. Walmart never feeds ranked meal totals
            here; OSM and unsupported chains are map context only—not
            live-priced sources for meal totals.
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
