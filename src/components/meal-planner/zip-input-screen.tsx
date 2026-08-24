"use client";

import { FormField } from "@/components/meal-planner/form-field";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import { FAQ_SLUG } from "@/lib/faq-articles";

type ZipInputScreenProps = {
  zipCode: string;
  error?: string;
  notice?: string;
  onZipCodeChange: (zipCode: string) => void;
  onContinue: () => void;
};

export function ZipInputScreen({
  zipCode,
  error,
  notice,
  onZipCodeChange,
  onContinue,
}: ZipInputScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="zip-input-title">
      <h1 id="zip-input-title" className="wizard-title">
        Enter your ZIP code
      </h1>
      <p className="wizard-copy">
        We’ll place a pin on the map next so you can center your search.
      </p>

      {notice ? (
        <p className="field-hint" role="status">
          {notice}
        </p>
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
          value={zipCode}
          onChange={(event) => onZipCodeChange(event.target.value)}
        />
      </FormField>

      <WizardContinueButton onClick={onContinue} />
    </section>
  );
}
