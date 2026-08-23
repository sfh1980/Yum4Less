import type { Metadata } from "next";
import Link from "next/link";
import { OwnerConsole } from "@/components/owner/owner-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner console · Yum4Less",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OwnerPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less · Owner ops</p>
        <h1>Owner console</h1>
        <p className="hero-copy">
          Private console for customer feedback, saved product analytics, and
          weekly-ad ingredient review. Not linked from the shopper app.
        </p>
        <p className="hero-copy">
          <Link className="text-link" href="/">
            Back to meal planner
          </Link>
        </p>
      </section>

      <OwnerConsole />
    </main>
  );
}
