const PUBLIX_WEEKLY_AD_VIEW_ALL_URL = "https://www.publix.com/savings/weekly-ad/view-all";

export function buildPublixWeeklyAdUrl(_input?: { zipCode?: string }) {
  return PUBLIX_WEEKLY_AD_VIEW_ALL_URL;
}

export function getPublixWeeklyAdBaseUrl() {
  return PUBLIX_WEEKLY_AD_VIEW_ALL_URL;
}
