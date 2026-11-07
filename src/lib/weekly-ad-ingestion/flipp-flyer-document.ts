/**
 * Reads one Flipp flyer document (GET /flipp/flyers/{id}).
 * Weekly-ad ingest does not write from this module.
 * The flyers-list categories decide grocery versus general merchandise.
 * Item-name votes are a cross-check. When they disagree, the categories win.
 */

import {
  flyerIncludesGroceryCategory,
  flyerLooksLikeNonGroceryDepartment,
  type FlippFlyerSummary,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";

export const FLIPP_FLYER_DOCUMENT_ORIGIN = "https://backflipp.wishabi.com";

export type FlippFlyerDocumentItem = {
  id?: number;
  flyer_id?: number;
  name?: string;
  brand?: string | null;
  price?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  display_type?: number;
};

export type FlippFlyerDocument = {
  items?: FlippFlyerDocumentItem[];
};

/** Weekly-ad offer fields plus the document's own start date and brand. */
export type FlippFlyerDocumentOffer = {
  productName: string;
  price: number;
  brand?: string;
  validFrom?: string;
  validTo?: string;
  validThrough?: string;
  saleLabel?: string;
  flyerId?: number;
  itemId?: number;
};

export type FlippFlyerDocumentKind = "grocery" | "general-merchandise" | "unknown";

export type FlippFlyerListCategoryKind =
  | FlippFlyerDocumentKind
  | "absent";

export type FlippFlyerDocumentClassification = {
  /** Categories when the list has them. Otherwise the name votes. */
  kind: FlippFlyerDocumentKind;
  categoryKind: FlippFlyerListCategoryKind;
  nameKind: FlippFlyerDocumentKind;
  groceryVotes: number;
  generalMerchandiseVotes: number;
  /**
   * False when the list categories and the name votes name opposite kinds.
   * The returned kind is still the category kind.
   */
  crossCheckAgrees: boolean;
};

const FOOD_NAME =
  /\b(chicken|beef|pork|turkey|milk|cheese|bread|cereal|beans?|rice|pasta|apple|pineapple|banana|yogurt|butter|eggs?|onion|potato|tomato|lettuce|broccoli|spinach|salmon|shrimp|bacon|sausage|juice|coffee|k-?cups?|flour|sugar|oil|cracker|applesauce|roast|crab|muffin|berr(?:y|ies)|tenderloin|steak|fish|tuna|soup|sauce|pizza|cheddar|grape|orange|lemon|lime|carrot|pepper|corn|peas?|almond|peanut|cookies?|ice cream|ground|deli|bakery|produce|organic|ham|wings?|nuggets?|tortilla|avocado|kale|salad|cream)\b/i;

const GENERAL_MERCHANDISE_NAME =
  /\b(apparel|d[eé]cor|plush|figure|toy|rolling pin|cookie cutter|dutch oven|laptop|television|\btv\b|tire|boots?|clogs?|cabinet|coffee table|mop|tizen|windows 11|\brtx\b|\bssd\b|headphone|mattress|sofa|shirts?|shoes?|drinkware|serveware|stunt tracks?|squish|cookware|glassware|gift cards?|halloween|holiday home|slow cooker|floor cleaner|storage accent)\b/i;

const NUMERIC_PRICE = /^(\d+(?:\.\d+)?)$/;
const SLASH_MULTI_BUY = /(\d+)\s*\/\s*\$\s*(\d+(?:\.\d+)?)/;
const FOR_MULTI_BUY = /(\d+)\s+for\s+\$\s*(\d+(?:\.\d+)?)/i;

export function buildFlippFlyerDocumentUrl(input: {
  flyerId: number;
  postalCode: string;
}): string {
  const url = new URL(
    `${FLIPP_FLYER_DOCUMENT_ORIGIN}/flipp/flyers/${input.flyerId}`,
  );
  url.searchParams.set("locale", "en-us");
  url.searchParams.set("postal_code", input.postalCode);
  return url.toString();
}

/** A missing or blank price field is unpriced. The item name is not a price. */
export function parseFlippFlyerDocumentPrice(
  price: string | null | undefined,
): { price: number; multiBuyLabel?: string } | null {
  const raw = price?.trim() ?? "";
  if (!raw) {
    return null;
  }
  const numeric = NUMERIC_PRICE.exec(raw);
  if (numeric) {
    return { price: Number(numeric[1]) };
  }
  return readMultiBuy(raw);
}

export function parseFlippFlyerDocument(
  document: FlippFlyerDocument,
): FlippFlyerDocumentOffer[] {
  const offers: FlippFlyerDocumentOffer[] = [];
  for (const item of document.items ?? []) {
    const productName = item.name?.trim() ?? "";
    if (!productName) {
      continue;
    }
    const parsed = parseFlippFlyerDocumentPrice(item.price);
    if (!parsed) {
      continue;
    }
    const brand = item.brand?.trim() || undefined;
    const validFrom = item.valid_from?.trim() || undefined;
    const validTo = item.valid_to?.trim() || undefined;
    const saleLabel = [brand, parsed.multiBuyLabel].filter(Boolean).join(" · ");
    offers.push({
      productName,
      price: parsed.price,
      brand,
      validFrom,
      validTo,
      validThrough: validTo,
      saleLabel: saleLabel || undefined,
      flyerId: item.flyer_id,
      itemId: item.id,
    });
  }
  return offers;
}

/**
 * List categories decide the kind. Name votes are recorded beside that.
 * A missing category list falls through to the name votes.
 * A general-merchandise name match wins over a food match on the same name,
 * so "cookie cutter" is not counted as food. Unmatched names do not vote.
 */
export function classifyFlippFlyerDocument(input: {
  document: FlippFlyerDocument;
  categories?: string[];
  categoriesCsv?: string;
  flyerName?: string;
}): FlippFlyerDocumentClassification {
  const categoryKind = readListCategoryKind(input);
  const nameVotes = countNameVotes(input.document);
  const nameKind = nameKindFromVotes(nameVotes);
  const categoriesDecided =
    categoryKind === "grocery" || categoryKind === "general-merchandise";
  const namesDisagree =
    categoriesDecided &&
    nameKind !== "unknown" &&
    nameKind !== categoryKind;
  const kind = categoriesDecided ? categoryKind : nameKind;
  return {
    kind,
    categoryKind,
    nameKind,
    groceryVotes: nameVotes.groceryVotes,
    generalMerchandiseVotes: nameVotes.generalMerchandiseVotes,
    crossCheckAgrees: !namesDisagree,
  };
}

function readListCategoryKind(input: {
  categories?: string[];
  categoriesCsv?: string;
  flyerName?: string;
}): FlippFlyerListCategoryKind {
  const hasList =
    input.categories !== undefined ||
    input.categoriesCsv !== undefined ||
    input.flyerName !== undefined;
  if (!hasList) {
    return "absent";
  }
  const flyer: FlippFlyerSummary = {
    categories: input.categories,
    categories_csv: input.categoriesCsv,
    name: input.flyerName,
  };
  if (flyerIncludesGroceryCategory(flyer)) {
    return "grocery";
  }
  if (flyerLooksLikeNonGroceryDepartment(flyer)) {
    return "general-merchandise";
  }
  return "unknown";
}

function countNameVotes(document: FlippFlyerDocument): {
  groceryVotes: number;
  generalMerchandiseVotes: number;
} {
  let groceryVotes = 0;
  let generalMerchandiseVotes = 0;
  for (const item of document.items ?? []) {
    const name = item.name?.trim() ?? "";
    if (!name) {
      continue;
    }
    if (GENERAL_MERCHANDISE_NAME.test(name)) {
      generalMerchandiseVotes += 1;
      continue;
    }
    if (FOOD_NAME.test(name)) {
      groceryVotes += 1;
    }
  }
  return { groceryVotes, generalMerchandiseVotes };
}

function nameKindFromVotes(votes: {
  groceryVotes: number;
  generalMerchandiseVotes: number;
}): FlippFlyerDocumentKind {
  if (votes.groceryVotes > votes.generalMerchandiseVotes) {
    return "grocery";
  }
  if (votes.generalMerchandiseVotes > votes.groceryVotes) {
    return "general-merchandise";
  }
  return "unknown";
}

export async function fetchFlippFlyerDocument(input: {
  flyerId: number;
  postalCode: string;
  categories?: string[];
  categoriesCsv?: string;
  flyerName?: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  offers: FlippFlyerDocumentOffer[];
  classification: FlippFlyerDocumentClassification;
}> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildFlippFlyerDocumentUrl({
      flyerId: input.flyerId,
      postalCode: input.postalCode,
    }),
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Flipp flyer document ${input.flyerId} failed with HTTP ${response.status}`,
    );
  }
  const document = (await response.json()) as FlippFlyerDocument;
  return {
    offers: parseFlippFlyerDocument(document),
    classification: classifyFlippFlyerDocument({
      document,
      categories: input.categories,
      categoriesCsv: input.categoriesCsv,
      flyerName: input.flyerName,
    }),
  };
}

function readMultiBuy(value: string): { price: number; multiBuyLabel: string } | null {
  const match = SLASH_MULTI_BUY.exec(value) ?? FOR_MULTI_BUY.exec(value);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(total)) {
    return null;
  }
  return { price: total / count, multiBuyLabel: match[0] };
}
