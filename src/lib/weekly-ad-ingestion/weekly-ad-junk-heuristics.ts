const JUNK_PATTERNS: RegExp[] = [
  /\bchips?\b/i,
  /\bcrisps?\b/i,
  /\bcandy\b/i,
  /\bcookie/i,
  /\bcake\b/i,
  /\bpop-?tarts?\b/i,
  /\bjerky\b/i,
  /\bbeer\b/i,
  /\bwine\b/i,
  /\blager\b/i,
  /\bale\b/i,
  /\bsoda\b/i,
  /\bcola\b/i,
  /\bjuice\b/i,
  /\bslider bags?\b/i,
  /\bfreezer bags?\b/i,
  /\bgarbage bags?\b/i,
  /\bstorage bags?\b/i,
  /\bgadget/i,
  /\bfootball\b/i,
  /\bkalanchoe\b/i,
  /\bcoir\b/i,
  /\bdoor mat\b/i,
  /\bfrying pan\b/i,
  /\bbaking pan\b/i,
  /\bsheet pan\b/i,
  /\bdress\b/i,
  /\bshirt\b/i,
  /\bshoe/i,
  /\bheadphone/i,
  /\bearpods?\b/i,
  /\bpillow\b/i,
  /\brug\b/i,
  /\bentr[eé]e\b/i,
  /\bheat.?and.?eat\b/i,
  /\bcupcakes?\b/i,
  /\bdiaper/i,
  /\bdetergent\b/i,
  /\bshampoo\b/i,
  /\bpaper towels?\b/i,
];

export function isWeeklyAdJunkProduct(productName: string): boolean {
  const trimmed = productName.trim();
  if (trimmed.length < 2) {
    return true;
  }
  return JUNK_PATTERNS.some((pattern) => pattern.test(trimmed));
}
