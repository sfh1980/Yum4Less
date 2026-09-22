import { fetchWeeklyAdHtmlOverHttp } from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";
import { buildWholeFoodsSalesFlyerUrl } from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-api";

export type WholeFoodsWeeklyAdFetcherDeps = {
  fetchHtml?: (url: string) => Promise<string>;
};

export async function fetchWholeFoodsSalesFlyerHtml(input: {
  storeId: string;
  deps?: WholeFoodsWeeklyAdFetcherDeps;
}): Promise<{ url: string; html: string }> {
  const url = buildWholeFoodsSalesFlyerUrl(input.storeId);
  const fetchHtml =
    input.deps?.fetchHtml ??
    ((pageUrl: string) => fetchWeeklyAdHtmlOverHttp({ url: pageUrl }));
  const html = await fetchHtml(url);
  return { url, html };
}
