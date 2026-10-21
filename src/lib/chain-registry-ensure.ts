import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";

export const MAP_ONLY_DISCOVERED_NOTE = "Found on the map. No sale source yet.";
export const SALE_FEED_NOTE = "Sale source is the shared flyer feed.";

const ZIP_SAFE_NAME = /[^a-z0-9]+/g;

export function chainIdFromDisplayName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(ZIP_SAFE_NAME, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "grocery";
}

export function matchChainIdByName(
  name: string,
  rows: readonly {
    chainId: string;
    displayName: string;
    nameMatchFragments: readonly string[];
  }[],
): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  let best: { chainId: string; length: number } | null = null;
  for (const row of rows) {
    const display = row.displayName.trim().toLowerCase();
    if (display.length >= 3 && normalized.includes(display) && display.length > (best?.length ?? 2)) {
      best = { chainId: row.chainId, length: display.length };
    }
    for (const fragment of row.nameMatchFragments) {
      const needle = fragment.trim().toLowerCase();
      if (needle.length >= 3 && normalized.includes(needle) && needle.length > (best?.length ?? 2)) {
        best = { chainId: row.chainId, length: needle.length };
      }
    }
  }
  return best?.chainId ?? null;
}

type RegistryNameRow = {
  chain_id: string;
  display_name: string;
  name_match_fragments: string[] | null;
};

export async function ensureMapOnlyChains(names: readonly string[]): Promise<void> {
  if (!process.env.DATABASE_URL || names.length === 0) {
    return;
  }
  try {
    const pool = getDbPool();
    const existing = await pool.query<RegistryNameRow>(
      `
        select chain_id, display_name, name_match_fragments
        from chain_registry
      `,
    );
    const rows = existing.rows.map((row) => ({
      chainId: row.chain_id,
      displayName: row.display_name,
      nameMatchFragments: row.name_match_fragments ?? [],
    }));
    const seen = new Set<string>();
    for (const name of names) {
      const displayName = name.trim();
      if (displayName.length < 3 || seen.has(displayName.toLowerCase())) {
        continue;
      }
      seen.add(displayName.toLowerCase());
      if (matchChainIdByName(displayName, rows)) {
        continue;
      }
      const chainId = chainIdFromDisplayName(displayName);
      const fragment = displayName.toLowerCase();
      await pool.query(
        `
          insert into chain_registry (
            chain_id,
            display_name,
            rollout_stage,
            shopper_ranked,
            settings_selectable,
            weekly_ad_eligible,
            promotion_blocked,
            name_match_fragments,
            location_strategy,
            sale_discovery_strategy,
            sort_order,
            notes
          )
          values (
            $1, $2, 'map_context', false, false, false, false,
            $3::text[], 'map_catalog_only', 'none', 100, $4
          )
          on conflict (chain_id) do nothing
        `,
        [chainId, displayName, [fragment], MAP_ONLY_DISCOVERED_NOTE],
      );
      rows.push({
        chainId,
        displayName,
        nameMatchFragments: [fragment],
      });
    }
  } catch (error) {
    logServerError("chain-registry.ensure-map-only", error);
  }
}

export async function listDiscoveredChainsWithoutSaleSource(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }
  const result = await getDbPool().query<{ display_name: string }>(
    `
      select display_name
      from chain_registry
      where rollout_stage = 'map_context'
        and sale_discovery_strategy = 'none'
        and notes = $1
      order by display_name asc
    `,
    [MAP_ONLY_DISCOVERED_NOTE],
  );
  return result.rows.map((row) => row.display_name);
}

export async function recordDiscoveredChainSaleFeed(input: {
  chainId: string;
  merchantName: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  await getDbPool().query(
    `
      update chain_registry
      set sale_discovery_strategy = 'flipp',
          flipp_merchant_name = $2,
          weekly_ad_eligible = true,
          weekly_ad_adapter = 'flipp',
          notes = $3
      where chain_id = $1
        and shopper_ranked = false
    `,
    [input.chainId, input.merchantName, SALE_FEED_NOTE],
  );
}
