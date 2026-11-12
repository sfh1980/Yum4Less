const URL_TEXT = /https?:\/\/\S+/gi;
const SECRET_TEXT = /\b(?:bearer|token|api[_-]?key|password|secret|cookie)\b[=:]?\s*\S+/gi;
const STORE_ID_TEXT = /\bstore(?:\s+id|\s+number)?\s*[:=]?\s*\d{3,}\b/gi;
const LONG_TOKEN = /\b[A-Za-z0-9+/_=-]{24,}\b/g;

/** A short failure sentence. URLs, tokens, and store ids are removed. */
export function sanitizeWeeklyAdFailureReason(raw: string): string {
  const cleaned = raw
    .replace(URL_TEXT, "")
    .replace(SECRET_TEXT, "")
    .replace(STORE_ID_TEXT, "")
    .replace(LONG_TOKEN, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "the flyer fetch failed";
  }
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
}
