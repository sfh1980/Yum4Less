import {
  buildStoreCookie,
  createPublixServicesApiClient,
} from "@/lib/providers/publix/publix-services-api-client";
import type { PublixStoreCookie } from "@/lib/providers/publix/publix-services-api-types";

export async function resolvePublixStoreForZip(zipCode: string): Promise<{
  storeKey?: string;
  storeName?: string;
  storeCookie?: PublixStoreCookie;
}> {
  const overrideStoreNumber = process.env.PUBLIX_STORE_NUMBER?.trim();
  if (overrideStoreNumber) {
    const storeNumber = Number.parseInt(overrideStoreNumber, 10);
    if (Number.isFinite(storeNumber)) {
      return {
        storeKey: overrideStoreNumber.padStart(5, "0"),
        storeCookie: {
          StoreName: process.env.PUBLIX_STORE_NAME?.trim() ?? "Publix",
          StoreNumber: storeNumber,
          Option: process.env.PUBLIX_STORE_OPTION?.trim() ?? "ACFHLNOTY",
          ShortStoreName:
            process.env.PUBLIX_STORE_SHORT_NAME?.trim() ??
            process.env.PUBLIX_STORE_NAME?.trim() ??
            "Publix",
        },
      };
    }
  }

  const api = createPublixServicesApiClient();
  const stores = await api.searchStoresByZip({ zipCode, count: 1 });
  const store = stores[0];
  const storeCookie = store ? buildStoreCookie(store) : undefined;

  return {
    storeKey: store?.KEY,
    storeName: store?.NAME,
    storeCookie,
  };
}
