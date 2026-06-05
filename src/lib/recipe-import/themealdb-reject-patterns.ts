/** Reject garnish, beverage, and non-grocery TheMealDB strings before catalog expansion. */
const GLOBAL_REJECT_PATTERNS = [
  /\bwater\b/i,
  /\bice\b/i,
  /\bwine\b/i,
  /\bbeer\b/i,
  /\bliqueur\b/i,
  /\brum\b/i,
  /\bvodka\b/i,
  /\bwhisky\b/i,
  /\bwhiskey\b/i,
  /\bcognac\b/i,
  /\bbrandy\b/i,
  /\bsherry\b/i,
  /\bvermouth\b/i,
  /\bsoda\b/i,
  /\bcola\b/i,
  /\bjuice\b/i,
  /\blemonade\b/i,
  /\bcoffee\b/i,
  /\btea\b/i,
  /\bto garnish\b/i,
  /\bgarnish\b/i,
  /\bfor serving\b/i,
  /\bto serve\b/i,
  /\bto taste\b/i,
  /\bsprig\b/i,
  /\bparsley to\b/i,
  /\bcoriander leaves to\b/i,
];

export function shouldRejectThemealdbIngredientLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 2) {
    return true;
  }

  return GLOBAL_REJECT_PATTERNS.some((pattern) => pattern.test(trimmed));
}
