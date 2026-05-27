import {
  PUBLIX_SERVICES_API_SPEC,
  type PublixStoreCookie,
  type PublixStoreLocationResponse,
  type PublixStoreRecord,
  type PublixStoreSearchFilters,
} from "@/lib/providers/publix/publix-services-api-types";

export type PublixServicesApiClient = ReturnType<typeof createPublixServicesApiClient>;

export function createPublixServicesApiClient() {
  return {
    searchStoresByZip: (filters: PublixStoreSearchFilters) => searchStoresByZip(filters),
    buildStoreCookie: (store: PublixStoreRecord) => buildStoreCookie(store),
  };
}

export async function searchStoresByZip(
  filters: PublixStoreSearchFilters,
): Promise<PublixStoreRecord[]> {
  const url = new URL(
    `${PUBLIX_SERVICES_API_SPEC.baseUrl}${PUBLIX_SERVICES_API_SPEC.storeLocationPath}`,
  );
  url.searchParams.set("types", "R,G,H,N,S");
  url.searchParams.set("count", String(filters.count ?? 10));
  url.searchParams.set("includeOpenAndCloseDates", "true");
  url.searchParams.set("isWebsite", "true");
  url.searchParams.set("zipCode", filters.zipCode);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Publix store lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PublixStoreLocationResponse;
  return payload.Stores ?? [];
}

export function buildStoreCookie(store: PublixStoreRecord): PublixStoreCookie | undefined {
  const storeNumber = parsePublixStoreNumber(store.KEY);
  const storeName = store.NAME?.trim();
  const shortStoreName = store.SHORTNAME?.trim() ?? storeName;
  const option = store.OPTION?.trim();

  if (!storeNumber || !storeName || !shortStoreName || !option) {
    return undefined;
  }

  return {
    StoreName: storeName,
    StoreNumber: storeNumber,
    Option: option,
    ShortStoreName: shortStoreName,
  };
}

export function parsePublixStoreNumber(storeKey: string | undefined) {
  if (!storeKey) {
    return undefined;
  }

  const parsed = Number.parseInt(storeKey, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function serializePublixStoreCookie(cookie: PublixStoreCookie) {
  return JSON.stringify(cookie);
}
