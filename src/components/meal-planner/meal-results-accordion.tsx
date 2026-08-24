"use client";

import { useId, useState } from "react";
import type { MealRecommendation, RecommendationExperience } from "@/lib/recommendation-service";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { MealRecommendationCard } from "@/components/meal-planner/meal-recommendation-card";
import type { ActiveLocationRequest, FormState } from "@/components/meal-planner/types";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { savedMealIdFromRecommendation } from "@/lib/saved-meals";

type MealResultsAccordionProps = {
  ariaLabel: string;
  recommendations: MealRecommendation[];
  form: FormState;
  market: RecommendationExperience["market"];
  activeLocationRequest?: ActiveLocationRequest;
  onOpenStoreMap: (store: NearbyStoreSummary | null) => void;
  savedMealIds?: ReadonlySet<string>;
  onToggleSaveMeal?: (meal: MealRecommendation) => void;
};

function scrollMealIntoView(node: HTMLElement | null) {
  if (!node || typeof node.scrollIntoView !== "function") {
    return;
  }

  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (typeof node.scrollIntoView === "function") {
        node.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest",
        });
      }
    });
  });
}

export function MealResultsAccordion({
  ariaLabel,
  recommendations,
  form,
  market,
  activeLocationRequest,
  onOpenStoreMap,
  savedMealIds,
  onToggleSaveMeal,
}: MealResultsAccordionProps) {
  const baseId = useId();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section aria-label={ariaLabel} className="meal-results-accordion">
      {recommendations.map((meal, index) => {
        const isExpanded = expandedIndex === index;
        const panelId = `${baseId}-meal-${index}`;
        const triggerId = `${panelId}-trigger`;

        return (
          <div className="meal-results-accordion-item" key={`${meal.title}-${index}`}>
            <h3 className="meal-results-accordion-heading">
              <button
                type="button"
                id={triggerId}
                className="meal-results-accordion-trigger"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={(event) => {
                  const nextIndex = isExpanded ? null : index;
                  setExpandedIndex(nextIndex);
                  if (nextIndex === null) {
                    return;
                  }
                  const item = event.currentTarget.closest(
                    ".meal-results-accordion-item",
                  );
                  scrollMealIntoView(item instanceof HTMLElement ? item : null);
                }}
              >
                {meal.title}
              </button>
            </h3>
            {isExpanded ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="meal-results-accordion-panel"
              >
                <MealRecommendationCard
                  activeLocationRequest={activeLocationRequest}
                  form={form}
                  hideTitle
                  isSaved={savedMealIds?.has(savedMealIdFromRecommendation(meal))}
                  market={market}
                  meal={meal}
                  onOpenStoreMap={onOpenStoreMap}
                  onToggleSave={onToggleSaveMeal}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
