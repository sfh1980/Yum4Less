import { RecommendationDemo } from "@/components/recommendation-demo";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Local MVP</p>
        <h1>Find realistic low-cost dinner options near you.</h1>
        <p className="hero-copy">
          Start with a ZIP code and radius, review nearby stores, then rank dinner
          options by budget, ingredients, and shopping preferences.
        </p>
      </section>

      <RecommendationDemo />
    </main>
  );
}
