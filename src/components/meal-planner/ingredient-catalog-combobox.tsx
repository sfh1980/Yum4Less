"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CatalogIngredient } from "@/lib/ingredient-category";
import { filterIngredientCatalog } from "@/lib/ingredient-catalog-search";

type IngredientCatalogComboboxProps = {
  catalog: CatalogIngredient[];
  selectedIngredientIds: string[];
  onSelectIngredient: (ingredientId: string) => void;
};

export function IngredientCatalogCombobox({
  catalog,
  selectedIngredientIds,
  onSelectIngredient,
}: IngredientCatalogComboboxProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () =>
      filterIngredientCatalog(catalog, query).filter(
        (ingredient) => !selectedIngredientIds.includes(ingredient.id),
      ),
    [catalog, query, selectedIngredientIds],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  function selectIngredient(ingredientId: string) {
    onSelectIngredient(ingredientId);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && suggestions[activeIndex]) {
      event.preventDefault();
      selectIngredient(suggestions[activeIndex]!.id);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="ingredient-catalog-combobox">
      <label className="field-label" htmlFor={`${listboxId}-input`}>
        Add a pantry item
      </label>
      <input
        ref={inputRef}
        id={`${listboxId}-input`}
        className="text-input"
        type="search"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        placeholder="Search catalog ingredients"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && suggestions.length > 0 ? (
        <ul className="ingredient-catalog-suggestions" id={listboxId} role="listbox">
          {suggestions.map((ingredient, index) => (
            <li key={ingredient.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "ingredient-catalog-suggestion ingredient-catalog-suggestion--active"
                    : "ingredient-catalog-suggestion"
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectIngredient(ingredient.id)}
              >
                <span>{ingredient.name}</span>
                <span className="ingredient-catalog-suggestion-category">
                  {ingredient.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="field-hint">
        Pick a catalog ingredient — free text is not saved to your pantry list.
      </p>
    </div>
  );
}
