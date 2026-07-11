# Store identity source onboarding

> **Status (Option A Slice 2):** Rank/pantry/store-scope expand is wired behind
> `YUM4LESS_STORE_IDENTITY_EXPAND` (still default **OFF**). Settings, map,
> market-search, and ingest are **not** wired yet (Slices 3–5).

The full new-source checklist (register `source_system`, external id scheme,
ingest upsert + alias, match pair rules, canonical ladder, fixtures/tests) is
**deferred to Slice 6**. Until then, treat Phase 2 design §6 as the draft
checklist and do not add chain-specific identity resolvers.

Related:

- Schema: `db/init/021_store_identities.sql`
- Policy: `src/lib/store-identity-match-policy.ts`
- Resolvers: `src/lib/store-identity-resolvers.ts` (`expandStoreIdsForRead`, virtual singleton)
- Rank/pantry scope: `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts`
- Flags: `YUM4LESS_STORE_IDENTITY_EXPAND` and sub-flags in `.env.example`
- **Pre-Slice-3:** Kroger twin scorer confidence is exactly **0.85** (on
  `confirmThreshold`) — retune before auto-confirm linking relies on it
