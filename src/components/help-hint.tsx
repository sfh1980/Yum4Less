"use client";

import Link from "next/link";
import {
  faqArticleHref,
  getFaqArticle,
  type FaqArticleSlug,
} from "@/lib/faq-articles";

type HelpHintProps = {
  articleSlug: FaqArticleSlug;
  id?: string;
};

export function HelpHint({ articleSlug, id }: HelpHintProps) {
  const article = getFaqArticle(articleSlug);
  if (!article) {
    return null;
  }

  return (
    <span className="help-hint">
      <Link
        className="help-hint-trigger"
        href={faqArticleHref(article.slug)}
        id={id}
        aria-label={`${article.question} Opens FAQ`}
      >
        ?
      </Link>
    </span>
  );
}
