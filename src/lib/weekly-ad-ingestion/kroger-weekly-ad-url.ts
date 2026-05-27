const KROGER_WEEKLY_AD_BASE_URL = "https://www.kroger.com/weeklyad";

export function buildKrogerWeeklyAdUrl(input: {
  zipCode: string;
  locationId?: string;
}) {
  const url = new URL(KROGER_WEEKLY_AD_BASE_URL);
  url.searchParams.set("zipcode", input.zipCode);

  if (input.locationId) {
    url.searchParams.set("store", input.locationId);
  }

  return url.toString();
}

export function getKrogerWeeklyAdBaseUrl() {
  return KROGER_WEEKLY_AD_BASE_URL;
}
