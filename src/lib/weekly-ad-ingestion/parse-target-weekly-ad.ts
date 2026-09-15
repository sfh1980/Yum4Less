import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/**
 * Parse Target weekly-ad promotion JSON (store_promotions detail pages) into
 * directional raw offers. Skips BOGO / percent-only lines without a clear unit price.
 */
export function parseTargetWeeklyAd(input: {
  promotionDetails: unknown[];
  validThroughFallback?: string;
}): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];

  for (const detail of input.promotionDetails) {
    const validThrough =
      readPromotionValidThrough(detail) ?? input.validThroughFallback;
    appendHotspotOffers(detail, offers, validThrough);
  }

  return dedupeOffers(offers);
}

function appendHotspotOffers(
  detail: unknown,
  offers: WeeklyAdRawOffer[],
  validThrough: string | undefined,
) {
  const pages = readPages(detail);
  for (const page of pages) {
    const hotspots = Array.isArray(page.hotspots) ? page.hotspots : [];
    for (const hotspot of hotspots) {
      const offer = normalizeHotspotOffer(hotspot, validThrough);
      if (offer) {
        offers.push(offer);
      }
    }
  }
}

function normalizeHotspotOffer(
  hotspot: unknown,
  validThrough: string | undefined,
): WeeklyAdRawOffer | null {
  const record = asRecord(hotspot);
  if (!record) {
    return null;
  }

  const productName =
    readString(record.title) ??
    readString(record.name) ??
    readString(record.link_title) ??
    readString(record.product_description);
  if (!productName || productName.length < 3) {
    return null;
  }

  const priceText =
    stringifyPrice(record.price) ??
    readString(record.sale_story) ??
    readString(record.price_text) ??
    readString(record.promotion_message);
  const parsed = parseTargetOfferPrice(priceText);
  if (!parsed) {
    return null;
  }

  const saleLabelParts = [
    parsed.saleLabel,
    readString(record.price_qualifier),
  ].filter((part): part is string => Boolean(part));

  return {
    productName,
    price: parsed.price,
    saleLabel:
      saleLabelParts.length > 0
        ? saleLabelParts.join(" · ")
        : "Directional — Target weekly ad",
    validThrough:
      readString(record.end_date) ??
      readString(record.validThrough) ??
      validThrough,
  };
}

export function parseTargetOfferPrice(
  priceText: string | undefined,
): { price: number; saleLabel?: string } | null {
  if (!priceText) {
    return null;
  }

  const normalized = priceText.trim();
  if (!normalized) {
    return null;
  }

  if (/bogo|buy\s*\d+\s*,?\s*get\s*\d+|%\s*off/i.test(normalized)) {
    return null;
  }

  const multiBuy = normalized.match(/^(\d+)\s*\/\s*\$?\s*([\d.]+)\s*$/i);
  if (multiBuy?.[1] && multiBuy[2]) {
    const count = Number.parseInt(multiBuy[1], 10);
    const total = Number.parseFloat(multiBuy[2]);
    if (Number.isFinite(count) && count > 0 && Number.isFinite(total) && total > 0) {
      return {
        price: Number((total / count).toFixed(2)),
        saleLabel: `Directional — ${normalized} (unit estimate)`,
      };
    }
  }

  const bareNumber = normalized.match(/^\$?\s*([\d.]+)\s*$/);
  if (bareNumber?.[1]) {
    const price = Number.parseFloat(bareNumber[1]);
    if (Number.isFinite(price) && price > 0) {
      return { price, saleLabel: "Directional — Target weekly ad" };
    }
  }

  const dollar = normalized.match(/\$\s*([\d.]+)/);
  if (dollar?.[1]) {
    const price = Number.parseFloat(dollar[1]);
    if (Number.isFinite(price) && price > 0) {
      return {
        price,
        saleLabel: `Directional — ${normalized}`,
      };
    }
  }

  return null;
}

function readPages(detail: unknown): Record<string, unknown>[] {
  const record = asRecord(detail);
  if (!record || !Array.isArray(record.pages)) {
    return [];
  }

  return record.pages
    .map((page) => asRecord(page))
    .filter((page): page is Record<string, unknown> => Boolean(page));
}

function readPromotionValidThrough(detail: unknown): string | undefined {
  const record = asRecord(detail);
  if (!record) {
    return undefined;
  }

  return (
    readString(record.sale_end_date) ??
    readString(record.promotion_end_date) ??
    readString(record.validThrough)
  );
}

function stringifyPrice(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return readString(value);
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
