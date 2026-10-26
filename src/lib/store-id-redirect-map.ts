export type StoreIdRedirectMap = Readonly<Record<string, string>>;

/**
 * Follow a deleted store id to the row that was kept.
 * A later merge that removes the first survivor is followed too.
 * A cycle stops on the last id before a repeat.
 */
export function followStoreIdRedirect(
  storeId: string,
  redirects: StoreIdRedirectMap | undefined,
): string {
  if (!redirects) {
    return storeId;
  }

  let current = storeId;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    const next = redirects[current];
    if (!next || next === current || seen.has(next)) {
      return current;
    }
    seen.add(current);
    current = next;
  }
  return current;
}

/** Rewrite saved ids. Duplicate targets collapse to one id. */
export function applyStoreIdRedirects(
  storeIds: readonly string[],
  redirects: StoreIdRedirectMap | undefined,
): string[] {
  if (!redirects || Object.keys(redirects).length === 0) {
    return [...storeIds];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const storeId of storeIds) {
    const next = followStoreIdRedirect(storeId, redirects);
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    out.push(next);
  }
  return out;
}
