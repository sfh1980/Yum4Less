import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { HelpHint } from "@/components/help-hint";
import type { FaqArticleSlug } from "@/lib/faq-articles";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  helpArticleSlug?: FaqArticleSlug;
  error?: string;
  children: ReactNode;
};

export function FormField({
  id,
  label,
  hint,
  helpArticleSlug,
  error,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const describedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
    });
  });

  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {helpArticleSlug ? (
          <HelpHint id={`${id}-help`} articleSlug={helpArticleSlug} />
        ) : null}
      </div>
      {describedChildren}
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
