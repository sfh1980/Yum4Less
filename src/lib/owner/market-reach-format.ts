export type MarketReachStoreLine = {
  storeId: string;
  name: string;
  chainLabel: string;
  city: string;
  state: string;
  sourceStoreId: string | null;
  addressLine: string | null;
  postalCode: string | null;
};

export function reachStoreTitle(store: Pick<MarketReachStoreLine, "name" | "chainLabel">): string | null {
  const name = store.name.trim();
  const chain = store.chainLabel.trim();
  if (!name || name.toLowerCase() === chain.toLowerCase()) {
    return null;
  }
  return name;
}

export function reachStorePlace(
  store: Pick<MarketReachStoreLine, "addressLine" | "city" | "state" | "postalCode">,
): string {
  const locality = [store.city, store.state]
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "unknown")
    .join(", ");
  const postal = store.postalCode?.trim() ?? "";
  const where = [locality, postal].filter(Boolean).join(" ");
  const street = store.addressLine?.trim() ?? "";
  if (street) {
    return where ? `${street}, ${where}` : street;
  }
  if (where) {
    return `${where}. No street address saved.`;
  }
  return "No street address saved.";
}

export function reachStoreIdLine(
  store: Pick<MarketReachStoreLine, "storeId" | "sourceStoreId">,
): string | null {
  const source = store.sourceStoreId?.trim() ?? "";
  const id = source || store.storeId;
  if (id.startsWith("osm-") || id.startsWith("fixture-osm-")) {
    return null;
  }
  return `Store id ${id}`;
}

export function groupReachStoresByChain<T extends { chainLabel: string }>(
  stores: readonly T[],
): Array<{ chainLabel: string; stores: T[] }> {
  const groups: Array<{ chainLabel: string; stores: T[] }> = [];
  for (const store of stores) {
    const current = groups[groups.length - 1];
    if (current && current.chainLabel === store.chainLabel) {
      current.stores.push(store);
    } else {
      groups.push({ chainLabel: store.chainLabel, stores: [store] });
    }
  }
  return groups;
}
