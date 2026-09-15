import {
  buildTargetApiHeaders,
  resolveTargetApiKey,
  TARGET_PROMOTION_DETAIL_URL_PREFIX,
  TARGET_STORE_PROMOTIONS_URL,
} from "@/lib/weekly-ad-ingestion/target-weekly-ad-api";

export type TargetStorePromotionSummary = {
  promotionId: string;
  storeId: string;
  title?: string;
  saleEndDate?: string;
  promotionType?: string;
};

export type TargetWeeklyAdFetcherDeps = {
  fetchJson?: (url: string) => Promise<{ status: number; json: unknown; text?: string }>;
};

export async function fetchTargetStorePromotions(input: {
  storeId: string;
  deps?: TargetWeeklyAdFetcherDeps;
}): Promise<TargetStorePromotionSummary[]> {
  const key = resolveTargetApiKey();
  const url = new URL(TARGET_STORE_PROMOTIONS_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("store_id", input.storeId);

  const fetchJson = input.deps?.fetchJson ?? fetchTargetJson;
  const response = await fetchJson(url.toString());
  if (response.status !== 200) {
    throw new Error(`Target store_promotions HTTP ${response.status}`);
  }

  if (!Array.isArray(response.json)) {
    return [];
  }

  return response.json
    .map((entry) => normalizePromotionSummary(entry, input.storeId))
    .filter((entry): entry is TargetStorePromotionSummary => Boolean(entry));
}

export async function fetchTargetPromotionDetail(input: {
  promotionId: string;
  deps?: TargetWeeklyAdFetcherDeps;
}): Promise<unknown> {
  const key = resolveTargetApiKey();
  const url = new URL(
    `${TARGET_PROMOTION_DETAIL_URL_PREFIX}/${encodeURIComponent(input.promotionId)}`,
  );
  url.searchParams.set("key", key);

  const fetchJson = input.deps?.fetchJson ?? fetchTargetJson;
  const response = await fetchJson(url.toString());
  if (response.status !== 200) {
    throw new Error(`Target promotions/${input.promotionId} HTTP ${response.status}`);
  }

  return response.json;
}

export async function fetchTargetWeeklyAdPromotionPayloads(input: {
  storeId: string;
  deps?: TargetWeeklyAdFetcherDeps;
}): Promise<{
  promotions: TargetStorePromotionSummary[];
  details: unknown[];
}> {
  const promotions = await fetchTargetStorePromotions(input);
  const weeklyAds = promotions.filter(
    (promo) =>
      !promo.promotionType ||
      /weeklyad|weekly.?ad/i.test(promo.promotionType) ||
      /weekly ad/i.test(promo.title ?? ""),
  );
  const selected = weeklyAds.length > 0 ? weeklyAds : promotions.slice(0, 1);
  const details: unknown[] = [];

  for (const promo of selected) {
    details.push(
      await fetchTargetPromotionDetail({
        promotionId: promo.promotionId,
        deps: input.deps,
      }),
    );
  }

  return { promotions: selected, details };
}

async function fetchTargetJson(
  url: string,
): Promise<{ status: number; json: unknown; text?: string }> {
  const response = await fetch(url, {
    headers: buildTargetApiHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

function normalizePromotionSummary(
  entry: unknown,
  fallbackStoreId: string,
): TargetStorePromotionSummary | undefined {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  const record = entry as Record<string, unknown>;
  const promotionId =
    readString(record.promotion_id) ?? readString(record.promotionId);
  if (!promotionId) {
    return undefined;
  }

  return {
    promotionId,
    storeId:
      readString(record.store_id) ??
      readString(record.storeId) ??
      fallbackStoreId,
    title: readString(record.title),
    saleEndDate:
      readString(record.sale_end_date) ??
      readString(record.promotion_end_date) ??
      readString(record.saleEndDate),
    promotionType:
      readString(record.promotion_type) ?? readString(record.promotionType),
  };
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
