import type { ResolvedSearchLocation } from "@/lib/location-resolution";

export type StoreDiscoveryProvider = "kroger" | "publix" | "walmart";

export type ProviderSearchStatus =
  | "available"
  | "not-configured"
  | "fallback"
  | "error";

export type ProviderSearchProvenance =
  | "official-api"
  | "website-service"
  | "third-party-feed"
  | "fallback-local"
  | "not-configured";

export type ProviderSearchRetrievalMode = "live" | "cached" | "none";

export type ProviderDiscoveredStore = {
  provider: StoreDiscoveryProvider;
  providerStoreId: string;
  name: string;
  addressLine1?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  distanceMiles?: number;
};

export type ProviderStoreSearchResult = {
  provider: StoreDiscoveryProvider;
  label: string;
  status: ProviderSearchStatus;
  provenance: ProviderSearchProvenance;
  retrievalMode: ProviderSearchRetrievalMode;
  configured: boolean;
  fallbackUsed: boolean;
  stores: ProviderDiscoveredStore[];
  message: string;
  fetchedAt: string;
  persistedSnapshotId?: number;
  snapshotCapturedAt?: string;
  snapshotAgeMinutes?: number;
};

export type ProviderStoreSearchInput = {
  location: ResolvedSearchLocation;
  radiusMiles: number;
};

export type ProviderPricingPreviewIngredient = {
  ingredientId: string;
  ingredientName: string;
  searchTerm: string;
  /** Priority-2 term from provider_search_terms; sync retries once when priority-1 fails. */
  fallbackSearchTerm?: string;
};

export type ProviderPricingCoverageStatus =
  | "strong"
  | "limited"
  | "weak"
  | "none";

export type ProviderPricingPreviewInput = {
  store: ProviderDiscoveredStore;
  ingredients: ProviderPricingPreviewIngredient[];
};

export type ProviderPricingPreviewItem = {
  provider: StoreDiscoveryProvider;
  ingredientId: string;
  ingredientName: string;
  providerProductId: string;
  description: string;
  brand?: string;
  regularPrice?: number;
  promoPrice?: number;
  currencyCode?: string;
  inStock: boolean;
  matchConfidence: number;
  matchReason: string;
};

export type ProviderPricingPreviewResult = {
  provider: StoreDiscoveryProvider;
  label: string;
  status: ProviderSearchStatus;
  provenance: ProviderSearchProvenance;
  retrievalMode: ProviderSearchRetrievalMode;
  configured: boolean;
  fallbackUsed: boolean;
  storeName: string;
  providerStoreId: string;
  items: ProviderPricingPreviewItem[];
  coverageStatus: ProviderPricingCoverageStatus;
  matchedIngredientCount: number;
  totalTrackedIngredients: number;
  message: string;
  fetchedAt: string;
  persistedSnapshotId?: number;
  snapshotCapturedAt?: string;
  snapshotAgeMinutes?: number;
};

export type StoreDiscoveryProviderClient = {
  provider: StoreDiscoveryProvider;
  label: string;
  configured: boolean;
  searchStoresByLocation(
    input: ProviderStoreSearchInput,
  ): Promise<ProviderStoreSearchResult>;
  searchPricingPreview(
    input: ProviderPricingPreviewInput,
  ): Promise<ProviderPricingPreviewResult>;
};
