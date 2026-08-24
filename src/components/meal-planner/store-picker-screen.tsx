"use client";

import { useState } from "react";
import { MapPinIcon } from "@/components/map-pin-icon";
import { SingleStoreMapOverlay } from "@/components/single-store-map-overlay";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import {
  filterSettingsSelectableStores,
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
import { StoreCoverageHelpHint } from "@/components/meal-planner/store-coverage-help-hint";
import type { FormState, MarketSearchState } from "@/components/meal-planner/types";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import type { MealPreferenceForm } from "@/lib/recommendation-service";

type StorePickerScreenProps = {
  form: FormState;
  setShoppingStyleSelection: (
    shoppingStyle: MealPreferenceForm["shoppingStyle"],
    selectedStoreIds: string[],
  ) => void;
  market?: RecommendationExperience["market"];
  marketSearchLoading: boolean;
  marketSearchState: MarketSearchState;
  settingsSaveError?: string;
  showFactoryReset: boolean;
  onContinue: () => void;
  onFactoryReset: () => void;
};

export function StorePickerScreen({
  form,
  setShoppingStyleSelection,
  market,
  marketSearchLoading,
  marketSearchState,
  settingsSaveError,
  showFactoryReset,
  onContinue,
  onFactoryReset,
}: StorePickerScreenProps) {
  const selectableStores = filterSettingsSelectableStores(market?.nearbyStores ?? []);
  const [storeMapTarget, setStoreMapTarget] = useState<
    (typeof selectableStores)[number] | null
  >(null);
  const [isStoreMapOpen, setIsStoreMapOpen] = useState(false);
  const storesReady = Boolean(market);
  const storesMissingRankedChains = storesReady && selectableStores.length === 0;
  const canSaveSettings =
    storesReady &&
    form.selectedStoreIds.length > 0 &&
    (form.shoppingStyle !== "single-store" || form.selectedStoreIds.length === 1);
  const storeCoverageHelp =
    storesReady && selectableStores.length > 0
      ? buildStoreCoverageHelpModel(selectableStores, form.selectedStoreIds)
      : null;

  function handleToggle(storeId: string, checked: boolean) {
    const store = selectableStores.find((candidate) => candidate.id === storeId);
    if (!store?.recommendationEnabled) {
      return;
    }

    if (form.shoppingStyle === "single-store") {
      setShoppingStyleSelection(
        form.shoppingStyle,
        checked ? canonicalizeStoreIdsForSettings([storeId]) : [],
      );
      return;
    }

    if (checked) {
      if (isSettingsStoreIdSelected(form.selectedStoreIds, storeId)) {
        return;
      }
      setShoppingStyleSelection(
        form.shoppingStyle,
        canonicalizeStoreIdsForSettings([...form.selectedStoreIds, storeId]),
      );
      return;
    }

    setShoppingStyleSelection(
      form.shoppingStyle,
      form.selectedStoreIds.filter(
        (id) => !isSettingsStoreIdSelected([id], storeId),
      ),
    );
  }

  return (
    <section className="wizard-screen" aria-labelledby="store-picker-title">
      <div className="wizard-title-with-hint">
        <h1 id="store-picker-title" className="wizard-title">
          Which stores should we use?
        </h1>
        {storeCoverageHelp ? (
          <StoreCoverageHelpHint id="wizard-store-coverage-help" />
        ) : null}
      </div>
      <p className="wizard-copy">
        Now we can start looking for dinner options.
      </p>
      {storeCoverageHelp ? (
        <p className="field-hint">{formatStoreCoverageHelpOneLiner(storeCoverageHelp)}</p>
      ) : null}

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

      {storesMissingRankedChains ? (
        <p className="field-hint" role="status">
          No stores with dinner estimates showed up in this search area. Go back
          and try a larger radius or another ZIP.
        </p>
      ) : null}

      {storesReady && selectableStores.length > 0 ? (
        <div className="store-multi-select" id="wizard-selected-stores">
          {selectableStores.map((store) => {
            const checkboxId = `wizard-store-${store.id}`;
            const selected = isSettingsStoreIdSelected(
              form.selectedStoreIds,
              store.id,
            );
            const storeSelectable = store.recommendationEnabled;

            return (
              <div
                key={store.id}
                className={`store-multi-select-option${selected ? " store-multi-select-option--selected" : ""}${!storeSelectable ? " store-multi-select-option--disabled" : ""}`}
                onClick={(event) => {
                  if (!storeSelectable) {
                    return;
                  }
                  const target = event.target as HTMLElement;
                  if (target.closest("input, label, .store-map-pin-button")) {
                    return;
                  }
                  handleToggle(store.id, !selected);
                }}
              >
                <input
                  id={checkboxId}
                  aria-label={`Select ${formatSettingsStoreOptionLabel(store)}`}
                  checked={selected && storeSelectable}
                  disabled={!storeSelectable}
                  onChange={(event) =>
                    handleToggle(store.id, event.target.checked)
                  }
                  type="checkbox"
                />
                <label htmlFor={checkboxId} className="store-multi-select-label">
                  <span className="store-multi-select-name">
                    {formatSettingsStoreOptionLabel(store)}
                    {selected && storeSelectable ? (
                      <span className="store-multi-select-selected-mark"> Selected</span>
                    ) : null}
                  </span>
                  {!storeSelectable ? (
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
                    setStoreMapTarget(store);
                    setIsStoreMapOpen(true);
                  }}
                >
                  <MapPinIcon size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {settingsSaveError ? (
        <p className="field-error" role="alert">
          {settingsSaveError}
        </p>
      ) : null}

      <WizardContinueButton disabled={!canSaveSettings} onClick={onContinue} />

      {showFactoryReset ? (
        <div className="settings-danger-zone">
          <button className="secondary-button" type="button" onClick={onFactoryReset}>
            {RESET_PREFERENCES_BUTTON_LABEL}
          </button>
          <p className="field-hint">
            Clears saved Settings and returns to setup — same as a first visit.
          </p>
        </div>
      ) : null}

      <HelpLegalLinks />

      <SingleStoreMapOverlay
        isOpen={isStoreMapOpen}
        store={storeMapTarget}
        onClose={() => setIsStoreMapOpen(false)}
      />
    </section>
  );
}
