import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { completeWelcomeFlow, resetAppPreferences } from "./helpers";

const COLD_COORDINATES = {
  latitude: 37.675,
  longitude: -77.28,
} as const;

const SEARCH_RADIUS_MILES = 5;
const MAX_MARKET_SEARCH_MS = 5_000;
const OSM_MAP_CATALOG_SOURCE = "openstreetmap-overpass";
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_test";

type ColdMarketSearchBody = {
  ok: boolean;
  market: {
    nearbyStores: Array<{
      recommendationEnabled: boolean;
    }>;
    mapDiscoveryNotice?: string | null;
    usesEphemeralOsmDiscovery?: boolean;
  };
};

async function countPreexistingOsmRowsNearCoordinate(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}): Promise<number> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
  });
  await client.connect();

  try {
    const result = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from stores
        where source_name = $1
          and 3958.8 * acos(
            least(
              1.0,
              greatest(
                -1.0,
                cos(radians($2)) * cos(radians(latitude)) *
                  cos(radians(longitude) - radians($3)) +
                sin(radians($2)) * sin(radians(latitude))
              )
            )
          ) <= $4
      `,
      [
        OSM_MAP_CATALOG_SOURCE,
        input.latitude,
        input.longitude,
        input.radiusMiles,
      ],
    );

    return Number(result.rows[0]?.count ?? "0");
  } finally {
    await client.end();
  }
}

test.describe("Coordinate-first location (cold OSM gap-fill)", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(COLD_COORDINATES);
    await resetAppPreferences(page);
  });

  test("keeps geolocation search bounded when map-context coverage starts cold", async ({
    page,
  }) => {
    const preexistingOsmRows = await countPreexistingOsmRowsNearCoordinate({
      ...COLD_COORDINATES,
      radiusMiles: SEARCH_RADIUS_MILES,
    });

    expect(
      preexistingOsmRows,
      "cold coordinate must start with zero openstreetmap-overpass rows in yum4less_test after fixture prep",
    ).toBe(0);

    await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
    const useLocationButton = page.getByRole("button", { name: "Use GPS" });
    await expect(useLocationButton).toBeEnabled({ timeout: 120_000 });

    await useLocationButton.click();
    await expect(page.getByRole("heading", { name: "How far should we look?" })).toBeVisible({
      timeout: 30_000,
    });

    const startedAtMs = Date.now();
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/market-search") &&
          res.request().method() === "POST",
        { timeout: 120_000 },
      ),
      page.getByRole("button", { name: "Continue" }).click(),
    ]);
    await response.finished();
    const marketSearchElapsedMs = Date.now() - startedAtMs;

    expect(
      marketSearchElapsedMs,
      "market-search should stay bounded instead of blocking on synchronous OSM gap-fill",
    ).toBeLessThan(MAX_MARKET_SEARCH_MS);
    expect(response.status(), "market-search should succeed for cold geolocation flow").toBe(200);

    const requestBody = response.request().postDataJSON() as {
      latitude?: number;
      longitude?: number;
    };
    expect(requestBody.latitude).toBeCloseTo(COLD_COORDINATES.latitude, 2);
    expect(requestBody.longitude).toBeCloseTo(COLD_COORDINATES.longitude, 2);

    const body = (await response.json()) as ColdMarketSearchBody;
    expect(body.ok).toBe(true);
    expect(
      body.market.nearbyStores.some((store) => store.recommendationEnabled),
      "cold coordinate should still expose at least one ranked-ready store in radius",
    ).toBe(true);
    expect(
      body.market.mapDiscoveryNotice,
      "thin map-context coverage should surface an honest notice instead of silently hanging or looking complete",
    ).toBeTruthy();

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await completeWelcomeFlow(page);

    await expect(page.getByText(/No sale ingredients are available/i)).not.toBeVisible();
    await page.getByRole("button", { name: "Do you want to see store locations?" }).click();
    await expect(page.getByRole("heading", { name: "Nearby stores map" })).toBeVisible();
    await expect(page.getByText(/Est\. (?:sale|store) prices/i).first()).toBeVisible();
  });
});
