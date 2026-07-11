/**
 * Option A Slice 1 — match policy (proximity + name/type + pointer bonus).
 *
 * PINNED STARTING THRESHOLDS — validated against fixture pairs in Slice 1–2.
 * Do not treat hardMiles/softMiles/confirm/provisional as final product policy;
 * retune via this module (no schema change).
 *
 * Starting knobs (Decision A / Phase 2 design):
 * - hardMiles: 0.15
 * - softMiles: 0.05
 * - confirmThreshold: ~0.85
 * - provisionalThreshold: ~0.70
 *
 * STRUCTURAL BOUNDARY (Slice 3 finding — do not "fix" casually):
 * Weights sum to 1.0. A no-pointer perfect twin (distance=1, name=1, type=1,
 * pointer=0) scores exactly `1 - pointerWeight` = `1 - 0.15` = **0.85** =
 * confirmThreshold. That is by design of the weight table, not a Kroger quirk —
 * Publix / Food Lion / future same-chain official↔slug pairs without a
 * source_store_id pointer will land on the same boundary. Classification uses
 * `>= confirmThreshold`, so the boundary is confirmed. Slice 3 seeds the
 * Mechanicsville Kroger link manually rather than relying on auto-confirm.
 * Flag for future scorer-tuning conversations; not a bug to patch in Slice 3.
 */

import { getDistanceMiles } from "@/lib/geo-distance";
import type { StoreIdentityMatchCandidate } from "@/lib/store-identity-types";

/** @deprecated Use STORE_IDENTITY_MATCH_POLICY — exported for continuity/tests. */
export const STORE_IDENTITY_HARD_MILES = 0.15;
export const STORE_IDENTITY_SOFT_MILES = 0.05;
export const STORE_IDENTITY_CONFIRM_THRESHOLD = 0.85;
export const STORE_IDENTITY_PROVISIONAL_THRESHOLD = 0.7;

export type StoreIdentityMatchPairOverride = {
  softMiles?: number;
  hardMiles?: number;
  confirmThreshold?: number;
  provisionalThreshold?: number;
  weights?: Partial<StoreIdentityMatchWeights>;
};

export type StoreIdentityMatchWeights = {
  distance: number;
  name: number;
  type: number;
  pointer: number;
};

export type StoreIdentityMatchPolicy = {
  softMiles: number;
  hardMiles: number;
  confirmThreshold: number;
  provisionalThreshold: number;
  weights: StoreIdentityMatchWeights;
  /**
   * Pair key: `${sourceSystemA}::${sourceSystemB}` with systems sorted
   * lexicographically so order does not matter.
   */
  pairOverrides: Record<string, StoreIdentityMatchPairOverride>;
  /** Reject linking live OSM/API rows to fixture identities. */
  rejectFixtureLiveCrossLink: boolean;
};

export const DEFAULT_STORE_IDENTITY_MATCH_WEIGHTS: StoreIdentityMatchWeights = {
  distance: 0.35,
  name: 0.35,
  type: 0.15,
  pointer: 0.15,
};

/**
 * Pinned starting policy. Thresholds need validation against real pairs
 * before Slice 2 ranking/pantry expand relies on auto-confirm.
 */
export const STORE_IDENTITY_MATCH_POLICY: StoreIdentityMatchPolicy = {
  softMiles: STORE_IDENTITY_SOFT_MILES,
  hardMiles: STORE_IDENTITY_HARD_MILES,
  confirmThreshold: STORE_IDENTITY_CONFIRM_THRESHOLD,
  provisionalThreshold: STORE_IDENTITY_PROVISIONAL_THRESHOLD,
  weights: DEFAULT_STORE_IDENTITY_MATCH_WEIGHTS,
  pairOverrides: {
    // Official API ↔ OSM: keep shared hard miles; pointer uncommon.
    "kroger-official-api::openstreetmap-overpass": {},
    // Market catalog ↔ OSM: pointer bonus expected (Aldi pattern).
    "openstreetmap-overpass::yum4less-market-catalog": {},
    "aldi-weekly-ad-scrape::openstreetmap-overpass": {},
  },
  rejectFixtureLiveCrossLink: true,
};

export type StoreIdentityMatchClassification =
  | "confirmed"
  | "provisional"
  | "none";

export type StoreIdentityMatchScore = {
  miles: number;
  distanceScore: number;
  nameScore: number;
  typeScore: number;
  pointerScore: number;
  confidence: number;
  classification: StoreIdentityMatchClassification;
  rejectedReason?: string;
  policy: {
    softMiles: number;
    hardMiles: number;
    confirmThreshold: number;
    provisionalThreshold: number;
  };
};

const FIXTURE_SYSTEMS = new Set(["yum4less-map-fixture"]);

const GROCERY_TYPE_TOKENS = new Set([
  "grocery",
  "supermarket",
  "convenience",
  "greengrocer",
  "sm",
  "ss",
  "super market",
  "food",
]);

const KNOWN_BRAND_TOKENS = [
  "kroger",
  "aldi",
  "publix",
  "food lion",
  "foodlion",
  "walmart",
  "lidl",
  "trader joe",
  "dollar general",
  "dollar tree",
  "harris teeter",
] as const;

export function storeIdentityPairOverrideKey(
  leftSystem: string,
  rightSystem: string,
): string {
  return [leftSystem, rightSystem].sort().join("::");
}

export function resolveStoreIdentityPairPolicy(
  leftSystem: string,
  rightSystem: string,
  base: StoreIdentityMatchPolicy = STORE_IDENTITY_MATCH_POLICY,
): Pick<
  StoreIdentityMatchPolicy,
  "softMiles" | "hardMiles" | "confirmThreshold" | "provisionalThreshold" | "weights"
> {
  const override =
    base.pairOverrides[storeIdentityPairOverrideKey(leftSystem, rightSystem)] ??
    {};

  return {
    softMiles: override.softMiles ?? base.softMiles,
    hardMiles: override.hardMiles ?? base.hardMiles,
    confirmThreshold: override.confirmThreshold ?? base.confirmThreshold,
    provisionalThreshold:
      override.provisionalThreshold ?? base.provisionalThreshold,
    weights: {
      ...base.weights,
      ...override.weights,
    },
  };
}

export function normalizeStoreIdentityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|co|company|store|stores|marketplace|supercenter|supermarket)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeStoreIdentityName(name: string): string[] {
  const normalized = normalizeStoreIdentityName(name);
  if (!normalized) {
    return [];
  }
  return normalized.split(" ").filter(Boolean);
}

export function scoreStoreIdentityNameSimilarity(
  leftName: string,
  rightName: string,
): number {
  const leftNorm = normalizeStoreIdentityName(leftName);
  const rightNorm = normalizeStoreIdentityName(rightName);

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  if (leftNorm === rightNorm) {
    return 1;
  }

  // Extra banner noise already stripped (marketplace, supercenter, …) — containment
  // means the same storefront label family (e.g. "kroger" vs "kroger kroger").
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return 1;
  }

  const leftBrand = extractKnownBrandToken(leftNorm);
  const rightBrand = extractKnownBrandToken(rightNorm);
  if (leftBrand && rightBrand && leftBrand === rightBrand) {
    return 0.9;
  }

  const leftTokens = new Set(tokenizeStoreIdentityName(leftName));
  const rightTokens = new Set(tokenizeStoreIdentityName(rightName));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = leftTokens.size + rightTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extractKnownBrandToken(normalizedName: string): string | null {
  for (const brand of KNOWN_BRAND_TOKENS) {
    if (normalizedName === brand || normalizedName.includes(brand)) {
      return brand;
    }
  }
  return null;
}

export function scoreStoreIdentityTypeAgreement(
  left: Pick<StoreIdentityMatchCandidate, "kind" | "typeHint">,
  right: Pick<StoreIdentityMatchCandidate, "kind" | "typeHint">,
): number {
  const leftType = normalizeTypeToken(left.typeHint ?? left.kind);
  const rightType = normalizeTypeToken(right.typeHint ?? right.kind);

  if (!leftType || !rightType) {
    return 0.5;
  }

  if (leftType === rightType) {
    return 1;
  }

  const leftGrocery = GROCERY_TYPE_TOKENS.has(leftType);
  const rightGrocery = GROCERY_TYPE_TOKENS.has(rightType);
  if (leftGrocery && rightGrocery) {
    return 0.9;
  }

  return 0;
}

function normalizeTypeToken(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim().toLowerCase().replace(/_/g, " ");
}

export function scoreStoreIdentityDistance(
  miles: number,
  softMiles: number,
  hardMiles: number,
): number {
  if (miles < 0 || miles > hardMiles) {
    return 0;
  }
  if (miles <= softMiles) {
    return 1;
  }
  if (hardMiles <= softMiles) {
    return 0;
  }
  return 1 - (miles - softMiles) / (hardMiles - softMiles);
}

export function scoreStoreIdentityPointerBonus(
  left: StoreIdentityMatchCandidate,
  right: StoreIdentityMatchCandidate,
): number {
  const leftPtr = left.sourceStoreId?.trim();
  const rightPtr = right.sourceStoreId?.trim();

  if (leftPtr && (leftPtr === right.id || leftPtr === right.externalId)) {
    return 1;
  }
  if (rightPtr && (rightPtr === left.id || rightPtr === left.externalId)) {
    return 1;
  }
  if (
    leftPtr &&
    rightPtr &&
    leftPtr === rightPtr &&
    leftPtr.length > 0
  ) {
    return 1;
  }

  return 0;
}

function isFixtureSystem(sourceSystem: string): boolean {
  return (
    FIXTURE_SYSTEMS.has(sourceSystem) ||
    sourceSystem.includes("map-fixture") ||
    sourceSystem.includes("fixture")
  );
}

/**
 * Score a candidate pair. Beyond hardMiles → classification "none".
 * Does not write aliases (Slice 1 = pure policy).
 */
export function scoreStoreIdentityMatch(
  left: StoreIdentityMatchCandidate,
  right: StoreIdentityMatchCandidate,
  basePolicy: StoreIdentityMatchPolicy = STORE_IDENTITY_MATCH_POLICY,
): StoreIdentityMatchScore {
  const pair = resolveStoreIdentityPairPolicy(
    left.sourceSystem,
    right.sourceSystem,
    basePolicy,
  );

  const policyMeta = {
    softMiles: pair.softMiles,
    hardMiles: pair.hardMiles,
    confirmThreshold: pair.confirmThreshold,
    provisionalThreshold: pair.provisionalThreshold,
  };

  if (
    basePolicy.rejectFixtureLiveCrossLink &&
    isFixtureSystem(left.sourceSystem) !== isFixtureSystem(right.sourceSystem)
  ) {
    return {
      miles: getDistanceMiles(
        left.latitude,
        left.longitude,
        right.latitude,
        right.longitude,
      ),
      distanceScore: 0,
      nameScore: 0,
      typeScore: 0,
      pointerScore: 0,
      confidence: 0,
      classification: "none",
      rejectedReason: "fixture-live-cross-link",
      policy: policyMeta,
    };
  }

  const miles = getDistanceMiles(
    left.latitude,
    left.longitude,
    right.latitude,
    right.longitude,
  );

  if (miles > pair.hardMiles) {
    return {
      miles,
      distanceScore: 0,
      nameScore: 0,
      typeScore: 0,
      pointerScore: 0,
      confidence: 0,
      classification: "none",
      rejectedReason: "beyond-hard-miles",
      policy: policyMeta,
    };
  }

  const distanceScore = scoreStoreIdentityDistance(
    miles,
    pair.softMiles,
    pair.hardMiles,
  );
  const nameScore = scoreStoreIdentityNameSimilarity(left.name, right.name);
  const typeScore = scoreStoreIdentityTypeAgreement(left, right);
  const pointerScore = scoreStoreIdentityPointerBonus(left, right);

  const confidence =
    pair.weights.distance * distanceScore +
    pair.weights.name * nameScore +
    pair.weights.type * typeScore +
    pair.weights.pointer * pointerScore;

  const classification = classifyStoreIdentityMatchConfidence(
    confidence,
    pair.confirmThreshold,
    pair.provisionalThreshold,
  );

  return {
    miles,
    distanceScore,
    nameScore,
    typeScore,
    pointerScore,
    confidence,
    classification,
    policy: policyMeta,
  };
}

export function classifyStoreIdentityMatchConfidence(
  confidence: number,
  confirmThreshold: number = STORE_IDENTITY_CONFIRM_THRESHOLD,
  provisionalThreshold: number = STORE_IDENTITY_PROVISIONAL_THRESHOLD,
): StoreIdentityMatchClassification {
  if (confidence >= confirmThreshold) {
    return "confirmed";
  }
  if (confidence >= provisionalThreshold) {
    return "provisional";
  }
  return "none";
}
