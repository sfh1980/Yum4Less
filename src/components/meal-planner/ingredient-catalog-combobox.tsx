"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CatalogIngredient } from "@/lib/ingredient-category";
import {
  filterIngredientCatalog,
  resolveIngredientFromCatalogQuery,
} from "@/lib/ingredient-catalog-search";

export type PantryIngredientAddResult = {
  ingredientId: string;
  ingredientName: string;
  nearMissRecipeCount: number;
};

type IngredientCatalogComboboxProps = {
  catalog: CatalogIngredient[];
  selectedIngredientIds: string[];
  nearMissRecipeCountByIngredientId?: ReadonlyMap<string, number>;
  onSelectIngredient: (result: PantryIngredientAddResult) => void;
};

function formatSuggestionList(suggestions: CatalogIngredient[]): string {
  return suggestions.map((ingredient) => ingredient.name).join(", ");
}

export function IngredientCatalogCombobox({
  catalog,
  selectedIngredientIds,
  nearMissRecipeCountByIngredientId,
  onSelectIngredient,
}: IngredientCatalogComboboxProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

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

  function buildAddResult(ingredient: CatalogIngredient): PantryIngredientAddResult {
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      nearMissRecipeCount:
        nearMissRecipeCountByIngredientId?.get(ingredient.id) ?? 0,
    };
  }

  function selectIngredient(ingredient: CatalogIngredient) {
    if (selectedIngredientIds.includes(ingredient.id)) {
      setFeedback({
        tone: "error",
        message: `${ingredient.name} is already in your pantry list.`,
      });
      return;
    }

    const result = buildAddResult(ingredient);
    onSelectIngredient(result);
    setQuery("");
    setIsOpen(false);
    setFeedback({
      tone: "success",
      message:
        result.nearMissRecipeCount > 0
          ? `Added ${ingredient.name} — helps ${result.nearMissRecipeCount} near-miss recipe${result.nearMissRecipeCount === 1 ? "" : "s"}.`
          : `Added ${ingredient.name} to your pantry for this session.`,
    });
    inputRef.current?.focus();
  }

  function attemptResolveQuery() {
    const trimmed = query.trim();
    if (!trimmed) {
      setFeedback({
        tone: "error",
        message: "Type an ingredient name to search the catalog.",
      });
      return;
    }

    const resolution = resolveIngredientFromCatalogQuery(catalog, trimmed);
    if (resolution.kind === "match") {
      selectIngredient(resolution.ingredient);
      return;
    }

    if (resolution.kind === "suggestions") {
      const available = resolution.suggestions.filter(
        (ingredient) => !selectedIngredientIds.includes(ingredient.id),
      );
      if (available.length === 1) {
        selectIngredient(available[0]!);
        return;
      }

      setFeedback({
        tone: "error",
        message:
          available.length > 0
            ? `We don't recognize "${trimmed}" — did you mean ${formatSuggestionList(available.slice(0, 3))}? Pick one from the list.`
            : `We don't recognize "${trimmed}". Pick a catalog ingredient from the suggestions.`,
      });
      setIsOpen(true);
      return;
    }

    setFeedback({
      tone: "error",
      message: `We don't recognize "${trimmed}". Try a different spelling or pick from the catalog suggestions.`,
    });
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

    if (event.key === "Enter") {
      event.preventDefault();
      if (isOpen && suggestions[activeIndex]) {
        selectIngredient(suggestions[activeIndex]!);
        return;
      }
      attemptResolveQuery();
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
      <div className="ingredient-catalog-input-row">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          className="text-input"
          type="search"
          role="combobox"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-describedby={`${listboxId}-feedback`}
          placeholder="Search catalog ingredients"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setFeedback(null);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="secondary-button ingredient-catalog-add-button"
          onClick={attemptResolveQuery}
        >
          Add
        </button>
      </div>
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
                onClick={() => selectIngredient(ingredient)}
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
      <p
        id={`${listboxId}-feedback`}
        className={
          feedback?.tone === "error"
            ? "field-error ingredient-catalog-feedback"
            : feedback?.tone === "success"
              ? "field-success ingredient-catalog-feedback"
              : "field-hint"
        }
        role={feedback?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {feedback?.message ??
          "Pick a catalog ingredient — unknown entries are not saved to your pantry list."}
      </p>
    </div>
  );
}
