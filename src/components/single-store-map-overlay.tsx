"use client";

import { useEffect, useMemo, useRef } from "react";
import { NearbyStoresMap } from "@/components/nearby-stores-map";
import { buildSingleStoreMapModel } from "@/lib/nearby-stores-map-model";
import { hasValidStoreCoordinates } from "@/lib/resolve-nearby-store-by-name";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { formatStoreNameWithLocation } from "@/lib/store-display-labels";

type SingleStoreMapOverlayProps = {
  store: NearbyStoreSummary | null;
  isOpen: boolean;
  onClose: () => void;
};

export function SingleStoreMapOverlay({
  store,
  isOpen,
  onClose,
}: SingleStoreMapOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mapReady = Boolean(store && hasValidStoreCoordinates(store));
  const mapModel = useMemo(
    () =>
      isOpen && mapReady && store ? buildSingleStoreMapModel(store) : undefined,
    [isOpen, mapReady, store],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const title = store ? formatStoreNameWithLocation(store) : "Store location";

  return (
    <div className="map-overlay single-store-map-overlay" role="presentation">
      <button
        type="button"
        className="map-overlay-backdrop"
        aria-label="Close store map"
        onClick={onClose}
      />
      <div
        className="map-overlay-panel single-store-map-overlay-panel panel panel-padding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="single-store-map-overlay-title"
      >
        <div className="map-overlay-header single-store-map-overlay-header">
          <h2 id="single-store-map-overlay-title">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="single-store-map-overlay-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {isOpen && store && mapModel ? (
          <div className="single-store-map-overlay-map">
            <NearbyStoresMap model={mapModel} selectedStoreId={store.id} />
          </div>
        ) : (
          <p className="field-hint single-store-map-overlay-fallback" role="status">
            Location not available for this store
          </p>
        )}
      </div>
    </div>
  );
}
