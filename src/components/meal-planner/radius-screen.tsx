"use client";

import { FormField } from "@/components/meal-planner/form-field";
import { WizardContinueButton } from "@/components/meal-planner/wizard-continue-button";
import { FAQ_SLUG } from "@/lib/faq-articles";

type RadiusScreenProps = {
  radiusMiles: string;
  error?: string;
  onRadiusMilesChange: (radiusMiles: string) => void;
  onContinue: () => void;
};

export function RadiusScreen({
  radiusMiles,
  error,
  onRadiusMilesChange,
  onContinue,
}: RadiusScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="radius-title">
      <h1 id="radius-title" className="wizard-title">
        How far should we look?
      </h1>
      <p className="wizard-copy">
        Start at 5 miles and change it if you want. You can change this later in
        Settings.
      </p>

      <FormField
        id="wizard-radius-miles"
        label="Radius in miles"
        error={error}
        helpArticleSlug={FAQ_SLUG.radius}
      >
        <input
          id="wizard-radius-miles"
          min={1}
          max={25}
          step={1}
          type="number"
          value={radiusMiles}
          onChange={(event) => onRadiusMilesChange(event.target.value)}
        />
      </FormField>

      <WizardContinueButton onClick={onContinue} />
    </section>
  );
}
