"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { FormField } from "@/components/meal-planner/form-field";
import { MapPinIcon } from "@/components/map-pin-icon";
import { SingleStoreMapOverlay } from "@/components/single-store-map-overlay";
import {
  defaultSelectedStoreIdsForSettings,
  filterSettingsSelectableStores,
  membershipFromMarket,
} from "@/lib/settings-store-selection";
import {
  canonicalizeStoreIdsForSettings,
  isSettingsStoreIdSelected,
} from "@/lib/store-identity-settings-lookup";
import { formatSettingsStoreOptionLabel } from "@/lib/store-display-labels";
import {
  buildStoreCoverageHelpModel,
  formatStoreCoverageHelpOneLiner,
} from "@/lib/chain-coverage-honesty";
import { HelpLegalLinks } from "@/components/help-legal-links";
import { RESET_PREFERENCES_BUTTON_LABEL } from "@/lib/reset-preferences-copy";
import { FAQ_SLUG } from "@/lib/faq-articles";
import {
  FIND_STORES_BASED_ON_ZIP_LABEL,
  USE_GPS_LOCATION_LABEL,
} from "@/lib/zip-search-center-copy";
import type { FieldErrors, FormState, MarketSearchState } from "@/components/meal-planner/types";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import type { ThemePreference } from "@/lib/settings-preferences";

type SettingsPanelProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  displayedErrors: FieldErrors;
  market?: RecommendationExperience["market"];
  storeCatalog?: RecommendationExperience["market"];
  marketSearchLoading: boolean;
  marketSearchState: MarketSearchState;
  settingsSaveError?: string;
  zipCenterCancelNotice?: string;
  onFindStores: () => void;
  onBrowserSearch: () => void;
  onSaveSettings: () => void;
  onFactoryReset: () => void;
  onZipCodeChange: (zipCode: string) => void;
  onRadiusMilesChange: (radiusMiles: string) => void;
};

export function SettingsPanel({
  form,
  setForm,
  displayedErrors,
  market,
  storeCatalog,
  marketSearchLoading,
  marketSearchState,
  settingsSaveError,
  zipCenterCancelNotice,
  onFindStores,
  onBrowserSearch,
  onSaveSettings,
  onFactoryReset,
  onZipCodeChange,
  onRadiusMilesChange,
}: SettingsPanelProps) {
  const selectableStores = filterSettingsSelectableStores(
    (storeCatalog ?? market)?.nearbyStores ?? [],
    membershipFromMarket(storeCatalog ?? market),
  );
  const [storeMapTarget, setStoreMapTarget] = useState<
    (typeof selectableStores)[number] | null
  >(null);
  const [isStoreMapOpen, setIsStoreMapOpen] = useState(false);
  const storesReady = Boolean(market);
  const storesMissingGroceryPins = storesReady && selectableStores.length === 0;
  const canSaveSettings =
    storesReady &&
    form.selectedStoreIds.length > 0 &&
    (form.shoppingStyle !== "single-store" || form.selectedStoreIds.length === 1);

  function handleShoppingStyleChange(shoppingStyle: MealPreferenceForm["shoppingStyle"]) {
    setForm((current) => ({
      ...current,
      shoppingStyle,
      selectedStoreIds: defaultSelectedStoreIdsForSettings(
        selectableStores,
        shoppingStyle,
      ),
    }));
  }

  function handleSingleStoreChange(storeId: string) {
    const store = selectableStores.find((candidate) => candidate.id === storeId);
    if (storeId && !store) {
      return;
    }

    setForm((current) => ({
      ...current,
      selectedStoreIds: storeId
        ? canonicalizeStoreIdsForSettings([storeId])
        : [],
    }));
  }

  function handleMultiStoreToggle(storeId: string, checked: boolean) {
    const store = selectableStores.find((candidate) => candidate.id === storeId);
    if (!store) {
      return;
    }

    setForm((current) => {
      if (checked) {
        if (isSettingsStoreIdSelected(current.selectedStoreIds, storeId)) {
          return current;
        }
        return {
          ...current,
          selectedStoreIds: canonicalizeStoreIdsForSettings([
            ...current.selectedStoreIds,
            storeId,
          ]),
        };
      }

      return {
        ...current,
        selectedStoreIds: current.selectedStoreIds.filter(
          (id) => !isSettingsStoreIdSelected([id], storeId),
        ),
      };
    });
  }

  function handleOpenStoreMap(store: (typeof selectableStores)[number]) {
    setStoreMapTarget(store);
    setIsStoreMapOpen(true);
  }

  function handleCloseStoreMap() {
    setIsStoreMapOpen(false);
  }

  const selectedSingleStore = selectableStores.find((store) =>
    isSettingsStoreIdSelected(form.selectedStoreIds, store.id),
  );
  const storeCoverageHelp =
    storesReady && selectableStores.length > 0
      ? buildStoreCoverageHelpModel(selectableStores, form.selectedStoreIds)
      : null;

  return (
    <div className="panel panel-padding meal-planner-panel meal-planner-panel--inputs flow-panel flow-panel--settings">
      <h2>Settings</h2>
      <p className="panel-copy">
        Set location, radius, and store(s). Preferences stay on this device.
        Meal totals are estimates — verify in store.
      </p>

      <div className="form-grid">
        <FormField
          id="settings-zip-code"
          label="ZIP code"
          error={displayedErrors.zipCode}
          helpArticleSlug={FAQ_SLUG.zip}
          hint="Continental US ZIP codes are supported in beta."
        >
          <input
            id="settings-zip-code"
            aria-invalid={displayedErrors.zipCode ? true : undefined}
            value={form.zipCode}
            onChange={(event) => onZipCodeChange(event.target.value)}
          />
        </FormField>

        <FormField
          id="settings-radius-miles"
          label="Radius in miles"
          error={displayedErrors.radiusMiles}
          helpArticleSlug={FAQ_SLUG.radius}
        >
          <input
            id="settings-radius-miles"
            aria-invalid={displayedErrors.radiusMiles ? true : undefined}
            min={1}
            max={25}
            step={1}
            type="number"
            value={form.radiusMiles}
            onChange={(event) => onRadiusMilesChange(event.target.value)}
          />
        </FormField>

        <FormField id="settings-shopping-style" label="Shopping style">
          <select
            id="settings-shopping-style"
            value={form.shoppingStyle}
            onChange={(event) =>
              handleShoppingStyleChange(
                event.target.value as MealPreferenceForm["shoppingStyle"],
              )
            }
          >
            <option value="single-store">Single store only</option>
            <option value="multi-store">Multiple stores allowed</option>
          </select>
        </FormField>

        {storesReady ? (
          form.shoppingStyle === "single-store" ? (
            <FormField
              id="settings-selected-store"
              label="Store"
              helpArticleSlug={FAQ_SLUG.storeMapCoverage}
              hint={
                storeCoverageHelp
                  ? formatStoreCoverageHelpOneLiner(storeCoverageHelp)
                  : undefined
              }
            >
              <div className="settings-single-store-row">
                <select
                  id="settings-selected-store"
                  value={selectedSingleStore?.id ?? form.selectedStoreIds[0] ?? ""}
                  onChange={(event) => handleSingleStoreChange(event.target.value)}
                >
                  <option value="">Choose a store</option>
                  {selectableStores.map((store) => (
                    <option
                      key={store.id}
                      value={store.id}
                    >
                      {formatSettingsStoreOptionLabel(store)}
                      {!store.recommendationEnabled ? ` — ${store.rolloutNote}` : ""}
                    </option>
                  ))}
                </select>
                {selectedSingleStore ? (
                  <button
                    type="button"
                    className="secondary-button settings-show-on-map-button"
                    onClick={() => handleOpenStoreMap(selectedSingleStore)}
                  >
                    📍 Show on map
                  </button>
                ) : null}
              </div>
            </FormField>
          ) : (
            <FormField
              id="settings-selected-stores"
              label="Stores"
              helpArticleSlug={FAQ_SLUG.storeMapCoverage}
              hint={[
                "Pick one or more stores. Unselected stores stay hidden from the map and ingredient list.",
                storeCoverageHelp
                  ? formatStoreCoverageHelpOneLiner(storeCoverageHelp)
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="store-multi-select" id="settings-selected-stores">
                {selectableStores.map((store) => {
                  const checkboxId = `settings-store-${store.id}`;
                  const selected = isSettingsStoreIdSelected(
                    form.selectedStoreIds,
                    store.id,
                  );
                  const hasDinnerEstimates = store.recommendationEnabled;

                  return (
                    <div
                      key={store.id}
                      className={`store-multi-select-option${selected ? " store-multi-select-option--selected" : ""}`}
                    >
                      <input
                        id={checkboxId}
                        aria-label={`Select ${formatSettingsStoreOptionLabel(store)}`}
                        checked={selected}
                        onChange={(event) =>
                          handleMultiStoreToggle(store.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <label htmlFor={checkboxId} className="store-multi-select-label">
                        <span className="store-multi-select-name">
                          {formatSettingsStoreOptionLabel(store)}
                        </span>
                        {!hasDinnerEstimates ? (
                          <span className="store-multi-select-disabled-note">
                            {store.rolloutNote}
                          </span>
                        ) : null}
                      </label>
                      <button
                        type="button"
                        className="store-map-pin-button"
                        aria-label={`Show ${formatSettingsStoreOptionLabel(store)} on map`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenStoreMap(store);
                        }}
                      >
                        <MapPinIcon size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </FormField>
          )
        ) : null}

        {storesMissingGroceryPins ? (
          <p className="field-hint" role="status">
            No grocery stores showed up in this search area. Try a
            larger radius or another ZIP.
          </p>
        ) : null}

        <FormField id="settings-theme" label="Theme">
          <select
            id="settings-theme"
            value={form.theme}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                theme: event.target.value as ThemePreference,
              }))
            }
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </FormField>
      </div>

      {marketSearchLoading || marketSearchState.status === "loading" ? (
        <p className="panel-copy" role="status">
          Finding stores for this area…
        </p>
      ) : null}

      {marketSearchState.status === "error" ? (
        <p className="field-error" role="alert">
          {marketSearchState.error ?? "Could not find stores for your area."}
        </p>
      ) : null}

      {marketSearchState.status === "ready" && marketSearchState.notice ? (
        <p className="field-hint" role="status">
          {marketSearchState.notice}
        </p>
      ) : null}

      {zipCenterCancelNotice ? (
        <p className="field-hint" role="status">
          {zipCenterCancelNotice}
        </p>
      ) : null}

      {!storesReady ? (
        <div className="action-row">
          <button
            className="secondary-button"
            type="button"
            onClick={onBrowserSearch}
            disabled={marketSearchLoading}
          >
            {USE_GPS_LOCATION_LABEL}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onFindStores}
            disabled={marketSearchLoading}
          >
            {FIND_STORES_BASED_ON_ZIP_LABEL}
          </button>
        </div>
      ) : (
        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={onSaveSettings}
            disabled={!canSaveSettings || marketSearchLoading}
          >
            Save settings and continue
          </button>
        </div>
      )}

      {settingsSaveError ? (
        <p className="field-error" role="alert">
          {settingsSaveError}
        </p>
      ) : null}

      <div className="settings-danger-zone">
        <button className="secondary-button" type="button" onClick={onFactoryReset}>
          {RESET_PREFERENCES_BUTTON_LABEL}
        </button>
        <p className="field-hint">
          Clears saved Settings and returns to this screen — same as a first visit.
        </p>
      </div>

      <HelpLegalLinks />

      <SingleStoreMapOverlay
        isOpen={isStoreMapOpen}
        store={storeMapTarget}
        onClose={handleCloseStoreMap}
      />
    </div>
  );
}
