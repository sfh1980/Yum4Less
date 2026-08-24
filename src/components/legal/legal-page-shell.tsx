import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  children,
}: LegalPageShellProps) {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">
          <Link className="text-link" href="/">
            Back to meal planner
          </Link>
        </p>
      </section>
      <section className="panel panel-padding legal-article">{children}</section>
    </main>
  );
}
