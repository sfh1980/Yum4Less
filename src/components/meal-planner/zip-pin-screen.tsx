"use client";

import { useEffect, useMemo, useState } from "react";
import { ZipCenterPickMap } from "@/components/zip-center-pick-map";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import { buildZipCenterPickMapModel } from "@/lib/nearby-stores-map-model";
import { ZIP_SEARCH_CENTER_INSTRUCTION } from "@/lib/zip-search-center-copy";
import { readZipSearchCenter } from "@/lib/zip-search-centers";

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

type ZipPinScreenProps = {
  zipCode: string;
  radiusMiles: number;
  onConfirm: (center: { latitude: number; longitude: number }) => void;
};

export function ZipPinScreen({
  zipCode,
  radiusMiles,
  onConfirm,
}: ZipPinScreenProps) {
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
    let cancelled = false;
    setGeocodeError(undefined);

    const cached = readZipSearchCenter(zipCode);
    if (cached) {
      setZipFocus({
        latitude: cached.latitude,
        longitude: cached.longitude,
        label: `ZIP ${zipCode}`,
      });
      setPendingCenter(cached);
      setGeocodeStatus("ready");
      return;
    }

    setGeocodeStatus("loading");
    setZipFocus(undefined);
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

        const focus = {
          latitude: result.location.latitude,
          longitude: result.location.longitude,
          label: `${result.location.city}, ${result.location.state}`,
        };
        setZipFocus(focus);
        setPendingCenter({
          latitude: focus.latitude,
          longitude: focus.longitude,
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
  }, [zipCode]);

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

  return (
    <section className="wizard-screen wizard-screen--map" aria-labelledby="zip-pin-title">
      <h1 id="zip-pin-title" className="wizard-title">
        Place your pin
      </h1>
      <p className="wizard-copy" role="status">
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
        <div className="wizard-pin-map">
          <ZipCenterPickMap
            model={mapModel}
            onMapClick={(coords) => setPendingCenter(coords)}
          />
        </div>
      ) : null}

      <WizardContinueButton
        disabled={!pendingCenter}
        onClick={() => {
          if (pendingCenter) {
            onConfirm(pendingCenter);
          }
        }}
      />
    </section>
  );
}
