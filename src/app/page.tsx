import { RecommendationDemo } from "@/components/recommendation-demo";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Local MVP · Beta</p>
        <h1>Find realistic low-cost dinner options near you.</h1>
        <p className="hero-copy">
          Start with a ZIP code and radius, review nearby stores, then rank dinner
          options by budget, ingredients, and shopping preferences. This beta MVP
          is still evolving—meal prices are estimates from saved weekly ads and
          recently checked online prices, not live checkout, and not every nearby
          chain is live-priced yet (Walmart is context-only for ranked meals).
        </p>
      </section>

      <RecommendationDemo />
    </main>
  );
}
