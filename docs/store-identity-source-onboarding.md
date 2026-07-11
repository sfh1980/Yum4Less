# Store identity source onboarding

> **Status (Option A Slice 5b):** Kroger (`022`) and Aldi↔OSM (`023`) seeds are
> live-readable via `createPostgresStoreIdentityLookup` (5a). Market-search
> attaches `equivalentStoreIds` on each nearby store from that expand. Map
> scope/highlight consumes those ids from the payload — **no** client hardcoded
> known-pair table for Map. Settings canonicalize remains Kroger known-pair only.
> All expand flags still default **OFF**. **5c** ingest upsert-alias is still
> open. Full onboarding checklist → Slice 6.

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist. Settings known-pair stays Kroger-only; Map does not duplicate it.

Related:

- Schema: `db/init/021_store_identities.sql`
- Seeds: `db/init/022_seed_kroger_mechanicsville_identity.sql`,
  `db/init/023_seed_aldi_mechanicsville_identity.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (structural 0.85 boundary documented)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Postgres lookup: `src/lib/store-identity-postgres-lookup.ts` (Slice 5a)
- Catalog collapse: `src/lib/store-identity-catalog-collapse.ts` (Slice 5a)
- Map pin scope: `src/lib/store-identity-map-pin-resolve.ts` (Slice 5b — payload-fed)
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts` (Kroger only)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
