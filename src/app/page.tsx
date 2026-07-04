import { MealPlanner } from "@/components/meal-planner";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less</p>
        <h1>Find realistic low-cost dinner options near you.</h1>
        <p className="hero-copy">
          Enter your ZIP and radius to see nearby stores on the map. Dinner price
          estimates are directional, not exact checkout totals — always verify in
          store.
        </p>
      </section>

      <MealPlanner />
    </main>
  );
}
