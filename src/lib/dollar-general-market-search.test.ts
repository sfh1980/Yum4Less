import { describe, expect, it } from "vitest";
import { FIXTURE_CHAIN_MEMBERSHIP } from "@/lib/chain-membership";
import { fixtureStores } from "@/lib/fixtures/market-catalog.fixtures";
import { buildNearbyStoresForSearch } from "@/lib/market-search-service";
import { zip23111MechanicsvilleLocation } from "@/lib/recommendation-service-ranking.fixture";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";

const RECIPE_IDS = ["spaghetti", "black-beans", "corn-tortillas", "olive-oil"];

function dgObservations(): CatalogPriceObservation[] {
  return RECIPE_IDS.map((ingredientId, index) => ({
    storeId: "dollar-general-market-highland",
    ingredientId,
    price: 1 + index,
    freshnessDaysAgo: 0,
    freshnessHoursAgo: 4,
    inStock: true,
    priceSource: "dollar-general-weekly-ad-scrape",
    priceSourceKind: "weekly-ad" as const,
    matchConfidence: 0.8,
  }));
}

describe("dollar general market search promotion", () => {
  it("enables Dollar General dinners only when it is the ranked grocer nearby", () => {
    const dollarGeneral = fixtureStores.find(
      (store) => store.id === "dollar-general-market-highland",
    )!;
    const kroger = fixtureStores.find((store) => store.id === "kroger-mechanicsville")!;

    const desertStores = buildNearbyStoresForSearch(
      [dollarGeneral],
      zip23111MechanicsvilleLocation,
      20,
      dgObservations(),
      RECIPE_IDS,
      { membership: FIXTURE_CHAIN_MEMBERSHIP },
    );
    expect(desertStores[0]?.recommendationEnabled).toBe(true);
    expect(desertStores[0]?.rolloutStatus).toBe("weekly-ad-preview");
    expect(desertStores[0]?.rolloutNote).toMatch(/area circular/i);

    const mixedStores = buildNearbyStoresForSearch(
      [kroger, dollarGeneral],
      zip23111MechanicsvilleLocation,
      20,
      dgObservations(),
      RECIPE_IDS,
      { membership: FIXTURE_CHAIN_MEMBERSHIP },
    );
    const mixedDg = mixedStores.find((store) => store.chain === "dollar-general");
    expect(mixedDg?.recommendationEnabled).toBe(false);
    expect(mixedDg?.pricingSourceKind).toBe("weekly-ad");
  });
});
