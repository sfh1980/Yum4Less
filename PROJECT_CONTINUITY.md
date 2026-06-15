# Yum4Less — Project continuity

> **Linear history + current snapshot.** Setup and commands → [`README.md`](README.md). Agents, MCP, hooks → [`AGENTS.md`](AGENTS.md). Full pre-reorg copy (last committed before this restructure) → [`.private/PROJECT_CONTINUITY.backup-2026-06-08.md`](.private/PROJECT_CONTINUITY.backup-2026-06-08.md) (gitignored).

---

## Resume (as of 2026-06-15)

**Phase:** Phase 2 geocoding production gate + fixture DB isolation landed; Phase 3+ (E2E slug decoupling, UI/MVP copy) deferred.

**Hosting:** Self-hosted homelab (target); owner pushing toward first production deploy with Kroger-family + Aldi ranked path.

**Production-ranked focus:** **Kroger family + Aldi** when daily ingest and promotion gates pass. Publix, Food Lion, Walmart, and others: map/context or **upcoming releases** (fixture weekly-ad rows may exist in dev; not used for ranked meal totals).

**Owner ingest path:** `npm run setup:local` runs **live** `ingest:weekly-ads:scheduled` when `GEOCODIO_API_KEY` + Kroger credentials set. Fixture ingest requires `CI=true`, Vitest (`NODE_ENV=test`), or aligned `DATABASE_URL` + `DATABASE_URL_TEST` — cannot write rehearsal data to `yum4less_dev` by accident.

**Geocoding:** `NODE_ENV=production` without `CI` requires `GEOCODIO_API_KEY`; seed ZIP fallback disabled. `npm run dev` and CI/e2e runners may still use seed ZIPs when the key is absent.

**Verified (2026-06-15):** Phase 2 — `npm test` 470/470; `npm run test:integration` 24/24; `npm run test:e2e:ci` 4/4. CI e2e job passes `GEOCODIO_API_KEY` from `secrets.GEOCODIO_API_KEY`. Semgrep MCP/hooks not re-run. Not claiming homelab deploy-ready or beta v1 demo-complete.

> **Changelog history:** Older entries below are point-in-time agent notes (e.g. a missing key on a past date). Check `.env.local` and the repo for current truth.

### Working today (honest)

- **Pipeline debug:** local-only `GET /api/debug/pipeline?zip=23111` or `?lat=&lng=` — stores, ranked observations, 24h freshness, missing tracked ingredients (404 in production)
- **Phase B price/store alignment:** `resolveInternalKrogerStoreId` maps locationId `02900529` → `kroger-mechanicsville` (source_store_id + single-store fallback); ingest prefers catalog `source_store_id` for Kroger weekly-ad URLs; `sync:provider-prices` resolves nearest Kroger-family numeric `locationId` via `resolvePreferredKrogerLocationIdForZip` (Postgres + haversine; optional `KROGER_LOCATION_ID` escape hatch) and logs `skip_reason`
- **Phase C location trust:** `store-location-reconciliation` — ranked coord updates need agreeing witnesses (Kroger API + Geocodio address; optional USDA SNAP corroboration); change-only when delta ≥ `YUM4LESS_LOCATION_CHANGE_THRESHOLD_METERS` (default 50); single provider witness still promotes bootstrap → API
- **Phase C map context:** `discoverMapContextStores` unifies OSM + optional USDA SNAP (`YUM4LESS_MAP_SNAP_CONTEXT=1`); `snap_retailer_locations` reference table + `npm run ingest:snap-retailers`; SNAP pins labeled `SNAP context pin` — not ranked pricing
- **Phase D ingest breadth:** Kroger Location API returns **Kroger-family** stores (limit `YUM4LESS_KROGER_LOCATION_SEARCH_LIMIT`, max 50) with multi-store catalog upsert; Aldi bootstrap refresh uses **nearest OSM Aldi** (never ZIP centroid); provider snapshot cache matches by **ZIP primary** with coord tolerance; Publix locator sync refreshes `publix-atlee` bootstrap + context rows (`publix-store-locator`); `sync:provider-prices` passes OSM discovery for Aldi parity
- **Phase A map truth:** Postgres/provider ranked pins beat OSM/SNAP context on merge (`kroger-official-api` priority 5; ranked-chain dedupe ~1.5 mi); `YUM4LESS_MAP_OSM_RANKED_CHAIN_POLICY=suppress-conflicts` (default) drops context Kroger/Aldi when ingested catalog covers chain; map/list badges (`Bootstrap pin`, `API-verified pin`, `OSM context pin`, `SNAP context pin`, `Weekly-ad ingest pin`)
- **Map search merge (Rec 1–2):** `/api/market-search` merges provider-discovered stores into map pins; ephemeral map-context discovery (OSM ± SNAP) when DB pins within radius &lt; `YUM4LESS_MAP_SPARSE_PIN_THRESHOLD` (default 3), 24h OSM cache, degraded copy on failure — **no Postgres writes** on public read path
- **OSM lifecycle:** disused/abandoned/closed elements filtered from Overpass parse
- **Daily map-catalog cron preserved:** `npm run ingest:map-catalog` / scheduled wrapper still warms Postgres catalog; search-time OSM complements cron for arbitrary ZIPs
- **OSM parser:** `brand` → `operator` → `name` priority; Food Lion–like elements without `name` tag map to `food-lion` chain context
- **Phase 2B:** Live map-catalog ingest refreshes bootstrap ranked-chain coordinates (`refreshBootstrapRankedStoreCoordinates`); map tooltips cite ingest source + last verified; seed SQL documented as bootstrap-only
- **Phase 2C:** Bootstrap coord refresh runs after weekly-ad ingest (`*-weekly-ad-scrape` source rows eligible); duplicate `kroger-{locationId}` catalog rows skipped when bootstrap seed exists; live scheduled ingest env guards; OSM Overpass fallback + non-fatal map-catalog failures; daily refresh empty/stale copy (`RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE`); homelab/Task Scheduler cron examples in `.env.example`
- **24-hour ranked-read cache:** `price_observations` older than 24h excluded from rankings; provider snapshots default to same TTL
- **Cache-only public APIs:** `/api/recommendations` does not call live Kroger APIs or sync prices on user search; `/api/market-search` may call Overpass ephemerally (no Postgres writes) when map pins are sparse
- **Universal map catalog (Slice 4A):** `npm run ingest:map-catalog` (+ fixture variant) discovers food retail via OSM Overpass + chain locators; upserts map-context `stores` rows on **cron only**; OSM attribution when OSM pins visible
- **Publix + Food Lion gates (Slice 4B, rehearsal):** weekly-ad promotion gates exist in code/fixture paths; **production deploy focus remains Kroger + Aldi** — other chains in upcoming releases
- **Daily ingest path:** `npm run ingest:weekly-ads:scheduled` (+ fixture rehearsal variant) now includes map catalog step
- **Recipe opt-in:** internal library ranks by default; TheMealDB requires explicit checkbox + `recipeSourceOptIn` on API
- **TheMealDB on search (Slice 3):** opt-in ranking reads Postgres imports cache-first; **search-time refresh removed** — cron/script only (`npm run ingest:themealdb:from-sales`); scheduled-refresh notice when imports stale/empty; attribution + meal link on cards when saved imports rank
- **Ingredient row trust (D/E):** `Est.` / directional labels; `Prices from ~N hours ago` on ingredient rows **and meal cards** when metadata present; honest empty state (daily scheduled refresh, not live on search)
- Location-first flow: ZIP or browser → market search → map → meal preferences → recommendations
- Continental US ZIP + browser geolocation; dev seed ZIPs when `GEOCODIO_API_KEY` unset
- v1 ranked chains when gates pass: **Kroger family**, **Aldi** (production deploy focus); Publix/Food Lion code paths exist for upcoming releases
- Trust UI: `Est.`, directional, limited coverage, verify-in-store; map pins use “Coming soon” / “Available in a future release” for context-only chains
- Fixture weekly-ad ingest for **CI/rehearsal and automated tests only** (not owner daily workflow)
- Public APIs read-only by default in production; response sanitization; route validation + rate limits

### Not working / deferred

- **Tier B ranked estimates** in most US ZIPs until daily ingest runs for that market (Tier C is normal)
- **Walmart** ranked pricing deferred
- **Homelab deploy**, DNS/TLS, user accounts — deferred
- **Semgrep CI** — runs when GitHub repo secret `SEMGREP_APP_TOKEN` is set (not a `.env.local` var); local hooks use optional `semgrep` CLI

### Next (when reprioritized)

1. **Homelab deploy** — deferred until migration-ready
2. **Optional:** owner SNAP CSV ingest (`YUM4LESS_SNAP_CSV_PATH`) for nationwide context beyond fixture ZIPs
3. **Walmart ranked path** — deferred

---

## Changelog (newest first)

### 2026-06-15 — Phase 2: production geocoding gate + fixture DB isolation

**Theme:** Production cannot silently use seed ZIP coordinates; fixture ingest cannot write rehearsal data to owner dev DB.

**Shipped:**
- **runtime-environment** — `allowsSeedZipGeocodingFallback()` true only outside production deploys, or under `CI` / `NODE_ENV=test`
- **geocoding** — missing key, rate limits, and Geocodio failures return structured errors in production; seed ZIP table kept for dev/CI/test
- **fixture-ingest-policy** — `YUM4LESS_WEEKLY_AD_FIXTURE` / `YUM4LESS_MAP_CATALOG_FIXTURE` writes allowed only when `CI=true`, `NODE_ENV=test`, or `DATABASE_URL === DATABASE_URL_TEST`
- **Scripts** — guards on weekly-ad/map-catalog ingest, scheduled fixture path, `sync-provider-prices` fixture mode, `weekly-ad-ingestion-service` DB persist path; `run-e2e-tests.mjs` sets `CI=1` at start
- **ensure-test-db** — resolves target DB from `DATABASE_URL`; can create/provision `yum4less_test` (or other non-default DB) with `db/init/*.sql`
- **.env.example** — documents `DATABASE_URL_TEST` and production Geocodio requirement
- **CI** — e2e job env includes `GEOCODIO_API_KEY: ${{ secrets.GEOCODIO_API_KEY }}`; `CI=1` accepted alongside `CI=true` for fixture/geocoding guards

**Deferred:** E2E slug decoupling; `Bootstrap pin` / MVP copy cleanup.

### 2026-06-15 — Phase 1: bootstrap store deprecation (stores + catalog merge)

**Theme:** Runtime catalog is ingest-only on owner/prod paths; CI/integration bootstrap pins isolated; proximity merge into slug ids removed.

**Shipped:**
- **002_seed.sql** — removed 8 bootstrap `stores` inserts; recipes/ingredients unchanged
- **db/ci/014_ci_bootstrap_stores.sql** — same 8 pins applied only when `YUM4LESS_CI_BOOTSTRAP_STORES=1` or `CI=true` via `ensure-test-db.mjs`
- **store-catalog-sync** — `findCanonicalStoreIdForApiDiscoveredStore` merges only on matching `source_store_id` (no 0.1 mi slug merge); `yum4less-internal-catalog` removed from ranked sources; Aldi catalog requires OSM Aldi (no ZIP-centroid fallback); `refreshIngestedRankedStoreCoordinates` promotes rows linked by `source_store_id`; `syncUniversalMapCatalogForZip` no longer passes `bootstrapStoreId` for Publix
- **Tests** — unit + integration updated for ingest-only merge/refresh behavior

**Deferred (later phases):** geocoding seed ZIP fallback fail-loud; fixture ingest DB isolation; E2E slug decoupling; `Bootstrap pin` / `Local seed anchor` UI labels; MVP copy in internal-details-modal / meal-planner / recipe-source-registry.

### 2026-06-15 — Audit remediation M1–M5 + L1–L3 (medium/low)

**Theme:** Transactional price writes, migration pass on `setup:local`, DB-backed Kroger coverage denominators, non-fatal SNAP ensure for `dev`, Publix/Food Lion context-only ranked rollout, public API `sourceStoreId` strip, gated Kroger diag logs, SNAP CSV gitignore.

**Shipped:**
- **M1** — `insertPriceObservationIfChanged` replace path uses Postgres transaction (`begin` → delete → insert → `commit`; `rollback` on failure); unit test for insert-failure rollback
- **M2** — `scripts/setup-local.mjs` calls `ensureTestDatabase()` after `db:up` so `010`–`013` apply on existing volumes
- **M3** — `resolveKrogerCoverageTrackedIngredients()` threads DB `provider_search_terms` into preview/coverage/debug paths (static 5-ingredient fallback when DB unavailable)
- **M4** — `ensure-snap-context.mjs --non-fatal`; `npm run dev` uses it so SNAP ingest failure does not block Next
- **M5** — `publix` + `food-lion` in `MEAL_PRICING_COMING_LATER_CHAINS`; rehearsal note when weekly-ad rows exist; ranking fixture multi-store test uses Kroger + Aldi
- **L1** — `[diag:searchPricingPreview]` / `[sync:kroger]` logs gated behind `YUM4LESS_DEBUG_PROVIDER=1` (`.env.example`)
- **L2** — `sanitizeNearbyStoreForPublicApi` omits `sourceStoreId`
- **L3** — `.gitignore` for repo-root USDA SNAP CSV + `.tmp-overpass-*.json`
- **E2E** — results panel accepts mixed online + weekly-ad trust copy; Kroger store pill accepts `Est. Kroger API prices` when official-api gate passes

**Honest limits:** H1/H2/H4 not in this slice; Playwright MCP not run (Vitest + `test:e2e:ci` cover trust copy); Semgrep advisory hook not re-run.

**Evidence:** `npm test` 459/459; `npm run build` pass; `npm run test:integration` 24/24; `npm run test:e2e:ci` 4/4; Postgres `provider_search_terms` kroger **101**; Security Review clean on diff; Bugbot flagged Kroger pill assertion (fixed).

### 2026-06-15 — H3 E2E core flow hardening (ZIP 23111 browser gate)

- **`e2e/mvp-flow.spec.ts`:** `submitZipMarketSearch` helper with `waitForResponse` on `POST /api/market-search` (`ok: true`); removed page-wide `/Kroger|Publix|Food Lion/i` hero-safe regexes; store success gated on `Location set`, map heading, and bootstrap `[data-store-id="kroger-mechanicsville"]` with `Est. weekly-ad prices` inside `.map-discovery-layout` / `.nearby-stores-list` (seed `stores.name` is short **Kroger**, not Vitest's **Kroger Mechanicsville** mock label); structural sale-ingredient checks (Step 3 heading, ≥1 `.sale-ingredient-list` checkbox, Suggest disabled→enabled, no catalog name pins); trust-explainer test completes search before opening modal; H3 assertion philosophy comment block
- **Test-only slice** — no application or ingest code changes

**Evidence:** `npm test` 456/456; `npm run test:e2e:ci` 4/4; dev Playwright 4/4 (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001`, port 3000 occupied by non-app process). Postgres: bootstrap stores + 6 Kroger `price_observations`. Semgrep CLI advisory scan on spec file. Remote CI not re-run on uncommitted work.

### 2026-06-15 — H1 trust copy: official-api-preview store pills (Option A)

- **`official-api-preview` list/map trust badges** no longer say "Kroger live prices" or unqualified "Official API prices"; aligned with cache-only public reads via **Est. Kroger API prices** / **Est. official API prices** (+ verify-in-store on map)
- **No gate or API behavior change** — copy, tests, and continuity only

**Evidence:** `npm test` 456/456; Postgres MCP skipped (Docker daemon not running); Playwright MCP skipped (no dev server + DB).

### 2026-06-13 — Kroger official API promotion gate (alternate ranked path)

- Stores with **≥3 fresh `kroger-official-api` observations within 24h** can enable ranked pricing via new `official-api-preview` rollout status (weekly-ad gate unchanged for scrape-only stores)
- Trust badge (superseded 2026-06-15 H1): ~~Kroger live prices~~ → **Est. Kroger API prices** (list) / **Est. Kroger API prices — verify in store** (map)

**Evidence:** `npm test` 451/451; debug endpoint confirms `kroger-mechanicsville` → `recommendationEnabled: true`, `official-api-preview`.

### 2026-06-13 — Bootstrap Kroger store merge on API catalog sync

- **`syncV1ChainStoresToCatalog()`** merges API-discovered Kroger rows into bootstrap seed stores within **0.1 mi** (keeps slug id e.g. `kroger-mechanicsville`), migrates `price_observations`, deletes duplicate `kroger-{locationId}` rows, and runs a post-sync reconciliation pass
- **`resolveInternalKrogerStoreId()`** prefers bootstrap slug ids over API-derived ids when `source_store_id` matches

**Evidence:** `npm test` 446/446; integration merge test; live `npm run sync:provider-prices` maps official prices to `kroger-mechanicsville`; debug endpoint shows one Mechanicsville Kroger at **2.7 mi** plus separate `kroger-02900515` at **6.8 mi**.

### 2026-06-13 — Pipeline debug endpoint refresh (pricing-only)

- Extended `GET /api/debug/pipeline` with lat/lng input, trust badges, `valid_through`, 24h fresh vs stale counts, and `missingIngredientIds` for provider-tracked ingredients
- Exported `buildNearbyStoresForSearch()` so debug uses the same nearby-store rollout logic as recommendations (recipe catalog read is internal-only for gate math)

**Evidence:** `npm test` 441/441; `npm run build` pass.

### 2026-06-13 — Pragmatic pipeline decoupling (Slice 1)

**Theme:** Separate recommendation-time market pricing reads from recipe catalog reads; stop search-time TheMealDB imports; add local debug visibility.

**Shipped:**
- **Step 1:** Removed `ensureThemealdbRecipesForSearch()` from `getRecommendationExperience()`; boundary comment at removal site; stale/empty TheMealDB opt-in returns honest scheduled-refresh `shopperNotice` (no inline API/DB writes)
- **Step 2:** `getMarketPricingContext()` + `getRecipeCatalog()` in `market-repository.ts`; `getMarketDataSnapshot()` composes both (+ ingredients); recommendation path uses split reads; market-search path unchanged
- **Step 3:** `GET /api/debug/pipeline` — dev-only (`404` when `NODE_ENV=production`); `?zip=` or `?lat=&lng=`; nearby stores with trust badge, ranked `price_observations` (`valid_through`), 24h freshness summary, missing tracked ingredients; pricing pipeline only — no recipes or meal ranking
- Unit + route tests updated; integration tests for split reads

**Honest limits:** `/api/market-search` still loads full snapshot; TheMealDB cron module and wiring unchanged; debug route exposes internal store IDs (local dev only).

**Evidence:** `npm test` 430/430; `npm run build` pass; `npm run test:integration` 22/22; Postgres MCP + manual debug endpoint spot-check for ZIP 23111.

### 2026-06-12 — Data-driven Kroger location resolver for provider price sync

**Theme:** Remove hardcoded `kroger-mechanicsville` slug from `sync:provider-prices`; pick nearest Kroger-family numeric `locationId` from Postgres after catalog upsert.

**Shipped:**
- `resolvePreferredKrogerLocationIdForZip` in `kroger-preferred-location.ts` — rollout-based Kroger-family filter, `isKrogerProviderLocationId`, haversine nearest pick, optional `KROGER_LOCATION_ID` fallback when no candidates/coords/location
- `scripts/sync-provider-prices.ts` wired to helper; generic log copy (`no-kroger-store-found`, `store-mapping-failed`)
- Unit tests (10) for nearest pick, env fallback precedence, rollout-based OSM rows

**Honest limits:** Bootstrap seed still uses slug `source_store_id` until official API/OSM catalog upsert writes numeric IDs; weekly-ad ingest still uses `resolveKrogerStoreForWeeklyAd` (unchanged). Single preferred Kroger store per ZIP unchanged.

**Evidence:** `npm test` 422/422; `npm run build` pass; Semgrep clean on changed files; Postgres MCP seed shows bootstrap Kroger row only (numeric IDs expected post-sync).

### 2026-06-12 — DB-backed Kroger provider search terms (sync path only)

**Theme:** Replace hardcoded sync ingredient slice with Postgres `provider_search_terms`; preview/coverage paths unchanged until pool-threading follow-up.

**Shipped:**
- `db/init/011_provider_search_terms.sql` — table + Kroger seed (5 tuned terms)
- `getProviderSearchTerms` in `provider-search-terms.ts`; `sync:provider-prices` passes `trackedIngredients` to `buildProviderPricingPreviews`
- `ensure-test-db.mjs` applies `011` on existing volumes; unit + integration tests

**Honest limits:** Preview/coverage rollups still use `PROVIDER_TRACKED_INGREDIENTS` (static display names as search terms). Only Kroger seeded; other providers fall back to static list when no DB rows.

**Evidence:** `npm test` 412/412; `npm run test:integration` 19/19; Postgres MCP + integration test on seed rows.

### 2026-06-12 — Kroger/location trust Phase D (ingest breadth + cache normalization)

**Theme:** Broaden ranked/map ingest without weakening trust labels — Kroger-family multi-store discovery, Aldi OSM parity, provider cache ZIP keys, Publix locator bootstrap.

**Shipped:**
- **D5** — `kroger-family-discovery.ts`; Kroger provider drops `chain: "Kroger"` filter; `YUM4LESS_KROGER_LOCATION_SEARCH_LIMIT` (default 25, max 50); multi-store catalog upsert while preserving bootstrap seed row
- **D8** — `aldi-location-discovery.ts`; bootstrap Aldi refresh uses nearest OSM Aldi at ingest/sync (never ZIP search anchor)
- **D13** — `provider-store-search-cache.ts` ZIP-primary cache match + normalized coords (`0.005` tolerance when ZIP absent)
- **D15** — `publix-catalog-sync.ts`; map-catalog ingest syncs Publix locator context + refreshes `publix-atlee` coordinates
- **D11** — `setup:local` + README + `.env.example` document map-catalog fixture path and Kroger search limit
- `sync:provider-prices` passes OSM food-retail discovery for Aldi coord refresh on provider sync path

**Honest limits:** Publix remains context-only (not production-ranked); multi-store Kroger rows are map/ranked catalog context — meal ranking still gates on promotion coverage.

**Evidence:** `npm test` 409/409; `npm run test:integration` 18/18; `npm run build` OK.

---

### 2026-06-12 — Kroger/location trust Phase C (location witness + map-context platform)

**Theme:** Geocodio-ranked location reconciliation; OSM quality filters; unified map-context discovery with optional USDA SNAP reference ingest.

**Shipped:**
- **C1** — `store-location-reconciliation.ts` + `geocodeStreetAddress`; bootstrap refresh gathers Kroger/Geocodio/SNAP witnesses; API-verified pins need two agreeing witnesses before coord moves
- **C2** — OSM `disused`/`abandoned`/`closed` lifecycle filter in `parseOverpassElements`
- **C3** — `map-context-discovery.ts` replaces search-time OSM-only path; conflict filter generalized to all map-context sources
- **C4** — `db/init/010_snap_retailer_locations.sql`; `npm run ingest:snap-retailers` (+ fixture); `YUM4LESS_MAP_SNAP_CONTEXT` gate; trust copy for SNAP context pins
- `ensure-test-db.mjs` applies `010` migration on existing Postgres volumes

**Honest limits:** SNAP off by default; live USDA CSV is owner-supplied (`YUM4LESS_SNAP_CSV_PATH`); SNAP never drives ranked estimates.

**Evidence:** `npm test` 402/402; `npm run test:integration` 17/17; `npm run build` OK.

---

### 2026-06-12 — Current-only ranked price observations (no stale history)

**Theme:** Replace append-only sale price history with one current row per store + ingredient; purge aged/expired rows on ingest.

**Shipped:**
- `insertPriceObservationIfChanged` deletes superseded ranked rows before insert; official API replaces weekly-ad for same ingredient; weekly-ad skips when fresher official row exists (`skipped-superseded`)
- `purgeStaleRankedPriceObservations` on scheduled weekly-ad + `sync:provider-prices` (24h+ or past `valid_through`)

**Evidence:** `npm test` 391/391; `npm run test:integration` 16/16.

---

### 2026-06-12 — Kroger/location trust Phase B (price + store id alignment)

**Theme:** Map Kroger Location API `02900529` to `kroger-mechanicsville`; write official API prices to Postgres on ingest.

**Shipped:**
- `resolveInternalKrogerStoreId` — `source_store_id` match, single-bootstrap-store fallback, `skipReason` on sync summaries
- `CatalogStore.sourceStoreId` plumbed through `market-repository` → `NearbyStoreSummary`
- `resolveKrogerStoreForWeeklyAd` — reads numeric `source_store_id` from catalog before ZIP API lookup; weekly-ad ingest passes `storeId`
- `selectProviderDiscoveredStore` / `buildProviderPricingPreviews` — `preferredProviderStoreIds` for ingest (`02900529`)
- `sync-provider-prices` — reordered snapshot read, skip_reason logging, preferred Kroger locationId

**Honest limits:** Only 4 tracked ingredients synced this run (provider preview cap); weekly-ad rows still coexist; promotion gates unchanged.

**Evidence:** `npm test` 389/389; `npm run test:integration` 15/15; `npm run sync:provider-prices` synced=4; Postgres MCP `kroger-official-api` rows.

---

### 2026-06-12 — Kroger/location trust Phase A (map truth + honest labels)

**Theme:** Prefer Postgres/Kroger API over OSM on map; suppress conflicting search-time OSM for ranked chains; surface bootstrap vs API vs OSM provenance in UI.

**Shipped:**
- Merge — `kroger-official-api` highest priority; ranked-chain dedupe 1.5 mi vs 0.15 mi OSM-only (`market-store-catalog-merge.ts`)
- Search policy — `YUM4LESS_MAP_OSM_RANKED_CHAIN_POLICY` (`suppress-conflicts` default); filter OSM Kroger/Aldi when ingested catalog covers chain (`map-osm-ranked-chain-policy.ts`)
- UI — `locationProvenance` / `locationBadge` / `locationNote` on `NearbyStoreSummary`; map tooltips + store list; updated `MAP_CATALOG_LOCATION_FOOTNOTE`
- Copy — Kroger provider discovery message no longer claims discovery “does not drive ranked meal pricing”
- Fixture — OSM Kroger node for conflict-suppression tests; `.env.example` policy docs

**Honest limits:** Local Postgres Kroger row still `kroger-weekly-ad-scrape` at bootstrap coords until Phase B `sync:provider-prices`; live Overpass on search may still fail (notice shown); Playwright used port 3003 because 3000 was occupied.

**Evidence:** `npm test` 382/382; `npm run build` OK; Postgres MCP 2 ranked stores; Playwright MCP ZIP 23111 map + trust copy.

---

### 2026-06-11 — Beta v1 UX simplification + map coverage

**Theme:** Ingredient-first-only shopper flow; richer map pins via provider merge + sparse-triggered search-time OSM.

**Shipped:**
- UI — removed planning-mode select, dinners-wanted, max-ingredients; budget relabeled; Step 2/3 copy aligned with trust rules
- API — defaults `planningMode: ingredient-first`, `dinnersWanted: 3`, `maxIngredients: 20` when omitted; `standard` still accepted for tests
- Map Rec 1 — merge `providerStoreSearches` stores into `nearbyStores` with proximity dedupe (`market-store-catalog-merge.ts`)
- Map Rec 2 — ephemeral OSM on market-search when DB pin count &lt; threshold; 24h in-memory cache (`map-search-osm-cache.ts`); degraded notice on Overpass failure; skipped when `dataSource === unavailable`
- Map Rec 4 — OSM tag parser accepts `brand`/`operator` without `name`; Food Lion unit tests
- Docs — `.env.example` sparse-pin/cache env vars; README map-search note

**Honest limits:** OSM completeness varies by region; Overpass latency/429 possible; Kroger official API still capped at 10 stores per search; Playwright MCP did not complete this session (dev `.next` stale cache required `dev:clean`).

**Evidence:** `npm test` 374/374; `npm run build` OK; `npm run test:integration` 14/14; Postgres MCP 7 stores near 23111 bbox.

---

### 2026-06-11 — P2 hardening + doc drift cleanup

**Theme:** Close optional audit gaps; sync agent docs with cache-only API policy.

**Shipped:**
- Weekly-ad ingest — scopes to stores within `YUM4LESS_PROVIDER_SYNC_RADIUS_MILES` of each `YUM4LESS_INGEST_ZIPS` market (multi-ZIP loop like map catalog)
- Route tests — `selectedIngredientIds` bounds (count, type, charset, length)
- Catalog sync — `upsertCatalogStores` logs and rethrows instead of swallowing errors
- Map — ESLint cleanup for marker ref in effect teardown
- Docs — `database-codegen-standards.md` no longer implies market-search catalog writes; `README.pdf` removed/ignored; Resume changelog history note

**Honest limits:** Homelab deploy, commit/push, remote CI still owner-run.

**Evidence:** `npm test` 368/368; `npm run build` OK.

---

### 2026-06-11 — Deploy-readiness: doc/trust alignment, security gate, E2E fixes

**Theme:** Align production story to Kroger-family + Aldi; fix audit blockers; port-flexible dev/Playwright docs.

**Shipped:**
- Docs/copy — README, hero, trust modal, help hints, Tier C messaging: **production-ranked = Kroger + Aldi**; other chains upcoming releases
- Security — TheMealDB search path gated by `isPublicApiDbWriteEnabled()`; **no HTTP import in production**; scoped import to selected sale ingredients
- E2E — stable trust assertions; `ingest:map-catalog:fixture` in CI script; Beta v1 wording
- Dev UX — README/AGENTS: use `-p 3001` + `PLAYWRIGHT_BASE_URL` when port 3000 busy
- Frontend — map HTML escape, modal `inert`, ingredient-first idle copy, focus rings
- Ingest — invalid `YUM4LESS_INGEST_ZIPS` falls back with warning

**Honest limits:** Homelab deploy wiring still owner-run; Publix/Food Lion remain code/fixture paths not production-ranked scope; Playwright MCP and remote CI not re-run; Semgrep CI still advisory.

**Evidence:** `npm test` 360/360; `npm run build` OK; `npm run test:integration` 14/14; `npm run test:e2e:ci` 4/4.

---

### 2026-06-10 — Phase 2 Slice C: Daily price pipeline guards + bootstrap coord refresh after weekly-ad ingest

**Theme:** Fix map pin / price store divergence when weekly-ad ingest runs before map-catalog; guard live scheduled ingest; align empty/stale UI with 24h daily refresh discipline.

**Shipped:**
- `store-catalog-sync.ts` — bootstrap coord refresh eligible for `*-weekly-ad-scrape` store rows; skip duplicate `kroger-{locationId}` upserts when bootstrap seed exists; prefer weekly-ad-linked bootstrap ids in `findPrimaryStoreIdForChain`
- `live-ingest-env.ts` + `scripts/assert-live-ingest-env.ts` — live `ingest:weekly-ads:scheduled` exits non-zero without `GEOCODIO_API_KEY` + Kroger prod keys
- `run-scheduled-weekly-ad-ingest.mjs` — env guard; map-catalog failures log warning and continue (OSM-only degradation)
- `osm-food-retail-discovery.ts` — Overpass User-Agent + fallback endpoint on 406/429/5xx
- `ranked-price-cache-policy.ts` — shared `RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE`; sale-ingredient empty state + market paused copy updated
- `.env.example` — homelab/Task Scheduler cron examples; Overpass fallback note
- `sync-provider-prices.ts` — honest log when Kroger official preview sync writes 0 rows

**Honest limits:** Kroger official preview sync may still write 0 rows when product matching or API env limits apply — weekly-ad prices can still rank. Owner should re-run live scheduled ingest and Postgres MCP to confirm bootstrap coords post-merge. Playwright MCP not re-run this slice. Not claiming deploy-ready or CI green.

**Evidence:** `npm test` 353/353; `npm run build`; `npm run test:integration` 14/14.

---

### 2026-06-10 — Phase 2 Slices A + B: Live ingest default + bootstrap store coordinate refresh

**Theme:** Move owner onboarding from fixture-first demo to daily live ingest; fix map pins by overwriting seed coordinates when Kroger Location API / market geocode ingest succeeds.

**Shipped:**
- `scripts/setup-local.mjs` — runs `ingest:weekly-ads:scheduled` when `GEOCODIO_API_KEY` + Kroger credentials set; clear message when keys missing (fixture CI-only)
- `README.md`, `.env.example` — live ingest as normal path; fixture labeled CI/rehearsal only
- `store-catalog-sync.ts` — `refreshBootstrapRankedStoreCoordinates` updates seed ranked-chain rows in place (preserveRankedSources-compatible WHERE)
- Map copy — `store-map-location-copy.ts` + `last_verified_at` on store reads; tooltips show ingest source + verification age
- `db/init/002_seed.sql` — comment that bootstrap coords are replaced by first live ingest

**Honest limits:** Owner `.env.local` currently missing `GEOCODIO_API_KEY` — live ingest not run in agent session; Kroger keys present. Playwright MCP not re-run this slice. Not claiming deploy-ready or CI green.

**Evidence:** `npm test` 350/350; `npm run build`; `npm run test:integration` 13/13. Playwright MCP and live Postgres ingest not run (missing `GEOCODIO_API_KEY` in `.env.local`).

---

### 2026-06-10 — Phase 1 Slice 6: Verifier close-out + public-beta readiness review

**Theme:** Readonly `@verifier` / `@testing-cicd-standards` pass — Playwright MCP, Postgres MCP, automated gates, CI spot-check. Fix-only scope; no P0 trust bugs found.

**Verdict:** **Public-beta-ready** language is justified for an honest internet beta with fixture ingest + clear trust copy. Still **not** deploy-ready, **not** claiming CI green for uncommitted work, **not** full-US ranked coverage. Walmart ranked pricing remains blocked in `provider-rollout.ts` despite fixture `price_observations` rows (rehearsal honesty).

**Evidence:** Playwright MCP — hero `Yum4Less · Beta v1`, feedback link, ingredient-first CTA gating, trust modal (Kroger/Aldi/Publix/Food Lion gates + Walmart/OSM context-only), meal cards `Est.` + directional + `Prices from less than 1 hour ago`, map legend chain-colored vs gray, OSM attribution. Postgres — 13 stores; Kroger/Aldi/Publix/Food Lion obs within 24h TTL. Gates — `npm test` 341/341; `npm run build`; `npm run test:integration` 12/12; `npm run test:e2e:ci` 4/4. Remote CI last green on `master` 2026-06-05 (Phase 1 slices not yet pushed).

**Gaps:** Walmart not in 5 mi store list for current ZIP `23111` geocode (covered in hero/modal/legend). Parallel `next dev` + `next build` can corrupt `.next` — use clean build + `next start` for MCP checks. Semgrep CI still advisory.

---

### 2026-06-10 — Phase 1 Slice 5: Trust emphasis pass (D → E → F)

**Theme:** Scannable priced vs context-only trust copy across hero, modal, meal cards, store list, and map; ingredient-first E2E gating hardened.

**Shipped:**
- `store-pricing-status-copy.ts` — shared list pill + map tooltip/popup labels (`Est. weekly-ad prices`, Walmart context-only, limited coverage)
- `meal-recommendation-card.tsx` — card-level `Prices from ~N hours ago` via `formatMealPriceAgeFromShoppingPlan`
- Map legend/help aligned to chain-colored ranked pins vs gray context badges; tooltips include pricing/rollout line (popups unchanged detail)
- `trust-explainer-modal.tsx` — Kroger/Aldi/Publix/Food Lion gate-aware ranked copy; Walmart + OSM context-only
- Hero + location panel — Publix/Food Lion in ranked chain list; consistent estimated/directional language
- `scripts/ensure-test-db.mjs` — accepts **≥8** stores (seed + OSM map-catalog rows)
- E2E — required disabled-then-enabled Suggest CTA; sale-ingredient checkbox scoped; trust copy assertions updated

**Honest limits:** Price-age on cards only when shopping-plan freshness metadata exists; Playwright MCP not invoked (no tool descriptors in session — E2E CI covers browser path). Not claiming public-beta-ready or deploy-ready.

**Evidence:** `npm test` 341/341; `npm run build`; `npm run test:integration` 12/12; `npm run test:e2e:ci` 4/4.

---

### 2026-06-10 — Phase 1 Slice 4: Universal map catalog + Publix/Food Lion gates

**Theme:** Cron-only OSM map-context catalog ingest; honest map pins; Publix/Food Lion weekly-ad promotion gates aligned with Kroger/Aldi.

**Shipped:**
- `osm-food-retail-discovery.ts` — Overpass food-retail discovery (1 req/s discipline) + deterministic fixture stores for ZIP 23111
- `store-catalog-sync.ts` — map-context vs ranked-ready source roles; `syncUniversalMapCatalogForZip`; ranked-row preservation on upsert
- `scripts/ingest-map-catalog.ts` + `ingest:map-catalog` / `:fixture` npm scripts; wired into `ingest:weekly-ads:scheduled`
- Map UI — context-only popup copy (“Coming soon — map context only” / “Available in a future release”); OSM pin attribution footer
- `weekly-ad-coverage.ts` — Food Lion in `WEEKLY_AD_RANKED_PRICING_CHAINS`; `provider-rollout.ts` — Publix/Food Lion beta weekly-ad notes; Walmart still blocked
- Tests: OSM discovery, catalog roles, map model OSM flag, rollout/promotion updates, integration upsert idempotency

**Honest limits:** Live Overpass coverage varies by market; fixture path adds 5 OSM-style pins beyond seed. Promotion still requires ingested weekly-ad rows + gate thresholds. No claim of full-US ranked coverage.

**Evidence:** `npm test`; `npm run build`; `npm run test:integration`; `npm run ingest:map-catalog:fixture`; Postgres MCP store counts.

---

**Theme:** Opt-in ranking merges sale-matched TheMealDB imports on the search path — cache-first with bounded refresh; visible attribution on meal cards.

**Shipped:**
- `ensure-themealdb-recipes-for-search.ts` — 24h recipe cache policy; refresh when stale/empty; reuses `runSaleDrivenThemealdbImport` (search cap 5 vs cron 15)
- `recommendation-service.ts` — calls ensure on `recipeSource=themealdb` + `recipeSourceOptIn`; reloads snapshot after refresh; shopper empty/degraded notices (no npm-script copy)
- `meal-recommendation-card.tsx` — `recipeAttributionUrl` + “View on TheMealDB” link
- `themealdb-recipe-cache-policy.ts` — `YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT` (non-production default on; production opt-in)
- Tests: ensure cache logic, service themealdb path, route opt-in acceptance, attribution unit test

**Honest limits:** Search-path import still calls TheMealDB API when cache miss (bounded, not every click). Production defaults to cron/script unless `YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT=1`. Playwright attribution smoke deferred this slice.

**Evidence:** `npm test` 329/329; `npm run build` OK; `npm run test:integration` 9/9; Postgres MCP 4 `themealdb` rows; `ingest:themealdb:from-sales` imported 4 meals.

---

### 2026-06-10 — Phase 1 Slice 2: Ingredient-first default UX

**Theme:** Sale-ingredient browse is the primary beta path; recipe ranking requires explicit opt-in for non-internal sources; ingredient-row trust copy (D/E).

**Shipped:**
- Default `planningMode` → `ingredient-first` in `use-meal-planner.ts`
- Step 2 UI reordered: sale ingredient picker primary; **Advanced options** retains alternate “Rank full dinner options” path
- CTA **Suggest recipes using my selected ingredients** (disabled until ≥1 ingredient selected)
- TheMealDB opt-in checkbox + API `recipeSourceOptIn` gate (route + `recommendation-service`)
- `formatIngredientPriceAge` + freshness hours on `SaleIngredientChoice` rows; honest no-ingest empty state
- Sale ingredient choices limited to `recommendationEnabled` stores (emphasis **F**)
- Tests: `meal-planner.test.tsx`, `sale-ingredient-offers.test.ts`, route opt-in rejection, `e2e/mvp-flow.spec.ts` flow update

**Honest limits:** Emphasis **F** (context-only chains on ingredient rows) unchanged — map pins still own that story. Slice 5 remains for hero/modal/card-wide E pass. TheMealDB on search still Slice 3.

**Evidence:** `npm test` 318/318; `npm run build` OK; Playwright MCP localhost (ingredient-first default, directional + data-age on rows).

---

### 2026-06-10 — Phase 1 Slice 4 amended (direction)

**Theme:** Map-first vision — show all nearby food retail; pricing remains chain-gated.

**Decision (not yet implemented):**
- **Slice 4 Phase A — Universal food-retail map catalog:** Daily ingest discovers supermarkets, club stores, dollar markets, convenience, ethnic grocers, warehouse clubs, etc. near `YUM4LESS_INGEST_ZIPS` (OSM Overpass + chain locators where wired). Upsert into `stores` on **cron only** (not user search). Unsupported pins: map tooltip “Coming soon” / “Available in a future release” — never implied ranked pricing.
- **Slice 4 Phase B — Chain pricing gates (original scope):** Publix + Food Lion weekly-ad promotion gates where ingest exists; Walmart ranked still deferred.
- Supersedes narrow reading of “no auto-upsert until post beta/v1” for **map-context catalog rows** via scheduled ingest only.

**Evidence:** direction lock only; no code slice yet.

---

### 2026-06-09 — Phase 1 Slice 1: 24-hour cache discipline

**Theme:** Enforce 24h TTL on ranked reads; stop live provider refresh on user search; document daily cron path.

**Shipped:**
- `ranked-price-cache-policy.ts` — shared 24h constant, SQL age filter, `cache-only` vs `live-allowed` read modes
- `getMarketDataSnapshot()` excludes `price_observations` older than 24h (`coalesce(last_verified_at, observed_at)`)
- Provider store/pricing snapshot caches default TTL 30min → **1440min (24h)**
- Public API paths (`recommendation-service`) use **cache-only** provider reads; removed catalog upsert + price sync on search
- Ingest scripts (`sync:provider-prices`) use `readMode: "live-allowed"` for daily refresh
- README + `.env.example` — daily cron example for `ingest:weekly-ads:scheduled`

**Honest limits:** Trust UI data-age copy (emphasis E) not yet surfaced in cards — Slice 5. Fixture ingest re-run needed after integration tests wipe rows.

**Evidence:** `npm test` 314/314; `npm run test:integration` 9/9; `npm run build` OK; Postgres MCP 28 fresh rows after `ingest:weekly-ads:fixture`.

---

### 2026-06-08 — Catalog types + fixture split (production-lean)

**Theme:** Remove dead `mvp-area` shim; retire `mock-market-data` module.

**Shipped:**
- Deleted `src/lib/mvp-area.ts`; trimmed MVP aliases from `us-service-area.ts` (`DEV_PRIMARY_ZIP`, `DEV_AREA_CENTER`)
- Added `market-catalog-types.ts` (`CatalogStore`, `CatalogRecipeRecord`, `CatalogPriceObservation`, …)
- Moved test fixture arrays to `src/lib/fixtures/market-catalog.fixtures.ts`
- Production paths use catalog types; DB `source_name = 'mock-market-data'` legacy label unchanged

**Evidence:** `npm test` 300/300.

---

### 2026-06-08 — Rules and agents: beta v1 direction sync

**Theme:** Align always-on rules, scoped workflows, agents, and hooks with Phase 0 decisions.

**Shipped:**
- `yum4less-product-direction.mdc` — continental US, Tier C default, Kroger family + Aldi v1, Walmart deferred
- `readme-living-document.mdc` — slim README / continuity ownership (replaces investor-ready README guidance)
- Orchestration, testing gates, frontend/backend workflows — beta v1 terminology; continental US bounds
- Agents: web-frontend, web-backend, testing-cicd, database-codegen, senior-auditor
- Hooks: session context, prompt routing, explore handoff; `AGENTS.md` trust boundaries

**Evidence:** governance/docs only.

---

### 2026-06-08 — E2E copy alignment (beta v1)

**Theme:** Playwright spec matches live hero and trust explainer copy.

**Shipped:**
- `e2e/mvp-flow.spec.ts`: hero `Yum4Less · Beta v1`; trust modal Walmart/Food Lion wording; describe block renamed

**Evidence:** `npm test` 300/300; `npm run test:e2e:ci` **4/4**.

---

### 2026-06-08 — AGENTS.md cleanup (doc ownership split)

**Theme:** Lean agent/MCP index; drop historical refactor table and duplicate orchestration prose.

**Shipped:**
- AGENTS.md ~149 → ~130 lines: slice router, MCP setup, Playwright checklist, hooks/scoped rules
- Removed production-lean phase table, long open-gaps paragraph (→ continuity Resume)
- Deduplicated minimum verification / continuity lists (→ orchestration + continuity rules)
- Playwright checklist hero copy → `Yum4Less · Beta v1`

**Evidence:** docs only.

---

### 2026-06-08 — README cleanup (doc ownership split)

**Theme:** Slim README to onboarding + setup; move history/status to continuity.

**Shipped:**
- README ~830 → ~200 lines: quick start, env, commands, security, troubleshooting
- Removed duplicate Development Status, roadmap, competitive section, file inventory, full MCP walkthrough
- Fixed stale copy (continental US scope, v1 Kroger+Aldi, test counts → pointer to continuity)
- MCP/agent setup → `AGENTS.md` only; live ingest baseline → continuity appendix

**Evidence:** docs only.

---

### 2026-06-08 — Continuity journal automation (hooks, rules, agents)

**Theme:** Enforce per-slice `PROJECT_CONTINUITY.md` updates without transcript dumps.

**Shipped:**
- `.cursor/rules/yum4less-continuity-journal.mdc` — scoped journal format + slice checklist
- `yum4less-governance-and-doc-sync.mdc` — doc owners table; continuity vs README split
- `yum4less-agent-orchestration.mdc` — step 4 before done + trigger-table row
- Hooks: session context, afterFileEdit nudge, stop-turn continuity reminder
- `AGENTS.md` continuity section; `@verifier` + `@testing-cicd-standards` continuity rules

**Evidence:** governance/docs only; no test run this slice.

---

### 2026-06-08 — Documentation + beta v1 implementation (Phase 0)

**Theme:** Reorganize continuity doc; ship continental US + Tier C + Kroger/Aldi v1 path.

**Shipped:**
- `PROJECT_CONTINUITY.md` restructured (this file); full prior version backed up to `.private/`
- `us-service-area.ts` — continental US bounds (replaced MVP 35 mi fence)
- `store-catalog-sync.ts` — upsert Kroger API + per-ZIP Aldi stores on market search
- Aldi unlocked for weekly-ad promotion gates; Kroger-family banner inference (Harris Teeter, Ralphs, etc.)
- `sync-provider-prices.ts` — multi-ZIP via `YUM4LESS_INGEST_ZIPS`
- `recommendation-demo/` → `meal-planner/` (`MealPlanner`, `use-meal-planner.ts`)
- Tier C UX: honest blocked-state copy; rank button disabled without recommendation-ready stores
- Hero/trust copy: beta v1, Kroger + Aldi, coverage varies by ZIP

**Decisions locked:** homelab target (migrate later); v1 = beta; no login; Walmart out of v1 scope.

**Evidence:** `npm test` 300/300; `npm run build` OK.

---

### 2026-06-05 — Verification sync + doc alignment

**Theme:** Test counts, CI evidence, README/continuity sync.

**Shipped:**
- Documented merge gates (E2E 4/4, integration, ranking fixtures, setup:local)
- Remote CI green on GitHub Actions
- Test baseline recorded: 295 unit + 8 integration (superseded by 2026-06-08 count)

---

### 2026-06-04 — Phase 0 planning (production decisions v2)

**Theme:** Move beyond local MVP toward beta v1 without homelab deploy yet.

**Decisions (later implemented 2026-06-08):**
- Continental US entry; Tier C as default success state
- v1 chains: Kroger family + Aldi only; Walmart deferred
- Self-hosted homelab when migration-ready; exposure TBD

---

### 2026-05 (late) — UI cleanup, security hardening, code health

**Theme:** User-facing UI slim-down; public API hardening; live ingest baseline recorded.

**Shipped:**
- Internal diagnostics → **Project & data details** modal (env-gated); trust modal shortened
- Public API read-only default; `public-api-response-sanitizer`; shopping-route caps
- Browser location validation aligned with market-search; Leaflet load fix (no broken dynamic import)
- Kroger Flipp fallback; Walmart Flipp fetch; Publix browser scrape (hundreds of offers when HTML renders)
- `recommendation-service.ts` rename; split UI into panel components; weekly-ad fetch helpers unified
- Rate limits on public routes; `npm audit --audit-level=high` in CI
- Removed committed GitHub PAT from tracked MCP config; `.cursor/mcp.json.example`

**Live ingest baseline (ZIP 23111, user-run):** Publix 655 parsed / 21 synced; Kroger 122 Flipp / 4 synced; Walmart 143 / 0 synced; Aldi 149 / 6 synced; Food Lion 137 / 20 synced.

**Limits:** Live ingest still not demo-reliable; fixture ingest remains local trust path.

**Evidence:** Security audit (no classic SQLi/IDOR); unit tests 110→119 over session.

---

### 2026-05 (mid) — MCP, weekly-ad gates, integration CI

**Theme:** Agent tooling + promotion gates + Postgres integration job.

**Shipped:**
- Postgres, GitHub (Docker), Playwright MCP in project config; rules/agents updated
- `weekly-ad-coverage.ts`, `weekly-ad-promotion-readiness.ts`, dynamic `weekly-ad-preview` rollout
- Integration test: fixture ingest → Postgres → promotion gates
- CI `integration` job with Docker Postgres
- Playwright browser fallback for weekly-ad ingest scripts; ingest env flags
- Recipe source research registry (internal library active only)

**Limits:** First live ingest run returned 0 offers for all chains before hardening; fixture path documented as valid MVP.

---

### 2026-04 / 2026-05 (early) — Autonomous MVP build slices

**Theme:** Runnable app from scaffold through provider rollout and map.

**Shipped:**
- Next.js + TypeScript + Postgres schema/seed; location-first UI
- Geocodio + seed ZIP fallback; market-search and recommendations API routes
- Kroger provider adapter (store discovery, pricing preview, snapshots)
- Publix/Walmart provider stubs with honest not-configured messaging
- Provider promotion-readiness gates; seed-vs-provider directional comparisons on cards
- Leaflet map; sale-confidence labels; results carousel
- Vitest harness (routes, ranking, trust copy, UI smoke)
- Playwright E2E CI gate (`e2e/mvp-flow.spec.ts`)

**Limits:** Ranked pricing from ingested/fixture data only; provider preview separate from ranked totals.

---

### 2026-03 — Project definition and Cursor setup

**Theme:** Name the product; define MVP loop; scaffold governance.

**Shipped:**
- Product: affordable **dinner** planning from nearby store sales + budget/ingredient constraints
- Stack direction: Next.js, TypeScript, Postgres, Leaflet, npm
- Competitive positioning vs sale/meal-plan apps (Saverly, Jow, Flipp, etc.)
- `.cursor` rules, agents, hooks; `AGENTS.md` index
- Initial focus: local demo around ZIP **23111**, no login, trust/fallback as product features

---

## Decision log

| Date | Decision | Status |
|------|----------|--------|
| 2026-06-15 | **M5 / Slice 4B:** Publix + Food Lion weekly-ad ingest/fixture gates remain for CI rehearsal; **shopper-facing ranked meal totals = Kroger family + Aldi only** (`MEAL_PRICING_COMING_LATER_CHAINS`) | **Active** (supersedes 2026-06-10 Slice 4B ranked shopper scope) |
| 2026-06-11 | **Map search:** Merge provider discovery + ephemeral OSM (24h cache, sparse-pin threshold) into map pins on `/api/market-search`; **no Postgres writes** on public read path | **Active** |
| 2026-06-11 | **UX:** Ingredient-first-only in UI; `planningMode: standard` retained for API/tests only; Step 2 defaults `dinnersWanted=3`, `maxIngredients=20` server-side | **Active** |
| 2026-06-10 | **Phase 2A:** Owner daily path = live `ingest:weekly-ads:scheduled`; fixture ingest CI/rehearsal only | **Active** |
| 2026-06-10 | **Phase 2B:** Live map-catalog ingest overwrites bootstrap seed coordinates for ranked chains when official discovery succeeds; seed SQL bootstrap-only | **Active** |
| 2026-06-10 | **Slice 3:** TheMealDB on opt-in search is cache-first (Postgres); bounded refresh when imports stale/empty (24h TTL, 5 meals/run on search) — separate from provider price cache-only discipline | **Active** |
| 2026-06-10 | **Slice 3:** TheMealDB cards require visible attribution (source name + meal link); trust labels remain estimated/directional | **Active** |
| 2026-06-10 | **Slice 2:** Ingredient-first is default UX; internal library ranks without opt-in; TheMealDB requires explicit shopper opt-in + API flag | **Active** |
| ~~2026-06-10~~ | ~~**Slice 2:** “Rank full dinner options” kept as Advanced alternate path (not removed)~~ | **Superseded** (2026-06-11: removed from UI; API `standard` for tests only) |
| 2026-06-10 | **Slice 4B:** Publix + Food Lion weekly-ad promotion gates enabled when coverage passes; Walmart ranked pricing remains deferred | **Superseded** (2026-06-15: fixture/CI rehearsal only; not production-ranked shopper path) |
| 2026-06-10 | **Slice 4A:** `ingest:map-catalog` upserts OSM map-context rows + chain locators on scheduled ingest only | **Active** |
| 2026-06-10 | Catalog upserts for **map context** allowed on **daily cron only** (not user search) | **Active** |
| 2026-06-10 | OSM Overpass + chain locators as discovery sources; OSM attribution required on map | **Active** |
| 2026-06-09 | Public internet beta target; homelab/DNS/TLS deferred until owner satisfied | **Active** |
| 2026-06-09 | 24h cache TTL on ranked reads; no live refresh on user search | **Active** |
| 2026-06-09 | Daily scheduled ingest (`ingest:weekly-ads:scheduled`) is the write path | **Active** |
| ~~2026-06-09~~ | ~~Do not auto-upsert detected stores on search until post beta/v1~~ | **Superseded** (2026-06-10: cron map-catalog upserts OK; user-search upserts still off) |
| 2026-06-09 | Near-term ranked chains: Kroger family, Aldi, Publix, Food Lion (Walmart deferred) | **Active** |
| 2026-06 | Beta v1 = continental US entry + Tier C default | **Active** |
| 2026-06 | v1 ranked chains: Kroger family + Aldi only | **Active** |
| 2026-06 | Walmart ranked pricing deferred | **Active** |
| 2026-06 | Homelab hosting; deploy when migration-ready | **Active** |
| 2026-06 | v1 = beta; keep estimate/directional/verify-in-store wording | **Active** |
| 2026-06 | No user accounts in v1 | **Active** |
| 2026-05 | Public API DB writes opt-in only; blocked in production | **Active** |
| 2026-05 | Fixture ingest = CI/rehearsal only; owner path = daily live scheduled ingest | **Active** (supersedes fixture-first demo wording) |
| 2026-05 | Internal recipe library only for rankings | **Active** |
| 2026-03 | Official APIs first; careful scraping only with terms review | **Active** |
| 2026-03 | Personalized teaching → `.private/learning-notes.md` only | **Active** |
| ~~2026-03~~ | ~~Hard limit MVP to ~35 mi from ZIP 23111~~ | **Superseded** (2026-06 continental US) |
| ~~2026-05~~ | ~~Near-term priority: Walmart matching for v1~~ | **Superseded** (2026-06 Walmart deferred) |

---

## Appendix

### Verification snapshot

| Gate | Last verified | Result |
|------|---------------|--------|
| `npm test` | 2026-06-15 | 459 tests, 101 files |
| `npm run build` | 2026-06-15 | OK |
| `npm run test:integration` | 2026-06-15 | 24 tests, 7 files |
| `npm run test:e2e:ci` | 2026-06-15 | 4/4 |
| Postgres (`provider_search_terms` kroger) | 2026-06-15 | 101 rows |
| Playwright MCP (localhost) | 2026-06-15 | Not run (`test:e2e:ci` used instead) |
| Semgrep MCP / hook | 2026-06-15 | Not re-run this slice |
| Remote CI | 2026-06-11 | Green on master — M/L slice not yet pushed |

**Local demo:** `npm run db:up` → `ingest:weekly-ads:fixture` → `ingest:map-catalog:fixture` → `npm run build` → `npm run start` (ZIP `23111`).

**Optional probes (not merge gates):** `npm run test:kroger-api`, `npm run test:publix-live-ingest`, live weekly-ad scripts.

### Live weekly-ad baseline (last measured 2026-05, ZIP 23111)

| Chain | Live result | Notes |
|-------|-------------|-------|
| Publix | 655 parsed, 21 synced | Browser + HTML parser |
| Kroger | 122 Flipp, 4 synced | Direct scrape often 0 |
| Walmart | 143 Flipp, **0 synced** | Matching gap |
| Aldi | 149 Flipp, 6 synced | Flipp primary path |
| Food Lion | 137 Flipp, 20 synced | HTTP often 403 |
| Lidl / DG | Stub | Not wired |

**Trusted local path:** `npm run ingest:weekly-ads:fixture` → Postgres → promotion gates.

### Deferred backlog (not v1)

| Item | Why later |
|------|-----------|
| Homelab deploy + exposure | After migration-ready checklist |
| Walmart ranked pricing | Shopper API + Flipp matching work |
| Publix ranked (v1 scope) | Regional; not in Phase 0 v1 chains |
| Food Lion, BJ's, Lidl, DG | Regional or stub ingest |
| Spoonacular / Edamam rankings | License + alignment gates |
| Redis / platform rate limits | Multi-instance production |
| User accounts | Explicitly out of v1 |

### Transcript index

Full chat prose lives in agent transcripts; use these links for deep context.

| When | Topic | Transcript |
|------|-------|------------|
| 2026-03 | MVP planning, stack, competitors, Cursor setup | [Yum4Less MVP planning](0e5bcef8-54ed-4c87-b5a6-1b4423cc1d08) |
| 2026-04/05 | Autonomous MVP slices, providers, map | [Autonomous MVP build slices](40f83ef1-d284-41d5-8f4f-7f7ade1daa2f) |
| 2026-05 | MCP, weekly-ad gates, integration CI | [MCP setup MVP completion](8145bf83-1d8c-4b90-9431-990a72d04817) |
| 2026-05 | UI cleanup, security, live ingest | [UI cleanup MVP gaps](18194906-4795-46c3-b3bd-7ba257b5db93) |
| 2026-06 | Phase 0 beta v1 + continuity journal automation | [Phase 0 and continuity hooks](ec7ad734-c4f5-4cda-b131-6c28a0f98262) |
| 2026-06-11 | Deploy-readiness audit + Kroger/Aldi doc/trust/security/E2E slices | [Deploy-readiness audit slices](ad4a04bf-68c6-4e8e-b1f8-bded8f60e22a) |

### How to update this file

Follow **`.cursor/rules/yum4less-continuity-journal.mdc`** and **`.cursor/rules/yum4less-governance-and-doc-sync.mdc`**. Compare against the repo before claiming “shipped”; this file is a journal, not immutable truth.
