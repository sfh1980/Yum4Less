import { inferStoreChainFromName } from "@/lib/chain-rollout-policy";
import { WEEKLY_AD_CHAINS } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import type { DensityClass } from "@/lib/market-density";

export type OwnerAdmissionGroup = "will-ingest" | "food-only" | "needs-you";

export type OwnerAdmissionStore = {
  name: string;
  kind: string;
  city: string;
  state: string;
  localityIsApproximate?: boolean;
  group: OwnerAdmissionGroup;
  chainId: string;
};

export type GroceryPinInput = {
  name: string;
  kind?: string;
  shopTag?: string;
};

const CONVENIENCE_NAME_FRAGMENTS = [
  "7-eleven",
  "7 eleven",
  "7eleven",
  "wawa",
  "sheetz",
  "circle k",
  "caseys",
  "casey's",
  "racetrac",
  "race track",
  "racetrack",
  "qt ",
  "quicktrip",
  "kwik trip",
  "mini mart",
  "minimart",
  "food mart",
  "fas mart",
  "fasmart",
  "dash in",
  "snack shop",
  "pit stop",
  "one stop",
  "convenience",
  "express mart",
  "corner store",
] as const;

const BAKERY_NAME_FRAGMENTS = [
  "bakery",
  "bake shop",
  "bake shoppe",
  "bread co",
  "bread company",
  "great harvest",
  "dunkin",
  "panera",
  "krispy kreme",
  "nothing bundt",
] as const;

const SPECIALTY_NAME_FRAGMENTS = [
  "seafood",
  "butcher",
  "deli",
  "fish market",
  "meat market",
  " meats",
] as const;

const SPECIALTY_OSM_SHOP_TAGS = [
  "convenience",
  "bakery",
  "butcher",
  "seafood",
  "deli",
] as const;

const PHARMACY_NAME_FRAGMENTS = ["cvs", "walgreens", "rite aid", "riteaid"] as const;

const CLUB_NAME_FRAGMENTS = ["costco", "sam's club", "sams club", "bj's", "bjs"] as const;

const NEEDS_YOU_NAME_FRAGMENTS = [
  "target",
  "giant",
  "wegmans",
  "safeway",
  "h-e-b",
  "heb",
  "meijer",
  "sprouts",
] as const;

const CONTEXT_GROCER_NAME_FRAGMENTS = [
  "whole foods",
  ...NEEDS_YOU_NAME_FRAGMENTS,
  ...CLUB_NAME_FRAGMENTS,
] as const;

export function isConvenienceOrBakeryPin(input: GroceryPinInput): boolean {
  const shop = input.shopTag?.trim().toLowerCase() ?? "";
  if (shop === "convenience" || shop === "bakery") {
    return true;
  }
  const name = input.name.trim().toLowerCase();
  if (CONVENIENCE_NAME_FRAGMENTS.some((fragment) => name.includes(fragment))) {
    return true;
  }
  if (BAKERY_NAME_FRAGMENTS.some((fragment) => name.includes(fragment))) {
    return true;
  }
  return false;
}

export function isPharmacyPin(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return PHARMACY_NAME_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

/**
 * Map-context food retail that must not appear on Settings, Owner Check, or
 * density grocery counts: convenience, bakeries, seafood/butcher/deli, and
 * other specialty pins (pharmacies stay Check-only via isOwnerCheckListedPin).
 */
export function isMapOnlyFoodRetailPin(input: GroceryPinInput): boolean {
  if (isPharmacyPin(input.name)) {
    return false;
  }
  const shop = input.shopTag?.trim().toLowerCase() ?? "";
  if (SPECIALTY_OSM_SHOP_TAGS.includes(shop as (typeof SPECIALTY_OSM_SHOP_TAGS)[number])) {
    return true;
  }
  if (isConvenienceOrBakeryPin(input)) {
    return true;
  }
  const kind = input.kind?.trim().toLowerCase() ?? "";
  if (kind === "specialty") {
    return true;
  }
  const name = ` ${input.name.trim().toLowerCase()} `;
  return SPECIALTY_NAME_FRAGMENTS.some((fragment) => name.includes(fragment));
}

/**
 * Recognized supermarket / club / dollar banners plus Target and Whole Foods.
 * Independent OSM "grocery" leftovers are not counted on any inventory list.
 */
export function isRecognizedGroceryBannerPin(input: GroceryPinInput): boolean {
  if (isMapOnlyFoodRetailPin(input)) {
    return false;
  }
  if (isPharmacyPin(input.name)) {
    return false;
  }
  const chain = inferStoreChainFromName(input.name);
  if (chain !== "unknown") {
    return true;
  }
  const kind = input.kind?.trim().toLowerCase() ?? "";
  if (kind === "dollar-market" || kind === "big-box") {
    return true;
  }
  const name = input.name.trim().toLowerCase();
  return CONTEXT_GROCER_NAME_FRAGMENTS.some((fragment) => name.includes(fragment));
}

export function isGroceryPinForDensity(input: GroceryPinInput): boolean {
  return isRecognizedGroceryBannerPin(input);
}

export function isOwnerCheckListedPin(input: GroceryPinInput): boolean {
  if (isMapOnlyFoodRetailPin(input)) {
    return false;
  }
  if (isPharmacyPin(input.name)) {
    return true;
  }
  return isRecognizedGroceryBannerPin(input);
}

export function classifyOwnerAdmissionGroup(name: string): OwnerAdmissionGroup {
  const chain = inferStoreChainFromName(name);
  if ((WEEKLY_AD_CHAINS as readonly string[]).includes(chain)) {
    return "will-ingest";
  }
  if (chain === "bjs") {
    return "food-only";
  }
  const normalized = name.trim().toLowerCase();
  if (CLUB_NAME_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return "food-only";
  }
  if (isPharmacyPin(name)) {
    return "needs-you";
  }
  if (NEEDS_YOU_NAME_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return "needs-you";
  }
  if (chain === "unknown") {
    return "needs-you";
  }
  return "will-ingest";
}

export function formatOmittedPinsNotice(omittedCount: number): string | undefined {
  if (omittedCount <= 0) {
    return undefined;
  }
  return `Omitted ${omittedCount} convenience, bakery, specialty, or independent pin(s) (not listed).`;
}

export function formatDensityHeadline(input: {
  zipCode: string;
  city: string;
  state: string;
  densityClass: DensityClass;
  groceryCountIn8Mi: number;
  ingestMiles: number;
  alreadyActive?: boolean;
}): string {
  const active = input.alreadyActive ? " · already active" : "";
  return `${input.zipCode} · ${input.city}, ${input.state} · ${input.densityClass} (${input.groceryCountIn8Mi} grocery pins in 8 mi) · ingest ZIP outline (cap ${input.ingestMiles} mi)${active}`;
}
