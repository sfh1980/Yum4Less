"use client";

import Link from "next/link";
import { InternalDetailsModal } from "@/components/internal-details-modal";
import { InternalDetailsDevTrigger } from "@/components/recommendation-demo/internal-details-dev-trigger";
import { LocationSearchPanel } from "@/components/recommendation-demo/location-search-panel";
import { MarketDiscoveryPanel } from "@/components/recommendation-demo/market-discovery-panel";
import { MealResultsPanel } from "@/components/recommendation-demo/meal-results-panel";
import { TrustExplainerModal } from "@/components/recommendation-demo/trust-explainer-modal";
import { useRecommendationDemo } from "@/components/recommendation-demo/use-recommendation-demo";
import { isInternalDetailsUiEnabled } from "@/lib/show-internal-details-ui";

export function RecommendationDemo() {
  const demo = useRecommendationDemo();
  const showInternalDetails = isInternalDetailsUiEnabled();

  return (
    <section className="meal-planner-grid" aria-label="Local dinner recommendation flow">
      <div className="meal-planner-grid-col meal-planner-grid-col--inputs">
        <LocationSearchPanel
          displayedErrors={demo.displayedErrors}
          focusMealPreferencesToken={demo.focusMealPreferencesToken}
          form={demo.form}
          isEditingLocation={demo.isEditingLocation}
          market={demo.market}
          onBrowserSearch={demo.handleBrowserLocationSearch}
          onEditLocation={() => demo.setIsEditingLocation(true)}
          onRankMeals={demo.handleRankMeals}
          onResetLocationState={demo.resetLocationDependentState}
          onZipSearch={demo.handleZipSearch}
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
