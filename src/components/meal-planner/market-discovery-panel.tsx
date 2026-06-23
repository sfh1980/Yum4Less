"use client";

import type { ReactNode } from "react";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { NearbyStoresMap } from "@/components/nearby-stores-map";
import { NearbyStoresList } from "@/components/nearby-stores-list";
import type { NearbyStoresMapModel } from "@/lib/nearby-stores-map-model";
import { HelpHint } from "@/components/help-hint";
import { PricingTrustHeadsUpBanner } from "@/components/meal-planner/pricing-trust-heads-up";
import { nearbyStoresMapHelp } from "@/lib/help-hint-content";
import { buildMarketShopperBlockedStatus } from "@/lib/market-shopper-status";
import type { MarketSearchState } from "@/components/meal-planner/types";

type MarketDiscoveryPanelProps = {
  marketSearchState: MarketSearchState;
  market?: RecommendationExperience["market"];
  marketBlocked: boolean;
  nearbyStoresMapModel?: NearbyStoresMapModel;
  selectedStoreId?: string;
  onStoreSelect: (storeId: string) => void;
};

export function MarketDiscoveryPanel({
  marketSearchState,
  market,
  marketBlocked,
  nearbyStoresMapModel,
  selectedStoreId,
  onStoreSelect,
}: MarketDiscoveryPanelProps) {
  const blockedStatus = market ? buildMarketShopperBlockedStatus(market) : null;

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--market">
      <div className="panel-header">
        <div>
          <h2>Nearby stores</h2>
          <p className="panel-copy">
            Review store coverage on the map before selecting sale ingredients.
          </p>
        </div>
        <span className="badge">
          {marketSearchState.status === "loading"
            ? "Finding nearby stores..."
            : market
              ? `${market.nearbyStores.length} store(s) in radius`
              : "Choose a local market first"}
        </span>
      </div>

      <PricingTrustHeadsUpBanner instanceId="market" market={market} />

      {market?.mapDiscoveryNotice ? (
        <p className="field-hint map-discovery-notice" role="status">
          {market.mapDiscoveryNotice}
        </p>
      ) : null}

      {nearbyStoresMapModel && market ? (
        <div className="main-map-panel">
          <div className="panel-subheader-with-hint">
            <h3>Nearby stores map</h3>
            <HelpHint
              id="nearby-stores-map-help"
              label="Nearby stores map help"
              popoverContent={nearbyStoresMapHelp.popoverContent}
              popoverTitle={nearbyStoresMapHelp.popoverTitle}
              tooltip={nearbyStoresMapHelp.tooltip}
            />
          </div>
          <div className="map-discovery-layout">
            <NearbyStoresMap
              model={nearbyStoresMapModel}
              onStoreSelect={onStoreSelect}
              selectedStoreId={selectedStoreId}
            />
            <NearbyStoresList
              onStoreSelect={onStoreSelect}
              selectedStoreId={selectedStoreId}
              stores={market.nearbyStores}
            />
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="results-stack">
        {marketSearchState.status === "loading" ? (
          <StatusCard
            title="Looking for nearby stores"
            body="Yum4Less is resolving the local market first so the nearby-store list can anchor the later recommendation step."
          />
        ) : marketSearchState.status === "error" ? (
          <StatusCard
            title={marketSearchState.errorTitle ?? "We could not find nearby stores yet"}
            body={
              marketSearchState.error ??
              "Try another ZIP, a different radius, or browser location."
            }
            extra={
              marketSearchState.errorHint ? (
                <p className="explanation">{marketSearchState.errorHint}</p>
              ) : marketSearchState.providerConfigured === false ? (
                <p className="explanation">
                  ZIP lookup is limited to a short local list for now. Try a nearby
                  ZIP if this one does not work.
                </p>
              ) : null
            }
          />
        ) : !market ? (
          <StatusCard
            title="Choose a location to start"
            body="Search by ZIP or use your current browser location first. Yum4Less will show nearby stores before you pick sale ingredients."
          />
        ) : marketBlocked && blockedStatus ? (
          <StatusCard
            title={blockedStatus.title}
            body={blockedStatus.body}
            extra={
              blockedStatus.extra ? (
                <p className="explanation">{blockedStatus.extra}</p>
              ) : null
            }
            variant={
              blockedStatus.kind === "database-unavailable"
                ? "infrastructure"
                : "default"
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  body,
  extra,
  variant = "default",
}: {
  title: string;
  body: string;
  extra?: ReactNode;
  variant?: "default" | "infrastructure";
}) {
  return (
    <div
      className={
        variant === "infrastructure" ? "card card--infrastructure" : "card"
      }
    >
      <h3 className="card-title">{title}</h3>
      <p className="explanation">{body}</p>
      {extra}
    </div>
  );
}
