"use client";

import { useEffect, useRef } from "react";
import { MarketDiscoveryPanel } from "@/components/meal-planner/market-discovery-panel";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import type { DiscoveryMapModel } from "@/lib/nearby-stores-map-model";
import type { MarketSearchState } from "@/components/meal-planner/types";

type StoreMapOverlayProps = {
  open: boolean;
  market?: RecommendationExperience["market"];
  marketBlocked: boolean;
  marketSearchState: MarketSearchState;
  nearbyStoresMapModel?: DiscoveryMapModel;
  selectedStoreId?: string;
  onClose: () => void;
  onStoreSelect: (storeId: string) => void;
};

export function StoreMapOverlay({
  open,
  market,
  marketBlocked,
  marketSearchState,
  nearbyStoresMapModel,
  selectedStoreId,
  onClose,
  onStoreSelect,
}: StoreMapOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="map-overlay" role="presentation">
      <button
        type="button"
        className="map-overlay-backdrop"
        aria-label="Close store map"
        onClick={onClose}
      />
      <div
        className="map-overlay-panel panel panel-padding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-map-overlay-title"
      >
        <div className="map-overlay-header">
          <h2 id="store-map-overlay-title">Store locations</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <MarketDiscoveryPanel
          market={market}
          marketBlocked={marketBlocked}
          marketSearchState={marketSearchState}
          nearbyStoresMapModel={nearbyStoresMapModel}
          onStoreSelect={onStoreSelect}
          selectedStoreId={selectedStoreId}
        />
      </div>
    </div>
  );
}
