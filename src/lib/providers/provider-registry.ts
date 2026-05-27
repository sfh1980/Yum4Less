import { createKrogerProviderClient } from "@/lib/providers/kroger-provider";
import { createPublixProviderClient } from "@/lib/providers/publix-provider";
import { createWalmartProviderClient } from "@/lib/providers/walmart-provider";
import type { StoreDiscoveryProviderClient } from "@/lib/providers/provider-types";

export function getStoreDiscoveryProviders(): StoreDiscoveryProviderClient[] {
  return [
    createKrogerProviderClient(),
    createPublixProviderClient(),
    createWalmartProviderClient(),
  ];
}
