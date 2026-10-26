import { getDbPool } from "@/lib/db";
import { getDistanceMiles } from "@/lib/geo-distance";
import { inferStoreChainFromCatalog } from "@/lib/chain-rollout-policy";
import { isLiveOsmStoreId, isOsmStyleStoreId } from "@/lib/osm-food-retail-discovery";

/**
 * Same physical building. A second same-chain grocery farther than this stays
 * its own row. This is tighter than the older 0.15-mile Kroger cleanup.
 */
export const SAME_BUILDING_MILES = 0.04;

export type OfficialPinStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceName?: string | null;
  sourceStoreId?: string | null;
};

function isPharmacyOrMoneyCounter(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized.includes("pharmacy") ||
    normalized.includes("western union") ||
    normalized.includes("money transfer")
  );
}

/**
 * Same chain from the saved source, id, or store number. A Publix row whose
 * display name is the shopping center still matches. The display name is used
 * only when the source and id do not already name a chain, which is how an
 * OpenStreetMap "Publix" pin matches. A pharmacy or money counter in the
 * building does not match.
 */
export function savedStoreMatchesOfficialChain(
  store: OfficialPinStore,
  chainHint: string,
): boolean {
  if (isPharmacyOrMoneyCounter(store.name)) {
    return false;
  }

  const hint = chainHint.trim().toLowerCase();
  if (!hint) {
    return false;
  }

  return (
    inferStoreChainFromCatalog({
      id: store.id,
      name: store.name,
      sourceName: store.sourceName,
    }) === hint
  );
}

/**
 * Prefer the map pin for this building. An existing chain row is used only
 * when the map pin is not already saved. No match means the locator may insert.
 */
export function findSavedStoreForOfficialPin(input: {
  stores: readonly OfficialPinStore[];
  latitude: number;
  longitude: number;
  chainHint: string;
  radiusMiles: number;
  locatorStoreNumber?: string | null;
}): OfficialPinStore | undefined {
  const locatorNumber = input.locatorStoreNumber?.trim() || "";
  const nearby = input.stores.filter((store) => {
    if (!Number.isFinite(store.latitude) || !Number.isFinite(store.longitude)) {
      return false;
    }
    if (!savedStoreMatchesOfficialChain(store, input.chainHint)) {
      return false;
    }
    return (
      getDistanceMiles(
        input.latitude,
        input.longitude,
        store.latitude,
        store.longitude,
      ) <= input.radiusMiles
    );
  });
  const mapPin = nearby.find((store) => isLiveOsmStoreId(store.id));
  if (mapPin) {
    return mapPin;
  }
  if (locatorNumber) {
    const numbered = nearby.find((store) => store.sourceStoreId?.trim() === locatorNumber);
    if (numbered) {
      return numbered;
    }
  }
  return nearby[0];
}

/**
 * Put the chain's store number on a map row. Leave a number that is already
 * a chain store number alone.
 */
export function chooseAttachedSourceStoreId(input: {
  current: string | null;
  incoming: string | null;
}): string | null {
  const incoming = input.incoming?.trim() || null;
  const current = input.current?.trim() || null;
  if (!incoming) {
    return current;
  }
  if (!current || isOsmStyleStoreId(current)) {
    return incoming;
  }
  return current;
}

export async function attachOfficialDetailsToStore(input: {
  storeId: string;
  addressLine?: string | null;
  postalCode?: string | null;
  sourceStoreId?: string | null;
}): Promise<number> {
  const addressLine = input.addressLine?.trim() || null;
  const postalCode = input.postalCode?.trim() || null;
  const sourceStoreId = input.sourceStoreId?.trim() || null;
  if (!addressLine && !postalCode && !sourceStoreId) {
    return 0;
  }
  const pool = getDbPool();
  const current = await pool.query<{ source_store_id: string | null }>(
    `select source_store_id from stores where id = $1`,
    [input.storeId],
  );
  const row = current.rows[0];
  if (!row) {
    return 0;
  }
  const nextSourceStoreId = chooseAttachedSourceStoreId({
    current: row.source_store_id,
    incoming: sourceStoreId,
  });
  const result = await pool.query(
    `
      update stores
      set address_line = coalesce($2, address_line),
          postal_code = coalesce($3, postal_code),
          source_store_id = $4,
          last_verified_at = now()
      where id = $1
    `,
    [input.storeId, addressLine, postalCode, nextSourceStoreId],
  );
  return result.rowCount ?? 0;
}
