"use client";

import { useEffect, useRef } from "react";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { formatStoreKind } from "@/components/recommendation-demo/form-validation";
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

          return (
            <li key={store.id}>
              <button
                className={`nearby-stores-list-item${isSelected ? " is-selected" : ""}`}
                data-store-id={store.id}
                onClick={() => onStoreSelect(store.id)}
                type="button"
              >
                <span className="nearby-stores-list-item-topline">
                  <strong>{store.name}</strong>
                  <span
                    className={`store-status-pill${store.recommendationEnabled ? " is-ready" : " is-context"}`}
                  >
                    {store.recommendationEnabled
                      ? "Weekly ad prices"
                      : "Context only"}
                  </span>
                </span>
                <span className="nearby-stores-list-item-meta">
                  {store.chainLabel} · {formatStoreKind(store.kind)} ·{" "}
                  {store.distanceMiles} mi
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
          Saved weekly-ad prices feed ranked dinners when rollout allows
        </span>
        <span className="map-legend-item">
          <span className="map-legend-swatch is-context" />
          Nearby context only (coming soon, no live Walmart pricing, or no weekly ad rollout yet)
        </span>
      </div>
    </div>
  );
}
