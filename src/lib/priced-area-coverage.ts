import { buildMarketShopperBlockedStatus } from "@/lib/market-shopper-status";

/** Neutral place phrase when YUM4LESS_PRICED_AREA_LABEL is unset or unusable. */
export const PRICED_AREA_LABEL_UNSET = "a limited area";

export const PRICED_AREA_LABEL_MAX_LENGTH = 80;

/**
 * First-step sentence. The place phrase comes from the server setting.
 * Unset stays neutral and names no city, state, or ZIP.
 */
export function pricedAreaCoverageSentence(label: string | null): string {
  const place = label && label.length > 0 ? label : PRICED_AREA_LABEL_UNSET;
  return `Dinner price estimates are available today in ${place}. Elsewhere you will see nearby stores while coverage grows.`;
}

export const UNSET_PRICED_AREA_COVERAGE_SENTENCE = pricedAreaCoverageSentence(null);

/**
 * Owner-set place phrase from YUM4LESS_PRICED_AREA_LABEL.
 * Empty, too long, or markup-like values fall back to the neutral sentence.
 */
export function readPricedAreaLabel(env: NodeJS.ProcessEnv = process.env): string | null {
  const collapsed = env.YUM4LESS_PRICED_AREA_LABEL?.trim().replace(/\s+/g, " ") ?? "";
  if (!collapsed || collapsed.length > PRICED_AREA_LABEL_MAX_LENGTH) {
    return null;
  }
  if (/[<>]/.test(collapsed)) {
    return null;
  }
  return collapsed;
}

export function readPricedAreaCoverageSentence(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return pricedAreaCoverageSentence(readPricedAreaLabel(env));
}

/**
 * Existing Tier C reason when this location has stores but no ranked dinners.
 * Returns null for priced locations, an empty radius, and a database outage.
 */
export function tierCMapOnlyReason(
  market: Parameters<typeof buildMarketShopperBlockedStatus>[0],
): string | null {
  const status = buildMarketShopperBlockedStatus(market);
  if (status?.kind !== "no-trusted-rollout") {
    return null;
  }
  return status.body;
}
