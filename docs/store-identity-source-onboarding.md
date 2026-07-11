# Store identity source onboarding

> **Status (Option A Slice 5 CLOSED — 5a/5b/5c):** Kroger (`022`) and Aldi↔OSM
> (`023`) seeds are live-readable via `createPostgresStoreIdentityLookup` (5a).
> Market-search attaches `equivalentStoreIds`; Map scope/highlight consumes
> payload ids (5b). Ingest writes **self-alias** on catalog upsert/refresh and
> **allowlisted Aldi→OSM pointer** cross-links only (5c) — first live alias
> writes outside a reviewed migration; proximity/name matcher remains Slice D.
> Settings canonicalize remains Kroger known-pair only. All expand flags and
> `AUTO_CONFIRM` still default **OFF**. Full onboarding checklist → Slice 6.

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
- Ingest aliases: `src/lib/store-identity-ingest-aliases.ts` (Slice 5c — self + Aldi pointer)
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts` (Kroger only)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
