import type {
  ProviderPricingCoverageStatus,
  ProviderPricingPreviewIngredient,
  ProviderPricingPreviewItem,
} from "@/lib/providers/provider-types";

export function getPricingCoverageStatus(input: {
  matchedIngredientCount: number;
  totalTrackedIngredients: number;
}): ProviderPricingCoverageStatus {
  if (input.matchedIngredientCount <= 0 || input.totalTrackedIngredients <= 0) {
    return "none";
  }

  const ratio = input.matchedIngredientCount / input.totalTrackedIngredients;
  if (ratio >= 0.8) {
    return "strong";
  }
  if (ratio >= 0.4) {
    return "limited";
  }
  return "weak";
}

export function buildPricingCoverageMessage(input: {
  matchedIngredientCount: number;
  totalTrackedIngredients: number;
  coverageStatus: ProviderPricingCoverageStatus;
}): string {
  const base = `Kroger official pricing preview matched ${input.matchedIngredientCount} of ${input.totalTrackedIngredients} tracked ingredient(s).`;

  switch (input.coverageStatus) {
    case "strong":
      return `${base} Coverage looks promising, but this preview is still not used for ranked meal pricing.`;
    case "limited":
      return `${base} Coverage is still limited, so this preview remains informational and is not used for ranked meal pricing.`;
    case "weak":
      return `${base} Coverage is weak, so this preview is directional only and is not used for ranked meal pricing.`;
    default:
      return `${base} No strong provider coverage is available yet, so this preview is not used for ranked meal pricing.`;
  }
}

const RETAIL_BRAND_PREFIXES = [
  "great value",
  "marketside",
  "freshness guaranteed",
  "mission",
  "nature's own",
  "kroger",
  "publix",
  "simply",
  "organic",
  "fresh",
];

export function scoreProviderProductMatch(input: {
  ingredient: ProviderPricingPreviewIngredient;
  description: string;
  inStock: boolean;
}): Pick<ProviderPricingPreviewItem, "matchConfidence" | "matchReason"> {
  const ingredientTokens = tokenize(input.ingredient.ingredientName);
  const searchTokens = tokenize(input.ingredient.searchTerm);
  const description = normalizeProductDescription(input.description);
  const descriptionTokens = tokenize(description);
  const fullIngredientName = input.ingredient.ingredientName.toLowerCase();
  const fullSearchTerm = input.ingredient.searchTerm.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (description.includes(fullIngredientName)) {
    score += 0.55;
    reasons.push("description contains the full ingredient name");
  } else if (fullSearchTerm.length >= 4 && includesWholeTerm(description, fullSearchTerm)) {
    score += 0.45;
    reasons.push("description contains the search term");
  }

  const overlappingTokens = ingredientTokens.filter((token) =>
    descriptionTokens.includes(token),
  );
  const overlappingSearchTokens = searchTokens.filter((token) =>
    descriptionTokens.includes(token),
  );
  const tokenOverlapCount = new Set([
    ...overlappingTokens,
    ...overlappingSearchTokens,
  ]).size;

  const requiresMultiTokenOverlap =
    Math.max(ingredientTokens.length, searchTokens.length) >= 2;

  if (tokenOverlapCount > 0) {
    if (!requiresMultiTokenOverlap || tokenOverlapCount >= 2 || score >= 0.45) {
      score += Math.min(0.3, tokenOverlapCount * 0.12);
      reasons.push(
        `matched ingredient tokens: ${[...new Set([...overlappingTokens, ...overlappingSearchTokens])].join(", ")}`,
      );
    }
  }

  if (input.inStock) {
    score += 0.05;
    reasons.push("item is marked in stock");
  }

  const matchConfidence = clamp(Number(score.toFixed(2)), 0, 1);

  return {
    matchConfidence,
    matchReason:
      reasons.length > 0
        ? reasons.join("; ")
        : "match relied on a weak text similarity signal",
  };
}

export function normalizeProductDescription(value: string) {
  let normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  for (const prefix of RETAIL_BRAND_PREFIXES) {
    if (normalized.startsWith(`${prefix} `)) {
      normalized = normalized.slice(prefix.length + 1).trim();
    }
  }
  return normalized;
}

function tokenize(value: string) {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    const stem = stemToken(token);
    if (stem !== token) {
      expanded.add(stem);
    }
  }

  return [...expanded];
}

function stemToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("oes") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function includesWholeTerm(description: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(description);
}
