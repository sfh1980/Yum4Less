"use client";

import { useId, useState } from "react";
import type { MealRecommendation, RecommendationExperience } from "@/lib/recommendation-service";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import { MealRecommendationCard } from "@/components/meal-planner/meal-recommendation-card";
import type { ActiveLocationRequest, FormState } from "@/components/meal-planner/types";

type MealResultsAccordionProps = {
  ariaLabel: string;
  recommendations: MealRecommendation[];
  form: FormState;
  market: RecommendationExperience["market"];
  activeLocationRequest?: ActiveLocationRequest;
  onOpenStoreMap: (store: NearbyStoreSummary | null) => void;
};

export function MealResultsAccordion({
  ariaLabel,
  recommendations,
  form,
  market,
  activeLocationRequest,
  onOpenStoreMap,
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
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
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
                  market={market}
                  meal={meal}
                  onOpenStoreMap={onOpenStoreMap}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
