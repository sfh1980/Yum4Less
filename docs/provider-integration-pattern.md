# Provider integration pattern

Reusable architecture for adding or auditing grocery-chain data paths. Chain-specific evidence lives in per-chain audit files (e.g. [`docs/audits/kroger-data-path-audit-2026-06-26.md`](audits/kroger-data-path-audit-2026-06-26.md)); this doc is the **general model** those audits should follow.

**When to use:** Before wiring a new chain (Publix, Food Lion, Walmart, …), or when a fallback chain “works” in code but produces empty or misleading ranked output.

---

## Three data-type categories

Yum4Less needs three **independent** answers from external sources. Mixing them — or putting a source in a fallback slot it cannot structurally fill — is the most common integration mistake (see Kroger weekly-ad → official API fallback in the 2026-06-26 audit).

| Category | Question it answers | Typical Yum4Less consumer |
|----------|-------------------|---------------------------|
| **Store location** | Where are this chain’s stores near the shopper? | Map pins, catalog upsert, store picker, distance/radius filtering, coordinate reconciliation |
| **Item pricing** | What does ingredient *X* cost at store *Y* right now (regular/promo, in-stock)? | Official-online ranked path (`price_observations` with `*-official-api` sources), provider pricing previews |
| **Sale discovery** | What promotional / weekly-ad offers exist for this market (often many SKUs, not ingredient-scoped)? | Weekly-ad ingest → ingredient matching → ranked weekly-ad observations (`*-weekly-ad-scrape`) |

Each category has different **latency**, **coverage shape**, and **trust labeling**. A source that is excellent for one category is often useless for another.

---

## What each source type can structurally do

Use this table when designing fallback order. **If a source is not listed under a category, do not put it in that category’s chain** — even as a “last resort.”

### Store location

| Source type | Capable? | Notes |
|-------------|----------|-------|
| Chain **location / store-locator API** | **Yes** | Primary path when an official API exists (e.g. Kroger Location API, Publix locator service). |
| **OSM Overpass** + chain heuristics | **Yes (context)** | Map context pins; not a substitute for chain-verified coordinates when an official API exists. |
| **USDA SNAP retailer locator** | **Yes (context)** | Reference witness / sparse-market context; labeled SNAP context pin. |
| **Geocoding** (address → coordinates) | **Partial** | Witness for reconciliation, not discovery. |
| Per-item **product pricing API** | **No** | Requires a known `locationId` / store context; does not enumerate nearby stores. |
| **Weekly-ad / Flipp** feed | **No** | ZIP-scoped offers, not a store directory. |
| Weekly-ad **page scrape** | **Rare / partial** | May embed store context for URL building; not a general locator. |

### Item pricing (per-ingredient, store-scoped)

| Source type | Capable? | Notes |
|-------------|----------|-------|
| Official **product search API** with store/location filter | **Yes** | Kroger `GET /v1/products?filter.locationId=…` — canonical item-pricing path. |
| Cached **`price_observations`** from prior sync | **Yes (read)** | Public APIs are cache-only; ingest scripts write observations. |
| **Weekly-ad / Flipp** raw offers | **Partial** | Promotional SKUs only; requires ingredient matching; directional trust tier. |
| Weekly-ad **scrape** | **Partial** | Same as Flipp — sale discovery input, not shelf-price API. |
| **OSM / SNAP** | **No** | No prices. |
| Location API alone | **No** | Addresses only. |

### Sale discovery (weekly ad / promotions)

| Source type | Capable? | Notes |
|-------------|----------|-------|
| **Syndicated weekly-ad feed** (e.g. Flipp) | **Yes** | Primary for many chains when direct scrape fails; merchant + ZIP scoped. |
| Chain **weekly-ad page scrape** (browser or HTTP) | **Yes** | Chain-specific parsers; anti-bot risk. |
| Official **product pricing API** | **No (wrong category)** | Answers per-ingredient shelf/promo lookup, **not** “all items on sale this week.” Using it as weekly-ad fallback (Kroger `fetchKrogerOffersFromOfficialApi`) only returns tracked ingredients, misses ad-only SKUs, and mislabels provenance — acceptable only as an explicit **last-resort partial fill**, never as sale-discovery primary. |
| Location API | **No** | |
| OSM / SNAP | **No** | |

---

## Per-chain integration checklist

Run this for **each new provider** and **each data category** separately. Do not sign off a chain because one category works.

### 1. Capability map (design)

- [ ] List every external source you plan to use (API, Flipp merchant name, scrape URL, OSM, locator).
- [ ] For each source, mark which **categories** it can serve (location / item pricing / sale discovery) using the table above.
- [ ] Draw **one fallback chain per category**, ordered strongest → weakest **within that category only**.
- [ ] Flag any edge where a source appears in the wrong category (common bug: product API in sale-discovery chain).

### 2. Store location

- [ ] Official locator API configured? What env vars / credentials?
- [ ] Catalog upsert path: which `source_name` on `stores` rows (e.g. `kroger-official-api`, `publix-store-locator`, `openstreetmap-overpass`)?
- [ ] Map merge priority: ingested ranked pins vs OSM/SNAP context (`market-store-catalog-merge.ts`, `map-osm-ranked-chain-policy.ts`).
- [ ] Coordinate reconciliation witnesses documented (`store-location-reconciliation.ts`).
- [ ] Bootstrap seed vs API-derived store IDs — linkage rules clear (slug vs numeric `locationId`)?
- [ ] **Closed/inactive stores:** Kroger Location API exposes address, departments, and hours only — **no `closed` or operational-status field** in the published OpenAPI (`locations.location`). Yum4Less does not infer permanent closure from that API today. OSM lifecycle tags are filtered at Overpass parse time; already-persisted catalog rows are not auto-tombstoned.

### 3. Item pricing

- [ ] Is there an official online pricing API? Production vs certification behavior documented?
- [ ] Ingest write path only (not public search live calls) — `readMode: live-allowed` in scripts, `cache-only` on `/api/*`.
- [ ] Search terms source: `provider_search_terms` table vs static fallback.
- [ ] Store mapping: preview `providerStoreId` → internal `stores.id` (Kroger: `resolveInternalKrogerStoreId`).
- [ ] `skip_reason` / empty paths logged when sync cannot write.
- [ ] Promotion gates: fresh observation count, coverage rollup, trust labels.

### 4. Sale discovery

- [ ] Fallback order documented (scrape vs Flipp-first vs locator-cookie — **chain-specific**, see configs below).
- [ ] Flipp merchant string verified against live feed.
- [ ] Parser + fixture HTML for CI (`YUM4LESS_WEEKLY_AD_FIXTURE=1`).
- [ ] Matching funnel understood: raw offers → `ingredientId` → sync (most offers drop here by design).
- [ ] Provenance / trust: `weekly-ad-scrape` vs `weekly-ad-partner-feed`; directional copy.
- [ ] **No product pricing API in the sale-discovery chain** unless explicitly justified as partial last-resort (document limits).

### 5. Read vs write boundaries

- [ ] Public routes read Postgres / snapshot cache only (`YUM4LESS_ENABLE_API_DB_WRITES` does not sync prices from HTTP).
- [ ] Scheduled ingest order: map-catalog → weekly-ad → provider price sync (when applicable).
- [ ] Fixture vs live policy enforced (`fixture-ingest-policy.ts`).

### 6. Tests and probes

- [ ] Unit tests per parser, resolver, and skip-reason path.
- [ ] Fixture ingest in CI for the chain.
- [ ] Owner `probe:*` scripts for live diagnostics — **not** merge gates (`AGENTS.md`).

---

## Kroger case study (why category separation matters)

The [Kroger data path audit (2026-06-26)](audits/kroger-data-path-audit-2026-06-26.md) traced:

| Category | Intended primary | Fallbacks | Anti-pattern found |
|----------|------------------|-----------|-------------------|
| Store location | Kroger Location API | Postgres cache, `KROGER_LOCATION_ID`, OSM/SNAP context | Bootstrap slug `source_store_id` vs numeric `locationId` mismatch blocking official price sync until map-catalog links rows |
| Item pricing | Kroger Products API (`sync:provider-prices`) | Cached observations; certification strips prices | Default `KROGER_API_ENV` = certification → sync always `not-production` until promoted |
| Sale discovery | Direct weekly-ad scrape | **Flipp** (de facto production path when scrape = 0) | **Official product API as third-tier “weekly ad” fallback** — structurally a per-ingredient pricing lookup, not ad discovery; ~122 Flipp offers → ~4 synced is matching funnel, not feed failure |

**Correct mental model:** Flipp belongs in **sale discovery**. Kroger Products API belongs in **item pricing**. Location API belongs in **store location**. Cross-wiring them creates silent partial data and wrong trust provenance.

---

## Codebase: store-agnostic vs chain-hardcoded

This is an inventory for the **next chain** — not a mandate to refactor now. Prefer extending existing registries over copy-pasting Kroger files.

### Already store-agnostic (reuse for new chains)

| Area | Location | Notes |
|------|----------|-------|
| Weekly-ad orchestration | `weekly-ad-ingestion-service.ts` | Dispatches by `WeeklyAdChain` to registered clients. |
| Chain registry + config | `weekly-ad-chain-registry.ts`, `weekly-ad-chain-config.ts` | Per-chain fetch strategy, URLs, terms — **add row + client**, don’t fork service. |
| Flipp resolver (Aldi / Food Lion / Kroger pattern) | `flipp-weekly-ad-resolver.ts` | Merchant search + flyer lookup + supplemental ingredient searches. |
| Shared weekly-ad pipeline | `weekly-ad-ingredient-matching.ts`, `weekly-ad-offer-sync.ts`, `weekly-ad-match-guards.ts` | Matching thresholds, persist rules, best-one-per-ingredient. |
| Generic page fetch | `weekly-ad-page-fetcher.ts`, `weekly-ad-browser-fetcher.ts` | HTTP vs browser strategies from config. |
| Provider store search dispatch | `provider-market-service.ts`, `provider-registry.ts` | Iterates registered `StoreDiscoveryProviderClient`s; cache-only vs live-allowed. |
| Provider interface | `provider-types.ts` | `searchStoresByLocation` + `searchPricingPreview` contract. |
| Pricing preview builder | `provider-pricing-preview-service.ts` | Loops all discovery providers; store selection by preferred ID. |
| Price source tiers | `price-source-policy.ts` | Official-online vs weekly-ad precedence (extensible `OFFICIAL_ONLINE_PRICE_SOURCES`). |
| Rollout / promotion gates | `provider-rollout.ts`, `weekly-ad-promotion-readiness.ts`, `provider-promotion-readiness.ts` | Chain status tables; not Kroger-only. |
| Map catalog / OSM | `osm-food-retail-discovery.ts`, `store-catalog-sync.ts` (partial) | Universal map-context ingest; chain-specific branches inside sync. |
| Search terms loader | `provider-search-terms.ts` | DB-backed by `provider` string — not Kroger-specific API. |

### Kroger-specific or hardcoded (expect touch when adding ranked official-online path)

| Area | Location | Generalization note |
|------|----------|---------------------|
| Official price observation sync | `provider-price-observation-sync.ts` | `syncProviderPreviewsToPriceObservations` **skips non-Kroger**; `resolveInternalKrogerStoreId`, Kroger production gate. **Next chain with official API:** extend here or parallel `syncPublixPreview…` — not yet abstracted. |
| Preferred location for price sync | `kroger-preferred-location.ts` | Kroger-family haversine + `KROGER_LOCATION_ID`. |
| Kroger provider client | `providers/kroger-provider.ts`, `providers/kroger/*` | Full Location + Products implementation. |
| Kroger weekly-ad ingest chain | `kroger-weekly-ad-ingestion.ts` | **Flipp-first** via `resolveFlippWeeklyAdOffersForChain` → Kroger chain scrape → API partial fill (last resort). Kroger-specific scrape parser/fetcher; same Flipp resolver as Aldi/Food Lion. |
| Kroger API weekly-ad fallback | `kroger-weekly-ad-api-fallback.ts` | **Kept, demoted:** last-resort partial enrichment only — fires after Flipp **and** scrape both return zero; fills **tracked ingredients** via Products API (`limit: 1` per term). Not sale discovery, not Flipp-equivalent. Trust label: `Partial — tracked-ingredient product API fill (not weekly ad discovery)` (distinct from Flipp syndicated feed). Provenance stays `weekly-ad-scrape`, not partner-feed. |
| Kroger parsers / fetchers | `parse-kroger-weekly-ad.ts`, `kroger-weekly-ad-fetcher.ts`, `kroger-weekly-ad-store.ts`, `kroger-weekly-ad-url.ts` | Expected per-chain duplication until a second chain shares parser shape. |
| Kroger family filter | `kroger-family-discovery.ts` | Kroger-banner rollout filter on Location API results. |
| Official API coverage gate | `kroger-official-api-coverage.ts` | Kroger-only promotion gate for official-online ranked path. |
| Map merge priority constant | `market-store-catalog-merge.ts` | `kroger-official-api` called out as priority-5 witness; pattern exists for other `PROVIDER_CATALOG_SOURCE_NAMES` but reconciliation favors Kroger API witness today. |
| Provider sync script | `scripts/sync-provider-prices.ts` | Resolves **Kroger-only** preferred locationId; logs Kroger-centric messages. |
| Provider search term conveniences | `provider-search-terms.ts` | `resolveKrogerPreviewTrackedIngredients` / `resolveKrogerSyncTrackedIngredients` wrappers. |
| Settings selectable chains | `settings-store-selection.ts` | Hardcoded `kroger` + `aldi` for v1 shopper scope. |
| DB seed | `db/init/013_kroger_search_terms_full.sql` | Kroger-only term rows (101 terms). |

### Per-chain weekly-ad clients (pattern: copy structure, not logic)

Each chain has its own `*-weekly-ad-ingestion.ts` (+ fetcher, parser, store resolver). **No shared “fallback chain executor”** yet — fallback order is **hand-written per file**. When adding Publix ranked path, compare:

- **Flipp-first + chain scrape:** Aldi, Food Lion, Kroger (`resolveFlippWeeklyAdOffersForChain` → chain-specific scrape). Kroger adds a third tier: official Products API partial fill when Flipp and scrape both return zero.
- **Locator-cookie + scrape:** Publix (no Flipp in live path today)

**Flag (future, not now):** Three chains now share the Flipp-first + scrape fallback shape (Aldi + Food Lion + Kroger). A small declarative list per chain in `weekly-ad-chain-config.ts` could reduce drift — **propose before building**; Kroger’s API partial-fill tier and Publix cookie logic stay outside any shared executor until explicitly approved.

### Provider registry gap

`provider-registry.ts` registers Kroger, Publix, Walmart for **store discovery** clients. Only Kroger implements meaningful **pricing preview + price observation sync**. Publix/Walmart clients exist for discovery/context; official-online ranked sync is not generalized.

---

## Adding a new chain (minimal path)

1. Read this doc + run the checklist for all three categories.
2. Add `weekly-ad-chain-config.ts` row + `*-weekly-ad-ingestion.ts` client; register in `weekly-ad-ingestion-service.ts`.
3. If official store API exists: add `providers/<chain>-provider.ts`, register in `provider-registry.ts`, add `source_name` to `price-source-policy.ts` if ranked.
4. If official pricing API exists: extend `syncProviderPreviewsToPriceObservations` (or chain-specific sync) — **do not assume Kroger sync applies**.
5. Add fixture HTML + `npm test` coverage; optional `probe:*` script.
6. Update `provider-rollout.ts` and shopper-facing trust copy when promotion gates pass.
7. Write a chain audit doc under `docs/audits/` referencing this pattern.

---

## Related docs

| Doc | Role |
|-----|------|
| [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) | Product scope, ranked-chain focus, ingest order |
| [`docs/audits/kroger-data-path-audit-2026-06-26.md`](audits/kroger-data-path-audit-2026-06-26.md) | Worked example audit |
| [`.cursor/agents/ingest-standards.md`](../.cursor/agents/ingest-standards.md) | Ingest pipeline operator checklist |
| [`.cursor/rules/yum4less-product-and-trust.mdc`](../.cursor/rules/yum4less-product-and-trust.mdc) | Trust labeling constraints |

---

## Explicit non-goals (do not build yet)

- Generic plugin / adapter framework for hypothetical chains
- Unified fallback-chain interpreter driven by config alone
- Automatic capability detection from API shapes
- Treating weekly-ad product API fallback as a reusable “sale discovery” pattern

Document and flag first; abstract only when a second chain proves the same shape.
