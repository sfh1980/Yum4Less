import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { FAQ_ARTICLES, getFaqArticle } from "@/lib/faq-articles";

type FaqArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return FAQ_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: FaqArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getFaqArticle(slug);
  if (!article) {
    return { title: "FAQ · Yum4Less" };
  }

  return {
    title: `${article.question} · Yum4Less FAQ`,
    description: article.paragraphs[0],
  };
}

export default async function FaqArticlePage({ params }: FaqArticlePageProps) {
  const { slug } = await params;
  const article = getFaqArticle(slug);
  if (!article) {
    notFound();
  }

  return (
    <LegalPageShell eyebrow="Yum4Less Beta · FAQ" title={article.question}>
      {article.paragraphs.map((paragraph) => (
        <p className="panel-copy" key={paragraph}>
          {paragraph}
        </p>
      ))}
      <p className="panel-copy">
        <Link className="text-link" href="/faq">
          All questions
        </Link>
      </p>
    </LegalPageShell>
  );
}
