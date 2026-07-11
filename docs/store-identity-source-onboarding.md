# Store identity source onboarding

> **Status (Option A Slice 4):** Kroger Mechanicsville (`022`) and Aldi↔OSM
> Mechanicsville (`023`) identities are **seeded** when both member store rows
> already exist (`match_method=seeded`). Settings canonicalize remains wired
> behind `YUM4LESS_STORE_IDENTITY_EXPAND` /
> `NEXT_PUBLIC_YUM4LESS_STORE_IDENTITY_EXPAND` (still default **OFF**) for the
> Kroger known-pair only. Aldi/OSM is **not** in the Settings known-pair lookup
> (OSM is map-context; suppressed from Settings when catalog Aldi is present).
> Map, market-search merge, and ingest matcher are **not** wired yet
> (later slices). Full onboarding checklist → Slice 6.

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist and do not add chain-specific identity resolvers beyond the Slice 3
Kroger known-pair (Aldi seed is DB-only this slice).

Related:

- Schema: `db/init/021_store_identities.sql`
- Seeds: `db/init/022_seed_kroger_mechanicsville_identity.sql`,
  `db/init/023_seed_aldi_mechanicsville_identity.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (structural 0.85 boundary documented)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts` (Kroger only)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
