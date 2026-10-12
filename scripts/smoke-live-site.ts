import {
  judgeLiveSite,
  LIVE_SMOKE_PIN,
  LIVE_SMOKE_RADIUS_MILES,
} from "@/lib/owner/morning-report";
import { probeShopperArea } from "@/lib/owner/morning-shopper-probe";

const origin = (process.env.YUM4LESS_SMOKE_ORIGIN ?? "https://yum4less.com").replace(
  /\/$/,
  "",
);

async function pageOk(path: string, needle: string): Promise<boolean> {
  const response = await fetch(`${origin}${path}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    return false;
  }
  const text = await response.text();
  return text.includes(needle);
}

async function main() {
  const homeOk = await pageOk("/", "Yum4Less");
  const faqOk = await pageOk("/faq", "Frequently asked questions");
  const probe = await probeShopperArea({
    origin,
    latitude: LIVE_SMOKE_PIN.latitude,
    longitude: LIVE_SMOKE_PIN.longitude,
    radiusMiles: LIVE_SMOKE_RADIUS_MILES,
  });
  const site = judgeLiveSite({
    homeOk,
    faqOk,
    marketOk: probe.marketOk,
    storeCount: probe.storeCount,
    rankOk: probe.rankOk,
  });
  console.log(
    `Outside site check ${site}. Home ${homeOk ? "ok" : "fail"}. FAQ ${faqOk ? "ok" : "fail"}. Stores ${probe.storeCount}. Dinners ${probe.dinnerCount}.`,
  );
  if (site !== "passed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
