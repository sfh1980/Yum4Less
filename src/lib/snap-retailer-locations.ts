import { getDbPool } from "@/lib/db";
import { fixtureSnapRetailers23111 } from "@/lib/fixtures/snap-retailers.fixtures";
import {
  type MapContextStoreCandidate,
  USDA_SNAP_CONTEXT_SOURCE,
} from "@/lib/map-context-types";
import { getDistanceMiles } from "@/lib/geo-distance";
import type { LocationWitness } from "@/lib/store-location-reconciliation";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";

export type SnapRetailerLocationRow = {
  id: string;
  retailerName: string;
  retailerType: string;
  addressLine1?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  snapshotDate: string;
};

/** USDA SNAP store types included for grocery map context (codes + FNS full names). */
export const SNAP_MAP_CONTEXT_RETAILER_TYPES = new Set([
  "SM",
  "SS",
  "LG",
  "MG",
  "SG",
  "SUPERMARKET",
  "SUPER STORE/CHAIN STORE",
  "SUPER STORE",
  "CHAIN STORE",
  "LARGE GROCERY STORE",
  "MEDIUM GROCERY STORE",
  "SMALL GROCERY STORE",
]);

export function normalizeSnapRetailerType(value: string): string {
  return value.trim().toUpperCase();
}

export function isSnapMapContextRetailerType(retailerType: string): boolean {
  return SNAP_MAP_CONTEXT_RETAILER_TYPES.has(normalizeSnapRetailerType(retailerType));
}

export function buildSnapRetailerLocationId(input: {
  state: string;
  zipCode?: string;
  retailerName: string;
  latitude: number;
  longitude: number;
}): string {
  const slug = input.retailerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const zipPart = (input.zipCode ?? "unknown").slice(0, 5);
  return `snap-${input.state.toLowerCase()}-${zipPart}-${slug || "store"}`;
}

export function inferSnapStoreKind(
  retailerName: string,
  retailerType: string,
): MapContextStoreCandidate["kind"] {
  const normalizedName = retailerName.toLowerCase();
  const normalizedType = normalizeSnapRetailerType(retailerType);

  if (
    normalizedName.includes("dollar general") ||
    normalizedName.includes("family dollar")
  ) {
    return "dollar-market";
  }

  if (
    normalizedType === "SS" ||
    normalizedName.includes("walmart") ||
    normalizedName.includes("costco") ||
    normalizedName.includes("sam's club") ||
    normalizedName.includes("bj")
  ) {
    return "big-box";
  }

  return "grocery";
}

export function snapRetailerRowToMapContextCandidate(
  row: SnapRetailerLocationRow,
): MapContextStoreCandidate {
  return {
    id: row.id,
    name: row.retailerName,
    kind: inferSnapStoreKind(row.retailerName, row.retailerType),
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    sourceName: USDA_SNAP_CONTEXT_SOURCE,
    sourceStoreId: row.id,
  };
}

const SNAP_UPSERT_CHUNK_SIZE = 250;

export async function upsertSnapRetailerLocations(
  rows: SnapRetailerLocationRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const pool = getDbPool();
  let upserted = 0;

  for (let offset = 0; offset < rows.length; offset += SNAP_UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + SNAP_UPSERT_CHUNK_SIZE);
    const values: string[] = [];
    const params: Array<string | number | null> = [];

    chunk.forEach((row, index) => {
      const base = index * 10;
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}::date)`,
      );
      params.push(
        row.id,
        row.retailerName,
        row.retailerType,
        row.addressLine1 ?? null,
        row.city,
        row.state,
        row.zipCode ?? null,
        row.latitude,
        row.longitude,
        row.snapshotDate,
      );
    });

    const result = await pool.query(
      `
        insert into snap_retailer_locations (
          id,
          retailer_name,
          retailer_type,
          address_line1,
          city,
          state,
          zip_code,
          latitude,
          longitude,
          snapshot_date
        )
        values ${values.join(", ")}
        on conflict (id) do update set
          retailer_name = excluded.retailer_name,
          retailer_type = excluded.retailer_type,
          address_line1 = excluded.address_line1,
          city = excluded.city,
          state = excluded.state,
          zip_code = excluded.zip_code,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          snapshot_date = excluded.snapshot_date
      `,
      params,
    );

    upserted += result.rowCount ?? 0;
  }

  return upserted;
}

export async function findSnapRetailersNearLocation(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
  useFixture?: boolean;
}): Promise<{
  rows: SnapRetailerLocationRow[];
  message: string;
  snapshotDate?: string;
}> {
  if (
    input.useFixture ||
    process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1" ||
    process.env.YUM4LESS_SNAP_FIXTURE === "1"
  ) {
    const rows = fixtureSnapRetailers23111.filter(
      (row) =>
        isSnapMapContextRetailerType(row.retailerType) &&
        getDistanceMiles(
          input.latitude,
          input.longitude,
          row.latitude,
          row.longitude,
        ) <= input.radiusMiles,
    );

    return {
      rows,
      message: `Loaded ${rows.length} fixture SNAP retailer row(s) for map context.`,
      snapshotDate: rows[0]?.snapshotDate,
    };
  }

  try {
    const pool = getDbPool();
    const latDelta = input.radiusMiles / 69;
    const lonDelta =
      input.radiusMiles / Math.max(Math.cos((input.latitude * Math.PI) / 180) * 69, 0.1);

    const result = await pool.query<{
      id: string;
      retailer_name: string;
      retailer_type: string;
      address_line1: string | null;
      city: string;
      state: string;
      zip_code: string | null;
      latitude: string;
      longitude: string;
      snapshot_date: string;
    }>(
      `
        select
          id,
          retailer_name,
          retailer_type,
          address_line1,
          city,
          state,
          zip_code,
          latitude,
          longitude,
          snapshot_date::text
        from snap_retailer_locations
        where latitude between $1 and $2
          and longitude between $3 and $4
      `,
      [
        input.latitude - latDelta,
        input.latitude + latDelta,
        input.longitude - lonDelta,
        input.longitude + lonDelta,
      ],
    );

    const rows = result.rows
      .map((row) => ({
        id: row.id,
        retailerName: row.retailer_name,
        retailerType: row.retailer_type,
        addressLine1: row.address_line1 ?? undefined,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code ?? undefined,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        snapshotDate: row.snapshot_date,
      }))
      .filter(
        (row) =>
          isSnapMapContextRetailerType(row.retailerType) &&
          getDistanceMiles(
            input.latitude,
            input.longitude,
            row.latitude,
            row.longitude,
          ) <= input.radiusMiles,
      );

    return {
      rows,
      message:
        rows.length > 0
          ? `Loaded ${rows.length} SNAP retailer row(s) from local reference index.`
          : "No SNAP retailer rows in local reference index for this area — run npm run ingest:snap-retailers.",
      snapshotDate: rows[0]?.snapshotDate,
    };
  } catch {
    return {
      rows: [],
      message:
        "SNAP retailer reference table is unavailable — map context will skip USDA pins.",
    };
  }
}

export async function findSnapLocationWitnessForStore(input: {
  storeName: string;
  latitude: number;
  longitude: number;
  radiusMiles?: number;
}): Promise<LocationWitness | undefined> {
  const chain = getProviderRolloutForStore(input.storeName).chain;
  if (chain === "unknown") {
    return undefined;
  }

  const discovery = await findSnapRetailersNearLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMiles: input.radiusMiles ?? 0.75,
  });

  const match = discovery.rows.find(
    (row) => getProviderRolloutForStore(row.retailerName).chain === chain,
  );

  if (!match) {
    return undefined;
  }

  return {
    source: "usda-snap",
    latitude: match.latitude,
    longitude: match.longitude,
  };
}
