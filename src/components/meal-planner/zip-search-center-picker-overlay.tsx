"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/use-modal-dialog";
import { ZipCenterPickMap } from "@/components/zip-center-pick-map";
import { buildZipCenterPickMapModel } from "@/lib/nearby-stores-map-model";
import {
  ZIP_SEARCH_CENTER_CONFIRM_PROMPT,
  ZIP_SEARCH_CENTER_CONFIRM_REPICK,
  ZIP_SEARCH_CENTER_CONFIRM_YES,
  ZIP_SEARCH_CENTER_INSTRUCTION,
} from "@/lib/zip-search-center-copy";

type GeocodeZipOk = {
  ok: true;
  location: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    zipCode?: string;
  };
};

type GeocodeZipFail = {
  ok: false;
  error?: string;
};

type ZipSearchCenterPickerOverlayProps = {
  isOpen: boolean;
  zipCode: string;
  radiusMiles: number;
  onCancel: () => void;
  onConfirm: (center: { latitude: number; longitude: number }) => void;
};

export function ZipSearchCenterPickerOverlay({
  isOpen,
  zipCode,
  radiusMiles,
  onCancel,
  onConfirm,
}: ZipSearchCenterPickerOverlayProps) {
  const modal = useModalDialog({ open: isOpen, onClose: onCancel });
  const [geocodeStatus, setGeocodeStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [geocodeError, setGeocodeError] = useState<string>();
  const [zipFocus, setZipFocus] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  }>();
  const [pendingCenter, setPendingCenter] = useState<{
    latitude: number;
    longitude: number;
  }>();

  useEffect(() => {
    if (!isOpen) {
      setGeocodeStatus("idle");
      setGeocodeError(undefined);
      setZipFocus(undefined);
      setPendingCenter(undefined);
      return;
    }

    let cancelled = false;
    setGeocodeStatus("loading");
    setGeocodeError(undefined);
    setPendingCenter(undefined);

    void (async () => {
      try {
        const response = await fetch(
          `/api/geocode/zip?zip=${encodeURIComponent(zipCode)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as GeocodeZipOk | GeocodeZipFail;
        if (cancelled) {
          return;
        }
        if (!result.ok || !("location" in result)) {
          setGeocodeStatus("error");
          setGeocodeError(
            !result.ok && result.error
              ? result.error
              : "Could not look up that ZIP on the map.",
          );
          return;
        }
        setZipFocus({
          latitude: result.location.latitude,
          longitude: result.location.longitude,
          label: `${result.location.city}, ${result.location.state}`,
        });
        setGeocodeStatus("ready");
      } catch {
        if (cancelled) {
          return;
        }
        setGeocodeStatus("error");
        setGeocodeError("Could not look up that ZIP on the map.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, zipCode]);

  const mapModel = useMemo(
    () =>
      zipFocus
        ? buildZipCenterPickMapModel({
            latitude: zipFocus.latitude,
            longitude: zipFocus.longitude,
            label: zipFocus.label,
            radiusMiles,
            pendingCenter,
          })
        : undefined,
    [zipFocus, radiusMiles, pendingCenter],
  );

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="map-overlay zip-search-center-picker-overlay" role="presentation">
      <button
        type="button"
        className="map-overlay-backdrop"
        aria-label="Cancel store search"
        onClick={onCancel}
      />
      <div
        className="map-overlay-panel zip-search-center-picker-panel panel panel-padding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zip-search-center-picker-title"
        onKeyDown={modal.onKeyDown}
        ref={modal.dialogRef}
        tabIndex={-1}
      >
        <div className="map-overlay-header zip-search-center-picker-header">
          <h2 id="zip-search-center-picker-title">
            Search center for ZIP {zipCode}
          </h2>
          <button
            ref={modal.initialFocusRef}
            type="button"
            className="single-store-map-overlay-close"
            aria-label="Cancel"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <p className="panel-copy zip-search-center-picker-instruction" role="status">
          {ZIP_SEARCH_CENTER_INSTRUCTION}
        </p>

        {geocodeStatus === "loading" ? (
          <p className="field-hint" role="status">
            Loading map for ZIP {zipCode}…
          </p>
        ) : null}

        {geocodeStatus === "error" ? (
          <p className="field-error" role="alert">
            {geocodeError}
          </p>
        ) : null}

        {geocodeStatus === "ready" && mapModel ? (
          <div className="zip-search-center-picker-map">
            <ZipCenterPickMap
              model={mapModel}
              onMapClick={(coords) => setPendingCenter(coords)}
            />
          </div>
        ) : null}

        {pendingCenter ? (
          <div
            className="zip-search-center-picker-confirm"
            role="group"
            aria-label={ZIP_SEARCH_CENTER_CONFIRM_PROMPT}
          >
            <p className="panel-copy">{ZIP_SEARCH_CENTER_CONFIRM_PROMPT}</p>
            <div className="action-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => onConfirm(pendingCenter)}
              >
                {ZIP_SEARCH_CENTER_CONFIRM_YES}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingCenter(undefined)}
              >
                {ZIP_SEARCH_CENTER_CONFIRM_REPICK}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
