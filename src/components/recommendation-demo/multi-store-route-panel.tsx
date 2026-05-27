"use client";

import { useEffect, useState } from "react";
import type { ShoppingRoutePlan } from "@/lib/multi-store-shopping-route";
import type { RecommendationExperience } from "@/lib/recommendation-service";

type MultiStoreRoutePanelProps = {
  mealTitle: string;
  storeNames: string[];
  home: { latitude: number; longitude: number };
  nearbyStores: RecommendationExperience["market"]["nearbyStores"];
};

export function MultiStoreRoutePanel({
  mealTitle,
  storeNames,
  home,
  nearbyStores,
}: MultiStoreRoutePanelProps) {
  const [routeState, setRouteState] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; route: ShoppingRoutePlan }
    | { status: "error"; error: string }
  >({ status: "idle" });

  useEffect(() => {
    const stores = storeNames
      .map((storeName) => nearbyStores.find((store) => store.name === storeName))
      .filter((store): store is RecommendationExperience["market"]["nearbyStores"][number] =>
        Boolean(store),
      )
      .map((store) => ({
        storeName: store.name,
        latitude: store.latitude,
        longitude: store.longitude,
      }));

    if (stores.length === 0) {
      setRouteState({
        status: "error",
        error: "Store coordinates were not available for route planning.",
      });
      return;
    }

    const controller = new AbortController();
    setRouteState({ status: "loading" });

    void fetch("/api/shopping-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        home: {
          latitude: home.latitude,
          longitude: home.longitude,
          label: "Home",
        },
        stores,
      }),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | { ok: true; route: ShoppingRoutePlan }
          | { ok: false; error: string };

        if (!result.ok) {
          setRouteState({ status: "error", error: result.error });
          return;
        }

        setRouteState({ status: "ready", route: result.route });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRouteState({
          status: "error",
          error: "Could not build a multi-store route estimate.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [home.latitude, home.longitude, mealTitle, nearbyStores, storeNames]);

  return (
    <div className="card-section">
      <h4>Suggested multi-store route</h4>
      {routeState.status === "loading" ? (
        <p className="field-hint">Calculating a home → stores → home route...</p>
      ) : null}
      {routeState.status === "error" ? (
        <p className="field-hint">{routeState.error}</p>
      ) : null}
      {routeState.status === "ready" ? (
        <>
          <p className="field-hint">{routeState.route.message}</p>
          <p className="field-hint">
            About {routeState.route.totalDistanceMiles.toFixed(1)} miles · ~
            {routeState.route.estimatedDriveMinutes} minute(s) driving ·{" "}
            {routeState.route.source === "osrm" ? "road routing" : "fallback estimate"}
          </p>
          <ol className="detail-list detail-list-numbered">
            {routeState.route.orderedStops.map((stop, index) => (
              <li key={`${mealTitle}-route-${stop.label}-${index}`}>
                {stop.kind === "home" ? "Home" : stop.label}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
