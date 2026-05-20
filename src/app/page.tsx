import { RecommendationDemo } from "@/components/recommendation-demo";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Local MVP</p>
        <h1>Find realistic low-cost dinner options near you.</h1>
        <p className="hero-copy">
          Start with a ZIP code and search radius, review nearby stores, then
          rank dinner options by budget, ingredient count, dietary fit, and
          one-store versus multi-store tradeoffs. Every result shows the current
          estimate, freshness context, and fallback status clearly.
        </p>
      </section>

      <RecommendationDemo />
    </main>
  );
}
