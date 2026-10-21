import { getDbPool } from "@/lib/db";
import { getDistanceMiles } from "@/lib/geo-distance";
import { inferStoreChainFromName } from "@/lib/chain-rollout-policy";
import { isLiveOsmStoreId, isOsmStyleStoreId } from "@/lib/osm-food-retail-discovery";

export type OfficialPinStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

/**
 * Prefer the map pin for this building. An existing chain row is used only
 * when the map pin is not already saved.
 */
export function findSavedStoreForOfficialPin(input: {
  stores: readonly OfficialPinStore[];
  name: string;
  latitude: number;
  longitude: number;
  chainHint: string;
  radiusMiles: number;
}): OfficialPinStore | undefined {
  const hint = input.chainHint.trim().toLowerCase();
  const nearby = input.stores.filter((store) => {
    if (!Number.isFinite(store.latitude) || !Number.isFinite(store.longitude)) {
      return false;
    }
    const chain = inferStoreChainFromName(store.name);
    const sameChain =
      chain === hint || store.name.trim().toLowerCase().includes(hint);
    if (!sameChain) {
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
  return nearby.find((store) => isLiveOsmStoreId(store.id)) ?? nearby[0];
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
