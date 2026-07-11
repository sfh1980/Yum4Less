# Store identity source onboarding

> **Status (Option A Slice 5b):** Kroger (`022`) and Aldi↔OSM (`023`) seeds are
> live-readable via `createPostgresStoreIdentityLookup` (5a). Market-search
> coverage expand + confirmed-link collapse are wired. Map uses expand-aware
> scope/highlight (`createMapPinIdentityLookup` + `scopeMarketSummaryToSelectedStoresForMap`)
> so stale alias selection does not silent-empty pins when server expand is ON.
> Settings canonicalize remains Kroger known-pair only. All expand flags
> (`YUM4LESS_STORE_IDENTITY_EXPAND` + `NEXT_PUBLIC_…`) still default **OFF**.
> **5c** ingest upsert-alias is still open. Full onboarding checklist → Slice 6.

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist. Settings known-pair stays Kroger-only; Map pin lookup includes
Aldi/OSM for expand-aware scope only.

Related:

- Schema: `db/init/021_store_identities.sql`
- Seeds: `db/init/022_seed_kroger_mechanicsville_identity.sql`,
  `db/init/023_seed_aldi_mechanicsville_identity.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (structural 0.85 boundary documented)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Postgres lookup: `src/lib/store-identity-postgres-lookup.ts` (Slice 5a)
- Catalog collapse: `src/lib/store-identity-catalog-collapse.ts` (Slice 5a)
- Map pin scope: `src/lib/store-identity-map-pin-resolve.ts` +
  `src/lib/store-identity-map-lookup.ts` (Slice 5b)
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts` (Kroger only)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
