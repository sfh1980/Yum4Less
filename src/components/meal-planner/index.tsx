"use client";

import { ThemeSync } from "@/components/theme-sync";
import { InternalDetailsModal } from "@/components/internal-details-modal";
import { AppChrome } from "@/components/meal-planner/app-chrome";
import { BottomNav } from "@/components/meal-planner/bottom-nav";
import { BudgetScreen } from "@/components/meal-planner/budget-screen";
import { ChooseLocationScreen } from "@/components/meal-planner/choose-location-screen";
import { DealsPanel } from "@/components/meal-planner/deals-panel";
import { DietaryScreen } from "@/components/meal-planner/dietary-screen";
import { FeedbackTabPanel } from "@/components/meal-planner/feedback-tab-panel";
import { InternalDetailsDevTrigger } from "@/components/meal-planner/internal-details-dev-trigger";
import { IngredientsMarketUnavailable } from "@/components/meal-planner/ingredients-market-unavailable";
import { IngredientsStepPanel } from "@/components/meal-planner/ingredients-step-panel";
import { LockedTabPanel } from "@/components/meal-planner/locked-tab-panel";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { PantryStepPanel } from "@/components/meal-planner/pantry-step-panel";
import { RadiusScreen } from "@/components/meal-planner/radius-screen";
import { RankLoadingOverlay } from "@/components/meal-planner/rank-loading-overlay";
import { SavedTabPanel } from "@/components/meal-planner/saved-tab-panel";
import { ShoppingStyleScreen } from "@/components/meal-planner/shopping-style-screen";
import { SplashScreen } from "@/components/meal-planner/splash-screen";
import { StoreMapOverlay } from "@/components/meal-planner/store-map-overlay";
import { StorePickerScreen } from "@/components/meal-planner/store-picker-screen";
import { ZipInputScreen } from "@/components/meal-planner/zip-input-screen";
import { ZipPinScreen } from "@/components/meal-planner/zip-pin-screen";
import { isAppTabContentReady } from "@/components/meal-planner/app-tab";
import {
  formatLockedTabMessage,
  previousOnboardingStep,
} from "@/components/meal-planner/onboarding-step";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import { isInternalDetailsUiEnabled } from "@/lib/show-internal-details-ui";
import { throwIfLocalhostVerificationRenderErrorRequested } from "@/lib/localhost-verification-triggers";

type MealPlannerProps = {
  feedbackEnabled?: boolean;
};

export function MealPlanner({ feedbackEnabled = false }: MealPlannerProps) {
  throwIfLocalhostVerificationRenderErrorRequested();
  const demo = useMealPlanner();
  const showInternalDetails = isInternalDetailsUiEnabled();
  const previousStep = previousOnboardingStep(
    demo.onboardingStep,
    demo.locationValidationMode === "browser" ? "geolocation" : "zip",
  );
  const showWizardBack =
    !demo.splashVisible &&
    demo.activeTab === "settings" &&
    previousStep !== null;
  const showDietaryBack =
    !demo.splashVisible &&
    demo.activeTab === "home" &&
    demo.flowStep === "welcome-dietary";
  const showBack = showWizardBack || showDietaryBack;

  const resultsPanel = (
    <MealResultsPanel
      activeLocationRequest={demo.activeLocationRequest}
      form={demo.form}
      market={demo.scopedMarket}
      marketBlocked={demo.marketBlocked}
      marketSearchState={demo.marketSearchState}
      onToggleSaveMeal={demo.handleToggleSaveMeal}
      recommendationState={demo.recommendationState}
      recommendations={demo.recommendations}
      savedMealIds={demo.savedMealIds}
      shopperNotice={demo.shopperNotice}
      supplementaryShopperNotices={demo.supplementaryShopperNotices}
      suppressInlineLoading={demo.rankLoading}
    />
  );

  const lockedMessage = formatLockedTabMessage(demo.remainingSetupSteps);
  const tabOptions = {
    settingsComplete: demo.settingsComplete,
    cookEnabled: demo.cookEnabled,
  };
  const homeReady = isAppTabContentReady("home", tabOptions);
  const dealsReady = isAppTabContentReady("deals", tabOptions);
  const cookReady = isAppTabContentReady("cook", tabOptions);
  const savedReady = isAppTabContentReady("saved", tabOptions);

  function renderSettingsWizard() {
    switch (demo.onboardingStep) {
      case "splash":
      case "choose-location":
        return (
          <ChooseLocationScreen
            gpsRequesting={demo.gpsRequesting}
            gpsNotice={demo.gpsNotice}
            onUseGps={demo.handleBrowserLocationSearch}
            onEnterZip={demo.handleEnterZipPath}
            onFactoryReset={demo.handleFactoryReset}
          />
        );
      case "zip-input":
        return (
          <ZipInputScreen
            zipCode={demo.form.zipCode}
            error={demo.displayedErrors.zipCode}
            notice={demo.gpsNotice}
            onZipCodeChange={demo.handleZipCodeChange}
            onContinue={demo.handleZipInputContinue}
          />
        );
      case "zip-pin":
        return (
          <ZipPinScreen
            zipCode={demo.form.zipCode.trim()}
            radiusMiles={Number(demo.form.radiusMiles) || 5}
            onConfirm={demo.handleZipPinCommit}
          />
        );
      case "radius":
        return (
          <RadiusScreen
            radiusMiles={demo.form.radiusMiles}
            error={demo.displayedErrors.radiusMiles}
            onRadiusMilesChange={demo.handleRadiusMilesChange}
            onContinue={demo.handleRadiusContinue}
          />
        );
      case "shopping-style":
        return (
          <ShoppingStyleScreen
            shoppingStyle={demo.form.shoppingStyle}
            onShoppingStyleChange={demo.handleShoppingStyleChange}
            onContinue={demo.handleShoppingStyleContinue}
          />
        );
      case "stores":
        return (
          <StorePickerScreen
            form={demo.form}
            setShoppingStyleSelection={demo.handleStoreSelectionChange}
            market={demo.market}
            marketSearchLoading={demo.marketSearchLoading}
            marketSearchState={demo.marketSearchState}
            settingsSaveError={demo.settingsSaveError}
            showFactoryReset
            onContinue={demo.handleSaveSettings}
            onFactoryReset={demo.handleFactoryReset}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <ThemeSync themePreference={demo.form.theme} />
      <AppChrome
        showBack={showBack}
        onBack={showDietaryBack ? demo.handleWelcomeBudgetBack : demo.handleWizardBack}
        theme={demo.form.theme}
        onToggleTheme={demo.handleToggleTheme}
      />
      <div className="app-shell-content">
        <div className="app-column">
          {demo.splashVisible ? (
            <SplashScreen onContinue={demo.handleDismissSplash} />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "home" && !homeReady ? (
            <LockedTabPanel title="Home" message={lockedMessage} />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "home" && homeReady ? (
            <section className="meal-planner-grid" aria-label="Home dinner planning flow">
              {demo.flowStep === "welcome-budget" ? (
                <BudgetScreen
                  form={demo.form}
                  setForm={demo.setForm}
                  error={demo.displayedErrors.budget}
                  onContinue={demo.handleCompleteWelcome}
                />
              ) : null}

              {demo.flowStep === "welcome-dietary" ? (
                <DietaryScreen
                  form={demo.form}
                  setForm={demo.setForm}
                  onContinue={demo.handleCompleteDietary}
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

              {demo.flowStep === "ingredients" && !demo.scopedMarket ? (
                <IngredientsMarketUnavailable
                  marketSearchLoading={demo.marketSearchLoading}
                  marketSearchState={demo.marketSearchState}
                />
              ) : null}

              {demo.flowStep === "pantry" ? (
                <PantryStepPanel
                  loading={demo.pantryCoverageState.status === "loading"}
                  error={demo.pantryCoverageState.error}
                  fullyCoveredRecipeCount={demo.pantryCoverageState.fullyCoveredRecipeCount}
                  eligibleRecipeCount={demo.pantryCoverageState.eligibleRecipeCount}
                  suggestedChecklist={demo.pantryCoverageState.suggestedChecklist}
                  pantryRows={demo.pantryRows}
                  selectedPantryIngredientIds={demo.pantryIngredientIds}
                  onToggleChecklistItem={demo.handleTogglePantryChecklistItem}
                  onRemovePantryIngredient={demo.handleRemovePantryIngredient}
                  rankingPaused={demo.marketBlocked}
                  rankLoading={demo.rankLoading}
                  onSuggestRecipes={demo.handleSuggestRecipesFromPantry}
                />
              ) : null}

              {demo.showResultsInHomeFlow ? resultsPanel : null}
            </section>
          ) : null}

          {!demo.splashVisible && demo.activeTab === "deals" && !dealsReady ? (
            <LockedTabPanel title="Deals" message={lockedMessage} />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "deals" && dealsReady ? (
            <DealsPanel
              market={demo.scopedMarket}
              marketSearchLoading={demo.marketSearchLoading}
              marketSearchState={demo.marketSearchState}
            />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "cook" && !cookReady ? (
            <LockedTabPanel
              title="Cook"
              message={
                demo.settingsComplete
                  ? "Suggest recipes on Home first"
                  : lockedMessage
              }
            />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "cook" && cookReady ? (
            <MealResultsPanel
              activeLocationRequest={demo.activeLocationRequest}
              form={demo.form}
              market={demo.scopedMarket}
              marketBlocked={demo.marketBlocked}
              marketSearchState={demo.marketSearchState}
              onToggleSaveMeal={demo.handleToggleSaveMeal}
              recommendationState={demo.recommendationState}
              recommendations={demo.recommendations}
              savedMealIds={demo.savedMealIds}
              shopperNotice={demo.shopperNotice}
              supplementaryShopperNotices={demo.supplementaryShopperNotices}
              suppressInlineLoading={demo.rankLoading}
              surface="cook"
            />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "saved" && !savedReady ? (
            <LockedTabPanel title="Saved" message={lockedMessage} />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "saved" && savedReady ? (
            <SavedTabPanel
              meals={demo.savedMeals}
              onRemove={demo.handleRemoveSavedMeal}
            />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "feedback" ? (
            <FeedbackTabPanel enabled={feedbackEnabled} />
          ) : null}

          {!demo.splashVisible && demo.activeTab === "settings"
            ? renderSettingsWizard()
            : null}

          <RankLoadingOverlay open={demo.rankLoading} />

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
        </div>
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
        onTabChange={demo.handleTabChange}
      />
    </div>
  );
}
