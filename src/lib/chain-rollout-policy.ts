import type { StoreChain } from "@/lib/provider-rollout";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Canonical beta v1 chains shoppers may rank and select in Settings. */
export const SHOPPER_RANKED_V1_CHAINS = [
  "kroger",
  "aldi",
  "publix",
  "food-lion",
] as const satisfies readonly StoreChain[];

export type ShopperRankedV1Chain = (typeof SHOPPER_RANKED_V1_CHAINS)[number];

/** v1 chains shoppers may select in Settings (scope for ingredients + rank). */
export const SETTINGS_SELECTABLE_CHAINS = new Set<StoreChain>(SHOPPER_RANKED_V1_CHAINS);

export const SETTINGS_SELECTABLE_CHAIN_ORDER: StoreChain[] = [
  ...SHOPPER_RANKED_V1_CHAINS,
];

/**
 * Chains eligible for weekly-ad ingest sync and promotion-readiness checks.
 * Includes Walmart so rehearsal/fixture ingest can persist rows, but
 * `weeklyAdPromotionGatesPass()` still hard-blocks Walmart — never promotable yet.
 */
export const WEEKLY_AD_RANKED_PRICING_CHAINS = new Set<WeeklyAdChain>([
  ...SHOPPER_RANKED_V1_CHAINS,
  "lidl",
  "walmart",
]);

/**
 * Chains surfaced in provider rollout catalog / map context lists.
 * BJ's is display-only here — intentionally not in SETTINGS_SELECTABLE_CHAINS
 * (upcoming-release map context, not a ranked v1 shopper pick).
 */
export const PROVIDER_CATALOG_DISPLAY_CHAINS: StoreChain[] = [
  ...SHOPPER_RANKED_V1_CHAINS,
  "lidl",
  "walmart",
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

const KROGER_FAMILY_NAME_MARKERS = [
  "kroger",
  "harris teeter",
  "ralphs",
  "fred meyer",
  "king soopers",
  "smith's",
  "smiths",
  "fry's",
  "frys",
  "qfc",
  "mariano",
  "pick n save",
  "metro market",
  "jay c",
  "food 4 less",
  "food4less",
  "dillons",
  "gerbes",
  "baker's",
  "bakers",
  "city market",
  "pay less",
] as const;

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
};

export function getCanonicalShopperChainDisplayName(
  chain: StoreChain,
): string | undefined {
  return CANONICAL_SHOPPER_CHAIN_DISPLAY_NAMES[chain];
}

export function isPublixCatalogSourceName(
  sourceName?: string | null,
): boolean {
  return (
    sourceName === "publix-store-locator" ||
    sourceName === "publix-weekly-ad-scrape"
  );
}

export function inferStoreChainFromName(storeName: string): StoreChain {
  const normalized = storeName.trim().toLowerCase();

  if (KROGER_FAMILY_NAME_MARKERS.some((marker) => normalized.includes(marker))) {
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
  if (normalized.includes("bj")) {
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

  return "unknown";
}

export type CatalogStoreChainInput = {
  id: string;
  name: string;
  sourceName?: string | null;
  /** DB row alias — accepted for catalog-sync call sites. */
  source_name?: string | null;
};

function readCatalogSourceName(
  store: Pick<CatalogStoreChainInput, "sourceName" | "source_name">,
): string | null | undefined {
  return store.sourceName ?? store.source_name;
}

const CATALOG_SOURCE_CHAIN_BY_NAME: Record<string, StoreChain> = {
  "publix-store-locator": "publix",
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
  [/^bjs-/, "bjs"],
];

const KNOWN_WEEKLY_AD_SOURCE_CHAINS = new Set<string>([
  ...WEEKLY_AD_RANKED_PRICING_CHAINS,
  "dollar-general",
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

  return inferStoreChainFromName(store.name);
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
        required: true,
        note: "Lidl is still pre-promotion; coordinate sanity is part of its required rollout audit.",
      };
    case "kroger":
    case "aldi":
    case "publix":
      return {
        required: false,
        note: `${chain} remains on the current rollout path until address-backed audit evidence is persisted; do not regress live ranked pricing while stores lack street-address rows.`,
      };
    case "walmart":
    case "bjs":
      return {
        required: false,
        note: `${chain} is context-only today, so coordinate sanity is tracked as a catalog audit rather than a ranked-promotion blocker.`,
      };
    default:
      return {
        required: false,
        note: `${chain} is outside the current ranked weekly-ad rollout, so coordinate sanity is not an active promotion gate yet.`,
      };
  }
}
