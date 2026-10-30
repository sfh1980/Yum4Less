import { KNOWN_DINNER_ADAPTER_CHAIN_IDS } from "@/lib/chain-membership";
import type { StoreChain } from "@/lib/provider-rollout";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/**
 * Known dinner-adapter ids (code that exists). Production *membership* is
 * `chain_registry` via `loadChainMembership()` — do not use this list to
 * unlock or block dinners.
 */
export const SHOPPER_RANKED_V1_CHAINS = KNOWN_DINNER_ADAPTER_CHAIN_IDS;

export type ShopperRankedV1Chain = (typeof SHOPPER_RANKED_V1_CHAINS)[number];

/** v1 chains shoppers may select in Settings (scope for ingredients + rank). */
export const SETTINGS_SELECTABLE_CHAINS = new Set<StoreChain>(SHOPPER_RANKED_V1_CHAINS);

export const SETTINGS_SELECTABLE_CHAIN_ORDER: StoreChain[] = [
  ...SHOPPER_RANKED_V1_CHAINS,
];

/**
 * Known dinner-adapter weekly-ad ids (code that exists). Runtime promotion
 * eligibility is `chain_registry.shopper_ranked` plus code floors.
 */
export const WEEKLY_AD_RANKED_PRICING_CHAINS = new Set<WeeklyAdChain>([
  ...SHOPPER_RANKED_V1_CHAINS,
]);

/**
 * Chains surfaced in provider rollout catalog / map context lists.
 * BJ's is display-only here — intentionally not in SETTINGS_SELECTABLE_CHAINS
 * (upcoming-release map context, not a ranked v1 shopper pick).
 */
export const PROVIDER_CATALOG_DISPLAY_CHAINS: StoreChain[] = [
  ...SHOPPER_RANKED_V1_CHAINS,
  "bjs",
];

export function listProviderCatalogRolloutChains(): StoreChain[] {
  return [...PROVIDER_CATALOG_DISPLAY_CHAINS];
}

/** Map context-only catalog chains (display list minus ranked v1). */
export function listMapContextOnlyCatalogChains(): StoreChain[] {
  return PROVIDER_CATALOG_DISPLAY_CHAINS.filter(
    (chain) => !SHOPPER_RANKED_V1_CHAINS.includes(chain as ShopperRankedV1Chain),
  );
}

/**
 * Warehouse clubs surfaced via OSM/SNAP discovery but not yet modeled as StoreChain
 * catalog rows — name fragments align with osm-food-retail-discovery / snap-retailer-locations.
 */
export const MAP_CONTEXT_ONLY_NAME_FRAGMENTS = ["costco", "sam's club"] as const;

/** Shopper-facing banner names for Kroger-family storefronts. Family is plumbing only. */
export const KROGER_FAMILY_BANNERS = [
  { fragment: "harris teeter", label: "Harris Teeter" },
  { fragment: "food 4 less", label: "Food 4 Less" },
  { fragment: "food4less", label: "Food 4 Less" },
  { fragment: "pick n save", label: "Pick n Save" },
  { fragment: "metro market", label: "Metro Market" },
  { fragment: "king soopers", label: "King Soopers" },
  { fragment: "fred meyer", label: "Fred Meyer" },
  { fragment: "city market", label: "City Market" },
  { fragment: "pay less", label: "Pay Less" },
  { fragment: "jay c", label: "Jay C" },
  { fragment: "ralphs", label: "Ralphs" },
  { fragment: "fry's", label: "Fry's" },
  { fragment: "frys", label: "Fry's" },
  { fragment: "smith's", label: "Smith's" },
  { fragment: "smiths", label: "Smith's" },
  { fragment: "qfc", label: "QFC" },
  { fragment: "mariano", label: "Mariano's" },
  { fragment: "dillons", label: "Dillons" },
  { fragment: "gerbes", label: "Gerbes" },
  { fragment: "baker's", label: "Baker's" },
  { fragment: "bakers", label: "Baker's" },
  { fragment: "kroger", label: "Kroger" },
] as const;

const KROGER_FAMILY_NAME_MARKERS = KROGER_FAMILY_BANNERS.map(
  (banner) => banner.fragment,
);

/**
 * These fragments also appear inside unrelated store names
 * ("River City Market"). A display name is not enough.
 * A leading banner name still matches when an official Kroger location id
 * or a separate OSM brand tag is present.
 */
const GENERIC_KROGER_NAME_FRAGMENTS = ["city market", "metro market", "pay less"] as const;

const DISTINCTIVE_KROGER_NAME_MARKERS = KROGER_FAMILY_NAME_MARKERS.filter(
  (marker) =>
    !(GENERIC_KROGER_NAME_FRAGMENTS as readonly string[]).includes(marker),
);

export type StoreChainNameEvidence = {
  /** Official Kroger-family location id. An OSM node id does not count. */
  krogerLocationId?: string | null;
  /** Official BJ's location id. A bare "bj" in a name is not enough without this or an OSM brand. */
  bjsRetailerId?: string | null;
  /** OSM `brand` tag kept apart from the display name. */
  osmBrand?: string | null;
};

function isGenericKrogerNameFragment(fragment: string): boolean {
  return (GENERIC_KROGER_NAME_FRAGMENTS as readonly string[]).includes(fragment);
}

/** "City Market" and "City Market #12" match. "River City Market" does not. */
function startsWithNameFragment(value: string, fragment: string): boolean {
  if (!value.startsWith(fragment)) {
    return false;
  }
  const next = value.charAt(fragment.length);
  return next === "" || !/[a-z0-9]/.test(next);
}

function hasDistinctiveBjsName(normalized: string): boolean {
  return normalized.includes("bj's") || /(?:^|[^a-z])bjs(?:[^a-z]|$)/.test(normalized);
}

/** The two letters "bj" as their own token, not "bj's" or "bjs", and not "object". */
function hasBareBjToken(normalized: string): boolean {
  if (hasDistinctiveBjsName(normalized)) {
    return false;
  }
  return /(?:^|[^a-z])bj(?:[^a-z]|$)/.test(normalized);
}

function brandIndicatesKroger(brand: string): boolean {
  if (!brand) {
    return false;
  }
  if (DISTINCTIVE_KROGER_NAME_MARKERS.some((marker) => brand.includes(marker))) {
    return true;
  }
  return GENERIC_KROGER_NAME_FRAGMENTS.some((marker) =>
    startsWithNameFragment(brand, marker),
  );
}

function brandIndicatesBjs(brand: string): boolean {
  return hasDistinctiveBjsName(brand) || hasBareBjToken(brand);
}

export const COORDINATE_SANITY_EXCEPTIONS: Record<string, string> = {
  // Add store ids here only after a human has verified the deliberate offset.
  "osm-node-3103220732":
    "Withheld 2026-07-03: SNAP + satellite review showed the stored storefront pin was correct while Nominatim landed on road geometry.",
  "osm-node-6527816794":
    "Withheld 2026-07-03: SNAP + satellite review showed the stored storefront pin was correct while Nominatim landed on an interchange/road geometry.",
};

export type CoordinateSanityPromotionRequirement = {
  required: boolean;
  note: string;
};

export function buildDirectionalRolloutNote(chainLabel: string): string {
  return `${chainLabel} dinner estimates use saved sale prices when available near you. Totals are estimates — verify in store.`;
}

/** Shopper-facing chain headlines — keep aligned with `PROVIDER_ROLLOUT` labels. */
const CANONICAL_SHOPPER_CHAIN_DISPLAY_NAMES: Partial<Record<StoreChain, string>> = {
  kroger: "Kroger",
  aldi: "Aldi",
  publix: "Publix",
  "food-lion": "Food Lion",
  walmart: "Walmart",
  bjs: "BJ's",
  lidl: "Lidl",
  "trader-joes": "Trader Joe's",
  "dollar-general": "Dollar General",
  target: "Target",
  "whole-foods": "Whole Foods",
};

export function getCanonicalShopperChainDisplayName(
  chain: StoreChain,
): string | undefined {
  return CANONICAL_SHOPPER_CHAIN_DISPLAY_NAMES[chain];
}

/** Banner shoppers should see. Harris Teeter stays Harris Teeter, not Kroger. */
export function inferShopperBannerDisplayName(
  storeName: string,
  evidence?: StoreChainNameEvidence,
): string | undefined {
  const normalized = storeName.trim().toLowerCase();
  const brand = evidence?.osmBrand?.trim().toLowerCase() ?? "";
  if (!normalized && !brand) {
    return undefined;
  }

  const krogerLocationId = evidence?.krogerLocationId?.trim() ?? "";
  const familyMatch = [...KROGER_FAMILY_BANNERS]
    .sort((left, right) => right.fragment.length - left.fragment.length)
    .find((banner) => {
      if (isGenericKrogerNameFragment(banner.fragment)) {
        const nameLeads = startsWithNameFragment(normalized, banner.fragment);
        const brandLeads = startsWithNameFragment(brand, banner.fragment);
        return brandLeads || (krogerLocationId.length > 0 && nameLeads);
      }
      return normalized.includes(banner.fragment) || brand.includes(banner.fragment);
    });
  if (familyMatch) {
    return familyMatch.label;
  }

  return getCanonicalShopperChainDisplayName(
    inferStoreChainFromName(storeName, evidence),
  );
}

export function isPublixCatalogSourceName(
  sourceName?: string | null,
): boolean {
  return (
    sourceName === "publix-store-locator" ||
    sourceName === "publix-weekly-ad-scrape"
  );
}

export function inferStoreChainFromName(
  storeName: string,
  evidence?: StoreChainNameEvidence,
): StoreChain {
  const normalized = storeName.trim().toLowerCase();
  const brand = evidence?.osmBrand?.trim().toLowerCase() ?? "";
  const krogerLocationId = evidence?.krogerLocationId?.trim() ?? "";
  const bjsRetailerId = evidence?.bjsRetailerId?.trim() ?? "";

  if (DISTINCTIVE_KROGER_NAME_MARKERS.some((marker) => normalized.includes(marker))) {
    return "kroger";
  }
  if (brandIndicatesKroger(brand)) {
    return "kroger";
  }
  if (
    krogerLocationId &&
    GENERIC_KROGER_NAME_FRAGMENTS.some((marker) =>
      startsWithNameFragment(normalized, marker),
    )
  ) {
    return "kroger";
  }
  if (normalized.includes("publix")) {
    return "publix";
  }
  if (normalized.includes("walmart")) {
    return "walmart";
  }
  if (normalized.includes("aldi")) {
    return "aldi";
  }
  if (hasDistinctiveBjsName(normalized) || brandIndicatesBjs(brand)) {
    return "bjs";
  }
  if (hasBareBjToken(normalized) && bjsRetailerId) {
    return "bjs";
  }
  if (normalized.includes("food lion")) {
    return "food-lion";
  }
  if (normalized.includes("lidl")) {
    return "lidl";
  }
  if (normalized.includes("trader joe")) {
    return "trader-joes";
  }
  if (normalized.includes("dollar general")) {
    return "dollar-general";
  }
  if (normalized.includes("target")) {
    return "target";
  }
  if (normalized.includes("whole foods")) {
    return "whole-foods";
  }

  return "unknown";
}

export type CatalogStoreChainInput = {
  id: string;
  name: string;
  sourceName?: string | null;
  /** DB row alias — accepted for catalog-sync call sites. */
  source_name?: string | null;
  osmBrand?: string | null;
  krogerLocationId?: string | null;
  bjsRetailerId?: string | null;
};

function readCatalogSourceName(
  store: Pick<CatalogStoreChainInput, "sourceName" | "source_name">,
): string | null | undefined {
  return store.sourceName ?? store.source_name;
}

const CATALOG_SOURCE_CHAIN_BY_NAME: Record<string, StoreChain> = {
  "publix-store-locator": "publix",
  "target-store-locator": "target",
  "whole-foods-store-locator": "whole-foods",
  "kroger-official-api": "kroger",
  "yum4less-market-catalog": "aldi",
};

const CATALOG_ID_PREFIX_CHAINS: ReadonlyArray<readonly [RegExp, StoreChain]> = [
  [/^publix-/, "publix"],
  [/^kroger-/, "kroger"],
  [/^aldi-/, "aldi"],
  [/^food-lion-/, "food-lion"],
  [/^walmart-/, "walmart"],
  [/^lidl-/, "lidl"],
  [/^trader-joes-/, "trader-joes"],
  [/^dollar-general-/, "dollar-general"],
  [/^target-/, "target"],
  [/^whole-foods-/, "whole-foods"],
  [/^bjs-/, "bjs"],
];

const KNOWN_WEEKLY_AD_SOURCE_CHAINS = new Set<string>([
  ...WEEKLY_AD_RANKED_PRICING_CHAINS,
  "dollar-general",
  "lidl",
  "target",
  "whole-foods",
]);

function isKnownStoreChain(value: string): value is StoreChain {
  return value !== "unknown" && KNOWN_WEEKLY_AD_SOURCE_CHAINS.has(value);
}

export function inferStoreChainFromCatalogSource(
  sourceName: string | null | undefined,
): StoreChain | null {
  const normalized = sourceName?.trim();
  if (!normalized) {
    return null;
  }

  const mapped = CATALOG_SOURCE_CHAIN_BY_NAME[normalized];
  if (mapped) {
    return mapped;
  }

  if (normalized.endsWith("-weekly-ad-scrape")) {
    const candidate = normalized.replace(/-weekly-ad-scrape$/, "");
    if (isKnownStoreChain(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function inferStoreChainFromIdPrefix(storeId: string): StoreChain | null {
  for (const [pattern, chain] of CATALOG_ID_PREFIX_CHAINS) {
    if (pattern.test(storeId)) {
      return chain;
    }
  }

  return null;
}

/**
 * Resolve chain for catalog-backed stores. Prefer ingest-controlled `sourceName`
 * and stable `id` conventions before locator/OSM display names.
 */
export function inferStoreChainFromCatalog(store: CatalogStoreChainInput): StoreChain {
  const fromSource = inferStoreChainFromCatalogSource(readCatalogSourceName(store));
  if (fromSource) {
    return fromSource;
  }

  const fromId = inferStoreChainFromIdPrefix(store.id);
  if (fromId) {
    return fromId;
  }

  return inferStoreChainFromName(store.name, {
    osmBrand: store.osmBrand,
    krogerLocationId: store.krogerLocationId,
    bjsRetailerId: store.bjsRetailerId,
  });
}

export function getCoordinateSanityPromotionRequirement(
  chain: StoreChain,
): CoordinateSanityPromotionRequirement {
  switch (chain) {
    case "food-lion":
      return {
        required: true,
        note: "Food Lion promotion audits must pass coordinate sanity before rollout claims expand.",
      };
    case "lidl":
      return {
        required: false,
        note: "Lidl dinner totals use a ZIP weekly ad, not this store's shelf. Coordinate sanity is a catalog audit.",
      };
    case "kroger":
    case "aldi":
    case "publix":
      return {
        required: false,
        note: `${chain} remains on the current rollout path until address-backed audit evidence is persisted; do not regress live ranked pricing while stores lack street-address rows.`,
      };
    case "walmart":
      return {
        required: false,
        note: `${chain} uses the same weekly-ad coverage floors as other ranked banners; coordinate sanity is tracked as a catalog audit.`,
      };
    case "dollar-general":
      return {
        required: false,
        note: "Dollar General uses the same weekly-ad coverage floors; dinners also require no other ranked grocer nearby. Coordinate sanity is a catalog audit.",
      };
    case "target":
      return {
        required: false,
        note: `${chain} uses the same weekly-ad coverage floors as other ranked banners; coordinate sanity is tracked as a catalog audit.`,
      };
    case "whole-foods":
      return {
        required: false,
        note: `${chain} uses the same weekly-ad coverage floors as other ranked banners; coordinate sanity is tracked as a catalog audit.`,
      };
    default:
      return {
        required: false,
        note: `${chain} is outside the current ranked weekly-ad rollout, so coordinate sanity is not an active promotion gate yet.`,
      };
  }
}
