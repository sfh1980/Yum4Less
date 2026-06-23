import {
  createKrogerApiClient,
  readKrogerApiCredentialsFromEnv,
} from "@/lib/providers/kroger/kroger-api-client";
import {
  getKrogerApiEnvironment,
  isKrogerOfficialOnlinePricingEligible,
  isKrogerProductAvailableInStore,
  readKrogerItemPrices,
  type KrogerLocation,
} from "@/lib/providers/kroger/kroger-api-types";
import type {
  ProviderDiscoveredStore,
  ProviderPricingPreviewInput,
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";
import {
  filterKrogerFamilyDiscoveredStores,
  resolveKrogerLocationSearchLimit,
} from "@/lib/kroger-family-discovery";
import {
  buildPricingCoverageMessage,
  getPricingCoverageStatus,
  isProviderMatchDebugEnabled,
  isKrogerProviderDebugEnabled,
  scoreProviderProductMatch,
} from "@/lib/providers/provider-price-matching";

const KROGER_LABEL = "Kroger official store discovery";
const KROGER_INGREDIENT_SEARCH_BATCH_SIZE = 10;
const KROGER_INGREDIENT_SEARCH_BATCH_DELAY_MS = 500;

type KrogerIngredientSearchResult = {
  rawItems: ProviderPricingPreviewItem[];
  firstError?: { message: string; statusCode?: string };
};

export function createKrogerProviderClient(): StoreDiscoveryProviderClient {
  const credentials = readKrogerApiCredentialsFromEnv();
  const api = createKrogerApiClient(credentials);
  const configured = api.isConfigured;

  return {
    provider: "kroger",
    label: KROGER_LABEL,
    configured,
    async searchStoresByLocation(
      input: ProviderStoreSearchInput,
    ): Promise<ProviderStoreSearchResult> {
      if (!configured || !credentials) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
          fallbackUsed: false,
          stores: [],
          message:
            "Kroger official store discovery is not configured yet. Add Kroger API credentials to enable live nearby-store checks.",
          fetchedAt: new Date().toISOString(),
        };
      }

      try {
        const locations = await api.searchLocations({
          latLongNear: `${input.location.latitude},${input.location.longitude}`,
          radiusInMiles: input.radiusMiles,
          limit: resolveKrogerLocationSearchLimit(),
        });
        const stores = filterKrogerFamilyDiscoveredStores(
          locations
            .map(toProviderDiscoveredStore)
            .filter(
              (store): store is ProviderDiscoveredStore => store !== undefined,
            ),
        );

        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          stores,
          message:
            stores.length > 0
              ? `Kroger Location API found ${stores.length} nearby Kroger-family store(s). Map pins prefer these API coordinates over OpenStreetMap when both are present; ranked meal estimates use ingested prices when production sync and promotion gates pass — verify totals in store.`
              : "Kroger official store discovery is configured, but no nearby Kroger stores were returned for this search.",
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          stores: [],
          message:
            error instanceof Error
              ? `Kroger official store discovery was attempted but fell back to local store coverage: ${error.message}`
              : "Kroger official store discovery was attempted but fell back to local store coverage.",
          fetchedAt: new Date().toISOString(),
        };
      }
    },
    async searchPricingPreview(
      input: ProviderPricingPreviewInput,
    ): Promise<ProviderPricingPreviewResult> {
      if (!configured || !credentials) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
          fallbackUsed: false,
          storeName: input.store.name,
          providerStoreId: input.store.providerStoreId,
          items: [],
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: input.ingredients.length,
          message:
            "Kroger official pricing preview is not configured yet. Add Kroger API credentials to enable provider-backed product lookups.",
          fetchedAt: new Date().toISOString(),
        };
      }

      try {
        const environment = getKrogerApiEnvironment();
        const { rawItems, firstError } = await searchKrogerProductsForIngredients(api, input);
        const items = isKrogerOfficialOnlinePricingEligible()
          ? rawItems.filter((item) => hasKrogerPreviewPrice(item))
          : [];
        const previewProvenance = isKrogerOfficialOnlinePricingEligible()
          ? "official-api"
          : "official-api-no-pricing";
        if (isKrogerProviderDebugEnabled()) {
          console.log(
            `[diag:searchPricingPreview] provenance=${previewProvenance} rawMatches=${rawItems.length} pricedItems=${items.length} firstError=${formatKrogerPreviewFirstError(firstError)}`,
          );
        }
        const coverageStatus = getPricingCoverageStatus({
          matchedIngredientCount: items.length,
          totalTrackedIngredients: input.ingredients.length,
        });

        if (!isKrogerOfficialOnlinePricingEligible()) {
          return {
            provider: "kroger",
            label: "Kroger official pricing preview",
            status: "available",
            provenance: "official-api",
            retrievalMode: "live",
            configured: true,
            fallbackUsed: false,
            storeName: input.store.name,
            providerStoreId: input.store.providerStoreId,
            coverageStatus: "none",
            matchedIngredientCount: 0,
            totalTrackedIngredients: input.ingredients.length,
            items: [],
            message:
              environment === "certification"
                ? "Kroger catalog lookup works in certification, but store-specific prices require production (api.kroger.com). Set KROGER_API_ENV=production after Kroger approves portal promotion, then re-run npm run probe:kroger-api."
                : "Kroger official-online pricing preview requires KROGER_API_ENV=production.",
            fetchedAt: new Date().toISOString(),
          };
        }

        if (items.length === 0) {
          return {
            provider: "kroger",
            label: "Kroger official pricing preview",
            status: "available",
            provenance: "official-api",
            retrievalMode: "live",
            configured: true,
            fallbackUsed: false,
            storeName: input.store.name,
            providerStoreId: input.store.providerStoreId,
            coverageStatus: "none",
            matchedIngredientCount: 0,
            totalTrackedIngredients: input.ingredients.length,
            items: [],
            message:
              "Kroger production API auth succeeded, but the sample product lookups did not return store prices yet. Weekly-ad and cached rows remain the ranked path until prices appear—verify any returned price in store before checkout.",
            fetchedAt: new Date().toISOString(),
          };
        }

        return {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          storeName: input.store.name,
          providerStoreId: input.store.providerStoreId,
          coverageStatus,
          matchedIngredientCount: items.length,
          totalTrackedIngredients: input.ingredients.length,
          items,
          message: `${buildPricingCoverageMessage({
            matchedIngredientCount: items.length,
            totalTrackedIngredients: input.ingredients.length,
            coverageStatus,
          })} Prices came from the official Kroger production API—verify in store before checkout.`,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const parsed = parseKrogerApiError(error);
        if (isKrogerProviderDebugEnabled()) {
          console.log(
            `[diag:searchPricingPreview] catch fired message=${parsed.message} status=${parsed.statusCode ?? "unknown"}`,
          );
        }
        return {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          storeName: input.store.name,
          providerStoreId: input.store.providerStoreId,
          items: [],
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: input.ingredients.length,
          message:
            error instanceof Error
              ? `Kroger official pricing preview fell back before using provider prices: ${error.message}`
              : "Kroger official pricing preview fell back before using provider prices.",
          fetchedAt: new Date().toISOString(),
        };
      }
    },
  };
}

function toProviderDiscoveredStore(
  item: KrogerLocation,
): ProviderDiscoveredStore | undefined {
  const latitude = item.geolocation?.latitude;
  const longitude = item.geolocation?.longitude;
  const address = item.address;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !item.locationId ||
    !item.name ||
    !address?.city ||
    !address.state
  ) {
    return undefined;
  }

  return {
    provider: "kroger",
    providerStoreId: item.locationId,
    name: item.name,
    addressLine1: address.addressLine1,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    latitude,
    longitude,
  };
}

async function searchKrogerProductsForIngredients(
  api: ReturnType<typeof createKrogerApiClient>,
  input: ProviderPricingPreviewInput,
): Promise<KrogerIngredientSearchResult> {
  const ingredients = input.ingredients;
  if (ingredients.length === 0) {
    return { rawItems: [] };
  }

  try {
    await api.warmProductsAccessToken();
    if (isKrogerProviderDebugEnabled()) {
      console.log(
        "[sync:kroger] warmed products access token (cached for remaining ingredient searches in this sync run)",
      );
    }
  } catch (error: unknown) {
    const parsed = parseKrogerApiError(error);
    if (isKrogerProviderDebugEnabled()) {
      console.log(
        `[diag:searchPricingPreview] token warm failed message=${parsed.message} status=${parsed.statusCode ?? "unknown"}`,
      );
    }
    return { rawItems: [], firstError: parsed };
  }

  const totalBatches = Math.ceil(ingredients.length / KROGER_INGREDIENT_SEARCH_BATCH_SIZE);
  const rawItems: ProviderPricingPreviewItem[] = [];
  let firstError: KrogerIngredientSearchResult["firstError"];

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const startIndex = batchIndex * KROGER_INGREDIENT_SEARCH_BATCH_SIZE;
    const batch = ingredients.slice(startIndex, startIndex + KROGER_INGREDIENT_SEARCH_BATCH_SIZE);
    const endIndex = startIndex + batch.length;

    if (isKrogerProviderDebugEnabled()) {
      console.log(
        `[sync:kroger] querying batch ${batchIndex + 1}/${totalBatches} (ingredients ${startIndex + 1}-${endIndex})`,
      );
    }

    const batchResults = await Promise.all(
      batch.map(async (ingredient) => {
        try {
          return await searchKrogerProduct(api, input.store.providerStoreId, ingredient);
        } catch (error: unknown) {
          if (!firstError) {
            firstError = parseKrogerApiError(error);
          }
          return undefined;
        }
      }),
    );

    for (const result of batchResults) {
      if (result !== undefined) {
        rawItems.push(result);
      }
    }

    if (batchIndex < totalBatches - 1) {
      await sleep(KROGER_INGREDIENT_SEARCH_BATCH_DELAY_MS);
    }
  }

  return { rawItems, firstError };
}

async function searchKrogerProduct(
  api: ReturnType<typeof createKrogerApiClient>,
  providerStoreId: string,
  ingredient: ProviderPricingPreviewInput["ingredients"][number],
): Promise<ProviderPricingPreviewItem | undefined> {
  const MATCH_THRESHOLD = 0.45;
  const MAX_SEARCH_TERMS_PER_INGREDIENT = 2;

  const searchAttempts: Array<{ searchTerm: string; priority: number }> = [
    { searchTerm: ingredient.searchTerm, priority: 1 },
  ];

  if (ingredient.fallbackSearchTerm) {
    searchAttempts.push({
      searchTerm: ingredient.fallbackSearchTerm,
      priority: 2,
    });
  }

  const boundedAttempts = searchAttempts.slice(0, MAX_SEARCH_TERMS_PER_INGREDIENT);

  for (let attemptIndex = 0; attemptIndex < boundedAttempts.length; attemptIndex += 1) {
    const attempt = boundedAttempts[attemptIndex]!;
    const result = await searchKrogerProductWithTerm(
      api,
      providerStoreId,
      ingredient,
      attempt.searchTerm,
      attempt.priority,
      MATCH_THRESHOLD,
    );

    if (result) {
      if (attempt.priority === 2 && isProviderMatchDebugEnabled()) {
        console.log(
          `[KrogerMatchDebug] falling back to priority-2 term "${attempt.searchTerm}" for ${ingredient.ingredientId}`,
        );
      }
      return result;
    }

    if (
      attempt.priority === 1 &&
      boundedAttempts.length > 1 &&
      isProviderMatchDebugEnabled()
    ) {
      console.log(
        `[KrogerMatchDebug] priority-1 term "${attempt.searchTerm}" found no match >= ${MATCH_THRESHOLD} for ${ingredient.ingredientId}; trying priority-2...`,
      );
    }
  }

  if (boundedAttempts.length > 1 && isProviderMatchDebugEnabled()) {
    console.log(
      `[KrogerMatchDebug] no-match-after-fallback for ${ingredient.ingredientId}`,
    );
  }

  return undefined;
}

async function searchKrogerProductWithTerm(
  api: ReturnType<typeof createKrogerApiClient>,
  providerStoreId: string,
  ingredient: ProviderPricingPreviewInput["ingredients"][number],
  searchTerm: string,
  priority: number,
  matchThreshold: number,
): Promise<ProviderPricingPreviewItem | undefined> {
  const products = await api.searchProducts({
    term: searchTerm,
    locationId: providerStoreId,
    fulfillment: "ais",
    limit: 3,
  });

  const scoredCandidates = products.map((product, index) => {
    if (!product.productId || !product.description) {
      return {
        index,
        dropped: true,
        dropReason: "missing productId or description",
        product,
        item: undefined as ProviderPricingPreviewItem | undefined,
      };
    }

    const firstItem = product.items?.[0];
    const { regularPrice, promoPrice } = readKrogerItemPrices(firstItem);
    const inStock = isKrogerProductAvailableInStore(firstItem);
    const matchMetadata = scoreProviderProductMatch({
      ingredient: {
        ...ingredient,
        searchTerm,
      },
      description: product.description,
      inStock,
    });

    const item: ProviderPricingPreviewItem = {
      provider: "kroger" as const,
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.ingredientName,
      providerProductId: product.productId,
      description: product.description,
      brand: product.brand,
      regularPrice,
      promoPrice,
      currencyCode: "USD",
      inStock,
      matchConfidence: matchMetadata.matchConfidence,
      matchReason: matchMetadata.matchReason,
    };

    const belowThreshold = item.matchConfidence < matchThreshold;

    return {
      index,
      dropped: belowThreshold,
      dropReason: belowThreshold
        ? `matchConfidence ${item.matchConfidence.toFixed(2)} < ${matchThreshold}`
        : undefined,
      product,
      item,
    };
  });

  if (isProviderMatchDebugEnabled()) {
    console.log(
      [
        "[KrogerMatchDebug] searchKrogerProduct",
        `  ingredientId: ${ingredient.ingredientId}`,
        `  ingredientName: ${ingredient.ingredientName}`,
        `  searchTerm: ${searchTerm}`,
        `  priority: ${priority}`,
        `  locationId: ${providerStoreId}`,
        `  apiCandidatesReturned: ${products.length}`,
      ].join("\n"),
    );

    for (const candidate of scoredCandidates) {
      const status = candidate.dropped ? "DROPPED" : "KEPT";
      const detail = candidate.item
        ? `confidence=${candidate.item.matchConfidence.toFixed(2)} regular=${candidate.item.regularPrice ?? "n/a"} promo=${candidate.item.promoPrice ?? "n/a"} inStock=${candidate.item.inStock}`
        : candidate.dropReason;
      console.log(
        [
          `  candidate[${candidate.index}] ${status}: productId=${candidate.product.productId ?? "n/a"}`,
          `    description: ${candidate.product.description ?? "n/a"}`,
          `    brand: ${candidate.product.brand ?? "n/a"}`,
          `    ${detail}`,
        ].join("\n"),
      );
    }
  }

  const candidateMatches = scoredCandidates
    .map((entry) => entry.item)
    .filter(
      (item): item is ProviderPricingPreviewItem =>
        item !== undefined && item.matchConfidence >= matchThreshold,
    )
    .sort((left, right) => right.matchConfidence - left.matchConfidence);

  if (isProviderMatchDebugEnabled()) {
    if (candidateMatches.length === 0) {
      console.log(
        `[KrogerMatchDebug] searchKrogerProduct result: NO candidate passed threshold ${matchThreshold} for ${ingredient.ingredientId} (priority ${priority}, term "${searchTerm}")`,
      );
    } else {
      console.log(
        `[KrogerMatchDebug] searchKrogerProduct result: selected productId=${candidateMatches[0]!.providerProductId} confidence=${candidateMatches[0]!.matchConfidence.toFixed(2)} (priority ${priority}, term "${searchTerm}")`,
      );
    }
  }

  return candidateMatches[0];
}

function hasKrogerPreviewPrice(item: ProviderPricingPreviewItem) {
  return typeof item.promoPrice === "number" || typeof item.regularPrice === "number";
}

function parseKrogerApiError(error: unknown): { message: string; statusCode?: string } {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/status (\d+)/);
  return {
    message,
    statusCode: statusMatch?.[1],
  };
}

function formatKrogerPreviewFirstError(
  firstError: KrogerIngredientSearchResult["firstError"],
): string {
  if (!firstError) {
    return "none";
  }
  if (firstError.statusCode) {
    return `${firstError.message} (status ${firstError.statusCode})`;
  }
  return firstError.message;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
