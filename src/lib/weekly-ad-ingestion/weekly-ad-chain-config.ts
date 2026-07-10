import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdFetchStrategy = "http" | "browser" | "browser-fallback";

export type WeeklyAdChainConfig = {
  chain: WeeklyAdChain;
  label: string;
  implementation: "live-scraper" | "research-stub";
  fetchStrategy: WeeklyAdFetchStrategy;
  browserWaitSelector?: string;
  researchTargets: string[];
  termsNote: string;
};

export const WEEKLY_AD_CHAIN_CONFIGS: WeeklyAdChainConfig[] = [
  {
    chain: "aldi",
    label: "Aldi weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser-fallback",
    browserWaitSelector:
      "#weekly-ad-offers-data, [data-weekly-ad-product], [class*='weekly'], iframe",
    researchTargets: ["https://www.aldi.us/en/weekly-specials/"],
    termsNote:
      "Aldi weekly specials use the Flipp syndicated weekly-ad feed for ZIP-scoped offers, then merge in a direct page scrape when the feed is empty or matched dinner-ingredient coverage stays low. Verify current deals in store before checkout.",
  },
  {
    chain: "food-lion",
    label: "Food Lion weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser-fallback",
    browserWaitSelector:
      "#weekly-ad-offers-data, [data-weekly-ad-product], [class*='weekly'], iframe",
    researchTargets: ["https://www.foodlion.com/weekly-ad/"],
    termsNote:
      "Food Lion weekly-ad offers use the Flipp syndicated feed first because direct pages often block automated HTTP access (403/WAF). Browser scrape runs only when the feed is empty. Verify current deals in store before checkout.",
  },
  {
    chain: "publix",
    label: "Publix weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser",
    browserWaitSelector:
      "#weekly-ad-offers-data, [data-weekly-ad-product], .weekly-ad, [class*='weekly'], iframe",
    researchTargets: ["https://www.publix.com/savings/weekly-ad/view-all"],
    termsNote:
      "Publix weekly-ad pages require a store cookie from the public store-locator service, then a hardened headless browser fetch against the view-all weekly ad page. Verify current deals in store before checkout.",
  },
  {
    chain: "kroger",
    label: "Kroger weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser",
    browserWaitSelector:
      "[data-testid*='weekly'], [data-testid*='Weekly'], #weekly-ad-offers-data, [data-weekly-ad-product], script#__NEXT_DATA__",
    researchTargets: [
      "https://www.kroger.com/weeklyad?zipcode=23111",
      "https://www.kroger.com/search?query=weekly%20ad&searchType=mktg%20content",
    ],
    termsNote:
      "Kroger weekly-ad offers use the Flipp syndicated feed first (merchant search, flyer lookup, and supplemental ingredient searches), then a hardened headless browser scrape with network JSON capture when the feed is empty. Official product API runs only as a last-resort partial fill for tracked ingredients when both Flipp and scrape return nothing — not general sale discovery. Verify current deals in store before checkout.",
  },
  {
    chain: "walmart",
    label: "Walmart weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser-fallback",
    browserWaitSelector: "#weekly-ad-offers-data, [data-weekly-ad-product], [data-automation-id*='weekly']",
    researchTargets: ["https://www.walmart.com/store/weekly-ads"],
    termsNote:
      "Walmart weekly-ad pages use HTTP first, then headless browser fallback because live pages are heavily dynamic. Verify current deals in store before checkout.",
  },
  {
    chain: "lidl",
    label: "Lidl weekly ad ingestion",
    implementation: "live-scraper",
    fetchStrategy: "browser-fallback",
    browserWaitSelector:
      "#weekly-ad-offers-data, [data-weekly-ad-product], [class*='weekly'], iframe",
    researchTargets: ["https://www.lidl.com/weekly-ads"],
    termsNote:
      "Lidl weekly-ad offers use the Flipp syndicated feed first, then optional direct page scrape when the feed is empty. Verify current deals in store before checkout.",
  },
  {
    chain: "dollar-general",
    label: "Dollar General weekly ad ingestion (research)",
    implementation: "research-stub",
    fetchStrategy: "http",
    researchTargets: ["https://www.dollargeneral.com/weekly-ads"],
    termsNote:
      "Dollar General Market has limited grocery coverage; ingestion is lower priority for dinner planning.",
  },
];

export function getWeeklyAdChainConfig(
  chain: WeeklyAdChain,
): WeeklyAdChainConfig | undefined {
  return WEEKLY_AD_CHAIN_CONFIGS.find((entry) => entry.chain === chain);
}
