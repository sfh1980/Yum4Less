import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { fetchWithRetries } from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";

export const FLIPP_WEEKLY_AD_SEARCH_URL =
  "https://backflipp.wishabi.com/flipp/items/search";

export type FlippWeeklyAdMerchantName = string;

export type FlippWeeklyAdItem = {
  name?: string;
  current_price?: number | null;
  original_price?: number | null;
  pre_price_text?: string | null;
  post_price_text?: string | null;
  sale_story?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  merchant_name?: string;
  _L1?: string | null;
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
  const payload = await fetchFlippJson<FlippWeeklyAdSearchResponse>(
    buildFlippWeeklyAdSearchUrl({
      zipCode: input.zipCode,
      merchantName: input.merchantName,
    }),
    fetchImpl,
    "Flipp weekly-ad search",
  );
  return parseFlippWeeklyAdItems(payload!.items ?? []);
}

/**
 * One Flipp read after the HTTP call returned.
 * provedEmpty: the JSON had the expected array and nothing in it was this merchant's.
 * requestFailed: the JSON shape was not that array, or a later call in the same read failed.
 * An HTTP error, timeout, or invalid JSON is not returned here — those throw,
 * unless the call was one of the lookups that already swallow a failure.
 */
export type FlippOfferRead = {
  offers: WeeklyAdRawOffer[];
  provedEmpty: boolean;
  requestFailed: boolean;
};

export async function fetchFlippSearchOffersForMerchant(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const read = await readFlippMerchantSearch(input);
  return read.offers;
}

/** Merchant search. HTTP and JSON failures throw, same as before. */
export async function readFlippMerchantSearch(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<FlippOfferRead> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const read = await readFlippJson<unknown>(
    buildFlippWeeklyAdSearchUrl({
      zipCode: input.zipCode,
      merchantName: input.merchantName,
    }),
    fetchImpl,
    `Flipp weekly-ad search for ${input.merchantName}`,
  );
  if (read.kind === "failed") {
    throw new Error(`Flipp weekly-ad search for ${input.merchantName} failed`);
  }
  return flippSearchRead(read.value, input.merchantName);
}

export async function fetchFlippFlyerSummaries(input: {
  zipCode: string;
  fetchImpl?: typeof fetch;
}): Promise<FlippFlyerSummary[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const payload = await fetchFlippJson<FlippFlyersResponse | FlippFlyerSummary[]>(
    buildFlippFlyersUrl(input.zipCode),
    fetchImpl,
    "Flipp flyers lookup",
  );
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload!.flyers ?? [];
}

export async function fetchFlippWeeklyAdOffersForMerchantFlyers(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const read = await readFlippMerchantFlyers(input);
  return read.offers;
}

/**
 * Flyer list for one merchant.
 * HTTP and JSON failures on the list throw.
 * A list that is not an array (and has no flyers array) is requestFailed, not proved empty.
 * Zero flyers for this merchant, on an expected list, is provedEmpty.
 * A flyer that is listed still counts even when its items are empty.
 * A swallowed item lookup is requestFailed and is not proved empty.
 */
export async function readFlippMerchantFlyers(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  fetchImpl?: typeof fetch;
}): Promise<FlippOfferRead> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const read = await readFlippJson<unknown>(
    buildFlippFlyersUrl(input.zipCode),
    fetchImpl,
    "Flipp flyers lookup",
  );
  if (read.kind === "failed") {
    throw new Error("Flipp flyers lookup failed");
  }
  const list = flippFlyerList(read.value);
  if (!list.expected) {
    return { offers: [], provedEmpty: false, requestFailed: true };
  }

  const merchantFlyers = list.flyers.filter(
    (flyer) => flyer.merchant?.toLowerCase() === input.merchantName.toLowerCase(),
  );
  if (merchantFlyers.length === 0) {
    return { offers: [], provedEmpty: true, requestFailed: false };
  }

  const selectedFlyers = selectFlyersForWeeklyAdPersist(merchantFlyers);
  const merged: WeeklyAdRawOffer[] = [];
  let requestFailed = false;
  for (const flyer of selectedFlyers) {
    if (typeof flyer.id !== "number") {
      continue;
    }

    const payload = await readFlippJson<unknown>(
      buildFlippWeeklyAdSearchUrl({
        zipCode: input.zipCode,
        flyerId: flyer.id,
      }),
      fetchImpl,
      `Flipp flyer ${flyer.id} lookup`,
      { returnEmptyOnFailure: true },
    );
    if (payload.kind === "failed") {
      requestFailed = true;
      continue;
    }
    const items = flippSearchItems(payload.value);
    if (!items.expected) {
      requestFailed = true;
      continue;
    }
    appendUniqueFlippOffers(
      merged,
      parseFlippWeeklyAdItemsForMerchant(items.items, input.merchantName),
    );
  }

  return { offers: merged, provedEmpty: false, requestFailed };
}

const NON_GROCERY_FLYER_DEPARTMENT =
  /\b(electronics|apparel|clothing|fashion|furniture|pharmacy|beauty|automotive|toys?|sporting goods|home decor)\b/i;

function flyerCategoryTokens(flyer: FlippFlyerSummary): string[] {
  return [
    ...(flyer.categories ?? []),
    ...(flyer.categories_csv?.split(",") ?? []),
    flyer.name ?? "",
  ]
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function flyerIncludesGroceryCategory(flyer: FlippFlyerSummary) {
  return flyerCategoryTokens(flyer).some(
    (category) => category.includes("grocer") || category.includes("grocery"),
  );
}

export function flyerLooksLikeNonGroceryDepartment(flyer: FlippFlyerSummary) {
  if (flyerIncludesGroceryCategory(flyer)) {
    return false;
  }
  return NON_GROCERY_FLYER_DEPARTMENT.test(flyerCategoryTokens(flyer).join(" "));
}

/** Grocery flyers when tagged; otherwise drop explicit merch departments. All chains. */
export function selectFlyersForWeeklyAdPersist(
  merchantFlyers: FlippFlyerSummary[],
): FlippFlyerSummary[] {
  const withIds = merchantFlyers.filter((flyer) => typeof flyer.id === "number");
  const groceryFlyers = withIds.filter((flyer) => flyerIncludesGroceryCategory(flyer));
  if (groceryFlyers.length > 0) {
    return groceryFlyers;
  }
  return withIds.filter((flyer) => !flyerLooksLikeNonGroceryDepartment(flyer));
}

export async function fetchFlippWeeklyAdOffersForSearchTerms(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  searchTerms: string[];
  fetchImpl?: typeof fetch;
}): Promise<WeeklyAdRawOffer[]> {
  const read = await readFlippSupplementalSearches(input);
  return read.offers;
}

/** Ingredient searches. A swallowed failure or unexpected body sets requestFailed. */
export async function readFlippSupplementalSearches(input: {
  zipCode: string;
  merchantName: FlippWeeklyAdMerchantName;
  searchTerms: string[];
  fetchImpl?: typeof fetch;
}): Promise<FlippOfferRead> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const merged: WeeklyAdRawOffer[] = [];
  let requestFailed = false;

  for (const searchTerm of input.searchTerms) {
    const payload = await readFlippJson<unknown>(
      buildFlippWeeklyAdSearchUrl({
        zipCode: input.zipCode,
        merchantName: `${input.merchantName} ${searchTerm}`,
      }),
      fetchImpl,
      `Flipp ${input.merchantName} ${searchTerm} lookup`,
      { returnEmptyOnFailure: true },
    );
    if (payload.kind === "failed") {
      requestFailed = true;
      continue;
    }
    const items = flippSearchItems(payload.value);
    if (!items.expected) {
      requestFailed = true;
      continue;
    }
    appendUniqueFlippOffers(
      merged,
      parseFlippWeeklyAdItems(items.items).filter((offer) =>
        offer.productName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  }

  return {
    offers: merged,
    provedEmpty: !requestFailed && merged.length === 0,
    requestFailed,
  };
}

/** Expected search body is an object whose items field is an array. */
export function flippSearchItems(payload: unknown): {
  expected: boolean;
  items: FlippWeeklyAdItem[];
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { expected: false, items: [] };
  }
  const items = (payload as FlippWeeklyAdSearchResponse).items;
  if (!Array.isArray(items)) {
    return { expected: false, items: [] };
  }
  return { expected: true, items };
}

/** Expected flyer list is a flyers array, or the body itself as an array. */
export function flippFlyerList(payload: unknown): {
  expected: boolean;
  flyers: FlippFlyerSummary[];
} {
  if (Array.isArray(payload)) {
    return { expected: true, flyers: payload.filter(isFlyerSummary) };
  }
  if (!payload || typeof payload !== "object") {
    return { expected: false, flyers: [] };
  }
  const flyers = (payload as FlippFlyersResponse).flyers;
  if (!Array.isArray(flyers)) {
    return { expected: false, flyers: [] };
  }
  return { expected: true, flyers: flyers.filter(isFlyerSummary) };
}

function flippSearchRead(payload: unknown, merchantName: string): FlippOfferRead {
  const parsed = flippSearchItems(payload);
  if (!parsed.expected) {
    return { offers: [], provedEmpty: false, requestFailed: true };
  }
  const normalizedMerchant = merchantName.toLowerCase();
  const merchantItems = parsed.items.filter((item) =>
    item.merchant_name?.toLowerCase().includes(normalizedMerchant),
  );
  return {
    offers: parseFlippWeeklyAdItemsForMerchant(parsed.items, merchantName),
    provedEmpty: merchantItems.length === 0,
    requestFailed: false,
  };
}

function isFlyerSummary(value: unknown): value is FlippFlyerSummary {
  return Boolean(value) && typeof value === "object";
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

type FlippJsonRead<TPayload> =
  | { kind: "ok"; value: TPayload }
  | { kind: "failed" };

async function readFlippJson<TPayload>(
  url: string,
  fetchImpl: typeof fetch,
  context: string,
  options: { returnEmptyOnFailure?: boolean } = {},
): Promise<FlippJsonRead<TPayload>> {
  try {
    const response = await fetchWithRetries(() =>
      fetchImpl(url, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }),
    );

    if (!response.ok) {
      throw new Error(`${context} failed with HTTP ${response.status}`);
    }

    return { kind: "ok", value: (await response.json()) as TPayload };
  } catch (error) {
    if (options.returnEmptyOnFailure) {
      return { kind: "failed" };
    }

    throw error;
  }
}

async function fetchFlippJson<TPayload>(
  url: string,
  fetchImpl: typeof fetch,
  context: string,
  options: { returnEmptyOnFailure?: boolean } = {},
): Promise<TPayload | undefined> {
  const read = await readFlippJson<TPayload>(url, fetchImpl, context, options);
  if (read.kind === "failed") {
    return undefined;
  }
  return read.value;
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

/** Keep uncategorized lines; drop GM departments on mixed circulars such as Dollar General. */
export function flippItemLooksLikeGroceryFood(item: FlippWeeklyAdItem): boolean {
  const department = item._L1?.trim() ?? "";
  if (!department) {
    return true;
  }

  return /food|grocery|produce|meat|dairy|frozen|beverage|drink|deli|bakery/i.test(
    department,
  );
}

export function parseFlippWeeklyAdItemsForMerchant(
  items: FlippWeeklyAdItem[],
  merchantName: string,
): WeeklyAdRawOffer[] {
  const normalizedMerchant = merchantName.toLowerCase();
  const merchantItems = items.filter((item) =>
    item.merchant_name?.toLowerCase().includes(normalizedMerchant),
  );
  const groceryItems =
    normalizedMerchant === "dollar general"
      ? merchantItems.filter(flippItemLooksLikeGroceryFood)
      : merchantItems;
  return parseFlippWeeklyAdItems(groceryItems);
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
    item.merchant_name?.trim(),
    buildFlippPriceContext(item),
    item.sale_story?.trim(),
  ].filter((part): part is string => Boolean(part));

  return {
    productName,
    price,
    saleLabel: saleLabelParts.join(" · "),
    validFrom: item.valid_from?.trim() || undefined,
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
