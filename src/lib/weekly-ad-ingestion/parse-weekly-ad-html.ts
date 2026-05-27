import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const JSON_EMBED_PATTERN =
  /<script[^>]*id=["']weekly-ad-offers-data["'][^>]*>([\s\S]*?)<\/script>/i;

const PRODUCT_CARD_PATTERN =
  /<div[^>]*data-weekly-ad-product=["']([^"']+)["'][^>]*data-price=["']([\d.]+)["'][^>]*>/gi;

export function parseWeeklyAdHtml(html: string): WeeklyAdRawOffer[] {
  const fromJson = parseEmbeddedJsonOffers(html);
  if (fromJson.length > 0) {
    return fromJson;
  }

  return parseProductCardOffers(html);
}

function parseEmbeddedJsonOffers(html: string): WeeklyAdRawOffer[] {
  const match = html.match(JSON_EMBED_PATTERN);
  if (!match?.[1]) {
    return [];
  }

  try {
    const payload = JSON.parse(match[1].trim()) as unknown;
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map(normalizeRawOffer)
      .filter((offer): offer is WeeklyAdRawOffer => offer !== null);
  } catch {
    return [];
  }
}

function parseProductCardOffers(html: string): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];
  let match = PRODUCT_CARD_PATTERN.exec(html);

  while (match) {
    const fullTag = match[0];
    const productName = decodeHtmlEntities(match[1].trim());
    const price = Number.parseFloat(match[2]);
    const saleLabelMatch = fullTag.match(/data-sale-label=["']([^"']+)["']/i);
    const saleLabel = saleLabelMatch?.[1]?.trim();

    if (productName && Number.isFinite(price) && price >= 0) {
      offers.push({
        productName,
        price,
        saleLabel: saleLabel || undefined,
      });
    }

    match = PRODUCT_CARD_PATTERN.exec(html);
  }

  return offers;
}

function normalizeRawOffer(entry: unknown): WeeklyAdRawOffer | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const productName =
    typeof record.productName === "string"
      ? record.productName.trim()
      : typeof record.name === "string"
        ? record.name.trim()
        : "";

  const price =
    typeof record.price === "number"
      ? record.price
      : typeof record.price === "string"
        ? Number.parseFloat(record.price)
        : Number.NaN;

  if (!productName || !Number.isFinite(price) || price < 0) {
    return null;
  }

  const saleLabel =
    typeof record.saleLabel === "string"
      ? record.saleLabel.trim()
      : typeof record.sale === "string"
        ? record.sale.trim()
        : undefined;

  const validThrough =
    typeof record.validThrough === "string" ? record.validThrough.trim() : undefined;

  return {
    productName,
    price,
    saleLabel: saleLabel || undefined,
    validThrough: validThrough || undefined,
  };
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
