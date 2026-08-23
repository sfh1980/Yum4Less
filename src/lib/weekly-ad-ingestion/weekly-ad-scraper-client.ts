import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { fetchWeeklyAdPageContent } from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type {
  WeeklyAdChain,
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export function createWeeklyAdScraperClient(input: {
  chain: WeeklyAdChain;
  weeklyAdUrl: string;
  fixtureFileName: string;
}): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig(input.chain);

  return {
    chain: input.chain,
    label: config?.label ?? `${input.chain} weekly ad ingestion`,
    configured: true,
    researchTargets: config?.researchTargets ?? [input.weeklyAdUrl],
    ingestWeeklyAd: (ingestionInput) =>
      ingestWeeklyAd({
        ...input,
        ingestionInput,
        termsNote:
          config?.termsNote ??
          `${input.chain} weekly-ad prices are directional until verified in store.`,
      }),
  };
}

async function ingestWeeklyAd(input: {
  chain: WeeklyAdChain;
  weeklyAdUrl: string;
  fixtureFileName: string;
  ingestionInput: WeeklyAdIngestionInput;
  termsNote: string;
}): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig(input.chain);
  const fetchedAt = new Date().toISOString();
  const label = config?.label ?? `${input.chain} weekly ad ingestion`;

  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    return buildFixtureResult({
      ...input,
      label,
      fetchedAt,
    });
  }

  try {
    const fetchStrategy = config?.fetchStrategy ?? "browser-fallback";
    const pageFetch = await fetchWeeklyAdPageContent({
      url: input.weeklyAdUrl,
      fetchStrategy,
      browserWaitSelector: config?.browserWaitSelector,
    });
    const rawOffers = parseWeeklyAdHtml(pageFetch.html);

    if (rawOffers.length === 0) {
      return {
        chain: input.chain,
        label,
        status: "error",
        provenance: "weekly-ad-scrape",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: pageFetch.method === "browser",
        offers: [],
        message: `${label} page loaded via ${pageFetch.method}, but Yum4Less could not extract offer rows from the current HTML. Retailer pages may block automated access or use a layout Yum4Less does not parse yet.`,
        fetchedAt,
        termsNote: input.termsNote,
      };
    }

    return buildSuccessResult({
      chain: input.chain,
      label,
      storeName: input.ingestionInput.storeName,
      sourceUrl: input.weeklyAdUrl,
      fetchedAt,
      termsNote: input.termsNote,
      rawOffers,
      ingestionInput: input.ingestionInput,
      fixtureMode: false,
      fetchMethod: pageFetch.method,
    });
  } catch (error) {
    return {
      chain: input.chain,
      label,
      status: "error",
      provenance: "weekly-ad-scrape",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: false,
      offers: [],
      message:
        error instanceof Error
          ? `${label} fetch failed: ${error.message}`
          : `${label} fetch failed with an unknown error.`,
      fetchedAt,
      termsNote: input.termsNote,
    };
  }
}

function buildFixtureResult(input: {
  chain: WeeklyAdChain;
  fixtureFileName: string;
  weeklyAdUrl: string;
  ingestionInput: WeeklyAdIngestionInput;
  label: string;
  fetchedAt: string;
  termsNote: string;
}): WeeklyAdIngestionResult {
  const fixturePath = join(
    process.cwd(),
    "src/lib/weekly-ad-ingestion/fixtures",
    input.fixtureFileName,
  );
  const html = readFileSync(fixturePath, "utf8");
  const rawOffers = parseWeeklyAdHtml(html);

  return buildSuccessResult({
    chain: input.chain,
    label: input.label,
    storeName: input.ingestionInput.storeName,
    sourceUrl: input.weeklyAdUrl,
    fetchedAt: input.fetchedAt,
    termsNote: input.termsNote,
    rawOffers,
    ingestionInput: input.ingestionInput,
    fixtureMode: true,
    fetchMethod: "http",
  });
}

function buildSuccessResult(input: {
  chain: WeeklyAdChain;
  label: string;
  storeName: string;
  sourceUrl: string;
  fetchedAt: string;
  termsNote: string;
  rawOffers: ReturnType<typeof parseWeeklyAdHtml>;
  ingestionInput: WeeklyAdIngestionInput;
  fixtureMode: boolean;
  fetchMethod: "http" | "browser";
}): WeeklyAdIngestionResult {
  const offers = matchWeeklyAdOffers({
    chain: input.chain,
    storeId: input.ingestionInput.storeId,
    sourceUrl: input.sourceUrl,
    observedAt: input.fetchedAt,
    rawOffers: input.rawOffers,
    ...weeklyAdMatchFieldsFromIngest(input.ingestionInput),
  });
  const matchedCount = offers.filter((offer) => offer.ingredientId).length;
  const modeLabel = input.fixtureMode ? "Fixture" : "Parsed";
  const fetchLabel = input.fixtureMode ? "" : ` via ${input.fetchMethod}`;

  return {
    chain: input.chain,
    label: input.label,
    status: "live",
    provenance: "weekly-ad-scrape",
    retrievalMode: "live",
    configured: true,
    fallbackUsed: !input.fixtureMode && input.fetchMethod === "browser",
    offers,
    message: `${modeLabel} ${input.chain} weekly-ad run${fetchLabel} parsed ${input.rawOffers.length} offer(s) for ${input.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
    fetchedAt: input.fetchedAt,
    termsNote: input.termsNote,
  };
}
