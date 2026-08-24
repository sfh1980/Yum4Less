import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { faqArticleHref, listFaqArticles } from "@/lib/faq-articles";

export const metadata: Metadata = {
  title: "FAQ · Yum4Less",
  description: "Answers about estimates, stores, maps, and recipes.",
};

export default function FaqIndexPage() {
  const articles = listFaqArticles();

  return (
    <LegalPageShell eyebrow="Yum4Less Beta · FAQ" title="Frequently asked questions">
      <p className="panel-copy">
        Short answers about estimates, stores, and recipes. Totals are not
        checkout prices.
      </p>
      <ul className="faq-article-list">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link className="text-link" href={faqArticleHref(article.slug)}>
              {article.question}
            </Link>
          </li>
        ))}
      </ul>
    </LegalPageShell>
  );
}
