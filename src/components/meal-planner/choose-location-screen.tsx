"use client";

import { HelpLegalLinks } from "@/components/help-legal-links";
import { WizardChoiceButton } from "@/components/meal-planner/wizard-choice-button";
import { RESET_PREFERENCES_BUTTON_LABEL } from "@/lib/reset-preferences-copy";

type ChooseLocationScreenProps = {
  gpsRequesting: boolean;
  gpsNotice?: string;
  onUseGps: () => void;
  onEnterZip: () => void;
  onFactoryReset: () => void;
};

export function ChooseLocationScreen({
  gpsRequesting,
  gpsNotice,
  onUseGps,
  onEnterZip,
  onFactoryReset,
}: ChooseLocationScreenProps) {
  return (
    <section className="wizard-screen" aria-labelledby="choose-location-title">
      <h1 id="choose-location-title" className="wizard-title">
        Let’s get started
      </h1>
      <p className="wizard-copy">How should we center your area?</p>

      <div className="wizard-choice-stack">
        <WizardChoiceButton
          label="Use GPS"
          description="More precise. Asks this browser for your location."
          disabled={gpsRequesting}
          onClick={onUseGps}
        />
        <WizardChoiceButton
          label="Enter ZIP code"
          description="Works without location access."
          disabled={gpsRequesting}
          onClick={onEnterZip}
        />
      </div>

      {gpsRequesting ? (
        <p className="wizard-copy" role="status">
          Asking for your location…
        </p>
      ) : null}

      {gpsNotice ? (
        <p className="field-error" role="alert">
          {gpsNotice}
        </p>
      ) : null}

      <p className="wizard-hint">
        GPS centers you more precisely in one tap. ZIP works without location
        access.
      </p>

      <div className="settings-danger-zone">
        <button className="secondary-button" type="button" onClick={onFactoryReset}>
          {RESET_PREFERENCES_BUTTON_LABEL}
        </button>
      </div>

      <HelpLegalLinks includeFeedback={false} />
    </section>
  );
}
