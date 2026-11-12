import { extendDateOnlySaleEnd } from "@/lib/weekly-ad-ingestion/date-only-sale-end";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const PUBLIX_VALID_RANGE =
  /valid\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;

/**
 * "Valid 11/11 - 11/18" becomes a date-only start and an inclusive end.
 * The year is the one that puts the start nearest the run date, within
 * about six months either side, whether or not the range crosses New Year.
 * "Valid 1/2 - 1/8" read on Dec 30 is the next year. "Valid 12/26 - 12/31"
 * read on Jan 2 is the previous year. The clock and offset are local
 * midnight in the process time zone, the same whole-hour shape
 * `extendDateOnlySaleEnd` already extends by one calendar day.
 * Unreadable text returns no dates and does not throw.
 */

/** About six months. A start farther than this is not used. */
export const PUBLIX_VALID_START_WINDOW_DAYS = 183;
export function parsePublixCardValidRange(
  text: string | undefined,
  now: Date = new Date(),
): { validFrom?: string; validThrough?: string } {
  if (!text?.trim()) {
    return {};
  }
  try {
    const match = PUBLIX_VALID_RANGE.exec(text);
    if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
      return {};
    }
    const startMonth = Number(match[1]);
    const startDay = Number(match[2]);
    const endMonth = Number(match[3]);
    const endDay = Number(match[4]);
    const years = publixValidRangeYears(now, startMonth, endMonth, endDay, startDay);
    if (
      !years ||
      !isRealCalendarDay(years.startYear, startMonth, startDay) ||
      !isRealCalendarDay(years.endYear, endMonth, endDay)
    ) {
      return {};
    }
    const validFrom = formatProcessDateOnlyInstant(years.startYear, startMonth, startDay, now);
    const rawEnd = formatProcessDateOnlyInstant(years.endYear, endMonth, endDay, now);
    if (!validFrom || !rawEnd) {
      return {};
    }
    const validThrough = extendDateOnlySaleEnd({ start: validFrom, end: rawEnd });
    if (typeof validThrough !== "string") {
      return {};
    }
    return { validFrom, validThrough };
  } catch {
    return {};
  }
}

function publixValidRangeYears(
  now: Date,
  startMonth: number,
  endMonth: number,
  endDay: number,
  startDay: number,
): { startYear: number; endYear: number } | null {
  if (
    startMonth < 1 ||
    startMonth > 12 ||
    endMonth < 1 ||
    endMonth > 12 ||
    startDay < 1 ||
    endDay < 1
  ) {
    return null;
  }
  const crosses =
    endMonth < startMonth || (endMonth === startMonth && endDay < startDay);
  const runYear = now.getFullYear();
  const runDay = calendarDayNumber(runYear, now.getMonth() + 1, now.getDate());
  let best: { startYear: number; endYear: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const startYear of [runYear - 1, runYear, runYear + 1]) {
    const endYear = crosses ? startYear + 1 : startYear;
    if (
      !isRealCalendarDay(startYear, startMonth, startDay) ||
      !isRealCalendarDay(endYear, endMonth, endDay)
    ) {
      continue;
    }
    const distance = Math.abs(calendarDayNumber(startYear, startMonth, startDay) - runDay);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { startYear, endYear };
    }
  }
  if (!best || bestDistance > PUBLIX_VALID_START_WINDOW_DAYS) {
    return null;
  }
  return best;
}

function calendarDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isRealCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Local midnight of that calendar day. Null when the offset is not a whole hour. */
function formatProcessDateOnlyInstant(
  year: number,
  month: number,
  day: number,
  now: Date,
): string | undefined {
  const offsetMinutes = -now.getTimezoneOffset();
  if (offsetMinutes % 60 !== 0) {
    return undefined;
  }
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}T00:00:00${formatWholeHourOffset(offsetMinutes)}`;
}

function formatWholeHourOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return "Z";
  }
  const sign = offsetMinutes > 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  return `${sign}${hours}:00`;
}

const NEXT_DATA_PATTERN =
  /<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;

const JSON_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;

const LISTED_SAVINGS_CARD_PATTERN =
  /data-qa-automation=["']listed-savings-card["'][\s\S]*?(?=data-qa-automation=["']listed-savings-card["']|$)/gi;

export function parsePublixWeeklyAd(input: {
  html: string;
  networkJsonBodies?: string[];
  now?: Date;
}): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  const now = input.now ?? new Date();

  appendUniqueOffers(offers, parseListedSavingsCardOffers(input.html, now));
  appendUniqueOffers(offers, parseWeeklyAdHtml(input.html));
  appendUniqueOffers(offers, parseAriaLabelOffers(input.html));
  appendUniqueOffers(offers, parseNextDataOffers(input.html));
  appendUniqueOffers(offers, parseJsonScriptOffers(input.html));

  for (const body of input.networkJsonBodies ?? []) {
    appendUniqueOffers(offers, parsePublixJsonPayload(body));
  }

  return offers;
}

function parseListedSavingsCardOffers(html: string, now: Date): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  let match = LISTED_SAVINGS_CARD_PATTERN.exec(html);

  while (match) {
    const offer = normalizeListedSavingsCard(match[0], now);
    if (offer) {
      appendUniqueOffers(offers, [offer]);
    }
    match = LISTED_SAVINGS_CARD_PATTERN.exec(html);
  }

  return offers;
}

function normalizeListedSavingsCard(cardHtml: string, now: Date): WeeklyAdRawOffer | null {
  const productName = readListedSavingsCardTitle(cardHtml);
  if (!productName || looksLikeNonProductLabel(productName)) {
    return null;
  }

  const badgeText = readListedSavingsCardSection(cardHtml, "p-savings-badge__text");
  const additionalInfo = readListedSavingsCardSection(cardHtml, "additional-info");
  const validDates = parsePublixCardValidRange(
    readListedSavingsCardSection(cardHtml, "valid-dates"),
    now,
  );
  const priceDetails = resolveListedSavingsCardPrice(badgeText, additionalInfo);

  if (!priceDetails) {
    return null;
  }

  return {
    productName,
    price: priceDetails.price,
    saleLabel: priceDetails.saleLabel,
    validFrom: validDates.validFrom,
    validThrough: validDates.validThrough,
  };
}

function readListedSavingsCardTitle(cardHtml: string) {
  const titleMatch = cardHtml.match(
    /data-qa-automation=["']prod-title["'][\s\S]*?class=["'][^"']*title(?:__[A-Za-z0-9]+)?[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/span>/i,
  );
  if (titleMatch?.[1]) {
    return stripHtmlText(titleMatch[1]);
  }

  const altMatch = cardHtml.match(/alt=["']([^"']+)["'][^>]*fetchpriority=["']auto["']/i);
  return altMatch?.[1] ? stripHtmlText(altMatch[1]) : undefined;
}

/**
 * Publix CSS modules prefix and hash the class (`PSavingsCard_additional-info__lOJgX`).
 * `_` is a word character, so a word boundary on either side of the base name misses it.
 */
const HASHED_CLASS = String.raw`(?:__[A-Za-z0-9]+)?`;

const LISTED_SAVINGS_SECTION_PATTERNS = {
  "p-savings-badge__text": new RegExp(
    String.raw`class=["'][^"']*p-savings-badge__text${HASHED_CLASS}[^"']*["'][\s\S]*?>\s*([\s\S]*?)\s*<\/span>`,
    "i",
  ),
  "additional-info": new RegExp(
    String.raw`class=["'][^"']*additional-info${HASHED_CLASS}[^"']*["'][\s\S]*?>\s*([\s\S]*?)\s*<\/span>`,
    "i",
  ),
  "valid-dates": new RegExp(
    String.raw`class=["'][^"']*valid-dates${HASHED_CLASS}[^"']*["'][\s\S]*?>\s*([\s\S]*?)\s*<\/span>`,
    "i",
  ),
} as const;

function readListedSavingsCardSection(
  cardHtml: string,
  section: keyof typeof LISTED_SAVINGS_SECTION_PATTERNS,
) {
  const match = cardHtml.match(LISTED_SAVINGS_SECTION_PATTERNS[section]);
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
