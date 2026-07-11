"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DiscoveryMapModel,
  MapStoreMarker,
  StoresMapModel,
} from "@/lib/nearby-stores-map-model";
import { getMapBounds } from "@/lib/nearby-stores-map-model";
import { escapeHtml } from "@/lib/html-escape";
import {
  buildStoreMarkerIconHtml,
  getStoreMarkerStyle,
} from "@/lib/store-chain-marker-style";
import { buildStoreMapPricingLabel } from "@/lib/store-pricing-status-copy";
import { MAP_CATALOG_LOCATION_FOOTNOTE } from "@/lib/store-map-location-copy";
import { formatStraightLineDistanceMiles } from "@/lib/store-display-labels";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { resolveSelectedMapMarkerId } from "@/lib/store-identity-map-pin-resolve";

type NearbyStoresMapProps = {
  model: StoresMapModel;
  selectedStoreId?: string;
  onStoreSelect?: (storeId: string) => void;
};

function readThemeToken(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }

  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export function NearbyStoresMap({
  model,
  selectedStoreId,
  onStoreSelect,
}: NearbyStoresMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onStoreSelectRef = useRef(onStoreSelect);
  const [mapError, setMapError] = useState<string>();

  useEffect(() => {
    onStoreSelectRef.current = onStoreSelect;
  }, [onStoreSelect]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    const markers = markersRef.current;
    setMapError(undefined);

    async function mountMap() {
      if (!containerRef.current || cancelled) {
        return;
      }

      try {
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

      if (model.kind === "discovery") {
        mountDiscoveryChrome(leaflet, map, model);
      }

      const stores =
        model.kind === "single-store" ? [model.store] : model.stores;

      for (const store of stores) {
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
        const safeLocationBadge = escapeHtml(store.locationBadge);
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
            `<strong>${safeName}</strong><br/>${safeChainLabel} · ${escapeHtml(formatStraightLineDistanceMiles(store.distanceMiles))}<br/>${safePricingLabel}<br/><span style="opacity:0.85">${safeLocationBadge} — ${safeLocationNote}</span>`,
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
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setMapError(
          error instanceof Error
            ? error.message
            : "The nearby stores map could not load.",
        );
      }
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
    const stores =
      model.kind === "single-store" ? [model.store] : model.stores;
    // Expand-aware highlight (Slice 5b): uses server equivalentStoreIds on
    // markers — no client known-pair lookup.
    const resolvedMarkerId = resolveSelectedMapMarkerId(selectedStoreId, stores);
    const marker = resolvedMarkerId
      ? markersRef.current.get(resolvedMarkerId)
      : undefined;
    if (!map || !marker || !resolvedMarkerId) {
      return;
    }

    const latLng = marker.getLatLng();
    map.flyTo(latLng, Math.max(map.getZoom(), 13), {
      animate: !prefersReducedMotion(),
      duration: prefersReducedMotion() ? 0 : 0.75,
    });
    marker.openTooltip();
  }, [selectedStoreId, model]);

  if (mapError) {
    return (
      <div className="nearby-stores-map-shell">
        <div className="card" role="alert">
          <h3 className="card-title">Map unavailable</h3>
          <p className="explanation">{mapError}</p>
          <p className="field-hint">
            Store list details are still available below the map area.
          </p>
        </div>
      </div>
    );
  }

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

function mountDiscoveryChrome(
  leaflet: typeof import("leaflet"),
  map: import("leaflet").Map,
  model: DiscoveryMapModel,
) {
  const actionColor = readThemeToken("--action", "#d85a30");

  leaflet
    .circle([model.anchor.latitude, model.anchor.longitude], {
      radius: model.radiusMiles * 1609.34,
      color: actionColor,
      fillColor: actionColor,
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
}

function buildStorePopupHtml(store: MapStoreMarker, pricingLabel: string) {
  const safeName = escapeHtml(store.name);
  const safeChainLabel = escapeHtml(store.chainLabel);
  const safePricingLabel = escapeHtml(pricingLabel);
  const safeLocationBadge = escapeHtml(store.locationBadge);
  const safeLocationNote = escapeHtml(store.locationNote);
  const safeRolloutNote = escapeHtml(store.rolloutNote);
  return `<strong>${safeName}</strong><br/>${safeChainLabel} · ${escapeHtml(formatStraightLineDistanceMiles(store.distanceMiles))}<br/>${safePricingLabel}<br/><span style="opacity:0.85">${safeLocationBadge} — ${safeLocationNote}</span><br/><span style="opacity:0.85">${safeRolloutNote}</span>`;
}

function formatAnchorSource(source: DiscoveryMapModel["anchor"]["source"]) {
  switch (source) {
    case "browser":
      return "Browser location anchor";
    case "zip":
      return "ZIP lookup anchor";
    default:
      return "Search anchor";
  }
}
