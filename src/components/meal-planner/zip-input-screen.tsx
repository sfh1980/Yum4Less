"use client";

import { useEffect, useRef } from "react";
import { FormField } from "@/components/meal-planner/form-field";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import { SEARCH_STORES_FOR_ZIP_ACTION } from "@/components/meal-planner/shopper-recovery-copy";
import { FAQ_SLUG } from "@/lib/faq-articles";

type ZipInputScreenProps = {
  zipCode: string;
  error?: string;
  notice?: string;
  storeListClearedNotice?: string;
  onZipCodeChange: (zipCode: string) => void;
  onSearchStoresForZip?: () => void;
  onContinue: () => void;
};

export function ZipInputScreen({
  zipCode,
  error,
  notice,
  storeListClearedNotice,
  onZipCodeChange,
  onSearchStoresForZip,
  onContinue,
}: ZipInputScreenProps) {
  const searchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (storeListClearedNotice) {
      searchRef.current?.focus();
    }
  }, [storeListClearedNotice]);

  return (
    <section className="wizard-screen" aria-labelledby="zip-input-title">
      <h1 id="zip-input-title" className="wizard-title">
        Enter your ZIP code
      </h1>
      <p className="wizard-copy">
        We’ll place a pin on the map next so you can center your search.
      </p>

      {notice ? (
        <p className="field-hint" role="alert">
          {notice}
        </p>
      ) : null}

      {storeListClearedNotice ? (
        <div role="alert">
          <p className="field-hint">{storeListClearedNotice}</p>
          {onSearchStoresForZip ? (
            <button
              ref={searchRef}
              className="primary-button"
              type="button"
              onClick={onSearchStoresForZip}
            >
              {SEARCH_STORES_FOR_ZIP_ACTION}
            </button>
          ) : null}
        </div>
      ) : null}

      <FormField
        id="wizard-zip-code"
        label="ZIP code"
        error={error}
        helpArticleSlug={FAQ_SLUG.zip}
        hint="Continental US ZIP codes are supported in beta."
      >
        <input
          id="wizard-zip-code"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-invalid={error ? true : undefined}
          autoFocus={Boolean(notice) && !storeListClearedNotice}
          value={zipCode}
          onChange={(event) => onZipCodeChange(event.target.value)}
        />
      </FormField>

      <WizardContinueButton onClick={onContinue} />
    </section>
  );
}
