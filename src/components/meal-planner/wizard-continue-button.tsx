"use client";

type WizardContinueButtonProps = {
  disabled?: boolean;
  onClick: () => void;
  children?: string;
};

export function WizardContinueButton({
  disabled = false,
  onClick,
  children = "Continue",
}: WizardContinueButtonProps) {
  return (
    <button
      type="button"
      className="wizard-continue"
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">→</span>
      {children}
    </button>
  );
}
