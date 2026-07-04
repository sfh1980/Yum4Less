"use client";

import { useEffect, useRef } from "react";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { formatStoreKind } from "@/components/meal-planner/form-validation";
import { buildStoreListStatusPill } from "@/lib/store-pricing-status-copy";
import { formatStoreNameWithLocation } from "@/lib/store-display-labels";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

type NearbyStoresListProps = {
  stores: NearbyStoreSummary[];
  selectedStoreId?: string;
  onStoreSelect: (storeId: string) => void;
};

export function NearbyStoresList({
  stores,
  selectedStoreId,
  onStoreSelect,
}: NearbyStoresListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!selectedStoreId || !listRef.current) {
      return;
    }

    const selectedItem = listRef.current.querySelector(
      `[data-store-id="${selectedStoreId}"]`,
    );
    selectedItem?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedStoreId]);

  if (stores.length === 0) {
    return (
      <div className="nearby-stores-list-empty">
        <p className="field-hint">No stores found inside this radius yet.</p>
      </div>
    );
  }

  return (
    <div className="nearby-stores-list-shell">
      <div className="nearby-stores-list-header">
        <h4>Nearby stores</h4>
        <p className="field-hint">
          {stores.length} store(s). Swipe sideways or select a card to highlight
          it on the map.
        </p>
      </div>

      <ul className="nearby-stores-list" ref={listRef}>
        {stores.map((store) => {
          const isSelected = store.id === selectedStoreId;
          const statusLabel = buildStoreListStatusPill({
            chain: store.chain,
            recommendationEnabled: store.recommendationEnabled,
            rolloutStatus: store.rolloutStatus,
          });

          return (
            <li key={store.id}>
              <button
                aria-label={buildStoreCardLabel(store, statusLabel, isSelected)}
                aria-pressed={isSelected}
                className={`nearby-stores-list-item${isSelected ? " is-selected" : ""}`}
                data-store-id={store.id}
                onClick={() => onStoreSelect(store.id)}
                type="button"
              >
                <span className="nearby-stores-list-item-topline">
                  <strong>{formatStoreNameWithLocation(store)}</strong>
                  <span
                    className={`store-status-pill${store.recommendationEnabled ? " is-ready" : " is-context"}`}
                  >
                    {statusLabel}
                  </span>
                </span>
                <span className="nearby-stores-list-item-meta">
                  {store.chainLabel} · {formatStoreKind(store.kind)} ·{" "}
                  {store.distanceMiles} mi · {store.locationBadge}
                </span>
                <span className="nearby-stores-list-item-note">
                  {store.locationNote}
                </span>
                <span className="nearby-stores-list-item-note">{store.rolloutNote}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div aria-label="Map marker legend" className="map-legend">
        <span className="map-legend-item">
          <span className="map-legend-swatch is-ready" />
          Chain-colored badges — est. dinner pricing when available
        </span>
        <span className="map-legend-item">
          <span className="map-legend-swatch is-context" />
          Gray badges — context only (no dinner totals yet)
        </span>
      </div>
    </div>
  );
}

function buildStoreCardLabel(
  store: NearbyStoreSummary,
  statusLabel: string,
  isSelected: boolean,
) {
  return [
    formatStoreNameWithLocation(store),
    store.chainLabel,
    formatStoreKind(store.kind),
    `${store.distanceMiles} miles away`,
    statusLabel,
    store.rolloutNote,
    isSelected ? "selected" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}
