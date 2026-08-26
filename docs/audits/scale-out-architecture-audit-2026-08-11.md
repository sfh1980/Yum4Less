# Scale-out architecture audit (2026-08-11)

> **Analysis only.** No code, config, or product behavior changed in the audit session.
> Saved to `docs/audits/` on 2026-08-12 at owner request.

**Question:** What already generalizes for multi-ZIP / multi-chain expansion beyond ZIP `23111` / Kroger, Aldi, Publix, Food Lion (and Walmart map-context), what is hardcoded to the current footprint, and what would a repeatable “add a ZIP” / “add a store” playbook look like?

**Authority:** [`PROJECT_CONTINUITY.md`](../../PROJECT_CONTINUITY.md) (Resume / Decision log / deferred backlog), [`docs/homelab-deploy.md`](../homelab-deploy.md), [`docs/store-identity-source-onboarding.md`](../store-identity-source-onboarding.md) (Option A + Dollar Tree appendix), [`docs/provider-integration-pattern.md`](../provider-integration-pattern.md), [`docs/audits/chain-provider-status-audit-2026-06-27.md`](chain-provider-status-audit-2026-06-27.md) (ingest shapes; shopper scope superseded by [`chain-rollout-status-check-2026-06-29.md`](chain-rollout-status-check-2026-06-29.md)).

**Methods:** Parallel codebase exploration (ZIP geography, chain onboarding, scaling risks); Continuity + onboarding docs; live Postgres MCP on `yum4less_dev` (read-only). Did **not** run `npm test`, e2e, or Semgrep (analysis-only).

**Live DB snapshot (`yum4less_dev`, 2026-08-11):** **281** stores (**VA 143** / **Unknown 138**), **274** `store_identities`, **276** aliases, **308** `price_observations`, **0** fresh in 24h.

---

## What already generalizes

1. **Multi-ZIP ingest loops exist.** `YUM4LESS_INGEST_ZIPS` is parsed and looped for map-catalog, weekly-ad, and provider sync (`parseIngestZipCodesFromEnv` in `src/lib/store-catalog-sync.ts`; `scripts/ingest-map-catalog.ts`, `ingest-weekly-ads.ts`, `sync-provider-prices.ts`). Homelab docs already show comma-separated markets (`docs/homelab-deploy.md` §2.3).

2. **Shopper geography is continental-US, coordinate-first.** Geocodio resolves arbitrary CONUS ZIPs in production; ZIP search-center cache is per-ZIP (`src/lib/zip-search-centers.ts`); Decision log superseded the old “~35 mi from 23111” fence.

3. **Weekly-ad orchestration is multi-chain by catalog presence.** Cron discovers nearby weekly-ad-capable stores per ZIP and runs registered clients; one primary scrape/feed per chain per ZIP, then fan-out to sibling stores.

4. **Identity alias-graph + onboarding checklist are designed as pluggable.** Schema `db/init/021_store_identities.sql`, Option A Slices 1–6, and the Dollar Tree dry-run appendix form a real identity playbook (`docs/store-identity-source-onboarding.md`).

5. **Provider integration is categorized, not ad hoc.** Location / item pricing / sale discovery are separate capability lanes (`docs/provider-integration-pattern.md`).

6. **Dedup helpers are mostly chain-agnostic.** Same-chain collocated catalog fold (`src/lib/catalog-store-colocated-identity.ts`), ranked-map OSM suppress (~1.5 mi), migration ledger closed.

7. **Ops controls for ranked reads exist.** 24h observation window + ingest freshness heartbeat (global, not per-market).

---

## Hardcoded inventory (quick reference)

### ZIP / geography

| Assumption | Where |
|---|---|
| Fallback ZIP **`23111`** when `YUM4LESS_INGEST_ZIPS` unset/invalid | `parseIngestZipCodesFromEnv`; homelab runbook warns |
| Seed geocode table: only **`23111`, `23116`, `23223`, `23231`** (VA) | `src/lib/geocoding.ts`, `src/lib/us-service-area.ts` |
| UI default ZIP **`23111`**, default radius **5** | `src/components/meal-planner/use-meal-planner.ts` |
| Fixture OSM returns stores only for ZIP **`23111`** | `src/lib/osm-food-retail-discovery.ts` |
| E2E/CI anchors: coords **`37.6085, -77.3739`**, ZIP **`23111`** | `e2e/helpers.ts`, AGENTS.md |
| Weekly-ad browser timezone **`America/New_York`** | `src/lib/weekly-ad-ingestion/weekly-ad-browser-profile.ts` |
| Global env pins **`KROGER_LOCATION_ID`**, **`PUBLIX_STORE_NUMBER`** | Apply to every ZIP if set |
| Probe scripts singular **`YUM4LESS_INGEST_ZIP`** | Ops confusion; not scheduled path |
| Mechanicsville/VA fixtures, CI bootstrap, ranking baselines, error-copy hints | `db/ci/014`, fixtures, `recommendation-error-copy.ts` |
| Kroger research-target ZIP **`23111`** in config | `weekly-ad-chain-config.ts` (live ingest uses input ZIP) |

### Chains / rollout (lists edited by hand)

| Assumption | Where |
|---|---|
| Ranked v1 / Settings-selectable: **Kroger, Aldi, Publix, Food Lion** only | `src/lib/chain-rollout-policy.ts` |
| Walmart hard-blocked from promotion; Lidl coming-later | `weekly-ad-coverage.ts`, `provider-rollout.ts` |
| `StoreChain` union + marker styles + name/id inference marker lists | `provider-rollout.ts`, `store-chain-marker-style.ts`, `chain-rollout-policy.ts` |
| Flipp merchant union (closed set) | `flipp-weekly-ad-feed.ts` |
| Weekly-ad primary-store id-prefix scoring lists | `weekly-ad-ingest-store-priority.ts` |
| Provider registry clients (Kroger / Publix / Walmart discovery) | `src/lib/providers/provider-registry.ts` |

### Chain-specific code paths (not just lists)

| Assumption | Where |
|---|---|
| Per-chain weekly-ad clients/parsers | `src/lib/weekly-ad-ingestion/*-weekly-ad-ingestion.ts` |
| Official item-price sync **Kroger-only** | `provider-price-observation-sync.ts` |
| Aldi location = nearest OSM builder | `store-catalog-sync.ts`, `aldi-location-discovery.ts` |
| Publix = dedicated locator sync | `publix-catalog-sync.ts` |
| Kroger preferred-location / family discovery | `kroger-preferred-location.ts`, `kroger-family-discovery.ts` |
| Identity cross-link allowlist **Aldi → OSM only** (until Slice D) | `store-identity-ingest-aliases.ts` |
| Settings known-pair **Mechanicsville Kroger** only | `store-identity-settings-lookup.ts` |
| Seeds `022` / `023` Mechanicsville Kroger/Aldi identity links | `db/init/022_*.sql`, `023_*.sql` |
| Collocated merge wider for **Kroger** (0.15 vs 0.05) | `catalog-store-colocated-identity.ts` |
| Coordinate-sanity exceptions: two **Food Lion** Mechanicsville OSM ids | `chain-rollout-policy.ts` |
| Publix bootstrap store number **1626** (Brandy Creek) | `publix-catalog-sync.ts` / docs |

### Thresholds proven on the current metro (constants)

| Constant | Value | Role |
|---|---|---|
| Catalog collocated merge | **0.05 mi** / Kroger **0.15 mi** | Same-chain catalog twins |
| Ranked-map OSM suppress | **1.5 mi** | Hide OSM near ranked pin |
| Nominatim sanity delta | **0.25 mi** | Coordinate sanity |
| Location move / witness | **50 m** / **250 m** | Reconciliation |
| Geocodio shared rate limit | **20/min** | In-process ZIP memo only |

### What is *not* hardcoded (contrast)

- Multi-ZIP ingest loops via `YUM4LESS_INGEST_ZIPS`
- Production Geocodio for any CONUS ZIP
- Weekly-ad cron picking whatever registered chains appear near each ZIP
- Identity schema / Option A checklist (designed to plug in; live linking still seed/allowlist-era)

**Short version:** the product *model* is multi-ZIP/multi-chain; the *defaults, fixtures, ranked membership, parsers, and VA-era overrides* are still hardwired to Mechanicsville + the four ranked chains.

---

## 1. ZIP coverage — hardcoded vs general

### Already general

| Mechanism | Notes |
|---|---|
| `YUM4LESS_INGEST_ZIPS` multi-market loops | Live cron path |
| Per-ZIP geocode → radius filter | Configurable radii (ingest ~8 mi, map-catalog ~12 mi) |
| Production Geocodio for any CONUS ZIP | Seed fallback disabled in prod without key |
| Shopper ZIP pin cache | Multi-ZIP map, not single slot |

### `YUM4LESS_INGEST_ZIPS` consumption

| Script | Behavior |
|---|---|
| `scripts/ingest-map-catalog.ts` | `parseIngestZipCodesFromEnv()` → `for (zip) syncUniversalMapCatalogForZip` |
| `scripts/ingest-weekly-ads.ts` | Per ZIP: resolve location → filter nearby stores → weekly-ad ingest |
| `scripts/sync-provider-prices.ts` | Per ZIP: geocode → provider search → catalog upsert → price sync |
| `scripts/run-scheduled-weekly-ad-ingest.mjs` | Orchestrates map-catalog → weekly-ad → provider sync |

Parser: `parseIngestZipCodesFromEnv` in `src/lib/store-catalog-sync.ts` — split on `,`, keep `/^\d{5}$/`, else warn + fallback `[YUM4LESS_PROVIDER_SYNC_ZIP ?? "23111"]`.

### `resolveZipLocation` / Geocodio

- Implementation: `src/lib/geocoding.ts` — Geocodio when `GEOCODIO_API_KEY` set; in-process `zipLocationCache`; seed fallback only in non-production / CI / test via `allowsSeedZipGeocodingFallback()`.
- Shared upstream bucket: `RATE_LIMITS.geocodioUpstream` = 20/min (`geocodio:global`); street geocode (`geocodeStreetAddress`) shares the same bucket and has **no** cache.
- Call sites: `location-resolution.ts`, `src/app/api/geocode/zip/route.ts`, ingest via `resolveLocationInput`.

### Adding a second ZIP today

**Mostly an env change for live ingest**, not a rewrite — with traps:

1. Set `YUM4LESS_INGEST_ZIPS=23111,<NEW>` (or replace with real markets).
2. Ensure `GEOCODIO_API_KEY` on **ingest and app**.
3. **Unset** `KROGER_LOCATION_ID` / `PUBLIX_STORE_NUMBER` unless correct for all markets.
4. Run scheduled ingest; SQL-verify catalog + observations near the new ZIP.
5. Expect Tier C until that market’s ranked rows warm.

**Not env-only:** fixture/rehearsal for a second ZIP (empty OSM fixtures), Eastern scrape TZ, global freshness can pass while the second market is empty, Continuity’s deferred **store geographic breakdown audit** before large expansion (`PROJECT_CONTINUITY.md` deferred backlog).

---

## 2. Store/chain onboarding — hardcoded vs general

### Lifecycle today

| Stage | Status |
|---|---|
| Rollout typing (`StoreChain`, `SHOPPER_RANKED_V1_CHAINS`) | Hardcoded unions/sets |
| Map-catalog / OSM | Universal Overpass; chain locators special-cased (Kroger API, Publix locator, Aldi nearest-OSM) |
| Identity graph | Pluggable design; live cross-link still Aldi allowlist + per-market seeds until **Slice D** |
| Weekly-ad | Registry + hand-written clients/parsers per chain |
| Official item pricing | **Kroger-only** sync |
| Promotion / Settings / map ranked policy | Shared gate math; membership lists hardcoded |
| Freshness | Global ranked-source heartbeat (not per-chain SLO) |
| Cron | No new job for a new chain if catalog pins exist near ingest ZIPs |

### Dollar Tree / Option A assessment

The Dollar Tree appendix in [`docs/store-identity-source-onboarding.md`](../store-identity-source-onboarding.md) is a **strong identity-only template** (locator → upsert + self-alias → optional OSM twin → stay out of ranked Settings). It is **not** a full “new ranked chain” SDK.

| Aspect | Repeatable? |
|---|---|
| Identity checklist steps 1–12 | Yes — best current template |
| Seed SQL shape (`022`/`023`) | Shape yes; still per-market until Slice D |
| Interim allowlist | Temporary — do not grow as permanent policy |
| Settings known-pair (Mechanicsville Kroger) | Anti-pattern — do not copy |
| Sale discovery / Flipp / scrape / official API | Outside Option A — still chain-specific |
| Backlog #18 catalog fit | Separate product investigation |

Closest playbook pair today: **Option A identity doc** + **provider-integration-pattern** — a checklist, not a plugin registry.

### Dedup layers (intentionally separate)

1. **Identity alias graph** (expand OFF by default) — Option A
2. **Same-chain collocated catalog fold** — `catalog-store-colocated-identity.ts`
3. **Map OSM suppress near ranked catalog** — `map-osm-ranked-chain-policy.ts` (~1.5 mi)
4. **Historical Publix tombstones** — anti-pattern; do not extend

---

## 3. Templatization scorecard

| Capability | Status | Evidence |
|---|---|---|
| **Add a new ZIP** | **Partially templatized** | Env + multi-ZIP loops work; fixtures/UI/TZ/overrides still VA-centric |
| **Add a new store chain** (adapter + identity + freshness) | **Partially templatized** | Identity checklist + weekly-ad registry exist; parsers/rollout lists/official pricing/Slice D are not |
| **Add a new location in an existing chain** | **Already templatized** (live) | Map-catalog / locator / API sync + weekly-ad fan-out; identity twin link still `[gap]` until Slice D |
| **Ingest cron scaling** (multi-ZIP × multi-chain) | **Partially templatized** | Loops exist; linear wall-clock; no per-chain schedule weights; M128 auto-pause **not shipped** |
| **Test coverage scaling** | **Not templatized** | E2E/fixtures pinned to one ZIP + Mechanicsville four-chain ids; no parameterized market matrix |

---

## 4. Risks and blockers

| Risk | Blocks | Effort | Notes |
|---|---|---|---|
| Shared Geocodio `20/min`; ZIP cache in-process only; street geocode uncached | ZIP (primary), both | **Large** | Continuity backlog #10; 2× usually fine; 5× bursty; 10× needs durable cache or plan |
| Ingest cost ~linear in ZIP count | ZIP | **Large** | Map-catalog + weekly-ad + Kroger sync per market |
| Kroger Locations ~1.6k/day/endpoint; Products ~10k/day | ZIP (sync) | **Medium** | Multi-ZIP preferred-location sync stays under Products longer than Locations |
| Metro-tuned dedupe (0.05 / 0.15 / 1.5 / 0.25 mi) + Food Lion exceptions | Both | **Medium** | Dense metros: over-suppress; rural: less merge risk, Nominatim FPs remain |
| Slice D open; allowlist/seeds for twins | Store (primary) | **Large** | Continuity: safety boundary until Slice D |
| M128 scrape auto-pause / kill-switch not shipped | Store (+ ZIP multiplies blast radius) | **Large** | Manual pause only today |
| E2E/fixtures single-ZIP | ZIP (+ store for new chains) | **Medium** | Honesty gap for second market |
| Market-search payload at dense/far ZIPs | ZIP | **Medium** | Continuity historically ~883 KB / 1310 stores |
| Global freshness / thin second market | ZIP | **Medium** | Heartbeat can pass while one market is empty |
| `price_observations` / identity growth without retention prune | Both | **Small–Medium** | Replace-on-write helps; no prune job |
| Parallel rollout registries easy to miss | Store | **Medium** | Soft blocker — miss one list → Tier C / wrong Settings |
| Official pricing beyond Kroger | Store (if needed) | **Large** | Only for official-online ranked path |
| #18 Dollar Tree/DG catalog fit | Store (ranked) | **Large** | Map/context can proceed without it |
| Live catalog state `Unknown` ~half of rows | Both | **Medium** | Metadata debt scales with map-catalog |
| Ops: `fresh_24h=0` on live DB at audit time | Both (ops) | **Medium** | Cron must stay green before scaling markets |

### Geocodio at 2× / 5× / 10× (qualitative)

| Scale | Implication |
|---|---|
| **2×** | Usually OK if ZIP memo hits; cold multi-ZIP bursts + street geocode share the same 20/min bucket |
| **5×** | Concurrent distinct-ZIP shopper traffic and nightly street witnesses can starve each other without durable ZIP cache or priority |
| **10×** | Shared key is a product risk; seed table only covers 4 VA ZIPs for offline fallback |

---

## Gap list (effort × dimension)

| Gap | Effort | Blocks |
|---|---|---|
| Durable Geocodio ZIP (+ optional street) cache / plan | Large | ZIP-scaling |
| Geographic `stores` breakdown audit before expanding ZIPs | Small (ops) | ZIP-scaling (Continuity gate) |
| Clear/document single-store env override hazard for multi-ZIP | Small | ZIP-scaling |
| Per-market scrape timezone | Medium | ZIP-scaling |
| Per-ZIP freshness / coverage heartbeat | Medium | ZIP-scaling |
| Second-ZIP fixtures + parameterized e2e smoke | Medium | ZIP-scaling |
| Market-search size guard / pagination | Medium | ZIP-scaling |
| Slice D batch proximity/name matcher | Large | Store-scaling (also worsens with ZIP density) |
| Unified chain-capability registry (rollout / Flipp / markers / prefixes) | Medium | Store-scaling |
| Declarative Flipp-first weekly-ad executor | Medium | Store-scaling (speed) |
| Official price sync abstraction beyond Kroger | Large | Store-scaling (official path only) |
| M128 robots/auto-pause/kill-switch | Large | Store-scaling (ZIP amplifies) |
| #18 catalog fit for dollar/club banners | Large | Store-scaling (ranked honesty) |
| Retention prune for observations/analytics | Small | Both |
| Unknown-state metadata quality | Medium | Both |

---

## Playbook drafts

### A. Add a new ZIP

1. Run deferred **store geographic breakdown** SQL (Continuity backlog) — know current footprint. `[gap: formalized audit step not automated]`
2. Choose ZIP(s) + radii (`YUM4LESS_PROVIDER_SYNC_RADIUS_MILES`, `YUM4LESS_MAP_CATALOG_RADIUS_MILES`).
3. Set `YUM4LESS_INGEST_ZIPS` on ingest; ensure `GEOCODIO_API_KEY` on ingest **and** app.
4. Unset `KROGER_LOCATION_ID` / `PUBLIX_STORE_NUMBER` unless multi-market-safe.
5. One-shot dry-run: map-catalog → weekly-ad → provider sync.
6. SQL-verify stores + `price_observations` near the new ZIP (homelab §4.2 pattern).
7. Shopper smoke: geocode ZIP → market-search → rank; expect Tier C until warm.
8. Watch Geocodio 429s and cron wall-clock. `[gap: durable cache / quota plan]`
9. Optional: second-ZIP e2e/fixture. `[gap: suite not parameterized]`
10. Optional: non-Eastern TZ. `[gap: still America/New_York]`

### B. Add a new chain

**Map/context only (Dollar Tree–shaped)**

1. Capability map (location only) via provider-integration-pattern.
2. Add `StoreChain` + markers + marker style. `[gap: no single registry]`
3. Register `source_system`; locator/OSM → `upsertCatalogStores` + self-alias.
4. Match-policy pair stub; prefer **no** allowlist until Slice D. `[gap: Slice D]`
5. Optional seed if both members exist — link, don’t invent stores.
6. Keep out of `SHOPPER_RANKED_V1_CHAINS` / Settings selectable.
7. Fixtures/tests per Option A checklist.

**Weekly-ad ranked path (additional)**

8. Location strategy (API / locator / OSM) — patterns not unified. `[gap]`
9. `WeeklyAdChain` + client + Flipp merchant if used; register in clients list. `[gap: hand-written parsers]`
10. Fixture HTML + CI ingest.
11. Promotion gates + add to ranked/Settings/map lists **together**.
12. Official API sync only if needed. `[gap: Kroger-only]`
13. Identity twins for API/slug/OSM. `[gap: expand OFF; Slice D]`
14. Cron: ensure pins near `YUM4LESS_INGEST_ZIPS` — no new cron job.
15. Catalog-fit / trust review (#18-class) before claiming ranked dinners. `[gap for dollar/club]`
16. Audit note under `docs/audits/`.

**New location in an existing ranked chain**

1. Ensure catalog sync covers the ZIP.
2. Run ingest — fan-out handles siblings.
3. Identity OSM twin if collapse needed. `[gap: seed/allowlist/Slice D]`

---

## Recommended sequencing

```text
1. Ops honesty: geographic audit + Geocodio durable cache (or plan) + clear store overrides
2. Expand YUM4LESS_INGEST_ZIPS in small batches (2 → ~5) on Kroger / Aldi / Publix / Food Lion
3. Second-ZIP e2e smoke + per-market freshness visibility
4. Slice D (identity) + M128 scrape safety
5. Then new ranked chains (Walmart / Lidl / DG / Dollar Tree) — map/context can proceed earlier for research
```

| Workstream | Can parallelize? | Why |
|---|---|---|
| ZIP expansion on four ranked chains | **Start now** (small batches) | Loops already exist; mainly env + quota + overrides |
| New **map/context** chain (DT-shaped) | **Mostly parallel** | Identity checklist independent of ZIP count; don’t grow allowlists |
| New **ranked** chain | **After / gated by** Slice D, scrape safety, catalog fit | Hand-written sale path + rollout lists + trust |
| Geocodio durable cache | **Do first among shared blockers** | Shared ZIP + store reconciliation |
| Slice D | **Before national identity expand** | Shared; worsens with store density from ZIP growth |

**Verdict:** ZIP expansion and map-context chain research can proceed in parallel. Trusted **ranked** chain expansion should wait on Slice D + scrape kill-switch + catalog-fit, while ZIP expansion on the current four chains is the higher-leverage next move — Continuity already treats geographic audit + real `YUM4LESS_INGEST_ZIPS` as precursors to trusting multi-market cron.

---

## Key file references

### Config / docs

- `.env.example`
- `docs/homelab-deploy.md`
- `docs/store-identity-source-onboarding.md`
- `docs/provider-integration-pattern.md`
- `PROJECT_CONTINUITY.md` (Resume; Decision log continental US; backlog geographic audit + Geocodio #10 + Slice D + #18)

### Ingest multi-ZIP core

- `src/lib/store-catalog-sync.ts`
- `scripts/ingest-map-catalog.ts`
- `scripts/ingest-weekly-ads.ts`
- `scripts/sync-provider-prices.ts`
- `scripts/run-scheduled-weekly-ad-ingest.mjs`
- `src/lib/scheduled-ingest-pipeline.ts`
- `src/lib/ingest/weekly-ad-ingest-store-selection.ts`

### Geocode / geography

- `src/lib/geocoding.ts`
- `src/lib/location-resolution.ts`
- `src/lib/us-service-area.ts`
- `src/lib/rate-limit.ts`
- `src/lib/geo/coordinate-sanity-check.ts`
- `src/app/api/geocode/zip/route.ts`

### Chain / identity / weekly-ad

- `src/lib/chain-rollout-policy.ts`
- `src/lib/provider-rollout.ts`
- `src/lib/weekly-ad-ingestion/weekly-ad-chain-registry.ts`
- `src/lib/weekly-ad-ingestion/weekly-ad-ingestion-service.ts`
- `src/lib/store-identity-ingest-aliases.ts`
- `db/init/021_store_identities.sql`, `022_*.sql`, `023_*.sql`

### Fixtures / CI anchors

- `src/lib/fixtures/*`
- `e2e/helpers.ts`
- `db/ci/014_ci_bootstrap_stores.sql`

---

## Scale check (audit findings)

- **Small scale:** Symptom of “what is hardcoded vs general for ZIP/chain expansion” is answered with concrete file paths and playbook gaps.
- **Large scale:** Root pattern is **multi-ZIP loops + Option A identity spine already exist**, while **defaults/fixtures/ranked membership/parsers/VA overrides** remain single-footprint — scale risk is treating env-only ZIP adds or Option A identity dry-runs as full national/ranked readiness.
