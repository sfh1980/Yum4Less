export const FAQ_SLUG = {
  mealTotal: "why-are-dinner-totals-only-estimates",
  priceSource: "where-do-these-prices-come-from",
  confidence: "what-does-confidence-mean",
  freshness: "what-does-freshness-mean",
  storeMapCoverage: "why-do-some-stores-only-appear-on-the-map",
  zip: "how-does-zip-search-work",
  radius: "how-far-does-the-search-radius-go",
  mapPins: "what-do-map-pin-colors-mean",
  recipes: "where-do-the-recipes-come-from",
} as const;

export type FaqArticleSlug = (typeof FAQ_SLUG)[keyof typeof FAQ_SLUG];

export type FaqArticle = {
  slug: FaqArticleSlug;
  question: string;
  paragraphs: readonly string[];
};

export const FAQ_ARTICLES: readonly FaqArticle[] = [
  {
    slug: FAQ_SLUG.mealTotal,
    question: "Why are dinner totals only estimates?",
    paragraphs: [
      "Each dinner total combines recently checked online prices and saved sale prices from the stores you selected. It is not a checkout total.",
      "Treat it as an estimate. Verify price, package size, and current shelf tags before you buy.",
    ],
  },
  {
    slug: FAQ_SLUG.priceSource,
    question: "Where do these prices come from?",
    paragraphs: [
      "Yum4Less uses saved sale prices, recently checked online prices, backup store data, or other non-checkout sources. Labels like estimated, directional, or limited coverage mean you should verify shelf tags before you buy.",
      "Dinner estimates can use Kroger-family banners (a Harris Teeter still shows as Harris Teeter), Aldi, Publix, Food Lion, Lidl, and Walmart when we have recent sale or online prices near you. If we cannot get usable sale data, that store stays on the map for context and we say so — it is not blocked. Other pins without a sale feed are nearby context only.",
      "Prices refresh about daily. Older info is a rougher guide. Always check package size and in-store tags.",
    ],
  },
  {
    slug: FAQ_SLUG.confidence,
    question: "What does the confidence label mean?",
    paragraphs: [
      "Confidence labels explain how straightforward the shopping plan is.",
      "Single-store estimates are usually easier to follow. Multi-store plans compare prices across your selected stores but depend on visiting more than one stop.",
    ],
  },
  {
    slug: FAQ_SLUG.freshness,
    question: "What does the freshness label mean?",
    paragraphs: [
      "Freshness tells you how recently prices were checked.",
      "Prices can change before you shop. Older rows are less reliable.",
    ],
  },
  {
    slug: FAQ_SLUG.storeMapCoverage,
    question: "Why do some stores only appear on the map?",
    paragraphs: [
      "You can pick grocery stores near you, including stores we do not have sale prices for yet.",
      "Dinner estimates use saved sale prices when a store has enough coverage. Other selected stores stay on the map for planning — they do not change meal totals.",
      "Yum4Less tracks a set of dinner ingredients and shows estimated sale prices when those ingredients overlap a store’s saved prices. Coverage differs by chain and week.",
    ],
  },
  {
    slug: FAQ_SLUG.zip,
    question: "How does ZIP code search work?",
    paragraphs: [
      "Yum4Less accepts continental US ZIP codes.",
      "We use the ZIP to center a search for nearby grocery stores. Some of those stores show dinner estimates; others appear on the map for planning only.",
    ],
  },
  {
    slug: FAQ_SLUG.radius,
    question: "How far does the search radius go?",
    paragraphs: [
      "The radius sets the search circle around your ZIP code or browser location.",
      "A wider radius includes more stores on the map, but pins farther away may be less convenient for a single shopping trip.",
    ],
  },
  {
    slug: FAQ_SLUG.mapPins,
    question: "What do the map pin colors mean?",
    paragraphs: [
      "Pins come from saved store data or map sources — confirm locations before visiting.",
      "Colored badges mark stores with dinner estimates. Gray badges are nearby for planning only.",
    ],
  },
  {
    slug: FAQ_SLUG.recipes,
    question: "Where do the recipes come from?",
    paragraphs: [
      "Shopper dinners come from TheMealDB meals that have a full recipe page and enough sale overlap at your stores.",
      "Short internal writeups stay in the catalog for matching but are not ranked. TheMealDB meals include attribution. Totals are still estimates — verify in store.",
    ],
  },
] as const;

export function faqArticleHref(slug: FaqArticleSlug): string {
  return `/faq/${slug}`;
}

export function getFaqArticle(slug: string): FaqArticle | undefined {
  return FAQ_ARTICLES.find((article) => article.slug === slug);
}

export function listFaqArticles(): readonly FaqArticle[] {
  return FAQ_ARTICLES;
}

export function collectFaqArticleText(
  articles: readonly FaqArticle[] = FAQ_ARTICLES,
): string {
  return articles
    .flatMap((article) => [article.question, ...article.paragraphs])
    .join(" ");
}
