const WALMART_WEEKLY_AD_BASE_URL = "https://www.walmart.com/store/weekly-ads";

export function buildWalmartWeeklyAdUrl(input?: { storeId?: string }) {
  if (!input?.storeId) {
    return WALMART_WEEKLY_AD_BASE_URL;
  }

  const url = new URL(WALMART_WEEKLY_AD_BASE_URL);
  url.searchParams.set("storeId", input.storeId);
  return url.toString();
}

export function getWalmartWeeklyAdBaseUrl() {
  return WALMART_WEEKLY_AD_BASE_URL;
}
