# Store identity source onboarding

> **Status (Option A Slice 6 CLOSED — 2026-07-11):** This is the pluggability
> checklist for adding a new store **location** source to the alias-graph
> identity system. It reflects what Slices 1–5c actually built — not the
> original Phase 2 design sketch alone.
>
> Master expand (`YUM4LESS_STORE_IDENTITY_EXPAND` / `NEXT_PUBLIC_…`) and
> `YUM4LESS_STORE_IDENTITY_AUTO_CONFIRM` remain **OFF** by default, including
> local/dev, until an explicit rollout decision. Slice D (batch
> proximity/name matcher) is still open.

**Success bar:** A second engineer can onboard the next locator/banner by
following this checklist **without** inventing permanent per-chain identity
rules (no banner-named resolvers, no tombstone-as-dedupe, no third client
known-pair table).

**Related (not this doc):** Provider location / item pricing / sale-discovery
integration → [`docs/provider-integration-pattern.md`](provider-integration-pattern.md).
This doc is **identity resolution only**.

---

## Status, flags, and related modules

### What is live today

| Piece | State |
|-------|--------|
| Schema `store_identities` / `store_identity_aliases` | Shipped (`021`) |
| Resolvers (expand / canonicalize / virtual singleton) | Shipped |
| Match policy scorer + pair override hooks | Shipped; **not** run as ingest matcher yet |
| Rank/pantry expand | Behind master flag (Slice 2); **Postgres lookup when expand ON** (Pass 3 — shared with market-search) |
| Settings canonicalize | Behind flag; **client known-pair = Kroger Mechanicsville only** (Slice 3) |
| Kroger slug↔API seed | `022` (`match_method=seeded`) |
| Aldi catalog↔OSM seed | `023` (`match_method=seeded`) |
| Postgres lookup + market-search coverage/collapse | Behind flag (Slice 5a); **rank/pantry use same resolver** (Pass 3) |
| Map pin scope / highlight | Server `equivalentStoreIds` only (Slice 5b) |
| Ingest alias writes | Self-alias + **allowlisted Aldi→OSM pointer** only (Slice 5c) |
| Slice D batch proximity/name matcher | **Not shipped** |

### Flags (all default OFF)

| Flag | Role |
|------|------|
| `YUM4LESS_STORE_IDENTITY_EXPAND` | Master expand/canonicalize on server read paths |
| `NEXT_PUBLIC_YUM4LESS_STORE_IDENTITY_EXPAND` | Same for client Settings remapping |
| `YUM4LESS_STORE_IDENTITY_AUTO_CONFIRM` | Auto-promote scored matches to confirmed — **must stay OFF** until Slice D + review |
| `YUM4LESS_STORE_IDENTITY_SNAP_MATCHING` | SNAP as match candidates |
| `YUM4LESS_STORE_IDENTITY_SEARCH_PROVISIONAL` | Search-time provisional links |

Documented in `.env.example`. Do not flip defaults in an onboarding slice.

### Product model: three layers of “what stores exist” (Wave 2 Part 2 / Q3=3B)

These layers are **intentional**, not a bug to collapse into one list:

| Layer | Authority for | Notes |
|-------|----------------|-------|
| **Postgres `stores`** | Durable truth — pricing FKs, ingest writes, identity graph members | Cron/ingest is the write path; public search stays read-only by default |
| **Map merge** (`mergeCatalogStoresForMap` on market-search) | Nearby-now **display** pins for one search | May include ephemeral provider/OSM extras that are **not** in DB |
| **Settings selectable pool** | What the shopper can check | Derived from the merged market list, then filtered (ranked chains, OSM suppress, collocated collapse) — not a raw DB dump |

Do **not** “fix” Settings vs map vs DB into a single source without an explicit Decision log change.

### Ephemeral search pins and identity (Wave 2 Part 2 / Q2=2A)

Search-time provider discovery and OSM/SNAP gap-fill pins are **display-only**. They **must not** participate in identity linking, allowlisted pointer writes, or coordinate reconciliation. Keep `YUM4LESS_STORE_IDENTITY_SEARCH_PROVISIONAL` **OFF** and unused for shopper paths — there is **no** provisional shopper tier. Matches allowlist-only / reviewed-data-only ingest linking.

### Publix locator classification (Wave 2 Part 2 / Q1=1B — policy locked; map code pending)

**Intent:** `publix-store-locator` rows are **Settings-selectable catalog** pins (same class as other ranked-chain catalog rows for selection/collapse).

**Drift today:** `isMapContextCatalogStore` still treats Publix locator as map-context (low merge priority / OSM suppress peer). `isMapContextLikeCatalogStore` correctly does **not**. Aligning map merge/suppress is a **separate small implementation slice** — do not reclassify Publix locator as map-context-only.

### Module index

| Concern | Path |
|---------|------|
| Schema | `db/init/021_store_identities.sql` |
| Seeds | `db/init/022_seed_kroger_mechanicsville_identity.sql`, `db/init/023_seed_aldi_mechanicsville_identity.sql` |
| Types / `source_system` keys | `src/lib/store-identity-types.ts` |
| Match policy (incl. structural 0.85 note) | `src/lib/store-identity-match-policy.ts` |
| Resolvers | `src/lib/store-identity-resolvers.ts` |
| Flags | `src/lib/store-identity-flags.ts` |
| Postgres lookup | `src/lib/store-identity-postgres-lookup.ts` |
| Server lookup resolve (market/rank/pantry) | `src/lib/store-identity-server-lookup.ts` |
| Catalog collapse | `src/lib/store-identity-catalog-collapse.ts` |
| Map pin resolve (payload-fed) | `src/lib/store-identity-map-pin-resolve.ts` |
| Ingest aliases (self + allowlisted pointer) | `src/lib/store-identity-ingest-aliases.ts` |
| Settings known-pair (Kroger only — do not copy for Map) | `src/lib/store-identity-settings-lookup.ts` |
| Rank/pantry scope | `resolvePricingScopeStoreIds` in `src/lib/store-scope.ts` |
| Shared fixtures | `src/lib/fixtures/store-identity.fixtures.ts` |

---

## Checklist: adding a store source

Use this when adding a new location source (locator, official API, weekly-ad
catalog writer, etc.) that must participate in the identity graph.

### 1. Register `source_system`

- [ ] Choose a **stable string key** (e.g. `dollar-tree-store-locator`,
  `publix-store-locator`, `kroger-official-api`).
- [ ] Document a human label and an intended **trust tier** in this checklist /
  PR notes: `official-api` | `locator` | `osm` | `snap` | `bootstrap` |
  `fixture` | `weekly-ad` | `cache`.
- [ ] Add the key to the documented union / comments in
  `store-identity-types.ts` (keys are **convention + TypeScript**, not a DB
  enum or trust-tier column).
- [ ] Align `stores.source_name` for rows written by this source with that key
  (self-alias uses `source_name` as `source_system`).

There is **no** separate trust-tier registry table today. The tier is
documentation for humans and for future display-ladder work — not a runtime
enum you must migrate.

### 2. Define external id scheme

- [ ] Document format, uniqueness, and examples (e.g. `dollar-tree-{storeNumber}`,
  `kroger-{locationId}`, `osm-node-{id}`).
- [ ] Default self-alias rule: `source_system` = catalog `source_name`,
  `external_id` = `stores.id`.
- [ ] Document exceptions explicitly. Today’s exception:
  **`kroger-official-api`** self-aliases use the provider location id
  (`source_store_id`), not the catalog row id — see `resolveSelfAliasKeys`.

`stores.source_store_id` remains a convenience mirror for pointers; the
identity join authority is `store_identity_aliases`.

### 3. Ingest / write-path inventory (not one choke point)

Do **not** assume a single “ingest upsert” hook. Inventory **every** path that
creates or refreshes catalog rows for this source, then ensure each success
path that leaves a durable `stores` row also runs alias ensure.

Known choke points today:

| Path | Role |
|------|------|
| `upsertCatalogStores` | Generic catalog insert/upsert |
| `updateIngestedRankedStoreCoordinates` | Ranked-store **refresh** (coords / provenance) — Aldi weekly-ad / market refresh can hit this **without** a full upsert |

- [ ] List every write/refresh path for the new source.
- [ ] On each path: ensure **self-alias** (`ensureStoreSelfAlias` or equivalent).
- [ ] Cross-link only via the rules in [Interim allowlist vs Slice D](#interim-allowlist-vs-slice-d) — **not** via proximity/name at ingest.
- [ ] Do not rely on `source_store_id` alone as the identity graph.

### 4. Match policy entries

- [ ] Add a `pairOverrides` key for systems this source may eventually link to
  (e.g. `dollar-tree-store-locator::openstreetmap-overpass`), even if the
  override body is empty `{}` for now.
- [ ] Add banner tokens to name normalization if missing.
- [ ] Know the **structural 0.85 boundary**: a no-pointer perfect twin scores
  exactly `confirmThreshold` (weight design, not a Kroger quirk). Classification
  uses `>=`. Prefer **reviewed seed / manual confirm** for first links of that
  class; do not flip `AUTO_CONFIRM` to paper over it.
- [ ] Until Slice D ships, **do not** expect ingest to score-link pairs.

### 5. Canonical member choice (ladder honesty)

Phase 2 designed a full **display-field authority ladder** (official API →
locator → market-catalog → weekly-ad → OSM → SNAP). Schema has nullable
`display_*` cache columns on `store_identities`.

**What actually resolves canonical membership today:**

- Reviewed **seeds** (`022`, `023`)
- **Self-alias** creating a singleton identity for an unlinked store
- **Allowlisted exact-pointer** cross-links (Aldi→OSM pattern)
- Q3 “official wins” is proven by the **Kroger seed** (API id canonical, slug
  alias) — **not** by a general ladder resolver job

- [ ] Decide which member is **canonical** for the new source’s first links
  (official API if present; else locator/catalog; OSM/SNAP as aliases).
- [ ] Document intended ladder placement for future display-cache refresh.
- [ ] Do **not** claim a general ladder resolver already refreshes `display_*`
  on every re-resolve — that work is still thin / future.

### 6. Rollout / Settings

- [ ] Identity does **not** replace chain rollout.
  Wire `getProviderRolloutForCatalogStore` / `SETTINGS_SELECTABLE_CHAINS` /
  map-context-only policy as today.
- [ ] Settings-selectable twins only: consider Settings canonicalize. OSM
  suppressed when a ranked catalog twin exists is **not** Settings-selectable —
  do not broaden `store-identity-settings-lookup.ts` for that case.
- [ ] **Do not** add a new client hardcoded known-pair table for Map or other
  surfaces that filter against server-collapsed lists. Prefer server-fed
  `equivalentStoreIds` (Slice 5b lesson).

### 7. Map provenance

- [ ] Map badge/provenance via existing helpers from the canonical member’s
  `source_name` / id — no new pin semantics for “being an identity source.”
- [ ] Linked pairs collapse to one pin when expand is ON; **unlinked** OSM near
  ranked chains still uses the 1.5 mi suppress safety net.
- [ ] Kind / chain inference updates (e.g. `dollar-market`) may be needed for
  correct map labeling — adjacent to identity, not a substitute for alias rows.

### 8. Pricing

- [ ] If weekly-ad or API prices exist, write `price_observations` to a member
  `store_id`; rank/pantry must use **expand** when the master flag is ON.
- [ ] Do not add per-chain observation fan-out “because twins exist.”
- [ ] Remember: with expand **OFF**, reads are exact-id by design.

### 9. Fixtures + tests

Minimum high-value set:

- [ ] One confirmed link fixture (new source ↔ OSM or official↔slug)
- [ ] One near-miss negative (~0.2 mi same-chain must not confirm)
- [ ] Rank/pantry expand: obs on non-canonical member still visible when flag ON
- [ ] Flag-OFF exact-id regression
- [ ] Settings canonicalize **only if** a Settings-selectable twin exists
- [ ] If the source uses a **refresh** path, an alias test on that path
- [ ] No new client known-pair registry for Map

### 10. CI / bootstrap

- [ ] If a seed slug will coexist with the new source, add an explicit identity
  seed migration **or** wait for Slice D / allowlisted pointer — document the
  expected canonical id for e2e.
- [ ] Seed pattern: link when **both** members already exist; **do not insert
  or delete** `stores` rows in the identity seed.
- [ ] Register ledger / effect probes for new `db/init/0xx_*.sql` files.

### 11. Observability

- [ ] Unique-constraint / conflicting alias bindings: use
  `store-identity.ingest-alias-conflict` (do not silently overwrite).
- [ ] Prefer summary counters (`aliasesEnsured` / `aliasesSkipped` /
  `aliasConflicts`) on sync job output.
- [ ] Scored provisional match reporting is **Slice D** territory — do not
  claim it exists for proximity matches yet.

### 12. Done when

A second engineer can add the next banner by copying this checklist **without**
new **permanent** code paths named for that banner’s identity rules.

Temporary, documented allowlist entries for **exact pointer** cross-links
(until Slice D) are allowed — see next section. Permanent Aldi-only (or
Dollar-Tree-only) resolvers, tombstones-as-dedupe, or Settings pair tables
copied per banner are not.

---

## Interim allowlist vs Slice D

This section is the most important framing in the doc. Read it before adding
any chain name to ingest alias code.

### What shipped in Slice 5c

Ingest may:

1. **Always** ensure a confirmed **self-alias** for a catalog store (singleton
   identity when unlinked).
2. **Optionally** create a confirmed **cross-link** when all of the following
   hold:
   - Catalog `source_name` is on a **narrow allowlist** (today:
     `yum4less-market-catalog`, `aldi-weekly-ad-scrape`)
   - `source_store_id` is an **exact** OSM (or fixture-OSM) store id
   - The target OSM catalog row already exists
   - No conflicting alias binding

It must **not**:

- Run proximity + name scoring at ingest
- Auto-confirm scored matches (`AUTO_CONFIRM` stays OFF)
- Attach provisional links on the live ingest path
- Auto-link Kroger slug↔API (no pointer; structural 0.85 — seed handles that)

### How to read the Aldi allowlist

| Reading | Correct? |
|---------|----------|
| “Aldi has permanent special identity rules” | **No** |
| “Temporary safety boundary until Slice D’s batch matcher exists” | **Yes** |
| “Pattern: deterministic exact pointer + allowlisted writers → confirmed cross-link” | **Yes** |
| “Copy this by adding forever-Aldi-shaped branches in random call sites” | **No** |

The allowlist exists because **Slice D is not shipped**. Without a batch
matcher, the only safe live cross-link is an **exact id pointer** from a
writer we have reviewed. Aldi is the first (and currently only) reviewed
writer with that pointer in production data.

When Slice D lands, scored proximity/name linking (behind flags, with
provisional band discipline) should make **per-source allowlists for
pointer-only cross-links unnecessary for the general case**. Any remaining
allowlist should be re-justified or removed in that slice — not quietly grown
into a permanent per-banner identity framework.

### Adding another allowlist entry (rare, pre–Slice D)

Only if the new source’s feed carries an **exact** OSM (or equivalent)
`source_store_id` pointer — the same deterministic class as Aldi. Document in
the PR: “temporary until Slice D; not permanent chain policy.” Prefer waiting
for Slice D when the link would require distance/name judgment.

---

## Anti-patterns (forbidden)

| Anti-pattern | Why |
|--------------|-----|
| Per-chain tombstone SQL as the primary dedupe strategy | Option A **links** and retains source rows; historical Publix tombstones are not the pattern to extend |
| Read-time-only fold without alias rows | Identity collapse requires confirmed aliases; virtual singletons are for **unlinked** stores only |
| Deleting the non-canonical `stores` row on link | Merge must not destroy source records |
| Exact-id observation joins without `expandStoreIds` / `expandStoreIdsForRead` when expand is ON | Silent-empty pricing scope |
| Match rules hardcoded only in a one-off migration | Seeds may record **outcomes** (`match_method=seeded`); scoring policy lives in `store-identity-match-policy.ts` |
| A third client hardcoded known-pair table for Map (or similar) | Slice 5b: use server `equivalentStoreIds` / payload membership |
| Treating the Aldi allowlist as permanent per-chain identity architecture | See [Interim allowlist vs Slice D](#interim-allowlist-vs-slice-d) |

**Still allowed as interim debt (do not copy blindly):**

- Settings **Kroger-only** known-pair lookup — acceptable until a Settings-
  selectable twin needs generalization; **not** the template for Map.
- Same-chain **collocated catalog fold** (`catalog-store-colocated-identity.ts`)
  for **unlinked** twins — fallback UI/ingest fold, not a substitute for the
  identity graph.

---

## Lessons from Slices 1–5c

1. **Write-path inventory beats “the upsert.”** Aldi refresh updated coords
   without always going through `upsertCatalogStores`; alias ensure had to
   hook **both** paths (5c).
2. **Structural 0.85 is by design.** No-pointer perfect twins land on
   `confirmThreshold`. Seed/manual confirm; don’t casually “fix” weights or
   enable `AUTO_CONFIRM` to paper over it (Slice 3).
3. **No client pair-table sprawl.** A brief Map known-pair mirror was deleted;
   Map consumes server-fed membership instead (5b).
4. **Settings known-pair stays narrow on purpose.** Aldi/OSM is not
   Settings-selectable when catalog Aldi is present — second seed did not
   justify broadening the client lookup (Slice 4).
5. **Self-alias ≠ cross-link.** Every durable catalog row can own a singleton
   identity; cross-source links need pointer allowlist (now) or Slice D (later).
6. **Flags stay OFF including dev** until an explicit rollout decision —
   onboarding a source does not flip expand.
7. **Seeds link; they do not invent store rows.** `022` / `023` no-op when a
   member is missing — preserves flag-OFF Settings/map behavior.

---

## Appendix: Dollar Tree dry-run (hypothetical)

> **Thought exercise only.** No `dollar-tree-*` `source_system` is registered
> in this slice. No locator code, seeds, or allowlist entries were added.

Walk the checklist as if onboarding a **Dollar Tree store locator** as a
map/context location source (not ranked meal pricing).

| Step | Hypothetical action |
|------|---------------------|
| **1. `source_system`** | `dollar-tree-store-locator`; trust tier **locator**; document in types comments. |
| **2. External id** | `stores.id` = `dollar-tree-{storeNumber}`; self-alias `external_id` same; `source_store_id` = locator native id and/or OSM pointer when the feed provides one. |
| **3. Write paths** | Locator feed → `upsertCatalogStores` + self-alias. Re-check any refresh-only path. OSM twins continue via `ingest:map-catalog` (`openstreetmap-overpass`) — do not mint a second DT identity from OSM alone. |
| **4. Match policy** | Add pair stub `dollar-tree-store-locator::openstreetmap-overpass`. Name token `"dollar tree"` already exists in match-policy brand tokens. No scored ingest link until Slice D. |
| **5. Canonical** | No official API assumed → **locator row canonical**, OSM alias (Aldi-shaped, not Kroger API↔slug). |
| **6. Rollout / Settings** | **Outside pure identity:** today only **Dollar General** is a modeled `StoreChain` (`coming-soon`); Dollar Tree name inference falls through to generic/unknown map context. Identity alone does not add Settings checkboxes. No Settings known-pair. Keep DT map-context / coming-soon until a separate product/rollout decision. |
| **7. Map** | Use `kind: dollar-market` where appropriate; provenance from locator `source_name`. Adjacent gap: OSM kind helper currently special-cases “dollar general” more than “dollar tree” — labeling fix is not identity-core. |
| **8. Pricing** | None for this dry-run. Ranked pricing would be a separate provider project and collides with backlog #18 (catalog fit) — out of scope here. |
| **9. Tests** | Locator↔OSM fixture + near-miss negative; skip Settings canonicalize until Settings-selectable. |
| **10. Bootstrap** | Optional seed only if both members already exist in fixtures; link, don’t insert stores. |
| **11. Observability** | Existing conflict/summary logs. |
| **Allowlist** | **Prefer stay Aldi-only until Slice D.** Add a DT allowlist entry only if the locator feed carries an **exact** OSM `source_store_id` pointer — same temporary framing as Aldi, never proximity invented as pointer. |

**Dry-run findings (checklist sharpness):**

- “Single ingest choke point” would have missed refresh-class paths — inventory is mandatory.
- Chain/rollout inference for Dollar Tree is a **pre-req beside** identity (DG exists; DT does not).
- Canonical **member choice** is actionable today; full display-ladder refresh is not.
- Pricing/catalog feasibility must stay out of this doc.

---

## Out of scope

- **Backlog #18** — Dollar Tree / Dollar General **ingredient-catalog fit** vs
  private-label assortments and the 97 tracked ingredients: separate queued
  investigation; **not** part of identity onboarding.
- Slice D batch proximity/name matcher and default flag flips.
- Shopping-plan `storeId` emit (deferred follow-up; name-join fragility).
- General `display_*` ladder resolver job.
- Registering or implementing any Dollar Tree `source_system` in this slice.
