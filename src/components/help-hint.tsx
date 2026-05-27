"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type HelpHintContent = {
  tooltip: string;
  popoverTitle?: string;
  popoverContent?: ReactNode;
};

type HelpHintProps = HelpHintContent & {
  id?: string;
  label: string;
};

export function HelpHint({
  id: idProp,
  label,
  tooltip,
  popoverTitle,
  popoverContent,
}: HelpHintProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const tooltipId = `${id}-tooltip`;
  const popoverId = `${id}-popover`;
  const popoverTitleId = `${id}-popover-title`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasPopover = Boolean(popoverContent);

  useEffect(() => {
    if (!popoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [popoverOpen]);

  function showTooltip() {
    setTooltipVisible(true);
  }

  function hideTooltip() {
    if (!popoverOpen) {
      setTooltipVisible(false);
    }
  }

  function handleTriggerClick() {
    if (!hasPopover) {
      return;
    }

    setPopoverOpen((current) => !current);
    setTooltipVisible(true);
  }

  return (
    <span className="help-hint" ref={rootRef}>
      <button
        aria-controls={hasPopover && popoverOpen ? popoverId : undefined}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        aria-expanded={hasPopover ? popoverOpen : undefined}
        aria-haspopup={hasPopover ? "dialog" : undefined}
        aria-label={label}
        className="help-hint-trigger"
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
            hideTooltip();
          }
        }}
        onClick={handleTriggerClick}
        onFocus={showTooltip}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        type="button"
      >
        ?
      </button>

      {tooltipVisible ? (
        <span className="help-hint-tooltip" id={tooltipId} role="tooltip">
          {tooltip}
        </span>
      ) : null}

      {hasPopover && popoverOpen ? (
        <div
          aria-labelledby={popoverTitle ? popoverTitleId : undefined}
          aria-modal="false"
          className="help-hint-popover"
          id={popoverId}
          role="dialog"
        >
          {popoverTitle ? (
            <p className="help-hint-popover-title" id={popoverTitleId}>
              {popoverTitle}
            </p>
          ) : null}
          <div className="help-hint-popover-copy">{popoverContent}</div>
          <button
            className="help-hint-popover-close secondary-button"
            onClick={() => setPopoverOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>
      ) : null}
    </span>
  );
}
