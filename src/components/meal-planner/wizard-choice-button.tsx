"use client";

type WizardChoiceButtonProps = {
  label: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function WizardChoiceButton({
  label,
  description,
  selected = false,
  disabled = false,
  onClick,
}: WizardChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`wizard-choice${selected ? " wizard-choice--selected" : ""}`}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="wizard-choice-label">{label}</span>
      {description ? (
        <span className="wizard-choice-description">{description}</span>
      ) : null}
    </button>
  );
}
