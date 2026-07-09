"use client";

import { useId, useState, type ReactNode } from "react";

type CollapsibleCardSectionProps = {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
};

export function CollapsibleCardSection({
  title,
  children,
  defaultExpanded = false,
}: CollapsibleCardSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <div className="card-section card-section--collapsible">
      <h4 className="card-section-heading">
        <button
          type="button"
          className="card-section-trigger"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
        >
          {title}
        </button>
      </h4>
      {expanded ? (
        <div id={panelId} className="card-section-panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}
