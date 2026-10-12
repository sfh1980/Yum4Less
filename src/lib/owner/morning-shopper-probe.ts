import {
  judgeShopperProbeWithDinners,
  LIVE_SMOKE_RADIUS_MILES,
  type ZipProbeOutcome,
} from "@/lib/owner/morning-report";

type FetchLike = typeof fetch;

type MarketPayload = {
  ok?: boolean;
  market?: { nearbyStores?: { id?: string }[] };
};

type RankPayload = {
  ok?: boolean;
  experience?: { recommendations?: unknown[] };
};

export type ShopperProbeResult = {
  marketOk: boolean;
  storeCount: number;
  rankOk: boolean;
  dinnerCount: number;
  outcome: ZipProbeOutcome;
};

export async function probeShopperArea(input: {
  origin: string;
  latitude: number;
  longitude: number;
  fetchImpl?: FetchLike;
  radiusMiles?: number;
}): Promise<ShopperProbeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const origin = input.origin.replace(/\/$/, "");
  const radiusMiles = input.radiusMiles ?? LIVE_SMOKE_RADIUS_MILES;
  const marketResponse = await fetchImpl(`${origin}/api/market-search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMiles,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const market = (await marketResponse.json().catch(() => null)) as MarketPayload | null;
  const stores = market?.market?.nearbyStores ?? [];
  const storeId = stores.find((store) => typeof store.id === "string" && store.id.trim())
    ?.id;
  const marketOk = marketResponse.ok && market?.ok === true;

  if (!marketOk || !storeId) {
    const outcome = judgeShopperProbeWithDinners({
      marketOk,
      storeCount: stores.length,
      rankOk: false,
      dinnerCount: 0,
    });
    return {
      marketOk,
      storeCount: stores.length,
      rankOk: false,
      dinnerCount: 0,
      outcome,
    };
  }

  const rankResponse = await fetchImpl(`${origin}/api/recommendations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMiles,
      budget: 25,
      shoppingStyle: "single-store",
      dietaryFocus: "anything",
      recipeSource: "internal-library",
      selectedStoreIds: [storeId],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const rank = (await rankResponse.json().catch(() => null)) as RankPayload | null;
  const dinnerCount = rank?.experience?.recommendations?.length ?? 0;
  const rankOk = rankResponse.ok && rank?.ok === true;
  return {
    marketOk: true,
    storeCount: stores.length,
    rankOk,
    dinnerCount,
    outcome: judgeShopperProbeWithDinners({
      marketOk: true,
      storeCount: stores.length,
      rankOk,
      dinnerCount,
    }),
  };
}
