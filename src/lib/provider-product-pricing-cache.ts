import { getDbPool } from "@/lib/db";
import { getPricingCoverageStatus } from "@/lib/providers/provider-price-matching";
import type {
  ProviderPricingPreviewInput,
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

export async function persistProviderPricingPreviewResult(
  input: ProviderPricingPreviewInput,
  result: ProviderPricingPreviewResult,
): Promise<number | undefined> {
  try {
    const pool = getDbPool();
    const itemsJson = JSON.stringify(result.items);

    const persisted = await pool.query<{ id: string }>(
      `
        insert into provider_product_pricing_snapshots (
          provider,
          provider_store_id,
          store_name,
          status,
          provenance,
          configured,
          fallback_used,
          tracked_ingredient_count,
          matched_ingredient_count,
          message,
          fetched_at,
          items_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
        )
        returning id
      `,
      [
        result.provider,
        input.store.providerStoreId,
        input.store.name,
        result.status,
        result.provenance,
        result.configured,
        result.fallbackUsed,
        result.totalTrackedIngredients,
        result.matchedIngredientCount,
        result.message,
        result.fetchedAt,
        itemsJson,
      ],
    );

    return Number(persisted.rows[0]?.id);
  } catch {
    return undefined;
  }
}

export async function getLatestProviderPricingPreviewSnapshot(input: {
  provider: StoreDiscoveryProvider;
  providerStoreId: string;
  maxAgeMinutes?: number;
}): Promise<ProviderPricingPreviewResult | undefined> {
  try {
    const pool = getDbPool();
    const maxAgeMinutes = input.maxAgeMinutes ?? 30;

    const snapshot = await pool.query<PricingSnapshotRow>(
      `
        select
          id,
          provider,
          provider_store_id,
          store_name,
          status,
          provenance,
          configured,
          fallback_used,
          tracked_ingredient_count,
          matched_ingredient_count,
          message,
          fetched_at,
          captured_at,
          items_json
        from provider_product_pricing_snapshots
        where provider = $1
          and provider_store_id = $2
          and matched_ingredient_count > 0
          and provenance = 'official-api'
          and captured_at >= now() - ($3::text || ' minutes')::interval
        order by captured_at desc
        limit 1
      `,
      [input.provider, input.providerStoreId, String(maxAgeMinutes)],
    );

    const row = snapshot.rows[0];
    if (!row) {
      return undefined;
    }

    const snapshotCapturedAt = row.captured_at.toISOString();
    const snapshotAgeMinutes = Math.max(
      0,
      Math.round((Date.now() - row.captured_at.getTime()) / 60000),
    );

    return {
      provider: row.provider,
      label: "Kroger official pricing preview",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: row.configured,
      fallbackUsed: true,
      storeName: row.store_name,
      providerStoreId: row.provider_store_id,
      items: row.items_json,
      coverageStatus: getPricingCoverageStatus({
        matchedIngredientCount: row.matched_ingredient_count,
        totalTrackedIngredients: row.tracked_ingredient_count,
      }),
      matchedIngredientCount: row.matched_ingredient_count,
      totalTrackedIngredients: row.tracked_ingredient_count,
      message: `Using a saved Kroger pricing preview from ${snapshotAgeMinutes} minute(s) ago because live provider pricing preview was unavailable.`,
      fetchedAt: row.fetched_at.toISOString(),
      persistedSnapshotId: row.id,
      snapshotCapturedAt,
      snapshotAgeMinutes,
    };
  } catch {
    return undefined;
  }
}

type PricingSnapshotRow = {
  id: number;
  provider: StoreDiscoveryProvider;
  provider_store_id: string;
  store_name: string;
  status: ProviderPricingPreviewResult["status"];
  provenance: ProviderPricingPreviewResult["provenance"];
  configured: boolean;
  fallback_used: boolean;
  tracked_ingredient_count: number;
  matched_ingredient_count: number;
  message: string;
  fetched_at: Date;
  captured_at: Date;
  items_json: ProviderPricingPreviewItem[];
};
