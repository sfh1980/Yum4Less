"use client";

import { useState, type FormEvent } from "react";

type PantryPromptCardProps = {
  items: string[];
  onAddItem: (item: string) => void;
  onRemoveItem: (item: string) => void;
  onClearItems: () => void;
};

export function PantryPromptCard({
  items,
  onAddItem,
  onRemoveItem,
  onClearItems,
}: PantryPromptCardProps) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onAddItem(draft);
    setDraft("");
  }

  return (
    <div className="card pantry-prompt-card">
      <div className="pantry-prompt-header">
        <h3 className="card-title">Already have some ingredients?</h3>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide pantry entry" : "Add pantry items"}
        </button>
      </div>

      <p className="explanation">
        List staples you already have at home for this session only. Yum4Less does
        not save pantry items — they disappear when you reset the flow or leave.
      </p>

      {expanded ? (
        <form className="pantry-prompt-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="pantry-item-input">
            <span className="field-label-row">Pantry item</span>
            <input
              id="pantry-item-input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. olive oil, rice, salt"
              maxLength={80}
            />
          </label>
          <div className="action-row">
            <button className="primary-button" type="submit" disabled={!draft.trim()}>
              Add item
            </button>
            {items.length > 0 ? (
              <button className="secondary-button" type="button" onClick={onClearItems}>
                Clear session list
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {items.length > 0 ? (
        <ul className="pantry-item-list" aria-label="Session pantry items">
          {items.map((item) => (
            <li key={item} className="pantry-item-row">
              <span>{item}</span>
              <button
                type="button"
                className="text-link"
                onClick={() => onRemoveItem(item)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
