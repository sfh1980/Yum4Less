# De-hardcoding plan for nationwide, DB-driven operation (2026-08-12)

> **Design only.** No schema DDL, migrations, or code in this pass.
> Source of truth for what is hardcoded today: [`scale-out-architecture-audit-2026-08-11.md`](scale-out-architecture-audit-2026-08-11.md).

**Goal:** the app works nationwide with **no fallback ZIP**, **no VA-only seed table as a runtime authority**, and **no hand-edited chain lists as the source of truth**. Geography- and chain-specific values (distance thresholds, timezone, rollout membership) come from **durable DB (or derived-from-DB) context**, not from constants / env defaults baked into application logic.

**Non-goal:** pretending every “add a chain” step becomes config-only. Parsers, official API clients, and novel scrape formats stay code.

---

## Design principles (locked for this plan)

1. **Resolve, don’t default.** An unrecognized ZIP is geocoded, cached, and given market context — never remapped to `23111` (or any other home ZIP).
2. **Fail loudly for ops config; prompt for shopper first-run.** Missing ingest ZIPs is an operator error. Missing shopper location is a UX prompt (geolocate / enter ZIP), not a silent pin.
3. **One registry per concern.** Chain capability/rollout lives in one place; ZIP/market context lives in one place; threshold profiles live in one place. Parallel TS arrays are views over that data (or compile-time mirrors for CI only — see inventory).
4. **Data vs code boundary.** Membership, flags, ids, styles, Flipp merchant names, id-prefix hints, thresholds, timezones → **data**. Novel weekly-ad HTML/API shapes, provider auth, identity matcher algorithms → **code**.
5. **Bootstrap without hidden geography.** When a new market has no empirical threshold history, classify density from **observable signals** (store/POI density in catalog or OSM at first ingest) and attach a **named profile** — not a silent “use Mechanicsville constants.”
6. **Slice D stays the identity matcher.** This plan replaces seed/allowlist *as a scaling pattern*; it does not redesign the matcher itself.

---

## 1. Inventory table

Every hardcoded item from the audit’s inventory, mapped to a replacement. Status meanings:

- **DB** — runtime authority moves to a table / config row
- **Derived** — computed at runtime from other durable data (no new constant)
- **Ops input** — required operator/env input with **no soft default ZIP**
- **Stays code** — algorithm, adapter, or test fixture; not a product default
- **Stays test-only** — may keep `23111` / Mechanicsville as *fixture anchors*, never as production fallbacks

### 1.1 ZIP / geography

| Hardcoded today | Proposed replacement | Kind |
|---|---|---|
| `parseIngestZipCodesFromEnv` fallback `"23111"` | **Fail closed** if `YUM4LESS_INGEST_ZIPS` unset/invalid *unless* ops explicitly opts into **`active_markets`-driven selection** (see §2.1). No silent ZIP. | Ops input / DB |
| Seed geocode table (`23111`, `23116`, `23223`, `23231`) | Durable **`zip_geocode_cache`** (or equivalent) populated on successful Geocodio resolve; seed rows only as **CI/dev bootstrap fixtures** for those four ZIPs, never as production fallback | DB (+ test-only seed) |
| UI default ZIP `23111` in `use-meal-planner.ts` | **No default ZIP.** First-run: geolocation primary → else empty ZIP field + explicit “set location” prompt. Persist last successful pin in client storage only after user success. | Derived / UX |
| UI default radius `5` | Keep a **product default radius** (not geography-specific). Optionally later: suggest radius from market density profile — not required to eliminate fallback ZIP. | Stays code (product UX default) *or* DB profile later |
| Fixture OSM returns stores only for `23111` | Parameterized fixture markets (or “any ZIP → empty OSM fixture”) for CI; production OSM remains Overpass-by-coords. | Stays test-only |
| E2E/CI anchors `37.6085, -77.3739` / ZIP `23111` | **Keep as CI anchors** (deterministic demo market). Document as *test geography*, not service-area center. | Stays test-only |
| Weekly-ad browser TZ `America/New_York` | Per-store (or per-ZIP market) **IANA timezone** from geocode/cache / store coords (e.g. Geocodio timezone field or post-resolve lookup). Scrape profile reads store/market TZ. | DB / Derived |
| Global `KROGER_LOCATION_ID` / `PUBLIX_STORE_NUMBER` | Treat as **single-market debug overrides** only; multi-ZIP mode **rejects** or ignores them when `YUM4LESS_INGEST_ZIPS` has >1 ZIP (or when `active_markets` drives selection). Preferred: per-store ids already on catalog rows. | Ops input (constrained) |
| Probe scripts singular `YUM4LESS_INGEST_ZIP` | Align probes with multi-ZIP / `active_markets` API; singular remains optional one-shot, not a second source of truth. | Ops clarity |
| Mechanicsville fixtures, CI bootstrap, ranking baselines, error-copy hints | Fixtures/baselines stay VA for CI honesty. Error-copy: remove “try 23111” style geography hints; point to geolocate / enter any CONUS ZIP. | Stays test-only / copy Derived |
| Kroger research-target ZIP `23111` in `weekly-ad-chain-config.ts` | Research/probe targets take **caller ZIP** or `active_markets`; drop baked research ZIP from live config path. | Ops input / Derived |

### 1.2 Chains / rollout (lists)

| Hardcoded today | Proposed replacement | Kind |
|---|---|---|
| `SHOPPER_RANKED_V1_CHAINS` | **`chain_registry.shopper_ranked`** (or capability flag) — runtime read | DB |
| Settings-selectable chain list | Same registry flag (`settings_selectable`) — must stay in lockstep with ranked via one row, not two arrays | DB |
| `StoreChain` TypeScript union | **Open string id** validated against registry at runtime; compile-time union becomes “known built-in adapters” only, or generated from registry export in CI | DB + thin code |
| Marker-style lists | Registry columns / related `chain_marker_style` | DB |
| Flipp merchant union | Registry `flipp_merchant_name` (nullable) | DB |
| Weekly-ad primary-store id-prefix lists | Registry `primary_store_id_prefixes` (array) or child table | DB |
| Walmart hard-block / Lidl coming-later | Registry `promotion_blocked` / `rollout_stage` (`ranked` \| `map_context` \| `ingest_only` \| `blocked` \| `upcoming`) | DB |
| Provider registry clients (Kroger / Publix / Walmart discovery) | **Stays code** — clients registered by id that **must exist** in `chain_registry`; membership is data, implementation is code | Stays code + DB membership |

### 1.3 Chain-specific code paths (data vs code)

| Item | Data? | Code? | Notes |
|---|---|---|---|
| Per-chain weekly-ad clients/parsers | Registry points to `adapter_key` | **Yes — new format ⇒ new code** | Flipp-shaped chains may share one declarative executor later; scrape HTML variance stays code |
| Official item-price sync (Kroger-only today) | Capability `official_item_pricing` | **Yes** per provider API | Abstract interface later; still new adapter code |
| Aldi location = nearest OSM builder | Capability `location_strategy = osm_nearest` | Strategy implementations stay code | Choosing strategy is data |
| Publix locator sync | `location_strategy = publix_locator` | Locator client stays code | |
| Kroger preferred-location / family discovery | `location_strategy = kroger_api` | API client stays code | |
| Identity cross-link allowlist Aldi→OSM | **Remove as scaling pattern** | Replaced by Slice D matcher + confirmed aliases | Interim allowlist must not grow |
| Settings known-pair Mechanicsville Kroger | **Remove** | Resolver uses identity graph only | Anti-pattern |
| Seeds `022` / `023` | One-time **bootstrap data** for demo market, not a template to copy per metro | Slice D + reviewed alias writes for new markets | |
| Collocated merge wider for Kroger | Per-chain threshold on registry or density profile | Fold algorithm stays code | |
| Food Lion Mechanicsville OSM id exceptions | **Do not generalize exceptions** | Coordinate-sanity uses density-aware thresholds + Slice D; delete one-off id lists over time | |
| Publix bootstrap store `#1626` | Debug/CI fixture only | Live path uses locator results for the resolved ZIP | |

### 1.4 Metro-tuned thresholds

| Constant | Role | Proposed |
|---|---|---|
| Catalog collocated merge `0.05` / Kroger `0.15` | Same-chain catalog twins | **Per-chain** base on registry + optional **per-market density multiplier** from market profile |
| Ranked-map OSM suppress `1.5` | Hide OSM near ranked pin | Density-aware profile (urban tighter / rural looser) — see §4 |
| Nominatim sanity delta `0.25` mi | Coordinate sanity | Same density profile family |
| Location move `50` m / witness `250` m | Reconciliation | Density profile (urban: smaller move threshold; rural: larger witness tolerance) — env overrides remain **ops knobs**, not geography defaults |
| Geocodio `20/min` + in-process ZIP memo | Quota | Durable ZIP (+ optional street) cache table; rate limiter stays process-local or shared — see §6 |

### 1.5 What stays code (and why)

| Item | Why it stays code |
|---|---|
| Continental US bounding box | Product scope rule (CONUS); not market-specific. Could move to config later; low leverage. |
| Product default search radius (`5`) | UX default, not a ZIP fallback. |
| Weekly-ad / locator / OSM / Kroger API **implementations** | Novel protocols and HTML. |
| Slice D proximity/name **matcher algorithm** | Logic; outputs are DB aliases. |
| CI/E2E fixture market (Mechanicsville) | Determinism and honesty — explicitly *not* a runtime default. |
| Rate-limit algorithms | Mechanism; limits may be config. |

---

## 2. New config / data surfaces (conceptual)

No DDL here — entities and responsibilities only.

### 2.1 `active_markets` (ingest selection)

**Purpose:** Replace “env list with ZIP `23111` soft-default” as the authority for *which* ZIPs scheduled ingest visits.

**Conceptual fields:**

- `zip_code` (PK or unique)
- `status` — `active` \| `paused` \| `retired`
- `priority` / schedule weight (optional)
- `ingest_radius_miles`, `map_catalog_radius_miles` (optional overrides)
- `activated_at`, `activated_by` (ops vs organic)
- `source` — `ops` \| `organic_usage` \| `bootstrap`

**Runtime determination of ingest ZIP set:**

| Mode | Behavior when env unset/invalid |
|---|---|
| **A — Fail loud (recommended default)** | Cron exits non-zero: “set `YUM4LESS_INGEST_ZIPS` or enable `YUM4LESS_INGEST_MARKETS_FROM_DB=1`.” |
| **B — DB-driven** | Select `active_markets` where `status = active`, ordered by priority. Still **no** hardwired ZIP if the table is empty — fail loud: “no active markets.” |

**Organic population (optional later):** when shoppers successfully resolve a ZIP and market-search finds stores, upsert a candidate market row (`source = organic_usage`) — **paused by default** until ops promotes to `active` for paid ingest. That avoids “any ZIP burns scrape quota” while still removing the need for a code default.

**What determines a market’s existence:** first successful geocode + optional store-coverage signal — not a pre-seeded VA table.

### 2.2 `zip_geocode_cache` (nationwide resolution)

**Purpose:** Persistent replacement for in-process memo + VA seed table (production path).

**Conceptual fields:**

- `zip_code` (PK)
- `latitude`, `longitude`
- `city`, `state`, `county` (nullable)
- `timezone` (IANA, nullable until filled)
- `provider` — `geocodio` (etc.)
- `resolved_at`, `expires_at` (optional TTL for refresh)
- `raw_fingerprint` / provider place id (optional)

**Runtime path:**

1. Validate ZIP format + CONUS policy (bounds / state from geocode — reject AK/HI if still product policy).
2. Read durable cache.
3. On miss: Geocodio → write cache → return.
4. On Geocodio failure: **do not** fall back to another ZIP. Return structured unavailable (shopper) or fail the ingest ZIP (ops).

**Dev/CI:** may preload the four VA ZIPs into the same table via fixture SQL so offline tests work — same *shape*, not a second code path with different authority.

**Street geocode:** separate cache keyed by normalized address (+ optional lat/lng hint), same durability story; shares Geocodio quota but not ZIP keys.

### 2.3 Market context / density profile

**Purpose:** Drive thresholds and scrape TZ without Mechanicsville constants.

**Option (recommended):** attach profile on the market (ZIP) row, not only on each store.

**Conceptual fields on `active_markets` or sibling `market_context`:**

- `density_class` — `urban` \| `suburban` \| `rural` \| `unknown`
- `density_score` (optional continuous)
- `timezone` (denormalized from geocode for ingest convenience)
- Optional **threshold overrides** (nullable) — only when empirically tuned

**What determines density at runtime (no hidden default ZIP):**

On first successful catalog/OSM ingest for that ZIP’s search circle, compute a heuristic, e.g.:

- count of food-retail OSM/catalog pins within map-catalog radius, and/or
- mean nearest-neighbor distance among same-chain pins

Map score → `density_class`. Until computed: `unknown`.

**`unknown` is not “use 23111 numbers.”** It means: use an explicitly named **`bootstrap` threshold profile** (documented, versioned in DB seed of *profiles*, not geography), and mark the market `thresholds_status = provisional` until a refinement pass runs.

### 2.4 `threshold_profiles`

**Purpose:** Named sets of distance/meter thresholds referenced by density class and/or chain.

**Conceptual rows (examples, not locked numbers):**

| profile_id | collocated_mi | kroger_collocated_mi | osm_suppress_mi | nominatim_delta_mi | move_m | witness_m |
|---|---|---|---|---|---|---|
| `bootstrap` | *TBD — see open Q* | *TBD* | *TBD* | *TBD* | *TBD* | *TBD* |
| `urban` | … | … | … | … | … | … |
| `suburban` | … | … | … | … | … | … |
| `rural` | … | … | … | … | … | … |

**Per-chain deltas** (e.g. Kroger wider collocated) live as:

- columns on `chain_registry`, **or**
- `chain_threshold_overrides (chain_id, profile_id, …)`

Resolution order: market override → chain+profile → profile → **hard fail / skip merge** if profile missing (prefer loud over silent code constant). During migration, code constants may temporarily mirror `bootstrap` — migration end-state deletes the constants.

### 2.5 `chain_registry` (single membership authority)

**Purpose:** Collapse hand-edited parallel lists.

**Conceptual fields:**

- `chain_id` (stable slug: `kroger`, `aldi`, …)
- `display_name`
- `rollout_stage` — `ranked` \| `settings_selectable` (usually same as ranked) \| `map_context` \| `ingest_only` \| `blocked` \| `upcoming`
- `shopper_ranked` bool / stage
- `weekly_ad_eligible`, `promotion_blocked`
- `flipp_merchant_name` nullable
- `primary_store_id_prefixes` (text[])
- `marker_style_key` / colors / icon
- `location_strategy` — `kroger_api` \| `publix_locator` \| `osm_nearest` \| `map_catalog_only` \| …
- `sale_discovery_strategy` — `flipp` \| `browser_scrape` \| `hybrid` \| `none`
- `official_pricing_adapter` nullable
- `weekly_ad_adapter` nullable (code module key)
- `collocated_merge_miles` nullable override
- `sort_order` for Settings

**Runtime:** Settings, promotion gates, map marker styles, Flipp client, primary-store scoring, and “is this chain ranked?” all **read the registry** (cached in-process with short TTL or process boot load).

**Adding a chain — data vs code:**

| Step | Data row? | New code? |
|---|---|---|
| Identity / display / markers / rollout stage | Yes | No (if map_context only and location via OSM/catalog) |
| Flipp merchant name + prefixes | Yes | No if shared Flipp executor exists |
| Novel weekly-ad HTML/API | Adapter key on row | **Yes** |
| Official item pricing API | Capability + adapter key | **Yes** |
| Locator-specific HTTP client | Strategy enum | **Yes** if new strategy |
| Ranked promotion honesty / catalog fit (#18-class) | Stage stays non-ranked until review | Product/trust review, not just a flag flip |

### 2.6 Identity linking (replace per-market seed/allowlist)

**Purpose:** Stop copying `022`/`023` and Mechanicsville known-pairs per metro.

**Replacement model (aligns with Slice D; not redesigned here):**

1. **Ingest** writes catalog/OSM/API rows + **self-aliases** only (already Option A).
2. **Slice D batch matcher** proposes candidate pairs (proximity + name + type) into a reviewable queue or provisional table — **geography-agnostic**.
3. **Confirmed aliases** become DB truth; Settings/map/rank expand reads the graph.
4. **Allowlists and client known-pairs are deleted** once Slice D + expand flags are trusted — not grown.

**Bootstrap seeds for the CI/demo market** may remain as historical SQL for Mechanicsville twin links — labeled **fixture identity**, not an onboarding playbook step.

**Open dependency:** until Slice D ships, new markets will accumulate **unlinked twins**. That is an accepted gap (audit Slice D), not solved by more seeds.

### 2.7 Geocode quota / durable cache ops

See §6. Entity: `zip_geocode_cache` (+ optional `street_geocode_cache`). Optional: `geocode_quota_events` for observability (not required for correctness).

### 2.8 Service area — static concept?

**Recommendation:** drop “home metro service area” as a product concept.

| Concept | Keep? | Replacement |
|---|---|---|
| CONUS bounds / policy | Yes | Product scope (static is fine) |
| `DEV_SEED_ZIP_CODES` / `DEV_AREA_CENTER` | Test/dev only | Rename mentally to **fixture market**, not service area |
| “We serve where we have stores” | Soft signal | UI honesty: Tier C / limited coverage from **actual catalog + observation coverage** near the user’s pin — not a pre-drawn VA polygon |

**Runtime “are we live here?”** = derived from store + fresh observation coverage in radius, not from a ZIP allowlist.

### 2.9 Owner `/owner` Coverage tab

**Purpose:** Let the operator search storefront coverage on TrueNAS (`yum4less.com/owner`), not infer it from ingest logs.

**Placement:** Fourth tab after Ingredient review, User feedback, and Analytics. Same admin-key gate. Not linked from shopper nav.

**Data:** Read `store_coverage` (keyed by existing `stores` rows). No second store directory.

**UI (locked):** Searchable/filterable list:

- **Store name** (and chain)
- **Location** (city / state — `stores` has no ZIP column; pin coords are on the row)
- **Checked — usable in the application** (`recipe_ready`). Other filters: all, not yet usable. Show seen / mapped / sales as columns or badges so map-only vs sale-only is obvious.

Summary counts may sit above the list. v1 is **read-only**; flipping `chain_registry.rollout_stage` is not a button on this tab.

**Status (2026-08-26):** Implemented as `/owner` Coverage + `GET /api/owner/store-coverage`. Needs migrate `026`.

---

## 3. Worked answers to the six design areas

### 3.1 Fallback / default ZIP — eliminate entirely

**Ingest (`parseIngestZipCodesFromEnv`):**

- If env has valid ZIPs → use them as a **debug overlay** (does not write `active_markets`).
- If env unset:
  - Load `active_markets` where `status = active`.
  - If the table is empty or unreadable → **fail loudly** (non-zero exit).
- **Never** substitute `23111` as a soft geographic default. `YUM4LESS_PROVIDER_SYNC_ZIP` remains an overlay alias of the multi-ZIP parser with the same fail-loud rules.

**UI (`use-meal-planner.ts`):**

- **No hardcoded default ZIP.**
- First-run always: attempt geolocation → on deny/fail, show empty location + prompt (ZIP entry or retry geo).
- Radius `5` may remain a neutral product default (not a geography pin).
- Last-good location may persist in localStorage **after** a successful resolve — that is user state, not a code default.

**Kroger research-target ZIP:**

- Config/probes accept an explicit ZIP argument or read `active_markets` / env list; remove baked `23111` from the live weekly-ad chain config path.

### 3.2 Geography — nationwide-dynamic

**General-purpose ZIP/market resolution:**

```text
shopper/ingest ZIP
  → format + CONUS policy
  → zip_geocode_cache lookup
  → miss: Geocodio → persist cache (coords, city, state, timezone)
  → attach/create market_context (density unknown → bootstrap profile)
  → proceed (Tier C until coverage warms)
```

**Service area:** CONUS policy only; coverage honesty from real data.

**Coordinate-sanity / move / witness thresholds:** vary by `density_class` via `threshold_profiles`. Classification driven by catalog/OSM density at first ingest (and periodic refresh). **Open question:** exact cutovers and whether OSM POI density is enough vs Census/urbanicity — see §5.

**Timezone:** store scrape uses `store.timezone` or market timezone from geocode cache; never a global `America/New_York` constant.

### 3.3 Chain / rollout — DB-driven membership

Single `chain_registry` feeds ranked, Settings, markers, Flipp, prefixes, promotion blocks. Provider/weekly-ad **clients remain code** keyed by `adapter_key`. Onboarding a Flipp-identical banner can be mostly data; a novel scrape is data **plus** a new adapter module.

### 3.4 Metro-tuned thresholds — context-aware

Per-market density profile + per-chain overrides. New market starting values = **`bootstrap` profile** assigned because density was computed or still `unknown` — not because of a home ZIP. Refinement = offline/job once enough twin/suppress false-positive metrics exist (**requires traffic or ingest metrics** — §5).

### 3.5 Identity linking — no per-market allowlist pattern

Slice D + alias graph; retire allowlist/known-pair/seed-copy playbook. Demo seeds stay CI-only.

### 3.6 Ops / quota — geography-agnostic capacity

Durable shared ZIP (and street) cache; all workers read/write the same table. In-process memo becomes L1 only. Quota remains a process/shared rate limiter; cache hit rate is what makes multi-ZIP scale. Unrecognized ZIP → resolve + cache, never remap.

---

## 4. Threshold bootstrap strategy (without hand-waving)

Empirically tuned numbers (`0.05` / `0.15` / `1.5` / `0.25` / `50` / `250`) were proven on one metro. Fully dynamic values need either:

1. **A declared bootstrap profile** (copy of today’s constants as *profile v1*, stored in DB, named `bootstrap` / `suburban_v1`), or
2. **New labeled metrics** in each market (false merges, under-suppress, Nominatim FP rate).

This plan **requires (1) for day-one correctness** and **(2) for refinement**. That is not a hidden ZIP default: every market explicitly references `profile_id = bootstrap` until promoted.

**Open tradeoff:** whether `bootstrap` numerically equals today’s Mechanicsville constants. Honest answer: **yes initially**, but the *authority* moves from `const` in TS to a versioned profile row — so changing national defaults is data, and per-market overrides don’t require code edits.

---

## 5. Explicit call-outs — cannot be fully dynamic without new data

| Gap | Why dynamic is hard | What to do instead of a silent default |
|---|---|---|
| Collocated / OSM suppress / Nominatim / witness meters | Tuned on one metro; optimal values need false-positive/false-negative rates | Ship named `bootstrap` profile; mark markets `provisional`; refine when metrics exist |
| Density classification cutovers | Need calibration set (urban vs rural labeled markets) | Start with simple pin-count / NN heuristic; log class; don’t pretend Census-grade accuracy |
| Per-market scrape TZ edge cases (ZIP spans TZ?) | Rare CONUS ZIP boundary issues | Prefer **store** lat/lng → TZ; ZIP TZ is approximate for primary selection only |
| Organic `active_markets` promotion | Usage ≠ budget for scrape quota | Candidates stay `paused` until ops activate |
| Slice D absence | Twins won’t auto-link in new metros | Accept unlinked twins; **do not** add per-market seeds; prioritize Slice D before national identity claims |
| Novel weekly-ad formats | Not inferable from registry fields | Require adapter code; registry only exposes capability |
| Official pricing beyond Kroger | Provider-specific APIs | New adapter code + capability flag |
| Fixture/E2E second market | Needs authored fixtures | Keep Mechanicsville as CI anchor until parameterized fixtures exist — test-only hardcoding is OK |
| Geocodio cold-start burst | Cache empty for new ZIPs | Fail/queue with backoff; never substitute another ZIP’s coords |
| “Empty active_markets” | No ZIPs to ingest | Fail loud — do not invent a market |

---

## 6. Durable Geocodio cache shape (quota, geography-agnostic)

**Problem today:** shared `20/min` bucket; ZIP memo is in-process only; street geocode uncached; seed table only 4 VA ZIPs offline.

**Target shape:**

```text
┌─────────────────┐     L1 (optional)      ┌──────────────────────┐
│ Ingest / App    │ ←── process memo ────→ │ zip_geocode_cache    │
│ workers         │                        │ (Postgres / durable) │
└────────┬────────┘                        └──────────┬───────────┘
         │ miss after durable                          │
         ▼                                             │
┌─────────────────┐                                    │
│ Geocodio API    │ ── write-through on success ───────┘
│ + 20/min limit  │
└─────────────────┘
```

**Properties:**

- Key: normalized 5-digit ZIP (CONUS policy applied before call).
- Write-through on success; negative cache optional with short TTL for hard 404s (invalid ZIP) to avoid hammering — **not** a redirect to another ZIP.
- Street cache: separate table/key space; same quota bucket.
- Multi-instance safe: durable store is the shared truth; rate limiter may remain per-process initially (document burst risk) or move to a shared limiter later — **orthogonal** to removing ZIP defaults.
- Offline CI: preload fixture ZIPs into the same cache table.

This is intentionally **not Redis-specific**. Redis is fine as L2; Postgres matches current ops and MCP read-only workflows.

---

## 7. What this unlocks

If implemented as specified:

| Requirement | Met? |
|---|---|
| No fallback ZIP in ingest | **Yes** — fail loud or `active_markets` (empty ⇒ fail) |
| No UI default ZIP | **Yes** — geo / prompt only |
| No VA-only seed as production authority | **Yes** — durable nationwide cache; VA rows are fixtures |
| No hand-edited chain lists as SoT | **Yes** — `chain_registry` |
| Thresholds / TZ from context | **Yes** — market profile + store/market TZ; bootstrap profile is explicit, not a hidden home ZIP |
| Identity without per-market seed playbook | **Yes as pattern** — **blocked on Slice D** for automatic linking quality |
| Quota behavior not tied to one metro | **Yes** — durable geocode cache |

**Residual hardcoding that remains unavoidable (and acceptable):**

1. **CI/demo fixture geography** (Mechanicsville coords/ZIP) for deterministic tests.
2. **Adapter code** for novel chains/providers.
3. **CONUS product bounds** (policy).
4. **Bootstrap threshold profile numerics** until multi-market metrics exist — *versioned data*, still initially equal to today’s constants.
5. **Slice D algorithm** in code; alias *rows* in DB.

**Verdict:** this design removes the need for a **fallback ZIP** and **per-market hardcoding as the expansion playbook**. It does **not** remove the need for Slice D, scrape safety (M128), or new adapters for new ranked chains — those remain explicit scale gates from the source audit.

---

## 8. Suggested implementation sequencing (design pointer only)

Not a commitment — aligns with the audit’s recommended order:

1. Durable `zip_geocode_cache` + fail-loud ingest ZIPs (delete `23111` soft-default).
2. UI: remove default ZIP; first-run geo/prompt.
3. `chain_registry` read-path behind a feature flag (dual-run vs TS lists until parity).
4. `threshold_profiles` + market density heuristic; move constants → `bootstrap` profile.
5. Per-store/market timezone for weekly-ad browser profile.
6. `active_markets` (+ optional organic candidates).
7. Slice D → delete allowlist / known-pair / seed-copy guidance.
8. Parameterized second-ZIP fixtures/e2e (test debt, not product default).

---

## 9. References

- [`scale-out-architecture-audit-2026-08-11.md`](scale-out-architecture-audit-2026-08-11.md) — hardcoded inventory
- [`docs/store-identity-source-onboarding.md`](../store-identity-source-onboarding.md) — Option A + Slice D framing; anti-patterns
- [`docs/provider-integration-pattern.md`](../provider-integration-pattern.md) — capability lanes
- [`docs/homelab-deploy.md`](../homelab-deploy.md) — multi-ZIP env today
- `src/lib/us-service-area.ts`, `src/lib/geocoding.ts`, `src/lib/chain-rollout-policy.ts` — current authorities this plan relocates

---

## Scale check

- **Small scale:** Design maps each audit hardcode to a DB/derived/ops-fail/test-only replacement without implementing schema or code.
- **Large scale:** Root pattern addressed — **defaults and parallel lists** become durable market/chain/profile authorities; residual limits (Slice D, adapters, bootstrap profile calibration) are called out rather than papered over with a home-ZIP default.
