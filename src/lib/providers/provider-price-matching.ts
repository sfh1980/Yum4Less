import type {
  ProviderPricingCoverageStatus,
  ProviderPricingPreviewIngredient,
  ProviderPricingPreviewItem,
} from "@/lib/providers/provider-types";
import { includesWholePhrase } from "@/lib/escape-regexp";

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

/** Set YUM4LESS_PROVIDER_MATCH_DEBUG=1 for per-ingredient Kroger match scoring logs. */
export function isProviderMatchDebugEnabled() {
  return process.env.YUM4LESS_PROVIDER_MATCH_DEBUG === "1";
}

/** Set YUM4LESS_DEBUG_PROVIDER=1 for Kroger preview/sync stdout diagnostics. */
export function isKrogerProviderDebugEnabled() {
  return process.env.YUM4LESS_DEBUG_PROVIDER === "1";
}

export type ProviderMatchScoreBreakdown = {
  rawDescription: string;
  normalizedDescription: string;
  searchTerm: string;
  ingredientName: string;
  ingredientTokens: string[];
  searchTokens: string[];
  descriptionTokens: string[];
  rulesFired: Array<{ rule: string; points: number }>;
  inStock: boolean;
  finalScore: number;
  matchConfidence: number;
  matchReason: string;
};

export function scoreProviderProductMatch(input: {
  ingredient: ProviderPricingPreviewIngredient;
  description: string;
  inStock: boolean;
}): Pick<ProviderPricingPreviewItem, "matchConfidence" | "matchReason"> {
  const breakdown = scoreProviderProductMatchWithBreakdown(input);
  if (isProviderMatchDebugEnabled()) {
    logProviderMatchBreakdown(breakdown);
  }
  return {
    matchConfidence: breakdown.matchConfidence,
    matchReason: breakdown.matchReason,
  };
}

const SEARCH_TERM_STOP_WORDS = new Set(["the", "a", "an", "of", "and"]);

function meaningfulSearchTermTokens(searchTerm: string): string[] {
  return searchTerm
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !SEARCH_TERM_STOP_WORDS.has(token));
}

function hasPartialWholeTermMatch(searchTerm: string, normalizedDescription: string) {
  const rawWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (rawWords.length < 2) {
    return false;
  }

  const meaningful = meaningfulSearchTermTokens(searchTerm);
  if (meaningful.length < 2) {
    return false;
  }

  const requiredMatches = Math.ceil(meaningful.length / 2);
  const descriptionWords = normalizedDescription.split(/\s+/).filter(Boolean);

  for (let start = 0; start <= meaningful.length - requiredMatches; start += 1) {
    for (let end = meaningful.length; end > start; end -= 1) {
      const sequence = meaningful.slice(start, end);
      if (sequence.length < requiredMatches) {
        continue;
      }
      if (matchesNearContiguousSequence(sequence, descriptionWords)) {
        return true;
      }
    }
  }

  return false;
}

function matchesNearContiguousSequence(
  sequence: string[],
  descriptionWords: string[],
): boolean {
  return findLongestNearContiguousMatch(sequence, descriptionWords) >= sequence.length;
}

function findLongestNearContiguousMatch(
  sequence: string[],
  descriptionWords: string[],
): number {
  let best = 0;

  for (let start = 0; start < sequence.length; start += 1) {
    let seqIdx = start;
    let lastMatchIdx = -2;

    for (let i = 0; i < descriptionWords.length && seqIdx < sequence.length; i += 1) {
      if (!tokenMatches(descriptionWords[i]!, sequence[seqIdx]!)) {
        continue;
      }

      if (seqIdx > start && i - lastMatchIdx - 1 > 1) {
        break;
      }

      lastMatchIdx = i;
      seqIdx += 1;
      best = Math.max(best, seqIdx - start);
    }
  }

  return best;
}

function tokenMatches(descriptionWord: string, termToken: string) {
  if (descriptionWord === termToken) {
    return true;
  }

  return (
    stemToken(descriptionWord) === termToken ||
    descriptionWord === stemToken(termToken) ||
    stemToken(descriptionWord) === stemToken(termToken)
  );
}

export function scoreProviderProductMatchWithBreakdown(input: {
  ingredient: ProviderPricingPreviewIngredient;
  description: string;
  inStock: boolean;
}): ProviderMatchScoreBreakdown & {
  matchConfidence: number;
  matchReason: string;
} {
  const rawDescription = input.description;
  const ingredientTokens = tokenize(input.ingredient.ingredientName);
  const searchTokens = tokenize(input.ingredient.searchTerm);
  const description = normalizeProductDescription(input.description);
  const descriptionTokens = tokenize(description);
  const fullIngredientName = input.ingredient.ingredientName.toLowerCase();
  const fullSearchTerm = input.ingredient.searchTerm.toLowerCase();

  let score = 0;
  const reasons: string[] = [];
  const rulesFired: Array<{ rule: string; points: number }> = [];

  if (description.includes(fullIngredientName)) {
    score += 0.55;
    reasons.push("description contains the full ingredient name");
    rulesFired.push({
      rule: `full ingredient name "${fullIngredientName}" found in normalized description`,
      points: 0.55,
    });
  } else if (fullSearchTerm.length >= 4 && includesWholeTerm(description, fullSearchTerm)) {
    score += 0.45;
    reasons.push("description contains the search term");
    rulesFired.push({
      rule: `whole search term "${fullSearchTerm}" found in normalized description`,
      points: 0.45,
    });
  } else if (hasPartialWholeTermMatch(fullSearchTerm, description)) {
    score += 0.25;
    reasons.push("partial-whole-term-match");
    rulesFired.push({
      rule: `partial whole-term match for "${fullSearchTerm}"`,
      points: 0.25,
    });
  } else {
    rulesFired.push({
      rule: `no full-name or whole-term match (ingredient="${fullIngredientName}", searchTerm="${fullSearchTerm}")`,
      points: 0,
    });
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
      const tokenPoints = Math.min(0.3, tokenOverlapCount * 0.12);
      score += tokenPoints;
      const matchedTokenList = [
        ...new Set([...overlappingTokens, ...overlappingSearchTokens]),
      ].join(", ");
      reasons.push(`matched ingredient tokens: ${matchedTokenList}`);
      rulesFired.push({
        rule: `token overlap (${tokenOverlapCount} token(s): ${matchedTokenList}); requiresMultiToken=${requiresMultiTokenOverlap}`,
        points: tokenPoints,
      });
    } else {
      rulesFired.push({
        rule: `token overlap blocked (count=${tokenOverlapCount}, requiresMultiToken=${requiresMultiTokenOverlap}, baseScore=${score.toFixed(2)})`,
        points: 0,
      });
    }
  } else {
    rulesFired.push({ rule: "no token overlap", points: 0 });
  }

  if (input.inStock) {
    score += 0.05;
    reasons.push("item is marked in stock");
    rulesFired.push({ rule: "in stock", points: 0.05 });
  } else {
    rulesFired.push({ rule: "not in stock", points: 0 });
  }

  const finalScore = score;
  const matchConfidence = clamp(Number(score.toFixed(2)), 0, 1);
  const matchReason =
    reasons.length > 0
      ? reasons.join("; ")
      : "match relied on a weak text similarity signal";

  return {
    rawDescription,
    normalizedDescription: description,
    searchTerm: input.ingredient.searchTerm,
    ingredientName: input.ingredient.ingredientName,
    ingredientTokens,
    searchTokens,
    descriptionTokens,
    rulesFired,
    inStock: input.inStock,
    finalScore,
    matchConfidence,
    matchReason,
  };
}

function logProviderMatchBreakdown(breakdown: ProviderMatchScoreBreakdown) {
  const ruleLines = breakdown.rulesFired
    .map((entry) => `      + ${entry.points.toFixed(2)} — ${entry.rule}`)
    .join("\n");

  console.log(
    [
      "[ProviderMatchDebug] scoreProviderProductMatch",
      `  ingredientName: ${breakdown.ingredientName}`,
      `  searchTerm: ${breakdown.searchTerm}`,
      `  rawDescription: ${breakdown.rawDescription}`,
      `  normalizedDescription: ${breakdown.normalizedDescription}`,
      `  ingredientTokens: [${breakdown.ingredientTokens.join(", ")}]`,
      `  searchTokens: [${breakdown.searchTokens.join(", ")}]`,
      `  descriptionTokens: [${breakdown.descriptionTokens.join(", ")}]`,
      `  rulesFired:`,
      ruleLines,
      `  finalScore (pre-clamp): ${breakdown.finalScore.toFixed(2)}`,
      `  matchConfidence: ${breakdown.matchConfidence.toFixed(2)}`,
      `  matchReason: ${breakdown.matchReason}`,
    ].join("\n"),
  );
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
  return includesWholePhrase(description, term);
}
