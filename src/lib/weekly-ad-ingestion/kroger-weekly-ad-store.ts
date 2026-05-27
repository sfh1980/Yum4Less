import { createKrogerApiClient } from "@/lib/providers/kroger/kroger-api-client";

export async function resolveKrogerStoreForZip(zipCode: string): Promise<{
  locationId?: string;
  storeName?: string;
}> {
  const overrideLocationId = process.env.KROGER_LOCATION_ID?.trim();
  if (overrideLocationId) {
    return { locationId: overrideLocationId };
  }

  const api = createKrogerApiClient();
  if (!api.isConfigured) {
    return {};
  }

  try {
    const locationId = await api.resolveLocationIdForZip(zipCode);
    return { locationId };
  } catch {
    return {};
  }
}
