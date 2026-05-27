import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const FLIPP_WEEKLY_AD_SEARCH_URL =
  "https://backflipp.wishabi.com/flipp/items/search";

export type FlippWeeklyAdMerchantName =
  | "Kroger"
  | "Walmart"
  | "Publix"
  | "ALDI"
  | "Food Lion";

export type FlippWeeklyAdItem = {
  name?: string;
  current_price?: number | null;
  original_price?: number | null;
  pre_price_text?: string | null;
  post_price_text?: string | null;
  sale_story?: string | null;
  valid_to?: string | null;
  merchant_name?: string;
};

export type FlippWeeklyAdSearchResponse = {
  items?: FlippWeeklyAdItem[];
};

export type FlippFlyerSummary = {
  id?: number;
  merchant?: string;
  name?: string;
  categories?: string[];
  categories_csv?: string;
};

export type FlippFlyersResponse = {
  flyers?: FlippFlyerSummary[];
};

export function buildFlippWeeklyAdSearchUrl(input: {
  zipCode: string;
  merchantName?: string;
  flyerId?: number;
}) {
  const url = new URL(FLIPP_WEEKLY_AD_SEARCH_URL);
  url.searchParams.set("locale", "en-us");
  url.searchParams.set("postal_code", input.zipCode);
  if (input.merchantName) {
    url.searchParams.set("q", input.merchantName);
  }
  if (input.flyerId !== undefined) {
    url.searchParams.set("flyer_id", String(input.flyerId));
  }
  return url.toString();
}

export function buildFlippFlyersUrl(zipCode: string) {
  const url = new URL("https://backflipp.wishabi.com/flipp/flyers");
  url.searchParams.set("locale", "en-us");
  url.searchParams.set("postal_code", zipCode);
  return url.toString();
}

export async function fetchFlippWeeklyAdOffers(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildFlippWeeklyAdSearchUrl({
      zipCode: input.zipCode,
      merchantName: input.merchantName,
    }),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Flipp weekly-ad search failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FlippWeeklyAdSearchResponse;
  return parseFlippWeeklyAdItems(payload.items ?? []);
}

export async function fetchFlippSearchOffersForMerchant(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildFlippWeeklyAdSearchUrl({
      zipCode: input.zipCode,
      merchantName: input.merchantName,
    }),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Flipp weekly-ad search for ${input.merchantName} failed with HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as FlippWeeklyAdSearchResponse;
  return parseFlippWeeklyAdItemsForMerchant(payload.items ?? [], input.merchantName);
}

export async function fetchFlippFlyerSummaries(input: {
  zipCode: string;
  fetchImpl?: typeof fetch;
}): Promise<FlippFlyerSummary[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(buildFlippFlyersUrl(input.zipCode), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Flipp flyers lookup failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FlippFlyersResponse | FlippFlyerSummary[];
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.flyers ?? [];
}

export async function fetchFlippWeeklyAdOffersForMerchantFlyers(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const flyers = await fetchFlippFlyerSummaries({
    zipCode: input.zipCode,
    fetchImpl,
  });
  const merchantFlyers = flyers.filter(
    (flyer) => flyer.merchant?.toLowerCase() === input.merchantName.toLowerCase(),
  );
  const groceryFlyers = merchantFlyers.filter((flyer) => flyerIncludesGroceryCategory(flyer));
  const selectedFlyers =
    groceryFlyers.length > 0
      ? groceryFlyers
      : merchantFlyers.filter((flyer) => typeof flyer.id === "number");

  const merged: WeeklyAdRawOffer[] = [];
  for (const flyer of selectedFlyers) {
    if (typeof flyer.id !== "number") {
      continue;
    }

    const response = await fetchImpl(
      buildFlippWeeklyAdSearchUrl({
        zipCode: input.zipCode,
        flyerId: flyer.id,
      }),
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as FlippWeeklyAdSearchResponse;
    appendUniqueFlippOffers(
      merged,
      parseFlippWeeklyAdItemsForMerchant(payload.items ?? [], input.merchantName),
    );
  }

  return merged;
}

function flyerIncludesGroceryCategory(flyer: FlippFlyerSummary) {
  const categories = [
    ...(flyer.categories ?? []),
    ...(flyer.categories_csv?.split(",") ?? []),
  ]
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean);

  return categories.some(
    (category) => category.includes("grocer") || category.includes("grocery"),
  );
}

export async function fetchFlippWeeklyAdOffersForSearchTerms(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  searchTerms: string[];
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const merged: WeeklyAdRawOffer[] = [];

  for (const searchTerm of input.searchTerms) {
    const response = await fetchImpl(
      buildFlippWeeklyAdSearchUrl({
        zipCode: input.zipCode,
        merchantName: `${input.merchantName} ${searchTerm}`,
      }),
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as FlippWeeklyAdSearchResponse;
    appendUniqueFlippOffers(
      merged,
      parseFlippWeeklyAdItems(payload.items ?? []).filter((offer) =>
        offer.productName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  }

  return merged;
}

export function mergeWeeklyAdRawOffers(
  ...offerGroups: WeeklyAdRawOffer[][]
): WeeklyAdRawOffer[] {
  const merged: WeeklyAdRawOffer[] = [];
  for (const group of offerGroups) {
    appendUniqueFlippOffers(merged, group);
  }
  return merged;
}

function appendUniqueFlippOffers(target: WeeklyAdRawOffer[], nextOffers: WeeklyAdRawOffer[]) {
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

export function parseFlippWeeklyAdItems(items: FlippWeeklyAdItem[]): WeeklyAdRawOffer[] {
  const offers: WeeklyAdRawOffer[] = [];

  for (const item of items) {
    const offer = normalizeFlippWeeklyAdItem(item);
    if (!offer) {
      continue;
    }

    const key = `${offer.productName.toLowerCase()}::${offer.price.toFixed(2)}`;
    const exists = offers.some(
      (existing) =>
        `${existing.productName.toLowerCase()}::${existing.price.toFixed(2)}` === key,
    );
    if (!exists) {
      offers.push(offer);
    }
  }

  return offers;
}

export function parseFlippWeeklyAdItemsForMerchant(
  items: FlippWeeklyAdItem[],
  merchantName: string,
): WeeklyAdRawOffer[] {
  const normalizedMerchant = merchantName.toLowerCase();
  return parseFlippWeeklyAdItems(
    items.filter((item) =>
      item.merchant_name?.toLowerCase().includes(normalizedMerchant),
    ),
  );
}

function normalizeFlippWeeklyAdItem(item: FlippWeeklyAdItem): WeeklyAdRawOffer | null {
  const productName = item.name?.trim();
  if (!productName) {
    return null;
  }

  const price = readFlippPrice(item);
  if (price === undefined) {
    return null;
  }

  const saleLabelParts = [
    "Directional — weekly ad syndicated feed",
    item.merchant_name?.trim(),
    buildFlippPriceContext(item),
    item.sale_story?.trim(),
  ].filter((part): part is string => Boolean(part));

  return {
    productName,
    price,
    saleLabel: saleLabelParts.join(" · "),
    validThrough: item.valid_to?.trim() || undefined,
  };
}

function readFlippPrice(item: FlippWeeklyAdItem) {
  if (typeof item.current_price === "number" && Number.isFinite(item.current_price)) {
    return item.current_price;
  }

  if (typeof item.original_price === "number" && Number.isFinite(item.original_price)) {
    return item.original_price;
  }

  return undefined;
}

function buildFlippPriceContext(item: FlippWeeklyAdItem) {
  const parts = [item.pre_price_text?.trim(), item.post_price_text?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}
