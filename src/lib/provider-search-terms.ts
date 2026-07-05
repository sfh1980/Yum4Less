import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";
import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import type { ProviderPricingPreviewIngredient } from "@/lib/providers/provider-types";

type ProviderSearchTermRow = {
  ingredient_id: string;
  ingredient_name: string;
  search_term: string;
  priority: number;
  notes: string | null;
};

export type GetProviderSearchTermsOptions = {
  /** When true, attach priority-2 search_term as fallbackSearchTerm (sync path only). */
  includeFallbackTerms?: boolean;
};

/**
 * Loads provider-tuned search terms for ingest/sync scripts.
 *
 * Preview and coverage rollups load Kroger terms from Postgres when a pool is available;
 * {@link PROVIDER_TRACKED_INGREDIENTS} remains the static fallback when the table is empty.
 */
export async function getProviderSearchTerms(
  provider: string,
  db: Pool,
  options?: GetProviderSearchTermsOptions,
): Promise<ProviderPricingPreviewIngredient[]> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!normalizedProvider) {
    return PROVIDER_TRACKED_INGREDIENTS;
  }

  const rows = await queryProviderSearchTerms(normalizedProvider, db);
  if (rows.length === 0) {
    return PROVIDER_TRACKED_INGREDIENTS;
  }

  const grouped = groupSearchTermsByIngredient(rows);

  if (options?.includeFallbackTerms) {
    return [...grouped.entries()].map(([ingredientId, terms]) => ({
      ingredientId,
      ingredientName: terms[0]!.ingredient_name,
      searchTerm: terms[0]!.search_term,
      ...(terms[1] ? { fallbackSearchTerm: terms[1].search_term } : {}),
    }));
  }

  return [...grouped.entries()].map(([ingredientId, terms]) => ({
    ingredientId,
    ingredientName: terms[0]!.ingredient_name,
    searchTerm: terms[0]!.search_term,
  }));
}

async function queryProviderSearchTerms(provider: string, db: Pool) {
  const result = await db.query<ProviderSearchTermRow>(
    `
      select
        pst.ingredient_id,
        i.name as ingredient_name,
        pst.search_term,
        pst.priority,
        pst.notes
      from provider_search_terms pst
      inner join ingredients i on i.id = pst.ingredient_id
      where pst.provider = $1
        and pst.priority <= 2
      order by pst.ingredient_id, pst.priority asc, pst.search_term asc
    `,
    [provider],
  );

  return result.rows;
}

function groupSearchTermsByIngredient(rows: ProviderSearchTermRow[]) {
  const grouped = new Map<string, ProviderSearchTermRow[]>();

  for (const row of rows) {
    const current = grouped.get(row.ingredient_id) ?? [];
    if (current.length >= 2) {
      continue;
    }
    current.push(row);
    grouped.set(row.ingredient_id, current);
  }

  return grouped;
}

async function resolveKrogerTrackedIngredients(
  db?: Pool,
  options?: GetProviderSearchTermsOptions,
): Promise<ProviderPricingPreviewIngredient[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return PROVIDER_TRACKED_INGREDIENTS;
  }

  try {
    const pool = db ?? getDbPool();
    const terms = await getProviderSearchTerms("kroger", pool, options);
    return terms.length > 0 ? terms : PROVIDER_TRACKED_INGREDIENTS;
  } catch {
    return PROVIDER_TRACKED_INGREDIENTS;
  }
}

/** Priority-1 Kroger terms for preview/coverage/debug denominators. */
export async function resolveKrogerPreviewTrackedIngredients(
  db?: Pool,
): Promise<ProviderPricingPreviewIngredient[]> {
  return resolveKrogerTrackedIngredients(db);
}

/** Priority-1 plus priority-2 fallback terms for provider price sync. */
export async function resolveKrogerSyncTrackedIngredients(
  db?: Pool,
): Promise<ProviderPricingPreviewIngredient[]> {
  return resolveKrogerTrackedIngredients(db, { includeFallbackTerms: true });
}

/** @deprecated Use {@link resolveKrogerPreviewTrackedIngredients}. */
export async function resolveKrogerCoverageTrackedIngredients(
  db?: Pool,
): Promise<ProviderPricingPreviewIngredient[]> {
  return resolveKrogerPreviewTrackedIngredients(db);
}
