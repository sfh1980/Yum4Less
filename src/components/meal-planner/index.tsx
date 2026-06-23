"use client";

import Link from "next/link";
import { InternalDetailsModal } from "@/components/internal-details-modal";
import { InternalDetailsDevTrigger } from "@/components/meal-planner/internal-details-dev-trigger";
import { LocationSearchPanel } from "@/components/meal-planner/location-search-panel";
import { MarketDiscoveryPanel } from "@/components/meal-planner/market-discovery-panel";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { TrustExplainerModal } from "@/components/meal-planner/trust-explainer-modal";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import { isInternalDetailsUiEnabled } from "@/lib/show-internal-details-ui";
import { throwIfLocalhostVerificationRenderErrorRequested } from "@/lib/localhost-verification-triggers";

export function MealPlanner() {
  throwIfLocalhostVerificationRenderErrorRequested();
  const demo = useMealPlanner();
  const showInternalDetails = isInternalDetailsUiEnabled();

  return (
    <section className="meal-planner-grid" aria-label="Beta v1 dinner planning flow">
      <div className="meal-planner-grid-col meal-planner-grid-col--inputs">
        <LocationSearchPanel
          displayedErrors={demo.displayedErrors}
          focusMealPreferencesToken={demo.focusMealPreferencesToken}
          form={demo.form}
          isEditingLocation={demo.isEditingLocation}
          market={demo.market}
          marketSearchLoading={demo.marketSearchLoading}
          rankLoading={demo.rankLoading}
          rankingPaused={demo.marketBlocked}
          onBrowserSearch={demo.handleBrowserLocationSearch}
          onEditLocation={() => demo.setIsEditingLocation(true)}
          onRankMeals={demo.handleRankMeals}
          onResetLocationState={demo.resetLocationDependentState}
          onZipSearch={demo.handleZipSearch}
          selectedIngredientIds={demo.selectedIngredientIds}
          onToggleIngredient={demo.handleToggleIngredient}
          onSelectAllIngredients={demo.handleSelectAllIngredients}
          onClearIngredientSelection={demo.handleClearIngredientSelection}
          setForm={demo.setForm}
        />
      </div>

      <div className="meal-planner-grid-col meal-planner-grid-col--market">
        <MarketDiscoveryPanel
          market={demo.market}
          marketBlocked={demo.marketBlocked}
          marketSearchState={demo.marketSearchState}
          nearbyStoresMapModel={demo.nearbyStoresMapModel}
          onStoreSelect={demo.handleStoreSelect}
          selectedStoreId={demo.selectedStoreId}
        />
      </div>

      <div className="meal-planner-grid-col meal-planner-grid-col--meals">
        <MealResultsPanel
          activeLocationRequest={demo.activeLocationRequest}
          form={demo.form}
          market={demo.market}
          marketBlocked={demo.marketBlocked}
          marketSearchState={demo.marketSearchState}
          onOpenTrustExplainer={() => demo.setIsTrustExplainerOpen(true)}
          recommendationState={demo.recommendationState}
          recommendations={demo.recommendations}
          shopperNotice={demo.shopperNotice}
        />
      </div>

      <TrustExplainerModal
        open={demo.isTrustExplainerOpen}
        onClose={demo.handleTrustExplainerClose}
      />
      {showInternalDetails ? (
        <>
          <InternalDetailsDevTrigger
            onOpen={() => demo.setIsInternalDetailsOpen(true)}
          />
          <InternalDetailsModal
            open={demo.isInternalDetailsOpen}
            onClose={() => demo.setIsInternalDetailsOpen(false)}
            market={demo.market}
            recommendations={demo.recommendations}
          />
        </>
      ) : null}

      <footer className="meal-planner-footer-links">
        <Link className="text-link" href="/feedback">
          Send feedback or report a wrong price
        </Link>
      </footer>
    </section>
  );
}
