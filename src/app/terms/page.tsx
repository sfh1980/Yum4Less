import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { TERMS_PARAGRAPHS, TERMS_TITLE } from "@/lib/terms-content";

export const metadata: Metadata = {
  title: "Terms of use · Yum4Less",
  description:
    "Beta dinner planner terms: estimates, no accounts, verify prices in store.",
};

export default function TermsPage() {
  return (
    <LegalPageShell eyebrow="Yum4Less Beta · Terms" title={TERMS_TITLE}>
      {TERMS_PARAGRAPHS.map((paragraph) => (
        <p className="panel-copy" key={paragraph}>
          {paragraph}
        </p>
      ))}
      <p className="panel-copy">
        <Link className="text-link" href="/faq">
          Frequently asked questions
        </Link>
      </p>
    </LegalPageShell>
  );
}
