# Store identity source onboarding

> **Status (Option A Slice 5a):** Kroger Mechanicsville (`022`) and Aldi↔OSM
> Mechanicsville (`023`) identities are **seeded** when both member store rows
> already exist (`match_method=seeded`). Server paths can load them via
> `createPostgresStoreIdentityLookup` (confirmed aliases only + virtual
> singleton for unlinked ids). Market-search coverage expand + confirmed-link
> catalog collapse are wired behind `YUM4LESS_STORE_IDENTITY_EXPAND` (still
> default **OFF**, including dev). Settings canonicalize remains Kroger
> known-pair only (`NEXT_PUBLIC_YUM4LESS_STORE_IDENTITY_EXPAND`). **5b** Map
> pin contract and **5c** ingest upsert-alias are still open. Full onboarding
> checklist → Slice 6.

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist and do not add chain-specific identity resolvers beyond the Slice 3
Kroger known-pair (Aldi seed is DB-readable via Postgres lookup; not in Settings).

Related:

- Schema: `db/init/021_store_identities.sql`
- Seeds: `db/init/022_seed_kroger_mechanicsville_identity.sql`,
  `db/init/023_seed_aldi_mechanicsville_identity.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (structural 0.85 boundary documented)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Postgres lookup: `src/lib/store-identity-postgres-lookup.ts` (Slice 5a)
- Catalog collapse: `src/lib/store-identity-catalog-collapse.ts` (Slice 5a)
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts` (Kroger only)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
