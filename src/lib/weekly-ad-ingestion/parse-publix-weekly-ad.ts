import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const NEXT_DATA_PATTERN =
  /<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;

const JSON_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;

const LISTED_SAVINGS_CARD_PATTERN =
  /data-qa-automation=["']listed-savings-card["'][\s\S]*?(?=data-qa-automation=["']listed-savings-card["']|$)/gi;

export function parsePublixWeeklyAd(input: {
  html: string;
  networkJsonBodies?: string[];
}): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];

  appendUniqueOffers(offers, parseListedSavingsCardOffers(input.html));
  appendUniqueOffers(offers, parseWeeklyAdHtml(input.html));
  appendUniqueOffers(offers, parseAriaLabelOffers(input.html));
  appendUniqueOffers(offers, parseNextDataOffers(input.html));
  appendUniqueOffers(offers, parseJsonScriptOffers(input.html));

  for (const body of input.networkJsonBodies ?? []) {
    appendUniqueOffers(offers, parsePublixJsonPayload(body));
  }

  return offers;
}

function parseListedSavingsCardOffers(html: string): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  let match = LISTED_SAVINGS_CARD_PATTERN.exec(html);

  while (match) {
    const offer = normalizeListedSavingsCard(match[0]);
    if (offer) {
      appendUniqueOffers(offers, [offer]);
    }
    match = LISTED_SAVINGS_CARD_PATTERN.exec(html);
  }

  return offers;
}

function normalizeListedSavingsCard(cardHtml: string): WeeklyAdRawOffer | null {
  const productName = readListedSavingsCardTitle(cardHtml);
  if (!productName || looksLikeNonProductLabel(productName)) {
    return null;
  }

  const badgeText = readListedSavingsCardSection(cardHtml, "p-savings-badge__text");
  const additionalInfo = readListedSavingsCardSection(cardHtml, "additional-info");
  const validThrough = readListedSavingsCardSection(cardHtml, "valid-dates");
  const priceDetails = resolveListedSavingsCardPrice(badgeText, additionalInfo);

  if (!priceDetails) {
    return null;
  }

  return {
    productName,
    price: priceDetails.price,
    saleLabel: priceDetails.saleLabel,
    validThrough,
  };
}

function readListedSavingsCardTitle(cardHtml: string) {
  const titleMatch = cardHtml.match(
    /data-qa-automation=["']prod-title["'][\s\S]*?class=["'][^"']*\btitle\b[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/span>/i,
  );
  if (titleMatch?.[1]) {
    return stripHtmlText(titleMatch[1]);
  }

  const altMatch = cardHtml.match(/alt=["']([^"']+)["'][^>]*fetchpriority=["']auto["']/i);
  return altMatch?.[1] ? stripHtmlText(altMatch[1]) : undefined;
}

function readListedSavingsCardSection(cardHtml: string, className: string) {
  const pattern = new RegExp(
    `class=["'][^"']*\\b${className}\\b[^"']*["'][\\s\\S]*?>\\s*([\\s\\S]*?)\\s*<\\/span>`,
    "i",
  );
  const match = cardHtml.match(pattern);
  return match?.[1] ? stripHtmlText(match[1]) : undefined;
}

function resolveListedSavingsCardPrice(
  badgeText: string | undefined,
  additionalInfo: string | undefined,
) {
  const normalizedBadge = badgeText?.trim() ?? "";
  const normalizedAdditional = additionalInfo?.trim() ?? "";
  const saveUpTo = readSaveUpToAmount(normalizedAdditional);
  const saveAmount = readSaveAmount(normalizedAdditional);
  const directionalSavings = saveUpTo ?? saveAmount;

  const unitPriceMatch = normalizedBadge.match(/\$\s*([\d.]+)\s*(?:\/?\s*lb\b)?/i);
  if (unitPriceMatch?.[1]) {
    const price = Number.parseFloat(unitPriceMatch[1]);
    if (!Number.isFinite(price)) {
      return null;
    }

    const isPerLb = /\blb\b/i.test(normalizedBadge);
    const saleLabelParts = [isPerLb ? "estimated per lb" : undefined, saveUpTo ? `save up to $${saveUpTo.toFixed(2)}` : undefined].filter(
      (part): part is string => Boolean(part),
    );

    return {
      price,
      saleLabel: saleLabelParts.length > 0 ? saleLabelParts.join(" · ") : "Weekly ad special",
    };
  }

  if (/buy\s*1\s*get\s*1\s*free|\bbogo\b/i.test(normalizedBadge)) {
    if (saveUpTo === undefined) {
      return null;
    }

    return {
      price: saveUpTo,
      saleLabel: "Directional — BOGO (save up to, not shelf price)",
    };
  }

  if (/digital coupon/i.test(normalizedAdditional) && directionalSavings !== undefined) {
    return {
      price: directionalSavings,
      saleLabel: "Directional — digital coupon savings",
    };
  }

  if (directionalSavings !== undefined) {
    return {
      price: directionalSavings,
      saleLabel: normalizedBadge || "Directional — weekly ad savings",
    };
  }

  return null;
}

function readSaveUpToAmount(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/save\s+up\s+to\s+\$?\s*([\d.]+)/i);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSaveAmount(value: string | undefined) {
  if (!value || /save\s+up\s+to/i.test(value)) {
    return undefined;
  }

  const match = value.match(/save\s+\$?\s*([\d.]+)/i);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function countListedSavingsCardsInHtml(html: string) {
  const matches = html.match(/data-qa-automation="listed-savings-card"/g);
  return matches?.length ?? 0;
}

function stripHtmlText(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
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

const ARIA_LABEL_PATTERN = /aria-label=["']([^"']+)["']/gi;

function parseAriaLabelOffers(html: string): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  let match = ARIA_LABEL_PATTERN.exec(html);

  while (match) {
    const label = decodeHtmlEntities(match[1]?.trim() ?? "");
    const offer = normalizeAriaLabelOffer(label);
    if (offer) {
      appendUniqueOffers(offers, [offer]);
    }
    match = ARIA_LABEL_PATTERN.exec(html);
  }

  return offers;
}

function normalizeAriaLabelOffer(label: string): WeeklyAdRawOffer | null {
  if (!label || looksLikeNonProductLabel(label)) {
    return null;
  }

  const trailingSaveMatch = label.match(/(.+?) - Save \$([\d.]+) on (.+)$/i);
  if (trailingSaveMatch) {
    const productName = trailingSaveMatch[1]?.split(" - ").pop()?.trim();
    const price = Number.parseFloat(trailingSaveMatch[2] ?? "");
    if (productName && Number.isFinite(price)) {
      return {
        productName,
        price,
        saleLabel: "Weekly ad special",
      };
    }
  }

  const saveOnMatch = label.match(/save\s+\$([\d.]+)\s+on\s+(.+?)(?:\s+to list|\s+when you spend|$)/i);
  if (saveOnMatch) {
    const price = Number.parseFloat(saveOnMatch[1] ?? "");
    const productName = saveOnMatch[2]?.trim();
    if (productName && Number.isFinite(price)) {
      return {
        productName,
        price,
        saleLabel: "Weekly ad special",
      };
    }
  }

  return null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
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

function parsePublixJsonPayload(body: string): WeeklyAdRawOffer[] {
  try {
    const payload = JSON.parse(body) as unknown;
    const savingsOffers = parsePublixSavingsGraphqlPayload(payload);
    if (savingsOffers.length > 0) {
      return savingsOffers;
    }
    return extractOffersFromUnknownJson(payload);
  } catch {
    return [];
  }
}

function parsePublixSavingsGraphqlPayload(payload: unknown): WeeklyAdRawOffer[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (!data || typeof data !== "object") {
    return [];
  }

  const searchResult = (data as Record<string, unknown>).storeProductsSavingsSearchResult;
  if (!searchResult || typeof searchResult !== "object") {
    return [];
  }

  const storeProducts = (searchResult as Record<string, unknown>).storeProducts;
  if (!Array.isArray(storeProducts)) {
    return [];
  }

  return storeProducts
    .map(normalizePublixSavingsProduct)
    .filter((offer): offer is WeeklyAdRawOffer => offer !== null);
}

function normalizePublixSavingsProduct(entry: unknown): WeeklyAdRawOffer | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName = readString(record.title) ?? readString(record.shortDescription);
  const price = parsePublixPriceLine(readString(record.priceLine));

  if (!productName || price === undefined) {
    return null;
  }

  return {
    productName,
    price,
    saleLabel:
      record.onSale === true
        ? readString(record.savingLine) ?? readString(record.specialPromotionDescription) ?? "Weekly ad special"
        : undefined,
  };
}

function parsePublixPriceLine(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const dollarMatch = value.match(/\$\s*([\d.]+)/);
  if (dollarMatch?.[1]) {
    const parsed = Number.parseFloat(dollarMatch[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return readPrice(value);
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
      const productOffer = normalizePublixProductRecord(entry);
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

function normalizePublixProductRecord(entry: unknown): WeeklyAdRawOffer | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName =
    readString(record.titlecopy) ??
    readString(record.title) ??
    readString(record.description) ??
    readString(record.productName) ??
    readString(record.name);

  if (!productName || looksLikeNonProductLabel(productName)) {
    return null;
  }

  const promoPrice =
    readPrice(record.saleprice) ??
    readPrice(record.salePrice) ??
    readPrice(record.promoPrice);
  const regularPrice =
    readPrice(record.listprice) ??
    readPrice(record.listPrice) ??
    readPrice(record.regularPrice);
  const resolvedPrice = promoPrice ?? readPrice(record.price) ?? regularPrice;

  if (resolvedPrice === undefined) {
    return null;
  }

  const saleLabel =
    readString(record.onsalemsg) ??
    readString(record.saleLabel) ??
    readString(record.promotion) ??
    (promoPrice !== undefined && regularPrice !== undefined && promoPrice < regularPrice
      ? "Weekly ad special"
      : undefined);

  return {
    productName,
    price: resolvedPrice,
    saleLabel,
    validThrough: readString(record.validThrough) ?? readString(record.validTo),
  };
}

function normalizeOfferRecord(entry: unknown): WeeklyAdRawOffer | null {
  const publixProduct = normalizePublixProductRecord(entry);
  if (publixProduct) {
    return publixProduct;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName =
    readString(record.productName) ??
    readString(record.titlecopy) ??
    readString(record.description) ??
    readString(record.name) ??
    readString(record.title) ??
    readString(record.label);

  if (!productName || looksLikeNonProductLabel(productName)) {
    return null;
  }

  const price =
    readPrice(record.price) ??
    readPrice(record.saleprice) ??
    readPrice(record.salePrice) ??
    readPrice(record.currentPrice) ??
    readPrice(record.current_price);

  if (price === undefined) {
    return null;
  }

  return {
    productName,
    price,
    saleLabel:
      readString(record.saleLabel) ??
      readString(record.onsalemsg) ??
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
    readPrice(record.saleprice) ??
    readPrice(record.current) ??
    readPrice(record.regular) ??
    readPrice(record.regularPrice) ??
    readPrice(record.listprice) ??
    readPrice(record.value)
  );
}

function looksLikeNonProductLabel(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("loading") ||
    normalized.includes("skip to content") ||
    normalized === "publix" ||
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
