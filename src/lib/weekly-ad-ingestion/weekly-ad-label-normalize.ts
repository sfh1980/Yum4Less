import { normalizeAliasLabel } from "@/lib/recipe-import/ingredient-normalization";
import { normalizeProductDescription } from "@/lib/providers/provider-price-matching";

export function normalizeWeeklyAdFlyerLabel(productName: string): string {
  return normalizeAliasLabel(normalizeProductDescription(productName));
}

const SIZE_AND_PACK_TOKENS = new Set([
  "oz",
  "lb",
  "lbs",
  "ct",
  "count",
  "pack",
  "pk",
  "family",
  "value",
  "fresh",
  "frozen",
  "boneless",
  "skinless",
  "marinated",
  "gourmet",
  "organic",
  "fillet",
  "filet",
  "fillets",
  "filets",
  "navel",
  "bartlett",
  "restaurant",
  "style",
  "select",
  "premium",
]);

export function stripWeeklyAdPackagingTokens(normalizedLabel: string): string {
  return normalizedLabel
    .split(" ")
    .filter((token) => {
      if (SIZE_AND_PACK_TOKENS.has(token)) {
        return false;
      }
      if (/^\d+$/.test(token)) {
        return false;
      }
      return true;
    })
    .join(" ")
    .trim();
}

export function splitWeeklyAdOrLabels(normalizedLabel: string): string[] {
  const parts = normalizedLabel
    .split(/\bor\b/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return parts.length > 1 ? parts : [normalizedLabel];
}
