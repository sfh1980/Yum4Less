import type { ReactNode } from "react";
import { HelpHint, type HelpHintContent } from "@/components/help-hint";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  helpHint?: HelpHintContent;
  error?: string;
  children: ReactNode;
};

export function FormField({
  id,
  label,
  hint,
  helpHint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {helpHint ? (
          <HelpHint id={`${id}-help`} label={`${label} help`} {...helpHint} />
        ) : null}
      </div>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
