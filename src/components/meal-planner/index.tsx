"use client";

import Link from "next/link";
import { ThemeSync } from "@/components/theme-sync";
import { InternalDetailsModal } from "@/components/internal-details-modal";
import { BottomNav } from "@/components/meal-planner/bottom-nav";
import { DealsPanel } from "@/components/meal-planner/deals-panel";
import { InternalDetailsDevTrigger } from "@/components/meal-planner/internal-details-dev-trigger";
import { IngredientsStepPanel } from "@/components/meal-planner/ingredients-step-panel";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { PantryStepPanel } from "@/components/meal-planner/pantry-step-panel";
import { RankLoadingOverlay } from "@/components/meal-planner/rank-loading-overlay";
import { SavedPlaceholderPanel } from "@/components/meal-planner/saved-placeholder-panel";
import { SettingsPanel } from "@/components/meal-planner/settings-panel";
import { StoreMapOverlay } from "@/components/meal-planner/store-map-overlay";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import { WelcomePanel } from "@/components/meal-planner/welcome-panel";
import { isInternalDetailsUiEnabled } from "@/lib/show-internal-details-ui";
import { throwIfLocalhostVerificationRenderErrorRequested } from "@/lib/localhost-verification-triggers";

export function MealPlanner() {
  throwIfLocalhostVerificationRenderErrorRequested();
  const demo = useMealPlanner();
  const showInternalDetails = isInternalDetailsUiEnabled();

  const resultsPanel = (
    <MealResultsPanel
      activeLocationRequest={demo.activeLocationRequest}
      form={demo.form}
      market={demo.scopedMarket}
      marketBlocked={demo.marketBlocked}
      marketSearchState={demo.marketSearchState}
      recommendationState={demo.recommendationState}
      recommendations={demo.recommendations}
      shopperNotice={demo.shopperNotice}
      supplementaryShopperNotices={demo.supplementaryShopperNotices}
      suppressInlineLoading={demo.rankLoading}
    />
  );

  return (
    <div className="app-shell">
      <ThemeSync themePreference={demo.form.theme} />
      <div className="app-shell-content">
        {demo.activeTab === "home" ? (
          <section className="meal-planner-grid" aria-label="Home dinner planning flow">
            {demo.flowStep === "welcome" ? (
              <WelcomePanel
                displayedErrors={demo.displayedErrors}
                form={demo.form}
                onContinue={demo.handleCompleteWelcome}
                setForm={demo.setForm}
              />
            ) : null}

            {demo.flowStep === "ingredients" && demo.scopedMarket ? (
              <IngredientsStepPanel
                market={demo.scopedMarket}
                marketSearchLoading={demo.marketSearchLoading}
                rankingPaused={demo.marketBlocked}
                shoppingStyle={demo.form.shoppingStyle}
                ingredientPickMode={demo.ingredientPickMode}
                selectedIngredientIds={demo.selectedIngredientIds}
                onClearIngredientSelection={demo.handleClearIngredientSelection}
                onContinueToPantry={demo.handleContinueToPantry}
                onPickManually={demo.handlePickIngredientsManually}
                onSelectAllIngredients={demo.handleSelectAllIngredients}
                onToggleIngredient={demo.handleToggleIngredient}
                onUseAllIngredients={demo.handleUseAllIngredients}
              />
            ) : null}

            {demo.flowStep === "ingredients" &&
            !demo.scopedMarket &&
            demo.marketSearchLoading ? (
              <div className="panel panel-padding meal-planner-panel flow-panel">
                <h2>Ingredients</h2>
                <p className="panel-copy" role="status">
                  Loading sale ingredients from your saved Settings…
                </p>
              </div>
            ) : null}

            {demo.flowStep === "pantry" ? (
              <PantryStepPanel
                loading={demo.pantryCoverageState.status === "loading"}
                error={demo.pantryCoverageState.error}
                fullyCoveredRecipeCount={demo.pantryCoverageState.fullyCoveredRecipeCount}
                eligibleRecipeCount={demo.pantryCoverageState.eligibleRecipeCount}
                suggestedChecklist={demo.pantryCoverageState.suggestedChecklist}
                pantryRows={demo.pantryRows}
                ingredientCatalog={demo.ingredientCatalog}
                selectedPantryIngredientIds={demo.pantryIngredientIds}
                onToggleChecklistItem={demo.handleTogglePantryChecklistItem}
                onAddPantryIngredient={demo.handleAddPantryIngredient}
                onRemovePantryIngredient={demo.handleRemovePantryIngredient}
                rankingPaused={demo.marketBlocked}
                rankLoading={demo.rankLoading}
                onSuggestRecipes={demo.handleSuggestRecipesFromPantry}
              />
            ) : null}

            {demo.showResultsInHomeFlow ? resultsPanel : null}
          </section>
        ) : null}

        {demo.activeTab === "deals" ? (
          <DealsPanel
            market={demo.scopedMarket}
            marketSearchLoading={demo.marketSearchLoading}
            marketSearchState={demo.marketSearchState}
          />
        ) : null}

        {demo.activeTab === "cook" && demo.cookEnabled ? resultsPanel : null}

        {demo.activeTab === "saved" ? <SavedPlaceholderPanel /> : null}

        {demo.activeTab === "settings" ? (
          <SettingsPanel
            displayedErrors={demo.displayedErrors}
            form={demo.form}
            market={demo.market}
            marketSearchLoading={demo.marketSearchLoading}
            marketSearchState={demo.marketSearchState}
            settingsSaveError={demo.settingsSaveError}
            storeCatalog={demo.market}
            onBrowserSearch={demo.handleBrowserLocationSearch}
            onFactoryReset={demo.handleFactoryReset}
            onFindStores={demo.handleFindStores}
            onResetLocationState={demo.resetLocationDependentState}
            onSaveSettings={demo.handleSaveSettings}
            setForm={demo.setForm}
          />
        ) : null}

        {demo.rankLoading ? <RankLoadingOverlay /> : null}

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

        {demo.activeTab === "home" ? (
          <footer className="meal-planner-footer-links">
            <Link className="text-link" href="/feedback">
              Send feedback or report a wrong price
            </Link>
          </footer>
        ) : null}
      </div>

      {demo.showMapLink ? (
        <div className="map-link-bar">
          <button
            type="button"
            className="text-link map-link-button"
            onClick={demo.handleOpenMapOverlay}
          >
            Do you want to see store locations?
          </button>
        </div>
      ) : null}

      <StoreMapOverlay
        open={demo.isMapOverlayOpen}
        market={demo.scopedMarket}
        marketBlocked={demo.marketBlocked}
        marketSearchState={demo.marketSearchState}
        nearbyStoresMapModel={demo.nearbyStoresMapModel}
        onClose={demo.handleCloseMapOverlay}
        onStoreSelect={demo.handleStoreSelect}
        selectedStoreId={demo.selectedStoreId}
      />

      <BottomNav
        activeTab={demo.activeTab}
        cookEnabled={demo.cookEnabled}
        onTabChange={demo.handleTabChange}
      />
    </div>
  );
}
