import type {
  WeeklyAdChain,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const BLOCKED_PAGE =
  /\b(captcha|access denied|robot or human|attention required|cf-browser-verification|px-captcha|awswaf|request unsuccessful)\b/i;

const LOADED_DOCUMENT =
  /<!doctype html|<html[\s>]|<body[\s>]|id=["']__NEXT_DATA__["']|id=["']weekly-ad-offers-data["']/i;

const OFFER_EMBED =
  /<script[^>]*id=["']weekly-ad-offers-data["'][^>]*>([\s\S]*?)<\/script>/i;

const NEXT_DATA_EMBED =
  /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;

/**
 * The store page showed no ad.
 * True only when a document arrived, it is not a block page, and any
 * embedded offer JSON or Next data is well-formed. An empty body, a block
 * page, or broken JSON is not this case — the caller keeps today's error.
 * Call this only after the parser already found zero offers.
 */
export function storePageShowedNoAd(html: string): boolean {
  const text = html ?? "";
  if (!text.trim()) {
    return false;
  }
  if (BLOCKED_PAGE.test(text)) {
    return false;
  }
  if (embeddedOfferJsonIsUnexpected(text) || nextDataIsUnexpected(text)) {
    return false;
  }
  if (embeddedOfferJsonIsEmptyArray(text)) {
    return true;
  }
  return LOADED_DOCUMENT.test(text);
}

/**
 * No current or upcoming flyer: Flipp proved the merchant had none, and the
 * store page loaded and showed no ad. Anything else stays an error.
 */
export function weeklyAdHarvestIsNoFlyer(input: {
  flippNoCurrentFlyer: boolean;
  pageHtml: string;
}): boolean {
  return input.flippNoCurrentFlyer === true && storePageShowedNoAd(input.pageHtml);
}

export function buildNoFlyerIngestionResult(input: {
  chain: WeeklyAdChain;
  label: string;
  provenance: WeeklyAdIngestionResult["provenance"];
  fallbackUsed: boolean;
  fetchedAt: string;
  termsNote: string;
  zipCode: string;
}): WeeklyAdIngestionResult {
  return {
    chain: input.chain,
    label: input.label,
    status: "live",
    provenance: input.provenance,
    retrievalMode: "live",
    configured: true,
    fallbackUsed: input.fallbackUsed,
    offers: [],
    noFlyer: true,
    message: `${input.label} found no current or upcoming flyer for ZIP ${input.zipCode}. No rows were written.`,
    fetchedAt: input.fetchedAt,
    termsNote: input.termsNote,
  };
}

function embeddedOfferJsonIsEmptyArray(html: string): boolean {
  const match = html.match(OFFER_EMBED);
  if (!match?.[1]) {
    return false;
  }
  try {
    const payload = JSON.parse(match[1].trim()) as unknown;
    return Array.isArray(payload) && payload.length === 0;
  } catch {
    return false;
  }
}

function embeddedOfferJsonIsUnexpected(html: string): boolean {
  const match = html.match(OFFER_EMBED);
  if (!match?.[1]) {
    return false;
  }
  try {
    return !Array.isArray(JSON.parse(match[1].trim()) as unknown);
  } catch {
    return true;
  }
}

function nextDataIsUnexpected(html: string): boolean {
  const match = html.match(NEXT_DATA_EMBED);
  if (!match?.[1]) {
    return false;
  }
  try {
    JSON.parse(match[1].trim());
    return false;
  } catch {
    return true;
  }
}
