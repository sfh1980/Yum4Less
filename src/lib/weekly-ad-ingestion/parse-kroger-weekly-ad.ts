import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const NEXT_DATA_PATTERN =
  /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;

const INITIAL_STATE_PATTERN =
  /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i;

const KROGER_PRODUCT_CARD_PATTERN =
  /<[^>]+data-testid=["'][^"']*(?:product-card|ProductCard|weekly-ad-product)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi;

const JSON_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;

export function parseKrogerWeeklyAd(input: {
  html: string;
  networkJsonBodies?: string[];
}): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];

  appendUniqueOffers(offers, parseWeeklyAdHtml(input.html));
  appendUniqueOffers(offers, parseInitialStateOffers(input.html));
  appendUniqueOffers(offers, parseKrogerProductCardOffers(input.html));
  appendUniqueOffers(offers, parseNextDataOffers(input.html));
  appendUniqueOffers(offers, parseJsonScriptOffers(input.html));

  for (const body of input.networkJsonBodies ?? []) {
    appendUniqueOffers(offers, parseKrogerJsonPayload(body));
  }

  return offers;
}

function parseInitialStateOffers(html: string): WeeklyAdRawOffer[] {
  const match = html.match(INITIAL_STATE_PATTERN);
  if (!match?.[1]) {
    return [];
  }

  try {
    return extractOffersFromUnknownJson(JSON.parse(match[1].trim()));
  } catch {
    return [];
  }
}

function parseKrogerProductCardOffers(html: string): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  const cards = html.match(KROGER_PRODUCT_CARD_PATTERN) ?? [];

  for (const cardHtml of cards) {
    const productName =
      readAriaLabel(cardHtml) ??
      readKrogerTaggedText(cardHtml, "productTitle") ??
      readKrogerTaggedText(cardHtml, "titleClass");
    const priceText =
      readKrogerTaggedText(cardHtml, "price") ??
      cardHtml.match(/\$\s*[\d.]+\s*(?:\/\s*lb)?/i)?.[0];

    if (!productName || !priceText) {
      continue;
    }

    const price = readPrice(priceText);
    if (price === undefined) {
      continue;
    }

    appendUniqueOffers(offers, [
      {
        productName: stripHtmlText(productName),
        price,
        saleLabel: /lb/i.test(priceText) ? "estimated per lb" : "Weekly ad special",
      },
    ]);
  }

  return offers;
}

function readAriaLabel(html: string) {
  return html.match(/aria-label=["']([^"']+)["']/i)?.[1];
}

const KROGER_TAGGED_TEXT_PATTERNS = {
  productTitle:
    /<[^>]*data-testid=["'][^"']*(?:product-title|ProductTitle)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  titleClass: /<[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  price: /<[^>]*data-testid=["'][^"']*(?:price|Price)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
} as const;

function readKrogerTaggedText(
  html: string,
  selector: keyof typeof KROGER_TAGGED_TEXT_PATTERNS,
) {
  const match = html.match(KROGER_TAGGED_TEXT_PATTERNS[selector]);
  return match?.[1] ? stripHtmlText(match[1]) : undefined;
}

function stripHtmlText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseNextDataOffers(html: string): WeeklyAdRawOffer[] {
  const match = html.match(NEXT_DATA_PATTERN);
  if (!match?.[1]) {
    return [];
  }

  try {
    return extractOffersFromUnknownJson(JSON.parse(match[1].trim()));
  } catch {
    return [];
  }
}

function parseJsonScriptOffers(html: string): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  let match = JSON_SCRIPT_PATTERN.exec(html);

  while (match) {
    const payload = match[1]?.trim();
    if (payload) {
      try {
        appendUniqueOffers(offers, extractOffersFromUnknownJson(JSON.parse(payload)));
      } catch {
        // Ignore malformed script payloads.
      }
    }
    match = JSON_SCRIPT_PATTERN.exec(html);
  }

  return offers;
}

function parseKrogerJsonPayload(body: string): WeeklyAdRawOffer[] {
  try {
    return extractOffersFromUnknownJson(JSON.parse(body));
  } catch {
    return [];
  }
}

function extractOffersFromUnknownJson(value: unknown): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  walkJson(value, offers, 0);
  return offers;
}

function walkJson(value: unknown, offers: WeeklyAdRawOffer[], depth: number) {
  if (depth > 14 || value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const offer = normalizeOfferRecord(entry);
      if (offer) {
        appendUniqueOffers(offers, [offer]);
      }
      walkJson(entry, offers, depth + 1);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const directOffer = normalizeOfferRecord(record);
  if (directOffer) {
    appendUniqueOffers(offers, [directOffer]);
  }

  if (Array.isArray(record.data)) {
    for (const entry of record.data) {
      const productOffer = normalizeKrogerProductRecord(entry);
      if (productOffer) {
        appendUniqueOffers(offers, [productOffer]);
      }
      walkJson(entry, offers, depth + 1);
    }
  }

  for (const nestedValue of Object.values(record)) {
    walkJson(nestedValue, offers, depth + 1);
  }
}

function normalizeKrogerProductRecord(entry: unknown): WeeklyAdRawOffer | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName =
    readString(record.description) ??
    readString(record.productName) ??
    readString(record.name) ??
    readString(record.title);

  if (!productName) {
    return null;
  }

  const items = Array.isArray(record.items) ? record.items : [];
  const firstItem =
    items.find((item) => item && typeof item === "object") ??
    (record.price || record.promoPrice || record.regularPrice ? record : undefined);

  if (!firstItem || typeof firstItem !== "object") {
    return null;
  }

  const itemRecord = firstItem as Record<string, unknown>;
  const priceField = itemRecord.price ?? record.price;
  const promoPrice =
    readPrice(itemRecord.promoPrice ?? record.promoPrice) ??
    readNestedPriceField(priceField, "promo");
  const regularPrice =
    readPrice(itemRecord.regularPrice ?? record.regularPrice) ??
    readNestedPriceField(priceField, "regular");
  const resolvedPrice =
    promoPrice ?? readPrice(priceField) ?? regularPrice;

  if (resolvedPrice === undefined) {
    return null;
  }

  const saleLabel =
    readString(record.saleLabel) ??
    readString(record.promotion) ??
    readString(record.promoDescription) ??
    (promoPrice !== undefined && regularPrice !== undefined && promoPrice < regularPrice
      ? "Weekly deal"
      : undefined);

  return {
    productName,
    price: resolvedPrice,
    saleLabel,
    validThrough: readString(record.validThrough) ?? readString(record.validTo),
  };
}

function normalizeOfferRecord(entry: unknown): WeeklyAdRawOffer | null {
  const krogerProduct = normalizeKrogerProductRecord(entry);
  if (krogerProduct) {
    return krogerProduct;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName =
    readString(record.productName) ??
    readString(record.description) ??
    readString(record.name) ??
    readString(record.title) ??
    readString(record.label);

  if (!productName || looksLikeNonProductLabel(productName)) {
    return null;
  }

  const price =
    readPrice(record.price) ??
    readPrice(record.currentPrice) ??
    readPrice(record.current_price) ??
    readPrice(record.salePrice);

  if (price === undefined) {
    return null;
  }

  return {
    productName,
    price,
    saleLabel:
      readString(record.saleLabel) ??
      readString(record.sale) ??
      readString(record.pre_price_text) ??
      readString(record.promoText),
    validThrough: readString(record.validThrough) ?? readString(record.validTo),
  };
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNestedPriceField(value: unknown, field: "promo" | "regular") {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return readPrice((value as Record<string, unknown>)[field]);
}

function readPrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return (
    readPrice(record.promo) ??
    readPrice(record.promoPrice) ??
    readPrice(record.sale) ??
    readPrice(record.current) ??
    readPrice(record.regular) ??
    readPrice(record.regularPrice) ??
    readPrice(record.value)
  );
}

function looksLikeNonProductLabel(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("loading") ||
    normalized.includes("skip to content") ||
    normalized === "kroger" ||
    normalized.startsWith("pickup at")
  );
}

function appendUniqueOffers(target: WeeklyAdRawOffer[], nextOffers: WeeklyAdRawOffer[]) {
  for (const offer of nextOffers) {
    const key = `${offer.productName.toLowerCase()}::${offer.price.toFixed(2)}`;
    const exists = target.some(
      (existing) =>
        `${existing.productName.toLowerCase()}::${existing.price.toFixed(2)}` === key,
    );
    if (!exists) {
      target.push(offer);
    }
  }
}
