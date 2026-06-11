"use client";

import { useEffect, useRef } from "react";
import type { NearbyStoresMapModel } from "@/lib/nearby-stores-map-model";
import { getMapBounds } from "@/lib/nearby-stores-map-model";
import { escapeHtml } from "@/lib/html-escape";
import {
  buildStoreMarkerIconHtml,
  getStoreMarkerStyle,
} from "@/lib/store-chain-marker-style";
import { buildStoreMapPricingLabel } from "@/lib/store-pricing-status-copy";
import { MAP_CATALOG_LOCATION_FOOTNOTE } from "@/lib/store-map-location-copy";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

type NearbyStoresMapProps = {
  model: NearbyStoresMapModel;
  selectedStoreId?: string;
  onStoreSelect?: (storeId: string) => void;
};

export function NearbyStoresMap({
  model,
  selectedStoreId,
  onStoreSelect,
}: NearbyStoresMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onStoreSelectRef = useRef(onStoreSelect);

  useEffect(() => {
    onStoreSelectRef.current = onStoreSelect;
  }, [onStoreSelect]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    const markers = markersRef.current;

    async function mountMap() {
      if (!containerRef.current || cancelled) {
        return;
      }

      const leaflet = await import("leaflet");

      if (!containerRef.current || cancelled) {
        return;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();

      const bounds = getMapBounds(model);
      const map =
        bounds.kind === "center"
          ? leaflet.map(containerRef.current, { zoomControl: true }).setView(bounds.center, bounds.zoom)
          : leaflet
              .map(containerRef.current, { zoomControl: true })
              .fitBounds([bounds.southWest, bounds.northEast], {
                padding: [32, 32],
                maxZoom: 14,
              });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
        .addTo(map);

      leaflet
        .circle([model.anchor.latitude, model.anchor.longitude], {
          radius: model.radiusMiles * 1609.34,
          color: "#75f0c0",
          fillColor: "#75f0c0",
          fillOpacity: 0.14,
          weight: 2,
          dashArray: "6 4",
        })
        .addTo(map)
        .bindTooltip(
          `<strong>${model.anchor.label}</strong><br/>${model.radiusMiles} mi search radius`,
          { direction: "top", opacity: 0.95 },
        );

      const anchorIcon = leaflet.divIcon({
        className: "store-map-marker-anchor-wrap",
        html: '<span class="store-map-marker-anchor">You</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      leaflet
        .marker([model.anchor.latitude, model.anchor.longitude], {
          icon: anchorIcon,
          zIndexOffset: 1000,
        })
        .addTo(map)
        .bindTooltip(
          `<strong>${model.anchor.label}</strong><br/>Search anchor · ${formatAnchorSource(model.anchor.source)}`,
          { direction: "top", opacity: 0.95, sticky: true },
        )
        .bindPopup(
          `<strong>${model.anchor.label}</strong><br/>Search anchor · ${formatAnchorSource(model.anchor.source)}<br/>${model.radiusMiles} mile radius`,
        );

      for (const store of model.stores) {
        const style = getStoreMarkerStyle({
          chain: store.chain,
          storeName: store.name,
          recommendationEnabled: store.recommendationEnabled,
        });
        const pricingLabel = buildStoreMapPricingLabel({
          chain: store.chain,
          recommendationEnabled: store.recommendationEnabled,
          rolloutStatus: store.rolloutStatus,
        });
        const safeName = escapeHtml(store.name);
        const safeChainLabel = escapeHtml(store.chainLabel);
        const safePricingLabel = escapeHtml(pricingLabel);
        const safeLocationNote = escapeHtml(store.locationNote);
        const icon = leaflet.divIcon({
          className: "store-map-marker-wrap",
          html: buildStoreMarkerIconHtml(style),
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = leaflet
          .marker([store.latitude, store.longitude], {
            icon,
            zIndexOffset: store.recommendationEnabled ? 500 : 100,
          })
          .addTo(map)
          .bindTooltip(
            `<strong>${safeName}</strong><br/>${safeChainLabel} · ${store.distanceMiles} mi<br/>${safePricingLabel}<br/><span style="opacity:0.85">${safeLocationNote}</span>`,
            { direction: "top", opacity: 0.95, sticky: true },
          )
          .bindPopup(buildStorePopupHtml(store, pricingLabel));

        marker.on("click", () => {
          onStoreSelectRef.current?.(store.id);
        });

        markersRef.current.set(store.id, marker);
      }

      const syncMapSize = () => {
        map.invalidateSize();
        if (bounds.kind === "bounds") {
          map.fitBounds([bounds.southWest, bounds.northEast], {
            padding: [32, 32],
            maxZoom: 14,
          });
        }
      };

      map.whenReady(syncMapSize);
      window.setTimeout(syncMapSize, 0);
      window.setTimeout(syncMapSize, 250);

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          syncMapSize();
        });
        resizeObserver.observe(containerRef.current);
      }

      mapRef.current = map;
    }

    void mountMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
      markers.clear();
    };
  }, [model]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedStoreId ? markersRef.current.get(selectedStoreId) : undefined;
    if (!map || !marker || !selectedStoreId) {
      return;
    }

    const latLng = marker.getLatLng();
    map.flyTo(latLng, Math.max(map.getZoom(), 13), {
      animate: !prefersReducedMotion(),
      duration: prefersReducedMotion() ? 0 : 0.75,
    });
    marker.openTooltip();
  }, [selectedStoreId]);

  return (
    <div className="nearby-stores-map-shell">
      <div
        aria-label="Nearby stores map"
        className="nearby-stores-map"
        ref={containerRef}
        role="application"
      />
      <p className="field-hint map-marker-note">
        {MAP_CATALOG_LOCATION_FOOTNOTE} Chain badges are abbreviations for quick
        recognition, not official store logos.
        {model.usesOsmCatalogData ? (
          <>
            {" "}
            Some store locations ©{" "}
            <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
              OpenStreetMap
            </a>{" "}
            contributors.
          </>
        ) : null}
      </p>
    </div>
  );
}

function buildStorePopupHtml(
  store: NearbyStoresMapModel["stores"][number],
  pricingLabel: string,
) {
  const safeName = escapeHtml(store.name);
  const safeChainLabel = escapeHtml(store.chainLabel);
  const safePricingLabel = escapeHtml(pricingLabel);
  const safeLocationNote = escapeHtml(store.locationNote);
  const safeRolloutNote = escapeHtml(store.rolloutNote);
  return `<strong>${safeName}</strong><br/>${safeChainLabel} · ${store.distanceMiles} mi<br/>${safePricingLabel}<br/><span style="opacity:0.85">${safeLocationNote}</span><br/><span style="opacity:0.85">${safeRolloutNote}</span>`;
}

function formatAnchorSource(source: NearbyStoresMapModel["anchor"]["source"]) {
  switch (source) {
    case "browser":
      return "Browser location anchor";
    case "zip":
      return "ZIP lookup anchor";
    default:
      return "Local seed anchor";
  }
}
