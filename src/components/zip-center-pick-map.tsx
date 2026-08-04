"use client";

import { useEffect, useRef, useState } from "react";
import type { ZipCenterPickMapModel } from "@/lib/nearby-stores-map-model";
import { getMapBounds } from "@/lib/nearby-stores-map-model";

type ZipCenterPickMapProps = {
  model: ZipCenterPickMapModel;
  onMapClick: (coords: { latitude: number; longitude: number }) => void;
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

/**
 * Leaflet map for choosing a ZIP search-center pin. Pan/zoom freely; click
 * places the pending center. Separate from discovery/single-store maps.
 */
export function ZipCenterPickMap({ model, onMapClick }: ZipCenterPickMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const [mapError, setMapError] = useState<string>();

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
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

        const bounds = getMapBounds(model);
        const map =
          bounds.kind === "center"
            ? leaflet
                .map(containerRef.current, { zoomControl: true })
                .setView(bounds.center, bounds.zoom)
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

        const zipIcon = leaflet.divIcon({
          className: "store-map-marker-anchor-wrap",
          html: '<span class="store-map-marker-anchor zip-center-pick-zip-marker">ZIP</span>',
          iconSize: [40, 36],
          iconAnchor: [20, 18],
        });

        leaflet
          .marker([model.zipFocus.latitude, model.zipFocus.longitude], {
            icon: zipIcon,
            zIndexOffset: 200,
            opacity: 0.85,
          })
          .addTo(map)
          .bindTooltip(
            `<strong>${model.zipFocus.label}</strong><br/>ZIP area reference`,
            { direction: "top", opacity: 0.95 },
          );

        if (model.pendingCenter) {
          const actionColor = readThemeToken("--action", "#d85a30");
          leaflet
            .circle(
              [model.pendingCenter.latitude, model.pendingCenter.longitude],
              {
                radius: model.radiusMiles * 1609.34,
                color: actionColor,
                fillColor: actionColor,
                fillOpacity: 0.14,
                weight: 2,
                dashArray: "6 4",
              },
            )
            .addTo(map);

          const centerIcon = leaflet.divIcon({
            className: "store-map-marker-anchor-wrap",
            html: '<span class="store-map-marker-anchor">Center</span>',
            iconSize: [52, 36],
            iconAnchor: [26, 18],
          });

          leaflet
            .marker(
              [model.pendingCenter.latitude, model.pendingCenter.longitude],
              {
                icon: centerIcon,
                zIndexOffset: 1000,
              },
            )
            .addTo(map)
            .bindTooltip(
              `<strong>Search center</strong><br/>${model.radiusMiles} mi radius`,
              { direction: "top", opacity: 0.95 },
            );
        }

        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          onMapClickRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });

        const syncMapSize = () => {
          map.invalidateSize();
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
            : "The search-center map could not load.",
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
    };
    // Remount when ZIP focus or radius changes; pending pin updates remount so
    // the circle/marker stay in sync without a separate layer store.
  }, [model]);

  if (mapError) {
    return (
      <div className="nearby-stores-map-shell">
        <div className="card" role="alert">
          <h3 className="card-title">Map unavailable</h3>
          <p className="explanation">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nearby-stores-map-shell">
      <div
        aria-label="Choose search center on map"
        className="nearby-stores-map zip-center-pick-map"
        ref={containerRef}
        role="application"
      />
      <p className="field-hint map-marker-note">
        Drag to explore the ZIP area, then click to place your search center.
        Map ©{" "}
        <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
          OpenStreetMap
        </a>{" "}
        contributors.
      </p>
    </div>
  );
}
