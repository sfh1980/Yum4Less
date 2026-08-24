import { MealPlanner } from "@/components/meal-planner";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";

export default function HomePage() {
  return (
    <main className="app-page">
      <MealPlanner feedbackEnabled={isFeedbackEnabled()} />
    </main>
  );
}
