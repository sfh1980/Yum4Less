/**
 * Escape arbitrary text for safe inclusion in a RegExp pattern.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary match without dynamic RegExp construction. */
export function includesWholePhrase(haystack: string, needle: string): boolean {
  const normalizedHaystack = haystack.toLowerCase();
  const normalizedNeedle = needle.toLowerCase();
  if (!normalizedNeedle) {
    return false;
  }

  let index = 0;
  while ((index = normalizedHaystack.indexOf(normalizedNeedle, index)) !== -1) {
    const beforeOk = index === 0 || !/\w/u.test(normalizedHaystack[index - 1]!);
    const afterIndex = index + normalizedNeedle.length;
    const afterOk =
      afterIndex === normalizedHaystack.length ||
      !/\w/u.test(normalizedHaystack[afterIndex]!);
    if (beforeOk && afterOk) {
      return true;
    }
    index += 1;
  }

  return false;
}
