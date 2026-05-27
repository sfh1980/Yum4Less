import type { StoreDiscoveryProvider } from "@/lib/providers/provider-types";

export function getProviderChainLabel(provider: StoreDiscoveryProvider): string {
  switch (provider) {
    case "kroger":
      return "Kroger";
    case "publix":
      return "Publix";
    case "walmart":
      return "Walmart";
  }
}

export function getProviderStoreDiscoveryLabel(
  provider: StoreDiscoveryProvider,
): string {
  switch (provider) {
    case "kroger":
      return "Kroger official store discovery";
    case "publix":
      return "Publix store discovery";
    case "walmart":
      return "Walmart official store discovery";
  }
}

export function getProviderPricingPreviewLabel(
  provider: StoreDiscoveryProvider,
): string {
  switch (provider) {
    case "kroger":
      return "Kroger official pricing preview";
    case "publix":
      return "Publix pricing preview";
    case "walmart":
      return "Walmart official pricing preview";
  }
}
