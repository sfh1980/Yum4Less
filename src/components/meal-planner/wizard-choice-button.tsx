"use client";

import type { Ref } from "react";

type WizardChoiceButtonProps = {
  label: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: () => void;
};

export function WizardChoiceButton({
  label,
  description,
  selected = false,
  disabled = false,
  buttonRef,
  onClick,
}: WizardChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`wizard-choice${selected ? " wizard-choice--selected" : ""}`}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      ref={buttonRef}
      onClick={onClick}
    >
      <span className="wizard-choice-label">{label}</span>
      {description ? (
        <span className="wizard-choice-description">{description}</span>
      ) : null}
    </button>
  );
}
