# Store identity source onboarding

> **Status (Option A Slice 3):** Kroger Mechanicsville identity is **seeded**
> (`db/init/022_seed_kroger_mechanicsville_identity.sql`). Settings canonicalize
> is wired behind `YUM4LESS_STORE_IDENTITY_EXPAND` / 
> `NEXT_PUBLIC_YUM4LESS_STORE_IDENTITY_EXPAND` (still default **OFF**).
> Map, market-search merge, and ingest matcher are **not** wired yet
> (Slices 4–5). Client Settings uses a **narrow known-pair lookup** (Kroger
> only) — named debt in `PROJECT_CONTINUITY.md`.

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist and do not add chain-specific identity resolvers beyond the Slice 3
known-pair.

Related:

- Schema: `db/init/021_store_identities.sql`
- Seed: `db/init/022_seed_kroger_mechanicsville_identity.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (structural 0.85 boundary documented)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Settings known-pair: `src/lib/store-identity-settings-lookup.ts`
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` (+ `NEXT_PUBLIC_` for client) in `.env.example`
