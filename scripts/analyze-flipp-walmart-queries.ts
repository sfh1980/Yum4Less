import { buildFlippWeeklyAdSearchUrl } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";

async function tryQuery(label: string, merchantName: string) {
  const url = buildFlippWeeklyAdSearchUrl({ zipCode: "23111", merchantName });
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    items?: Array<{ name?: string; merchant_name?: string }>;
  };
  const foodish = (payload.items ?? []).filter((item) =>
    /bean|rice|tortilla|tofu|cabbage|chicken|broccoli|spinach|spaghetti|butter|olive oil|pepper|onion|potato|lemon|lime|parmesan|soy/i.test(
      item.name ?? "",
    ),
  );
  console.log(`\n${label}: total=${payload.items?.length ?? 0} foodish=${foodish.length}`);
  for (const item of foodish.slice(0, 8)) {
    console.log(`  ${item.merchant_name}: ${item.name}`);
  }
}

async function main() {
  await tryQuery("Walmart", "Walmart");
  await tryQuery("Walmart grocery", "Walmart grocery");
  await tryQuery("Great Value", "Great Value");
  await tryQuery("weekly ad food", "weekly ad food Walmart");
}

main();
