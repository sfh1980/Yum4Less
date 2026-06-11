import { MealPlanner } from "@/components/meal-planner";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less · Beta v1</p>
        <h1>Find realistic low-cost dinner options near you.</h1>
        <p className="hero-copy">
          Enter a continental US ZIP and radius to see nearby stores on the map.
          For the current production release, ranked dinner estimates focus on{" "}
          <strong>Kroger-family and Aldi</strong> when daily ingest and promotion
          gates pass. Publix, Food Lion, Walmart, and other pins may appear as
          map context; ranked pricing for them is planned in upcoming releases.
          Totals are <strong>estimated</strong> and <strong>directional</strong>{" "}
          from weekly ads and official Kroger online prices, not live checkout.
        </p>
      </section>

      <MealPlanner />
    </main>
  );
}
