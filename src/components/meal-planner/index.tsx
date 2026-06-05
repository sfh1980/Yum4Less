"use client";

import { InternalDetailsModal } from "@/components/internal-details-modal";
import { InternalDetailsDevTrigger } from "@/components/meal-planner/internal-details-dev-trigger";
import { LocationSearchPanel } from "@/components/meal-planner/location-search-panel";
import { MarketDiscoveryPanel } from "@/components/meal-planner/market-discovery-panel";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { TrustExplainerModal } from "@/components/meal-planner/trust-explainer-modal";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import { isInternalDetailsUiEnabled } from "@/lib/show-internal-details-ui";

export function MealPlanner() {
  const planner = useMealPlanner();
  const showInternalDetails = isInternalDetailsUiEnabled();

  return (
    <section className="demo-grid" aria-label="Local dinner recommendation flow">
      <div className="demo-grid-col demo-grid-col--inputs">
        <LocationSearchPanel
          displayedErrors={planner.displayedErrors}
          focusMealPreferencesToken={planner.focusMealPreferencesToken}
          form={planner.form}
          isEditingLocation={planner.isEditingLocation}
          market={planner.market}
          onBrowserSearch={planner.handleBrowserLocationSearch}
          onEditLocation={() => planner.setIsEditingLocation(true)}
          onRankMeals={planner.handleRankMeals}
          onResetLocationState={planner.resetLocationDependentState}
          onZipSearch={planner.handleZipSearch}
          setForm={planner.setForm}
        />
      </div>

      <div className="demo-grid-col demo-grid-col--market">
        <MarketDiscoveryPanel
          market={planner.market}
          marketBlocked={planner.marketBlocked}
          marketSearchState={planner.marketSearchState}
          nearbyStoresMapModel={planner.nearbyStoresMapModel}
          onStoreSelect={planner.handleStoreSelect}
          selectedStoreId={planner.selectedStoreId}
        />
      </div>

      <div className="demo-grid-col demo-grid-col--meals">
        <MealResultsPanel
          activeLocationRequest={planner.activeLocationRequest}
          form={planner.form}
          market={planner.market}
          marketBlocked={planner.marketBlocked}
          marketSearchState={planner.marketSearchState}
          onOpenTrustExplainer={() => planner.setIsTrustExplainerOpen(true)}
          recommendationState={planner.recommendationState}
          recommendations={planner.recommendations}
          shopperNotice={planner.shopperNotice}
        />
      </div>

      <TrustExplainerModal
        open={planner.isTrustExplainerOpen}
        onClose={planner.handleTrustExplainerClose}
      />
      {showInternalDetails ? (
        <>
          <InternalDetailsDevTrigger
            onOpen={() => planner.setIsInternalDetailsOpen(true)}
          />
          <InternalDetailsModal
            open={planner.isInternalDetailsOpen}
            onClose={() => planner.setIsInternalDetailsOpen(false)}
            market={planner.market}
            recommendations={planner.recommendations}
          />
        </>
      ) : null}
    </section>
  );
}
