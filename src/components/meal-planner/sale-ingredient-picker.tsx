"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import type { SaleIngredientChoice } from "@/lib/sale-ingredient-offers";
import { formatIngredientPriceAge } from "@/lib/sale-ingredient-offers";
import {
  formatShopperPriceWording,
  shopperPriceTierFromOfferFields,
} from "@/lib/shopper-price-wording";
import { RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE } from "@/lib/ranked-price-cache-policy";
import type { IngredientCategory } from "@/lib/ingredient-category";
import { inferIngredientCategory } from "@/lib/ingredient-category";

type SaleIngredientPickerProps = {
  choices: SaleIngredientChoice[];
  selectedIngredientIds: string[];
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

type PickerRow = {
  ingredientId: string;
  ingredientName: string;
  storeId: string;
  storeName: string;
  price: number;
  trustLabel: "directional" | "estimated";
  saleLabel?: string;
  freshnessHoursAgo?: number;
  freshnessDaysAgo: number;
  priceSource?: string;
  category: IngredientCategory | null;
};

const CATEGORY_ORDER: IngredientCategory[] = [
  "protein",
  "produce",
  "dairy",
  "pantry",
  "seasoning",
  "baking",
  "frozen",
];

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  protein: "Protein",
  produce: "Produce",
  dairy: "Dairy",
  pantry: "Pantry",
  seasoning: "Seasoning",
  baking: "Baking",
  frozen: "Frozen",
};

function buildPickerRows(choices: SaleIngredientChoice[]): PickerRow[] {
  return choices.flatMap((choice) => {
    const category = inferIngredientCategory(choice.ingredientName);

    return choice.offers.map((offer) => ({
      ingredientId: choice.ingredientId,
      ingredientName: choice.ingredientName,
      storeId: offer.storeId,
      storeName: offer.storeName,
      price: offer.price,
      trustLabel: offer.trustLabel,
      saleLabel: offer.saleLabel ?? choice.saleLabel,
      freshnessHoursAgo: offer.freshnessHoursAgo ?? choice.freshnessHoursAgo,
      freshnessDaysAgo: offer.freshnessDaysAgo,
      priceSource: offer.priceSource,
      category,
    }));
  });
}

export function SaleIngredientPicker({
  choices,
  selectedIngredientIds,
  shoppingStyle,
  onToggleIngredient,
  onSelectAll,
  onClearSelection,
}: SaleIngredientPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<IngredientCategory | "all">("all");

  const rows = useMemo(() => buildPickerRows(choices), [choices]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (activeCategory !== "all" && row.category !== activeCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        row.ingredientName.toLowerCase().includes(query) ||
        row.storeName.toLowerCase().includes(query)
      );
    });
  }, [rows, searchQuery, activeCategory]);

  const availableCategories = useMemo(() => {
    const categories = new Set<IngredientCategory>();
    for (const row of rows) {
      if (row.category) {
        categories.add(row.category);
      }
    }

    return CATEGORY_ORDER.filter((category) => categories.has(category));
  }, [rows]);

  const useFlatList =
    shoppingStyle === "single-store" ||
    searchQuery.trim().length > 0 ||
    isNearSingleItemPerStore(filteredRows);

  const rowsByStore = useMemo(() => {
    if (useFlatList) {
      return null;
    }

    const grouped = new Map<string, PickerRow[]>();
    for (const row of filteredRows) {
      const current = grouped.get(row.storeId) ?? [];
      current.push(row);
      grouped.set(row.storeId, current);
    }

    return [...grouped.entries()].sort((left, right) =>
      (left[1][0]?.storeName ?? "").localeCompare(right[1][0]?.storeName ?? ""),
    );
  }, [filteredRows, useFlatList]);

  if (choices.length === 0) {
    return (
      <p className="field-hint" role="status">
        No sale or cached price ingredients are available for your selected store(s)
        yet. {RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE} Try another ZIP or check back
        later — prices refresh daily.
      </p>
    );
  }

  const selectedCount = selectedIngredientIds.length;

  return (
    <div className="sale-ingredient-picker">
      <div className="sale-ingredient-picker-header">
        <p className="panel-copy">
          Narrow to specific sale items if you want. Leave none checked to rank with
          all sale ingredients at your selected store(s). Totals stay{" "}
          <strong>estimated</strong> or <strong>directional</strong>.
        </p>
        <div className="action-row sale-ingredient-picker-actions">
          <button className="secondary-button" type="button" onClick={onSelectAll}>
            Select all
          </button>
          <button className="secondary-button" type="button" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      </div>

      <FormField id="sale-ingredient-search" label="Search ingredients">
        <input
          id="sale-ingredient-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by ingredient or store"
        />
      </FormField>

      {availableCategories.length > 0 ? (
        <div className="ingredient-category-chips" role="toolbar" aria-label="Ingredient categories">
          <button
            type="button"
            className={`chip-button${activeCategory === "all" ? " chip-button--active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`chip-button${activeCategory === category ? " chip-button--active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      ) : null}

      <p className="field-hint" role="status">
        {selectedCount} of {choices.length} ingredient(s) selected
        {searchQuery.trim() ? ` · ${filteredRows.length} row(s) shown` : ""}
      </p>

      {filteredRows.length === 0 ? (
        <p className="field-hint" role="status">
          No ingredients match your search or category filter.
        </p>
      ) : useFlatList ? (
        <ul className="sale-ingredient-list">
          {filteredRows.map((row) => renderRow(row, selectedIngredientIds, onToggleIngredient, true))}
        </ul>
      ) : (
        <div className="sale-ingredient-store-groups">
          {rowsByStore?.map(([storeId, storeRows]) => (
            <section key={storeId} className="sale-ingredient-store-group">
              <h3 className="sale-ingredient-store-heading">{storeRows[0]?.storeName}</h3>
              <ul className="sale-ingredient-list">
                {storeRows.map((row) =>
                  renderRow(row, selectedIngredientIds, onToggleIngredient, false),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function isNearSingleItemPerStore(rows: PickerRow[]): boolean {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.storeId, (counts.get(row.storeId) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return true;
  }

  return [...counts.values()].every((count) => count <= 1);
}

function renderRow(
  row: PickerRow,
  selectedIngredientIds: string[],
  onToggleIngredient: (ingredientId: string, checked: boolean) => void,
  showStoreTag: boolean,
) {
  const inputId = `sale-ingredient-${row.ingredientId}-${row.storeId}`;
  const checked = selectedIngredientIds.includes(row.ingredientId);
  const priceAgeLabel = formatIngredientPriceAge({
    freshnessHoursAgo: row.freshnessHoursAgo,
  });
  const priceLabel = formatShopperPriceWording(
    row.price,
    shopperPriceTierFromOfferFields({
      saleLabel: row.saleLabel,
      freshnessDaysAgo: row.freshnessDaysAgo,
      freshnessHoursAgo: row.freshnessHoursAgo,
      priceSource: row.priceSource,
      trustLabel: row.trustLabel,
    }),
  );

  return (
    <li key={`${row.ingredientId}-${row.storeId}`}>
      <label className="sale-ingredient-list-item" htmlFor={inputId}>
        <input
          checked={checked}
          id={inputId}
          onChange={(event) => onToggleIngredient(row.ingredientId, event.target.checked)}
          type="checkbox"
        />
        <span className="sale-ingredient-list-item-body">
          <span className="sale-ingredient-list-item-topline">
            <strong>{row.ingredientName}</strong>
            <span className="sale-ingredient-price">
              {priceLabel}
            </span>
          </span>
          <span className="field-hint">
            <span
              className={
                row.trustLabel === "directional" ? "badge-urgency" : "badge-trust"
              }
            >
              {row.trustLabel === "directional"
                ? "Sale price — estimate only"
                : "Online cache — estimated"}
            </span>
            {row.saleLabel ? ` · ${row.saleLabel}` : ""}
            {showStoreTag ? ` · ${row.storeName}` : ""}
          </span>
          {priceAgeLabel ? (
            <span className="field-hint sale-ingredient-freshness badge-trust">
              {priceAgeLabel}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
