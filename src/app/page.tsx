import { MealPlanner } from "@/components/meal-planner";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";
import { readPricedAreaCoverageSentence } from "@/lib/priced-area-coverage";

export default function HomePage() {
  return (
    <main className="app-page">
      <MealPlanner
        feedbackEnabled={isFeedbackEnabled()}
        pricedAreaCoverageSentence={readPricedAreaCoverageSentence()}
      />
    </main>
  );
}
