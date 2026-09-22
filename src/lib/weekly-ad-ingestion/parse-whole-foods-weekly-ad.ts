import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const DIRECTIONAL_LABEL = "Directional — Whole Foods weekly sales flyer";

/**
 * Parse Whole Foods sales-flyer HTML (`__NEXT_DATA__.props.pageProps.promotions`)
 * into directional unit-priced offers. Percent-only / BOGO lines are skipped.
 */
export function parseWholeFoodsWeeklyAd(input: {
  html?: string;
  promotions?: unknown;
}): WeeklyAdRawOffer[] {
  const promotions = input.promotions ?? extractPromotionsFromHtml(input.html ?? "");
  if (!Array.isArray(promotions)) {
    return [];
  }

  const offers: WeeklyAdRawOffer[] = [];
  for (const entry of promotions) {
    const offer = normalizePromotion(entry);
    if (offer) {
      offers.push(offer);
    }
  }
  return dedupeOffers(offers);
}

export function extractPromotionsFromHtml(html: string): unknown[] {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    return [];
  }

  try {
    const payload = JSON.parse(match[1]) as unknown;
    const pageProps = asRecord(asRecord(asRecord(payload)?.props)?.pageProps);
    const promotions = pageProps?.promotions;
    return Array.isArray(promotions) ? promotions : [];
  } catch {
    return [];
  }
}

export function parseWholeFoodsOfferPrice(
  priceText: string | undefined,
): { price: number; saleLabel?: string } | null {
  if (!priceText) {
    return null;
  }

  const normalized = priceText.trim();
  if (!normalized) {
    return null;
  }

  if (/bogo|buy\s*\d+\s*,?\s*get\s*\d+/i.test(normalized)) {
    return null;
  }

  if (/%\s*off/i.test(normalized) && !/\$/.test(normalized)) {
    return null;
  }

  const multiBuy =
    normalized.match(/(\d+)\s*(?:for|\/)\s*\$?\s*([\d.]+)/i) ??
    normalized.match(/^(\d+)\s*\/\s*\$?\s*([\d.]+)\s*$/i);
  if (multiBuy?.[1] && multiBuy[2] && /for|^\d+\s*\//i.test(normalized)) {
    const count = Number.parseInt(multiBuy[1], 10);
    const total = Number.parseFloat(multiBuy[2]);
    if (Number.isFinite(count) && count > 1 && Number.isFinite(total) && total > 0) {
      return {
        price: Number((total / count).toFixed(2)),
        saleLabel: `Directional — ${normalized} (unit estimate)`,
      };
    }
  }

  const dollar = normalized.match(/\$\s*([\d.]+)/);
  if (dollar?.[1]) {
    const price = Number.parseFloat(dollar[1]);
    if (Number.isFinite(price) && price > 0) {
      return {
        price,
        saleLabel: /prime/i.test(normalized)
          ? `Directional — ${normalized}`
          : DIRECTIONAL_LABEL,
      };
    }
  }

  return null;
}

function normalizePromotion(entry: unknown): WeeklyAdRawOffer | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const productName =
    readString(record.productName) ??
    readString(record.headline) ??
    readString(record.originBrandName);
  if (!productName || productName.length < 3) {
    return null;
  }

  const brand = readString(record.originBrandName);
  const displayName =
    brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;

  const saleText = readString(record.salePrice);
  const primeText = readString(record.primePrice);
  const regularText = readString(record.regularPrice);
  const percentOnlyDeal =
    isPercentOnlyPrice(saleText) || isPercentOnlyPrice(primeText);

  const parsed =
    parseWholeFoodsOfferPrice(saleText) ??
    parseWholeFoodsOfferPrice(primeText) ??
    (percentOnlyDeal ? null : parseWholeFoodsOfferPrice(regularText));
  if (!parsed) {
    return null;
  }

  const validThrough =
    readString(record.endDate) ??
    readString(record.validThrough) ??
    readString(record.startDate);

  const saleLabelParts = [parsed.saleLabel];
  if (
    parsed.saleLabel === DIRECTIONAL_LABEL &&
    readString(record.primePrice) &&
    /prime|%/i.test(readString(record.primePrice) ?? "")
  ) {
    saleLabelParts.push("Prime price may be lower");
  }

  return {
    productName: displayName,
    price: parsed.price,
    saleLabel: saleLabelParts.filter(Boolean).join(" · "),
    validThrough,
  };
}

function isPercentOnlyPrice(priceText: string | undefined): boolean {
  if (!priceText) {
    return false;
  }
  return /%\s*off/i.test(priceText) && !/\$/.test(priceText);
}

function dedupeOffers(offers: WeeklyAdRawOffer[]): WeeklyAdRawOffer[] {
  const seen = new Set<string>();
  const unique: WeeklyAdRawOffer[] = [];
  for (const offer of offers) {
    const key = `${offer.productName.toLowerCase()}|${offer.price}|${offer.saleLabel ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(offer);
  }
  return unique;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
