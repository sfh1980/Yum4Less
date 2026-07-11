# Store identity source onboarding

> **Status (Option A Slice 1):** Infrastructure only — `store_identities` /
> `store_identity_aliases` schema, resolvers, match-policy module, and feature
> flags (all default **OFF**). Live read paths are **not** wired yet (Slice 2+).

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist and do not add chain-specific identity resolvers.

Related:

- Schema: `db/init/021_store_identities.sql`
- Policy: `src/lib/store-identity-match-policy.ts` (thresholds pinned for tests;
  **unvalidated** against real pairs until Slice 2)
- Resolvers: `src/lib/store-identity-resolvers.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` and sub-flags in `.env.example`
