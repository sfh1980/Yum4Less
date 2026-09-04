import {
  isMissingActiveMarketsSchema,
  readIngestMarket,
  saveMarketDensity,
  upsertActiveMarket,
  type ActiveMarketRow,
} from "@/lib/active-markets";
import { isValidZipCode } from "@/lib/api-request";
import { resolveZipLocation, type ResolvedZipLocation } from "@/lib/geocoding";
import { inferStoreChainFromName } from "@/lib/chain-rollout-policy";
import {
  isShopperRankedChain,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import { loadChainMembership } from "@/lib/chain-membership-repository";
import { getDistanceMiles } from "@/lib/geo-distance";
import { resolveZctaGeometry } from "@/lib/geo/zcta-boundary";
import { listCatalogStoresNearLocation } from "@/lib/market-catalog-repository";
import type { CatalogStore } from "@/lib/market-catalog-types";
import { mergeCatalogStoresForMap } from "@/lib/market-store-catalog-merge";
import {
  DENSITY_CLASSIFY_RADIUS_MILES,
  INGEST_ZCTA_SAFETY_CAP_MILES,
  pickPersistedIngestMiles,
} from "@/lib/market-density";
import {
  classifyAndMilesFromGroceryCount,
  storePassesIngestFence,
} from "@/lib/market-ingest-fence";
import { discoverMapContextStores } from "@/lib/map-context-discovery";
import {
  formatDensityHeadline,
  formatOmittedPinsNotice,
  classifyOwnerAdmissionGroup,
  isGroceryPinForDensity,
  isOwnerCheckListedPin,
} from "@/lib/owner/owner-market-admission";
import {
  NO_RANKED_V1_CHAIN_PREVIEW_NOTICE,
  type OwnerMarketAdmission,
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";
import {
  buildOwnerMarketPreviewList,
  type OwnerMarketPreviewOsmCandidate,
} from "@/lib/owner/owner-market-preview-stores";
import { isWithinContinentalUsBounds } from "@/lib/us-service-area";
import { rememberIngestZipGeocode } from "@/lib/zip-geocode-cache";

export {
  isMissingActiveMarketsSchema,
  type ActiveMarketRow,
} from "@/lib/active-markets";
export {
  INGEST_OVERLAY_NOTICE,
  MISSING_ACTIVE_MARKETS_MESSAGE,
  NO_RANKED_V1_CHAIN_PREVIEW_NOTICE,
  type OwnerMarketAdmission,
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";

export const OWNER_MARKET_PREVIEW_RADIUS_MILES = INGEST_ZCTA_SAFETY_CAP_MILES;
export const OWNER_MARKET_PREVIEW_STORE_LIMIT = 40;
export const OWNER_MARKET_PREVIEW_TIMEOUT_MS = 12_000;

export type OwnerMarketInspectResult = {
  zipCode: string;
  location: Pick<
    ResolvedZipLocation,
    "city" | "state" | "latitude" | "longitude" | "source"
  >;
  existing: ActiveMarketRow | null;
  alreadyActive: boolean;
  activatedNow: boolean;
  stores: OwnerMarketStorePreview[];
  warnings: string[];
  admission: OwnerMarketAdmission;
};

export function parseOwnerMarketZipInput(
  body: unknown,
): { ok: true; zipCode: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "ZIP payload is invalid." };
  }

  const zipCode = (body as { zipCode?: unknown }).zipCode;
  if (!isValidZipCode(zipCode)) {
    return { ok: false, error: "Enter a 5-digit ZIP code." };
  }

  return { ok: true, zipCode: zipCode.trim() };
}

async function previewNearbyStores(input: {
  zipCode: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  savedIngestMiles: number | null;
}): Promise<{
  stores: OwnerMarketStorePreview[];
  warnings: string[];
  admission: OwnerMarketAdmission;
}> {
  const warnings: string[] = [];
  const catalogStores = await listCatalogStoresNearLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMiles: OWNER_MARKET_PREVIEW_RADIUS_MILES,
  }).catch(() => []);

  let osmStores: OwnerMarketPreviewOsmCandidate[] = [];
  let osmLookupFailed = false;

  try {
    const discovery = await Promise.race([
      discoverMapContextStores({
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: OWNER_MARKET_PREVIEW_RADIUS_MILES,
        zipCode: input.zipCode,
        includeSnap: false,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("store-preview-timeout"));
        }, OWNER_MARKET_PREVIEW_TIMEOUT_MS);
      }),
    ]);
    osmStores = discovery.stores;
  } catch {
    osmLookupFailed = true;
  }

  const osmAsCatalog: CatalogStore[] = osmStores.map((store, index) => ({
    id: store.id?.trim() || `osm-preview-${index}`,
    name: store.name,
    kind: store.kind as CatalogStore["kind"],
    city: store.city,
    state: store.state,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceName: store.sourceName,
  }));
  const merged = mergeCatalogStoresForMap(catalogStores, osmAsCatalog);

  const groceryCountIn8Mi = merged.filter((store) => {
    if (!isGroceryPinForDensity(store)) {
      return false;
    }
    return (
      getDistanceMiles(
        input.latitude,
        input.longitude,
        store.latitude,
        store.longitude,
      ) <= DENSITY_CLASSIFY_RADIUS_MILES
    );
  }).length;

  const classified = classifyAndMilesFromGroceryCount(groceryCountIn8Mi);
  const ingestMiles = pickPersistedIngestMiles({
    savedMiles: input.savedIngestMiles,
    computedMiles: classified.ingestMiles,
  });

  const zcta = await resolveZctaGeometry({ zipCode: input.zipCode });
  if (!zcta.ok) {
    warnings.push(
      `ZIP outline unavailable (${zcta.error}). Showing pins in the ${ingestMiles} mi circle only.`,
    );
  }

  const omitted = merged.filter((store) => !isOwnerCheckListedPin(store));
  const listedPins = merged.filter((store) => {
    if (!isOwnerCheckListedPin(store)) {
      return false;
    }
    if (zcta.ok) {
      return storePassesIngestFence({
        latitude: store.latitude,
        longitude: store.longitude,
        center: { latitude: input.latitude, longitude: input.longitude },
        fence: { ingestMiles, geometry: zcta.geometry },
      });
    }
    return (
      getDistanceMiles(
        input.latitude,
        input.longitude,
        store.latitude,
        store.longitude,
      ) <= ingestMiles
    );
  });

  const preview = buildOwnerMarketPreviewList({
    catalogStores: listedPins,
    osmStores: [],
    marketCity: input.city,
    marketState: input.state,
    limit: OWNER_MARKET_PREVIEW_STORE_LIMIT,
  });

  const stores = preview.stores.map((store) => {
    const pin = listedPins.find((candidate) => candidate.name === store.name);
    const inIngestFence = pin
      ? storePassesIngestFence({
          latitude: pin.latitude,
          longitude: pin.longitude,
          center: { latitude: input.latitude, longitude: input.longitude },
          fence: {
            ingestMiles,
            geometry: zcta.ok ? zcta.geometry : null,
          },
        })
      : false;
    const group = classifyOwnerAdmissionGroup(store.name);
    return {
      ...store,
      group,
      inIngestFence,
    };
  });

  const omittedNotice = formatOmittedPinsNotice(omitted.length);
  if (omittedNotice) {
    warnings.unshift(omittedNotice);
  }

  if (preview.stores.length === 0) {
    warnings.push(
      osmLookupFailed
        ? "Store lookup timed out or failed. The ZIP can still be activated; coverage comes from the next ingest run."
        : "No grocery pins showed up in this first look. The ZIP can still be activated; coverage comes from the next ingest run.",
    );
  } else {
    if (osmLookupFailed) {
      warnings.push(
        "Live map lookup timed out or failed. Showing ingested catalog pins for this ZIP.",
      );
    }
    if (preview.total > OWNER_MARKET_PREVIEW_STORE_LIMIT) {
      warnings.push(
        `Showing ${OWNER_MARKET_PREVIEW_STORE_LIMIT} of ${preview.total} pins (ranked banners first). This first look is not a full ingest catalog.`,
      );
    }
    if (preview.stores.some((store) => store.localityIsApproximate)) {
      warnings.push(
        `OSM pins without address tags are listed near ${input.city}, ${input.state} — not a street address.`,
      );
    }
  }

  const admission: OwnerMarketAdmission = {
    densityClass: classified.densityClass,
    groceryCountIn8Mi,
    ingestMiles,
    omittedCount: omitted.length,
    headline: formatDensityHeadline({
      zipCode: input.zipCode,
      city: input.city,
      state: input.state,
      densityClass: classified.densityClass,
      groceryCountIn8Mi,
      ingestMiles,
    }),
    zctaWarning: zcta.ok ? undefined : zcta.error,
  };

  return { stores, warnings, admission };
}

function previewHasShopperRankedV1Chain(
  stores: OwnerMarketStorePreview[],
  membership: ChainMembershipSnapshot,
): boolean {
  return stores.some((store) => {
    const chain = inferStoreChainFromName(store.name);
    return (
      chain !== "dollar-general" && isShopperRankedChain(membership, chain)
    );
  });
}

export async function inspectOwnerIngestMarket(
  zipCode: string,
): Promise<
  | { ok: true; result: OwnerMarketInspectResult }
  | { ok: false; error: string }
> {
  const resolved = await resolveZipLocation(zipCode);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  if (
    !isWithinContinentalUsBounds({
      latitude: resolved.location.latitude,
      longitude: resolved.location.longitude,
    })
  ) {
    return {
      ok: false,
      error:
        "That ZIP is outside the continental US markets Yum4Less supports in this beta.",
    };
  }

  const existing = await readIngestMarket(zipCode);
  const membership = await loadChainMembership();
  const nearby = await previewNearbyStores({
    zipCode,
    latitude: resolved.location.latitude,
    longitude: resolved.location.longitude,
    city: resolved.location.city,
    state: resolved.location.state,
    savedIngestMiles: existing?.ingestMiles ?? null,
  });
  const warnings = [...nearby.warnings];
  const admission: OwnerMarketAdmission = {
    ...nearby.admission,
    headline: formatDensityHeadline({
      zipCode,
      city: resolved.location.city,
      state: resolved.location.state,
      densityClass: nearby.admission.densityClass,
      groceryCountIn8Mi: nearby.admission.groceryCountIn8Mi,
      ingestMiles: nearby.admission.ingestMiles,
      alreadyActive: existing?.status === "active",
    }),
  };

  if (existing?.status === "active") {
    try {
      await saveMarketDensity({
        zipCode,
        densityClass: admission.densityClass,
        ingestMiles: admission.ingestMiles,
      });
    } catch {
      // density columns may be missing until 029
    }
  }

  if (!previewHasShopperRankedV1Chain(nearby.stores, membership)) {
    warnings.push(NO_RANKED_V1_CHAIN_PREVIEW_NOTICE);
  }

  if (existing?.status === "paused") {
    warnings.push(
      "This ZIP is already on the list as paused. Activating it will include it in the next ingest run.",
    );
  } else if (existing?.status === "retired") {
    warnings.push(
      "This ZIP is marked retired. Activating it will put it back on the ingest list.",
    );
  }

  return {
    ok: true,
    result: {
      zipCode,
      location: {
        city: resolved.location.city,
        state: resolved.location.state,
        latitude: resolved.location.latitude,
        longitude: resolved.location.longitude,
        source: resolved.location.source,
      },
      existing,
      alreadyActive: existing?.status === "active",
      activatedNow: false,
      stores: nearby.stores,
      warnings,
      admission,
    },
  };
}

export async function activateOwnerIngestMarket(
  zipCode: string,
): Promise<
  | { ok: true; result: OwnerMarketInspectResult }
  | { ok: false; error: string }
> {
  const inspected = await inspectOwnerIngestMarket(zipCode);
  if (!inspected.ok) {
    return inspected;
  }

  if (inspected.result.alreadyActive) {
    try {
      await saveMarketDensity({
        zipCode,
        densityClass: inspected.result.admission.densityClass,
        ingestMiles: inspected.result.admission.ingestMiles,
      });
    } catch {
      // density columns may be missing until 029
    }
    return {
      ok: true,
      result: { ...inspected.result, activatedNow: false },
    };
  }

  const { location, admission } = inspected.result;
  await upsertActiveMarket({
    zipCode,
    source: "ops",
    latitude: location.latitude,
    longitude: location.longitude,
    densityClass: admission.densityClass,
    ingestMiles: admission.ingestMiles,
    notes: "Activated by /owner Markets",
  });
  await rememberIngestZipGeocode({
    zipCode,
    city: location.city,
    state: location.state,
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
  });

  const existing = await readIngestMarket(zipCode);
  return {
    ok: true,
    result: {
      ...inspected.result,
      existing,
      alreadyActive: true,
      activatedNow: true,
    },
  };
}
