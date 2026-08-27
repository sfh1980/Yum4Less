import {
  isMissingActiveMarketsSchema,
  readIngestMarket,
  upsertActiveMarket,
  type ActiveMarketRow,
} from "@/lib/active-markets";
import { isValidZipCode } from "@/lib/api-request";
import { resolveZipLocation, type ResolvedZipLocation } from "@/lib/geocoding";
import {
  inferStoreChainFromName,
  SHOPPER_RANKED_V1_CHAINS,
  type ShopperRankedV1Chain,
} from "@/lib/chain-rollout-policy";
import { discoverMapContextStores } from "@/lib/map-context-discovery";
import {
  NO_RANKED_V1_CHAIN_PREVIEW_NOTICE,
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";
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
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";

export const OWNER_MARKET_PREVIEW_RADIUS_MILES = 5;
export const OWNER_MARKET_PREVIEW_STORE_LIMIT = 20;
export const OWNER_MARKET_PREVIEW_TIMEOUT_MS = 8_000;

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
}): Promise<{ stores: OwnerMarketStorePreview[]; warnings: string[] }> {
  const warnings: string[] = [];

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

    const stores = discovery.stores
      .slice(0, OWNER_MARKET_PREVIEW_STORE_LIMIT)
      .map((store) => ({
        name: store.name,
        city: store.city,
        state: store.state,
        kind: store.kind,
      }));

    if (stores.length === 0) {
      warnings.push(
        "No grocery pins showed up in this first look. The ZIP can still be activated; coverage comes from the next ingest run.",
      );
    } else if (discovery.stores.length > OWNER_MARKET_PREVIEW_STORE_LIMIT) {
      warnings.push(
        `Showing ${OWNER_MARKET_PREVIEW_STORE_LIMIT} of ${discovery.stores.length} pins. This first look is not a full ingest catalog.`,
      );
    }

    return { stores, warnings };
  } catch {
    warnings.push(
      "Store lookup timed out or failed. The ZIP can still be activated; coverage comes from the next ingest run.",
    );
    return { stores: [], warnings };
  }
}

function previewHasShopperRankedV1Chain(
  stores: OwnerMarketStorePreview[],
): boolean {
  return stores.some((store) =>
    SHOPPER_RANKED_V1_CHAINS.includes(
      inferStoreChainFromName(store.name) as ShopperRankedV1Chain,
    ),
  );
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
  const nearby = await previewNearbyStores({
    zipCode,
    latitude: resolved.location.latitude,
    longitude: resolved.location.longitude,
  });
  const warnings = [...nearby.warnings];

  if (!previewHasShopperRankedV1Chain(nearby.stores)) {
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
    return {
      ok: true,
      result: { ...inspected.result, activatedNow: false },
    };
  }

  const { location } = inspected.result;
  await upsertActiveMarket({
    zipCode,
    source: "ops",
    latitude: location.latitude,
    longitude: location.longitude,
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
