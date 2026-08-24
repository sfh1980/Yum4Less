import { describe, expect, it } from "vitest";
import { FORBIDDEN_TRUST_CLAIM_PATTERNS } from "@/lib/pricing-trust-heads-up-expanded";
import {
  FAQ_ARTICLES,
  FAQ_SLUG,
  collectFaqArticleText,
  faqArticleHref,
  getFaqArticle,
  listFaqArticles,
} from "@/lib/faq-articles";
import { collectTermsText } from "@/lib/terms-content";

describe("faq-articles", () => {
  it("exposes one article per slug with a question title", () => {
    const slugs = FAQ_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(FAQ_ARTICLES.length);
    expect(slugs).toEqual(Object.values(FAQ_SLUG));
    for (const article of listFaqArticles()) {
      expect(article.question.endsWith("?")).toBe(true);
      expect(article.paragraphs.length).toBeGreaterThan(0);
      expect(faqArticleHref(article.slug)).toBe(`/faq/${article.slug}`);
    }
  });

  it("looks up articles by slug", () => {
    expect(getFaqArticle(FAQ_SLUG.mealTotal)?.question).toMatch(/estimates/i);
    expect(getFaqArticle("not-a-real-article")).toBeUndefined();
  });

  it("forbidden-claim patterns do not match FAQ or Terms copy", () => {
    const text = `${collectFaqArticleText()} ${collectTermsText()}`;

    for (const pattern of FORBIDDEN_TRUST_CLAIM_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
