/**
 * Pass 3 — rank/pantry and market-search share resolveServerStoreIdentityLookup
 * so expand-ON reads honor the same Postgres (or injected) alias graph.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLinkedAldiOsmIdentityLookup,
  createLinkedKrogerIdentityLookup,
  FIXTURE_ALDI_CATALOG,
  FIXTURE_ALDI_OSM,
  FIXTURE_KROGER_API,
  FIXTURE_KROGER_SLUG,
} from "@/lib/fixtures/store-identity.fixtures";
import { expandStoreIdsForRead } from "@/lib/store-identity-resolvers";
import { resolvePricingScopeStoreIds } from "@/lib/store-scope";

const { createPostgresStoreIdentityLookupSafe } = vi.hoisted(() => ({
  createPostgresStoreIdentityLookupSafe: vi.fn(),
}));

vi.mock("@/lib/store-identity-postgres-lookup", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/store-identity-postgres-lookup")
  >("@/lib/store-identity-postgres-lookup");

  return {
    ...actual,
    createPostgresStoreIdentityLookupSafe,
  };
});

import { resolveServerStoreIdentityLookup } from "@/lib/store-identity-server-lookup";

const EXPAND_ON = { YUM4LESS_STORE_IDENTITY_EXPAND: "1" } as const;
const EXPAND_OFF = {} as const;

describe("resolveServerStoreIdentityLookup (Pass 3)", () => {
  beforeEach(() => {
    createPostgresStoreIdentityLookupSafe.mockReset();
    createPostgresStoreIdentityLookupSafe.mockResolvedValue(
      createLinkedKrogerIdentityLookup(),
    );
  });

  afterEach(() => {
    createPostgresStoreIdentityLookupSafe.mockReset();
  });

  it("uses virtual singletons when expand is OFF (no Postgres load)", async () => {
    const { identityLookup } = await resolveServerStoreIdentityLookup({
      env: EXPAND_OFF,
    });

    expect(createPostgresStoreIdentityLookupSafe).not.toHaveBeenCalled();
    expect(
      expandStoreIdsForRead(
        identityLookup,
        [FIXTURE_KROGER_API.id],
        EXPAND_OFF,
      ),
    ).toEqual([FIXTURE_KROGER_API.id]);
  });

  it("loads Postgres lookup when expand is ON and no lookup is injected", async () => {
    await resolveServerStoreIdentityLookup({ env: EXPAND_ON });
    expect(createPostgresStoreIdentityLookupSafe).toHaveBeenCalledOnce();
  });

  it("prefers an injected lookup over Postgres even when expand is ON", async () => {
    const injected = createLinkedAldiOsmIdentityLookup();
    const { identityLookup } = await resolveServerStoreIdentityLookup({
      identityLookup: injected,
      env: EXPAND_ON,
    });

    expect(createPostgresStoreIdentityLookupSafe).not.toHaveBeenCalled();
    expect(identityLookup).toBe(injected);
  });

  it("expands Kroger and Aldi seeded pairs identically for market-search and rank/pantry paths", async () => {
    createPostgresStoreIdentityLookupSafe.mockResolvedValue(
      createLinkedKrogerIdentityLookup(),
    );
    const marketSearch = await resolveServerStoreIdentityLookup({
      env: EXPAND_ON,
    });
    const rankPantry = await resolveServerStoreIdentityLookup({
      env: EXPAND_ON,
    });

    assertPairParity(
      marketSearch.identityLookup,
      rankPantry.identityLookup,
      FIXTURE_KROGER_API.id,
      FIXTURE_KROGER_SLUG.id,
    );

    createPostgresStoreIdentityLookupSafe.mockResolvedValue(
      createLinkedAldiOsmIdentityLookup(),
    );
    const marketAldi = await resolveServerStoreIdentityLookup({
      env: EXPAND_ON,
    });
    const rankAldi = await resolveServerStoreIdentityLookup({
      env: EXPAND_ON,
    });

    assertPairParity(
      marketAldi.identityLookup,
      rankAldi.identityLookup,
      FIXTURE_ALDI_CATALOG.id,
      FIXTURE_ALDI_OSM.id,
    );
  });
});

function assertPairParity(
  marketLookup: Awaited<
    ReturnType<typeof resolveServerStoreIdentityLookup>
  >["identityLookup"],
  rankLookup: Awaited<
    ReturnType<typeof resolveServerStoreIdentityLookup>
  >["identityLookup"],
  idA: string,
  idB: string,
) {
  const marketExpanded = new Set(
    expandStoreIdsForRead(marketLookup, [idA], EXPAND_ON),
  );
  const rankExpanded = new Set(
    expandStoreIdsForRead(rankLookup, [idA], EXPAND_ON),
  );
  expect(marketExpanded).toEqual(rankExpanded);
  expect(marketExpanded.has(idA)).toBe(true);
  expect(marketExpanded.has(idB)).toBe(true);

  const marketScope = new Set(
    resolvePricingScopeStoreIds({
      selectedStoreIds: [idA],
      identityLookup: marketLookup,
      env: EXPAND_ON,
    }),
  );
  const rankScope = new Set(
    resolvePricingScopeStoreIds({
      selectedStoreIds: [idA],
      identityLookup: rankLookup,
      env: EXPAND_ON,
    }),
  );
  expect(marketScope).toEqual(rankScope);
}
