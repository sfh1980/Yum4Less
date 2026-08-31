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
  "qt ",
  "quicktrip",
  "kwik trip",
  "mini mart",
  "minimart",
  "convenience",
  "express mart",
  "corner store",
] as const;

const BAKERY_NAME_FRAGMENTS = [
  "bakery",
  "dunkin",
  "panera",
  "krispy kreme",
  "nothing bundt",
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

export function isConvenienceOrBakeryPin(input: {
  name: string;
  kind?: string;
  shopTag?: string;
}): boolean {
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

export function isGroceryPinForDensity(input: {
  name: string;
  kind?: string;
  shopTag?: string;
}): boolean {
  if (isConvenienceOrBakeryPin(input)) {
    return false;
  }
  const kind = input.kind?.trim().toLowerCase() ?? "";
  if (kind === "grocery" || kind === "dollar-market" || kind === "big-box") {
    return true;
  }
  const chain = inferStoreChainFromName(input.name);
  return chain !== "unknown";
}

export function classifyOwnerAdmissionGroup(name: string): OwnerAdmissionGroup {
  const chain = inferStoreChainFromName(name);
  if ((WEEKLY_AD_CHAINS as readonly string[]).includes(chain) && chain !== "dollar-general") {
    return "will-ingest";
  }
  if (chain === "dollar-general" || chain === "bjs") {
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
  return `Omitted ${omittedCount} convenience/bakery pin(s) (not listed).`;
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
  return `${input.zipCode} · ${input.city}, ${input.state} · ${input.densityClass} (${input.groceryCountIn8Mi} grocery pins in 8 mi) · ingest ${input.ingestMiles} mi${active}`;
}
