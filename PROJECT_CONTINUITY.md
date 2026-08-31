# Yum4Less — Project continuity

> **Linear history + current snapshot.** Setup and commands → [`README.md`](README.md). Agents, MCP, hooks → [`AGENTS.md`](AGENTS.md). Full pre-reorg copy (last committed before this restructure) → [`.private/PROJECT_CONTINUITY.backup-2026-06-08.md`](.private/PROJECT_CONTINUITY.backup-2026-06-08.md) (gitignored).

---

## Resume (as of 2026-08-31)

**Owner lock:** Membership cutover **shipped in code** — `chain_registry` drives who we *attempt* for dinners / fail-loud ingest; **floors stay in code**. Thin sale coverage ⇒ pin stays tracked, dinners stay off. Banner grain later via **shared adapter keys**. Owner Check brand lists stay research. Live yum4less.com waits Watchtower.

> **Single source of truth:** This **Resume** section (especially **Verified** and **Production-ranked focus**) is the canonical place for current chain status, test counts, and what is shipped. **Working today**, **Deferred backlog**, and **Changelog** are historical or narrower context — do **not** restate status claims or numbers that could drift; link here instead (e.g. “see Resume for current status” or [Verification snapshot](#verification-snapshot) for gate tables).

**Phase:** Redesign **slices 1–5**, shell **D1–D7**, and post-audit hardening **Sprints A–E** **shipped**. **Onboarding wizard setup UI** is on **`master`** (splash → GPS or ZIP+pin → 6-tab shell). Settings-first shopper UI is rollback-only at **`backup/settings-ui-plus-catalog`** (`38bad3a`). Section H visual restyle of Home/Deals/Cook/Saved and Q34/Q35 remain out of scope. **DB migration ledger (backlog #3) CLOSED** (2026-07-09). **Store-ID integrity bundle (#14–15) CLOSED** (2026-07-09). **Coverage ingest slices 2–5 CLOSED** (2026-07-09). **Chain coverage honesty (#13 + #16) CLOSED** (2026-07-09). **Publix weekly-ad ingest exclusion (0/97) CLOSED** (2026-07-09) — **`c18f99e`**. **Geolocation denial asymmetry (P1-3) CLOSED** (2026-07-10) — **`295daee`**. **Option A Slice 1–4 CLOSED** (2026-07-10). **Option A Slice 5 (5a/5b/5c) CLOSED** (2026-07-11). **Option A Slice 6 CLOSED** (2026-07-11) — identity source onboarding checklist + Dollar Tree dry-run appendix. Master + `NEXT_PUBLIC_` expand flags and `AUTO_CONFIRM` still **OFF** by default. **Tier 1 Pass 1–7 CLOSED** (2026-07-15/16). **022/023 vacuous probe CLOSED** (2026-07-16). **`yum4less_dev` Kroger identity live repair CLOSED** (2026-07-16) — manual data heal, not a code change. **Wave 0 Home Ingredients market blank hole CLOSED** (2026-07-16). **Wave 1 CI-trust-tax CLOSED** (2026-07-16) — **1a** rank-wait/ZIP 409, **1b** overlay mobile false-sync, **1c** Scale risk C portal rule docs. **Wave 2 Part 1 Aldi `023` heal CLOSED** (2026-07-16). **Wave 2 Part 2 Phase 0 Q1–Q3 locked** (2026-07-16) — Q1 map-align code **not started**. **Backlog #5 (`tsc` bucket) CLOSED** (2026-07-09). **Tier 2 comprehensive audit CLOSED (audit-only)** (2026-07-16) — see [`docs/audits/tier2-comprehensive-audit-report.md`](docs/audits/tier2-comprehensive-audit-report.md). **Tier 2 SS-1 CLOSED** (2026-07-16) — Postgres compose bind loopback-only + `check:compose-db-bind` CI gate. **Vision-gap + UI stub sweep CLOSED (investigation checkpoint)** (2026-07-17). **Vision-gap sprint items 1–6 CLOSED** (2026-07-20) — External API Integration Standard; exact-coord privacy; geo-only Settings completion; nav finish-setup hints; Cook honest empty + rank invalidation; confidence-flexed price wording (`directional-provider-match` → Low). CI [**29770945822**](https://github.com/sfh1980/Yum4Less/actions/runs/29770945822) @ `adf0a62`. P1-ops freshness (`fresh_24h=0` on `yum4less_dev`) remains **open** (ops).

**Homelab prep:** Convergence verdict → [`docs/audits/homelab-readiness-verdict.md`](docs/audits/homelab-readiness-verdict.md) — **READY WITH CONDITIONS**; **OPEN-BLOCKS empty**. **App containerized (2026-07-20):** multi-stage `Dockerfile` + Compose `app` + `db`. **GHCR published (2026-07-24):** `yum4less-app` + `yum4less-ingest` — SHA **`54e7b60`** + `:homelab` + `:latest` ([CI **30104150018**](https://github.com/sfh1980/Yum4Less/actions/runs/30104150018)). **TrueNAS Apps `app`+`db` CLOSED (2026-07-22)**; **Ingest + Watchtower CLOSED (2026-07-26)**. **Cloudflare Tunnel WAN CLOSED (2026-08-03/04)** — `https://yum4less.com/` via `cloudflared` Custom App + tunnel `truenas-homelab`; app `TRUST_PROXY_*` set; feedback + analytics (postgres sink) enabled on box. **Shopper UI copy trim (2026-08-04)** — feedback analytics panel + public feed removed; trust expand shortened; CI bakes `NEXT_PUBLIC_YUM4LESS_ANALYTICS=1` into published app images. **ZIP search-center picker + Settings button order (2026-08-04)** — GPS left / ZIP Find right; ZIP path opens map pin confirm before search. **Owner console (`/owner`, 2026-08-06; pagination 2026-08-10; ingredient review 2026-08-22; create-id 2026-08-24; tabs 2026-08-25; Coverage 2026-08-26; Markets 2026-08-27)** — key-gated **Ingredient review**, **User feedback**, **Analytics**, **Coverage**, and **Markets** tabs (Yes can **create** a kebab-case food id with name + category, or map to an existing id). Coverage is read-only over `store_coverage` (search name, city/state, usable-in-app). Markets: type a 5-digit ZIP, Check (preview), Activate into `active_markets`. **`025` and `026` are applied** on TrueNAS (2026-08-27 00:04Z). **`027` (Lidl) and `028` (Walmart) applied** during the **2026-08-28 07:00Z** scheduled ingest migrate (`applied_at` 07:00:02 / 07:00:03Z). **`029` is on live** (worker drain **2026-08-30** used `ingest_jobs` + 9 mi fence). Watchtower still does **not** migrate by itself. **First live `ingest:worker` drain CLOSED (manual, 2026-08-30).** **Unattended worker night CLOSED (2026-08-31):** 3am enqueued 6 jobs; Cron Job drained them **07:01–07:09Z**, all `succeeded`. Extra ZIP **`23220`** owner-Activated 2026-08-31 (first ingest tonight). **Settings grocery-pin picker** shipped locally (Whole Foods/Target/clubs selectable when in search; no new adapters; estimates still floored). Live yum4less.com waits Watchtower. Runbook → [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10.2.1. Weekly-ad ingest **fail-soft** for Dollar General only; shopper-ranked banners (including Walmart) stay fail-loud. Runbook → [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §8–§12. **Unattended 3am cron two-night proof CLOSED** (owner paste-back **2026-08-29**): **2026-08-28T07:07:42Z** and **2026-08-29T07:07:38Z** both `Scheduled pricing ingest completed.` with `[freshness] OK`. Overlay unset. **Backup/restore drill CLOSED (2026-08-31):** host dump → `yum4less_backup_drill` counts **276/324/29** matched; drill DB dropped. Compose local still **`127.0.0.1:3000`** / **`127.0.0.1:5433`** (SS-1).

**Provider integration pattern:** Reusable three-category model (store location / item pricing / sale discovery), per-source capability table, and new-chain audit checklist → [`docs/provider-integration-pattern.md`](docs/provider-integration-pattern.md). Kroger worked example → [`docs/audits/kroger-data-path-audit-2026-06-26.md`](docs/audits/kroger-data-path-audit-2026-06-26.md). Store-identity onboarding (Slice 6) → [`docs/store-identity-source-onboarding.md`](docs/store-identity-source-onboarding.md).

**Hosting:** Self-hosted TrueNAS SCALE — **Custom App `yum4less` (`db`+`app`+`ingest`) healthy**; **Watchtower** sibling up; **Cloudflare Tunnel** live at **`https://yum4less.com/`** (LAN `:3000` remains). Images on **`:homelab`**. Wizard shopper UI is on **`master`**. Market-admission ingest image is on the box (worker drain 2026-08-30). Rollback: **`backup/settings-ui-plus-catalog`** (`38bad3a`, Settings-first + catalog) or older **`backup/pre-catalog-expansion-live`** / **`:800c450`**. Watchtower still does **not** migrate by itself. Live ledger includes **`024`** (`applied_at` **2026-08-24 07:00:02Z**), **`025`/`026`** (**2026-08-27 00:04:01Z**), **`027`/`028`** (**2026-08-28 07:00:02–03Z**), and **`029`** (proven by `ingest_jobs` drain 2026-08-30). Future `db/init` files still need ingest migrate or `npm run db:migrate`.

**Production-ranked focus:** **Kroger-family banners, Aldi, Publix, Food Lion, Lidl, and Walmart** when daily ingest and promotion gates pass. Same floors for every ranked banner. Missing estimates stay map context with an honest reason — not a permanent block. BJ's and other unsupported chains: map/context only.

**Owner ingest path:** `npm run setup:local` / `ingest:weekly-ads:scheduled` runs **map-catalog → weekly-ad → provider sync → TheMealDB** when `GEOCODIO_API_KEY` + Kroger credentials set. Fixture ingest requires `CI=true`, Vitest (`NODE_ENV=test`), or aligned `DATABASE_URL` + `DATABASE_URL_TEST`. Map-catalog fixtures write `fixture-osm-*` / `yum4less-map-fixture` only — never live Overpass identity.

**Nationwide de-hardcoding:** **A** (no silent `23111`), **B1** (`active_markets` + `zip_geocode_cache` / `025`), **B2** (`chain_registry` + `store_coverage` + `/owner` Coverage / `026`), **C** (`/owner` Markets ZIP check + activate), and **membership DB-wins** (shopper estimates + ingest fail-loud read `chain_registry.shopper_ranked`) are **current** in repo. **Market admission is on live** (owner paste-back **2026-08-30**): 9 mi fence ∩ ZIP outline, one flyer per banner, content-hash skip, `ingest:worker` drained 6 jobs. Plan → [`docs/audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md`](docs/audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md). Expansion is more owner-activated ZIPs. **Owner-chosen ranked ingest anchor is ZIP `23111`** (explicit `active_markets` row — not a code default). Ranked dinners still only where Kroger-family banners, Aldi, Publix, Food Lion, Lidl, or Walmart exist **and** weekly-ad promotion gates pass. Weekly-ad ingest **fail-soft** on Dollar General flyer errors; those six ranked banners stay fail-loud. Chain go/no-go stays later (free Flipp/OSM/scrape only; trial and error). CI asserts every `shopper_ranked` row has a known dinner adapter (not that TypeScript equals the table). **Live ingest overlay is off**. Cron visits **1 ZIP** from `active_markets` (`23111`, `source=ops`). Extra ZIP **`23220`** is next (`/owner` Check + Activate). Keep the TrueNAS worker Cron Job Enabled while 3am only enqueues.

**Geocoding:** `NODE_ENV=production` without `CI` requires `GEOCODIO_API_KEY`; seed ZIP fallback disabled. `npm run dev` and CI/e2e runners may still use seed ZIPs when the key is absent **and the shopper types one of those ZIPs**. The wizard does **not** prefill `23111`. Scheduled ingest reads **`active_markets`** when `YUM4LESS_INGEST_ZIPS` is unset (empty table fails closed). Env ZIP list remains a debug overlay. `zip_geocode_cache` is filled by ingest, not by public geocode GET.

**Verified (2026-07-11 Slice 5c evidence — historical):** Option A Slice **5c CLOSED**. At that time: unit **978/978**, integration **46/46**, build pass, typecheck **0**, e2e **25/1 skip**. Remote CI later green on **`812d6b7`** ([**29173497984**](https://github.com/sfh1980/Yum4Less/actions/runs/29173497984)). Master expand + `AUTO_CONFIRM` **OFF**.

**Tier 1 re-run (2026-07-15 @ `812d6b7` — not full verified):** unit **978/978**, typecheck **0**, build OK; integration **45/46** (ledger timeout); e2e **24/1 fail/1 skip** (Publix Settings miss). See [`docs/audits/tier1-foundation-hardening-report.md`](docs/audits/tier1-foundation-hardening-report.md). Do **not** treat 2026-07-11 Verified counts as current local gate truth.

> **Changelog history:** Older entries below are point-in-time agent notes (e.g. a missing key on a past date). Check `.env.local` and the repo for current truth.

### Working today (honest)

- **Market admission (unattended worker 2026-08-31):** Shopper wizard is still GPS pin or ZIP → map pin. Live ZIP `23111` ingest uses **9 mi ∩ ZIP outline**, one flyer per banner, then fan-out. Hash skip can leave weekly-ad `observed_at` from Sunday. Unattended Cron Job drain **07:01–07:09Z** (6 jobs, all `succeeded`); Sunday hand drain **19:50–19:58Z**. Freshness **324/324** (fence, not a failed night). No Lidl flyer this ZIP. TheMealDB still logs **dev test key**. Do **not** claim more dinners. Extra ZIP `23220` is next. **Keep the Cron Job Enabled.**
- **Owner Markets Check ZIP locality (2026-08-29):** Check overlays ingested catalog pins, lists ranked banners first, and shows OSM pins without address tags as **near** the ZIP city (not `Unknown`). Not a street-address geocode. Live ingest matches against Postgres `ingredients` (97-id `internal-catalog.ts` remains seed/fallback and fixture SSOT). Unmatched flyer lines skip, auto-create simple foods, or queue on private `/owner` for Yes (nickname) / No (skip). Junk skip SSOT is `isWeeklyAdJunkProduct` for all chains; classify skips junk before fuzzy match; price persist will not write junk titles. Flipp persist prefers grocery-tagged flyers. **Local `yum4less_dev` after junk heal (2026-08-25):** pending `/owner` reviews **743 → 619**; junk skips **112 → 236**. Live Flipp probe (same day, no persist): Walmart 144 offers → 113 junk / 6 grocery matches. **TrueNAS live volume (owner paste-back 2026-08-29, ~8.4h after 3am):** `027`+`028` applied. `ingredients` **472** (TheMealDB **299** / internal **97** / weekly-ad-catalog **76**); pending reviews **696**; weekly-ad aliases **90**; skips **742**; recipes **329** (TheMealDB **323**). Ranked in-stock freshness **680/681** in 24h: Kroger API **97** foods (96 fresh); Publix ad **104**; Food Lion ad **275** rows / **55** foods; Kroger ad **129** / **35**; Aldi ad **58** / **29**; Walmart ad **18** / **9**. No `lidl-weekly-ad-scrape` rows this market. App/ingest `:homelab` Up **41h** (created **2026-08-27T22:55Z**). Shopper pantry leftovers stay **1–4**. Do **not** claim more dinners. Local and live catalogs are **not** the same size.
- **Pipeline debug:** local-only `GET /api/debug/pipeline?zip=23111` or `?lat=&lng=` with `YUM4LESS_DEBUG_ROUTES_ENABLED=1` **and** `YUM4LESS_DEBUG_ADMIN_KEY` (`Authorization: Bearer` or `X-Yum4Less-Admin-Key`) — stores, ranked observations, 24h freshness, missing tracked ingredients (404 in production; 401 without key)
- **Phase B price/store alignment:** `resolveInternalKrogerStoreId` maps locationId via `source_store_id` / canonical `kroger-{locationId}` / name heuristics — **no** single-store guess fallback (H8); ingest prefers catalog `source_store_id` for Kroger weekly-ad URLs; `sync:provider-prices` resolves nearest Kroger-family numeric `locationId` via `resolvePreferredKrogerLocationIdForZip` (Postgres + haversine; optional `KROGER_LOCATION_ID` escape hatch) and logs `skip_reason`
- **Phase C location trust:** `store-location-reconciliation` — ranked coord updates need agreeing witnesses (Kroger API + Geocodio address; optional USDA SNAP corroboration); change-only when delta ≥ `YUM4LESS_LOCATION_CHANGE_THRESHOLD_METERS` (default 50); single provider witness still promotes bootstrap → API
- **Coordinate sanity audit path:** `coordinate-sanity-check.ts` now reports `flagReasons[]` (including dual-flag rows like `unknown_city_state` + `coordinate_delta`), `scripts/audit-food-lion-coordinates.mjs` buckets correction-candidate vs metadata-only vs manual-review rows and supports `--ids=...`, rollout policy keeps Food Lion/Lidl as coordinate-audit-required, and the verified `food-lion-mechanicsville` pin is corrected in dev + CI/fixture bootstrap data
- **Coordinate sanity exceptions:** the two 2026-07-03 withheld Food Lion rows (`osm-node-3103220732`, `osm-node-6527816794`) now live in `COORDINATE_SANITY_EXCEPTIONS`, so storefront-vs-road-geometry decisions persist across future audit reruns
- **Phase C map context:** `discoverMapContextStores` unifies OSM + optional USDA SNAP (`YUM4LESS_MAP_SNAP_CONTEXT=1`); `snap_retailer_locations` reference table + `npm run ingest:snap-retailers`; SNAP pins labeled `SNAP context pin` — not ranked pricing
- **Phase D ingest breadth:** Kroger Location API returns **Kroger-family** stores (limit `YUM4LESS_KROGER_LOCATION_SEARCH_LIMIT`, max 50) with multi-store catalog upsert; Aldi bootstrap refresh uses **nearest OSM Aldi** (never ZIP centroid); provider snapshot cache matches by **ZIP primary** with coord tolerance; Publix locator sync upserts `publix-{storeNumber}` rows and **retires legacy `publix-atlee`** on map-catalog ingest; `sync:provider-prices` passes OSM discovery for Aldi parity
- **Phase A map truth:** Postgres/provider ranked pins beat OSM/SNAP context on merge (`kroger-official-api` priority 5; ranked-chain dedupe ~1.5 mi); `YUM4LESS_MAP_OSM_RANKED_CHAIN_POLICY=suppress-conflicts` (default) drops context Kroger/Aldi when ingested catalog covers chain; map/list badges (`Seed catalog pin`, `Verified store pin`, `Map context pin`, `Rehearsal map pin`, `SNAP`/`directory context`, `Saved store pin`); fixture-mode `mapDiscoveryNotice` says rehearsal / not live OpenStreetMap
- **Map search merge (Rec 1–2):** `/api/market-search` merges provider-discovered stores into map pins; ephemeral map-context discovery (OSM ± SNAP) when **per-chain Postgres gaps** exist (ranked v1 chain &lt; **2** pins, or context-only catalog chain / Costco / Sam's at **0** pins within radius), 24h OSM cache, degraded copy on failure — **no Postgres writes** on public read path
- **Unknown location metadata treatment:** store labels now render **`Approximate location`** when city/state metadata is the literal `Unknown`, instead of surfacing raw sentinel text or pretending the locality is verified
- **Search-time OSM performance:** `/api/market-search` returns saved catalog stores first; search-time OSM gap-fill now waits at most **3s** on the critical path, logs deferrals, and lets the in-memory cache finish warming in the background for later requests; committed CI coverage in `e2e/coordinate-first-cold.spec.ts` keeps a true cold geolocation path in the suite
- **OSM lifecycle:** disused/abandoned/closed elements filtered from Overpass parse
- **Daily map-catalog cron preserved:** `npm run ingest:map-catalog` / scheduled wrapper still warms Postgres catalog; search-time OSM complements cron for arbitrary ZIPs
- **OSM parser:** `brand` → `operator` → `name` priority; Food Lion–like elements without `name` tag map to `food-lion` chain context
- **Phase 2B:** Live map-catalog ingest refreshes bootstrap ranked-chain coordinates (`refreshBootstrapRankedStoreCoordinates`); map tooltips cite ingest source + last verified; seed SQL documented as bootstrap-only
- **Phase 2C:** Bootstrap coord refresh runs after weekly-ad ingest (`*-weekly-ad-scrape` source rows eligible); duplicate `kroger-{locationId}` catalog rows skipped when bootstrap seed exists; live scheduled ingest env guards; OSM Overpass fallback + non-fatal map-catalog failures; daily refresh empty/stale copy (`RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE`); homelab/Task Scheduler cron examples in `.env.example`
- **24-hour ranked-read cache:** `price_observations` older than 24h excluded from rankings; provider snapshots default to same TTL
- **Cache-only public APIs:** `/api/recommendations` does not call live Kroger APIs or sync prices on user search; `/api/market-search` may call Overpass ephemerally (no Postgres writes) when map pins are sparse
- **Universal map catalog (Slice 4A):** `npm run ingest:map-catalog` (+ fixture variant) discovers food retail via OSM Overpass + chain locators; upserts map-context `stores` rows on **cron only**; OSM attribution when OSM pins visible
- **Publix + Food Lion + Lidl + Walmart gates:** weekly-ad promotion gates for shopper-ranked v1 chains; **production-ranked when ingest and promotion gates pass** (same path as Kroger-family and Aldi weekly-ad rollout). Lidl still requires coordinate-sanity audit evidence before expanding rollout claims.
- **Daily ingest path:** `npm run ingest:weekly-ads:scheduled` (+ fixture rehearsal variant) runs **map-catalog before weekly-ad**, then provider sync + TheMealDB
- **Weekly-ad chain status:** Aldi, Food Lion, Lidl, and Walmart remain Flipp-first; Publix scrape stays primary with Flipp supplemental ingredient backfill. Those banners are Settings-selectable and can rank when weekly-ad promotion gates pass. Thin Flipp or scrape misses stay map context with an honest reason.
- **Store scope:** shopping style + store picker (single/multi); unselected stores hidden from map, ingredients, and rank; prefs persisted in localStorage (`setupComplete` marker — slice 5 routes on this)
- **Recipe ranking:** TheMealDB dinners with a numeric meal-page id and enough sale overlap; short internal-library writeups stay in the catalog but are **not** ranked
- **TheMealDB on search:** ranking reads Postgres imports cache-first; **search-time refresh removed** — cron/script only (`npm run ingest:themealdb:from-sales`); scheduled-refresh notice when imports stale/empty; full-recipe link on cards when `source_recipe_id` is numeric
- **Ingredient row trust (D/E):** `Est.` / directional labels; `Prices from ~N hours ago` on ingredient rows **and meal cards** when metadata present; honest empty state (daily scheduled refresh, not live on search)
- **Redesign UX (slices 1–5 + D1–D7 + onboarding wizard on `master`):** sequential setup (splash → GPS or ZIP+pin → radius → shopping style → stores → budget → dietary → ingredients → pantry → rank). **How do you shop?** and **Dietary focus** advance as soon as a choice is tapped (no Continue). **6-tab shell** (Home, Deals, Cook, Saved, **Feedback**, Settings). Locked Home/Deals/Cook/Saved tabs are tappable message pages until setup. After `setupComplete`, Settings reuses the same wizard screens. Theme is a chrome moon/sun toggle (light↔dark). Home/Deals/Cook/Saved **content restyle (Section H)** is not in this slice. **Stacked accordion** results; TheMealDB-only ranking with full recipe links; no `dinnersWanted` cap.
- **Settings store dropdown:** grocery and food-capable pins in radius (`filterSettingsSelectableStores`) — omit convenience/bakery/pharmacy/mini-mart and map fixtures; **not** limited to Kroger/Aldi/Publix/Food Lion/Lidl/Walmart. Unranked selections stay map/context (rollout note); dinner estimates still require promotion floors. Prefers non-OSM catalog rows; **excludes `fixture-osm-*` / legacy `osm-node-90000*`**; live OSM kept only when no same-key catalog pin within 1.5 mi; **same-chain collocated catalog twins collapsed** via `collapseSameChainCollocatedCatalogStores` (0.05 mi default; Kroger 0.15 mi exception); auto market search on Settings when setup incomplete
- **SSR tab hydration:** `SSR_DEFAULT_APP_TAB` + post-mount `resolveAppTabFromPreferences()` — fixes React hydration mismatch when saved Settings route to Home
- Continental US ZIP + browser geolocation; dev seed ZIPs when `GEOCODIO_API_KEY` unset
- v1 ranked chains when gates pass: **Kroger-family banners**, **Aldi**, **Publix**, **Food Lion**, **Lidl**, and **Walmart**; BJ's and other unsupported chains remain map/context only
- Trust UI: short estimate line on results plus `?` links to `/faq` articles; `/terms` is a short beta disclaimer. Open dinner cards show total, cook time, confidence/freshness/difficulty pills, Save, and nested Store/Shopping/Recipe sections. Map pins use “Coming soon” / context-only for unsupported chains; **no trust explainer modal** (removed 2026-06-26 audit)
- Fixture weekly-ad ingest for **CI/rehearsal and automated tests only** (not owner daily workflow)
- **`npm run setup:local`:** provisions `yum4less_dev` + `yum4less_test`, runs post-setup `npm test` smoke, fixture `DATABASE_URL_TEST` guidance, geolocation-or-ZIP next-step copy; SNAP ensure stays non-fatal inside `ensureTestDatabase()` only
- Public APIs read-only by default in production; response sanitization; route validation + rate limits

### Store-discovery bug status (2026-07-06)

| Item | Status | Evidence / notes |
|------|--------|------------------|
| **Bug 1 — Publix headline shows shopping-center label** (`publix-1626` / `Brandy Creek Commons`) | **CLOSED** | Display-layer only: `resolveStoreDisplayHeadline()` + optional locator subtitle via `formatStoreHeadlineWithOptionalSubtitle()` in `store-display-labels.ts`; wired in `buildNearbyStoresForSearch`. DB `stores.name` unchanged. |
| **Bug 2 — `ALDI` vs `Aldi` casing** (`aldi-23111`, `osm-node-6531578976`, etc.) | **CLOSED** | `getCanonicalShopperChainDisplayName()` in `chain-rollout-policy.ts` routes ranked v1 chain headlines through one map (`aldi` → `Aldi`, etc.). |
| **Bug 3 — Food Lion pin in neighborhood** (`osm-node-3103220732`, FL #601) | **CLOSED (prior)** | Not a coordinate write — stored pin matches SNAP within ~60 ft; Nominatim road-geometry false positive. Already in `COORDINATE_SANITY_EXCEPTIONS` (2026-07-03). |
| **Bug 4 — Aldi pin in wrong neighborhood** (`aldi-mechanicsville` bootstrap) | **CLOSED** | Stale bootstrap coord corrected to OSM/SNAP storefront (`37.611004`, `-77.336853`) in `yum4less_dev`, `db/ci/014_ci_bootstrap_stores.sql`, and `src/lib/fixtures/market-catalog.fixtures.ts`. |
| **Bug 4b — Fake fixture Aldi in Settings** (`osm-node-900007` at wrong coords; shared live OSM namespace) | **CLOSED (root cause)** | Phase A–C (2026-07-08): fixture upsert uses `fixture-osm-*` + `yum4less-map-fixture`; Settings/market-search exclude non-live OSM outside fixture mode; `findNearestOsmAldiStore` / `buildAldiCatalogStoreForMarket` refuse synthetic 90000x ids; `touchStoreVerification` preserves location provenance; `018_retire_synthetic_osm_fixture_pins.sql` purges legacy band + repairs weekly-ad-overwritten live OSM `source_name`. Prior 017 was symptom-only. |
| **Bug 4c — Same-chain collocated catalog twins** (`aldi-mechanicsville` + `aldi-23111` at identical coords) | **CLOSED** (`e5b1285`) | Shared `catalog-store-colocated-identity.ts` (Decision A: `CATALOG_COLLOCATED_MERGE_MILES=0.05`, named `KROGER_COLLOCATED_MERGE_MILES=0.15`); Settings fold; ingest prefer-colocate; `019` retires ZIP twin; pinned 0.05/0.15 regression. CI [28954380879](https://github.com/sfh1980/Yum4Less/actions/runs/28954380879). |
| **Distance display (Food Lion #2575 / `osm-node-1654396096`)** | **CLOSED — not a bug** | Haversine straight-line was always correct; 0.8 mi vs ~1.9 mi driving traced to geolocation origin + straight-line semantics, not formula or store coord error (stored pin within ~390 ft of USPS/SNAP). UI now labels **`X mi straight-line`** on map/list/Settings. |
| **OSRM driving distance in store discovery** | **DEFERRED** | See [Deferred backlog](#deferred-backlog-not-v1) — extend existing `multi-store-shopping-route.ts` OSRM path to map/list/Settings distances; smaller lift than greenfield routing. |
| **Phase D — live OSM road-geometry witnesses** | **DEFERRED** | Wrong road geometry on real Overpass pins (not fixture identity) — witnesses / Nominatim corroboration; out of scope for fixture/live namespace separation. |

### Not working / deferred

- **Tier B ranked estimates** in most US ZIPs until daily ingest runs for that market (Tier C is normal)
- **Homelab TrueNAS Custom App (`app`+`db`)** — **CLOSED** (2026-07-22); see [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §9
- **Homelab ingest container + Watchtower deploy** — **CLOSED** (recorded 2026-07-26); see [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10–§11
- **Unattended 3am cron two-night proof** — **CLOSED** (owner paste-back 2026-08-29): nights of **2026-08-28** and **2026-08-29**, both completed ~07:07 UTC, `[freshness] OK`, overlay off, ZIP `23111` only
- **Homelab still open (do not fold into closed):** none for ingest/backup. Watchtower first hourly scan still unconfirmed in the punch-list. Extra ZIP `23220` is next (`/owner`).
- **Homelab Cloudflare Tunnel WAN** — **CLOSED** (2026-08-03/04) @ `https://yum4less.com/`
- **M128/M151 scrape automation** (robots.txt checks, auto-pause on block signals, automated per-chain kill switches) — homelab slice; manual owner-pause only today
- **Semgrep CI** — runs when GitHub repo secret `SEMGREP_APP_TOKEN` is set (not a `.env.local` var); local hooks use optional `semgrep` CLI

### Next (redesign — ordered)

1. ~~**Slice 1** — Remove `dinnersWanted` entirely~~ **done (2026-06-25)**
2. ~~**Slice 2** — TheMealDB **merged** ranking + hide opt-in checkbox~~ **done (2026-06-25)**
3. ~~**Slice 3** — Settings store scope + remove **40-ingredient POST cap** + prefs persistence~~ **done (2026-06-25)**
4. ~~**Slice 4** — **Stacked** accordion meal cards (title-only collapsed; **one expanded at a time**); delete carousel component/CSS/tests~~ **done (2026-06-25)**
5. ~~**Slice 5** — Welcome **budget + dietary** → straight to **ingredients**; **Settings-first gate**; tap steps; full-screen rank loading; **delete hidden TheMealDB opt-in dead code**~~ **done (2026-06-25)**
6. ~~**Deferred D1–D6** — 5-tab shell, theme tokens, ingredient gate/chips, map-as-link overlay, session pantry UI~~ **done (2026-06-25)** — cuisine chips (R11) still deferred. Device-local Saved meals shipped 2026-08-20 (no accounts; cross-device still deferred).
7. ~~**D7 — Color/tokens port** — Theme C (dark) + Theme D (light) from `.private/tokens.css`; flat page bg; system font; light default first visit; recolor buttons/panels/nav/map~~ **done (2026-06-26)** — owner browser verify pending

**Next (nationwide de-hardcoding — ordered):** ~~A no silent ZIP~~ **done** · ~~B1 `active_markets` + ZIP cache~~ **done** (TrueNAS `025`) · ~~B2 `chain_registry` + Coverage~~ **done** (TrueNAS `026`) · ~~C `/owner` Markets ZIP activate~~ **done** · ~~weekly-ad fail-soft for unranked chains~~ **done** · ~~Lidl/Walmart shopper-ranked v1~~ **done** (TrueNAS `027`+`028` applied 2026-08-28 07:00Z) · ~~membership DB-wins~~ **done** (repo; live waits Watchtower). **Market admission is on live** (unattended worker **2026-08-31** 07:01–07:09Z). **`23220` Activate** owner-clicked 2026-08-31 (first ingest tonight). **Settings grocery-pin picker** shipped. Organic shopper-ZIP waiting list, threshold profiles, scrape TZ, Slice D identity, banner-row split, and new ranked adapters stay later.

**Later (when reprioritized):** chain go/no-go on the free stack (OSM / Flipp / scrape; no paid aggregator); Section H restyle of Home/Deals/Cook/Saved + Q34/Q35 compact Settings; GYAM Cloudflare hostname on same tunnel; Saved tab persistence; cuisine chips (R11); optional SNAP CSV ingest; banner-per-row with shared family adapters (not 20 copied Kroger clients). Owner Check fragment lists: research later.

---

## Redesign — locked plan (2026-06-25)

**Handoff digest:** [`docs/redesign/redesign-analysis-handoff.md`](docs/redesign/redesign-analysis-handoff.md) (slices + doc-update summary). This section remains canonical.

**Authority:** This section + [Decision log](#decision-log) below. **Not** `.private/` (archive/mockups only). Trust copy → `.cursor/rules/yum4less-product-and-trust.mdc`.

**Scope:** Frontend/UX redesign is primary; backend/API changes are allowed when named per slice (not silently bundled).

### Shipped workflow (target)

**Entry order (2026-08-24 live UI):** first visit or **Reset Preferences** → splash → GPS or ZIP+pin wizard (radius, shopping style, stores, budget, dietary) → ingredients → pantry → rank. Returning visitors with `setupComplete` see splash briefly, then Home. The 2026-06-25 Settings-first ZIP hero is rollback-only (`backup/settings-ui-plus-catalog`).

| Step | What the shopper does | What is stored |
|------|------------------------|----------------|
| **Settings** (first-run / factory-reset gate) | ZIP **or** browser location, search radius, **shopping style** + **store dropdown** (see below), theme | Saved preferences (e.g. localStorage) + **initial setup complete** marker |
| **Welcome** | Choose **budget** and **dietary** | Per visit / session (not buried in Settings) |
| **Ingredients** | See **all** sale ingredients for **selected store(s)** only; optional manual narrow later | Session |
| **Rank** | **Tap** to proceed; **full-screen** loading with honest TheMealDB copy | — |
| **Results** | **Stacked** cards; **title only** collapsed; expand **one at a time** (opening another collapses the previous) | Session until flow reset |

**After welcome:** go **straight to ingredients** (no separate store-search step on the main path). Store discovery runs from saved Settings.

### Settings — first-run, factory reset, and required fields

- **Detect missing Settings:** no persisted preference blob **or** required fields incomplete (location, radius, at least one selected store per shopping style, theme if treated as required on first setup).
- **Gate behavior:** route to Settings **before** welcome or any shopping flow. Do **not** re-show this gate on every visit once valid Settings exist.
- **Re-trigger gate only when:** shopper uses **factory reset** (explicit control that clears saved Settings / marks setup incomplete) — same experience as first visit.
- **Not a gate trigger:** changing budget/dietary on welcome, session-only ingredient scope, or rank/results navigation.
- **Implementation slice:** persistence + completeness detection in **slice 3**; entry routing and factory-reset UX in **slice 5**.

### Settings — shopping style and stores

Under **Shopping style**:

- **Single store** — dropdown: pick **exactly one** store.
- **Multiple stores** — dropdown: pick **one or more** stores.

**Unselected stores:** do **not** appear anywhere in the UI (no map pin, no list row, no sale ingredients, no pricing/recipe scope). For the shopper, unchecked stores do not exist.

**Settings owns:** location method, ZIP/coordinates, radius, shopping style + store selection, theme.

**Settings does not own:** budget, dietary (welcome screen — faster to change).

### Meal results count

- **No fixed card cap** — remove `dinnersWanted` completely from the project; result count = recipes that qualify after filters (location, selected stores, budget, dietary, shopping style, ingredient scope, `maxIngredients`, eligibility).
- **`maxIngredients`** (shopping-plan line count): **unchanged** — hidden default/behavior.

### Recipes / TheMealDB

- **Shopper ranking (2026-08-20 lock):** TheMealDB imports with a **numeric meal-page id** only. Short internal-library writeups stay in the catalog for matching; they are **not** listed.
- **Sale overlap** still required (at least three overlapping sale ingredients) plus a priced shopping plan, budget, and `maxIngredients`.
- **UI:** no shopper recipe-source picker; hidden opt-in / `recipeSourceOptIn` already deleted (slice 5).
- **Zero TheMealDB meals in results:** tests must prove empty is from workflow/settings/eligibility, not a bug.
- **Stale/empty imports:** do **not** fall back to internal 3-step recipes. Show scheduled-refresh `shopperNotice` when catalog refresh is due (cron/script path — no search-time import in production).
- **Attribution** + “Open full recipe instructions” on cards when a meal-page URL exists. Loading copy: list is **not exhaustive**.

### Ingredient scope and API

- **Remove** the **40-ID** `selectedIngredientIds` cap; rely on existing **64 KB body limit**, **rate limits**, and **per-ID validation**.
- **Default rank path:** all sale ingredients at selected store(s) — server resolves from market snapshot/observations when possible (avoid posting every ID).
- **Optional** manual ingredient narrow later (no product-facing max count).

### Rank and empty state

- Ranking on **explicit tap** (not automatic when ingredient list appears).
- **Nothing found:** stay in flow with clear next steps (wider budget, different stores, different ZIP) — not a dead end.

### Information architecture (shipped D1)

- Mobile-first; functional on desktop without a separate layout.
- **5-tab bottom nav:** Home, Deals, Cook (enabled when session has ranked results), Saved (placeholder), Settings.
- Home tab: welcome → ingredients → rank → results. Settings tab: location, radius, stores, theme.
- Deals: browse-only sale ingredients when market loaded. Cook: shortcut to results panel when enabled.

### Flow and session (shipped)

- **Flow reset** = return to welcome and/or wipe **session** data (ingredient scope, results) without clearing saved Settings.
- **Reset Preferences (Settings)** = clear saved Settings preference data → **Settings-first gate** runs again (same as first visit).
- **Session:** derived state (`cookEnabled`, pantry items), not a DB row.

### Map (shipped D5)

- Optional **link bar** above bottom nav on Home ingredients step → full-screen `store-map-overlay` (not a flow step or tab).

### Theme (D2 + D7 shipped)

- **Shipped:** Settings theme select (`light` / `dark` / `system`); `ThemeSync` on `<html>`; mockup Theme C + D palette in `theme-tokens.css` (action/trust/urgency/price/danger/tag roles); **light default on first visit** (overrides D2 OS-first paint); flat page background; system font stack; trust/urgency/price applied to existing labels (copy unchanged).

### Results cards

- **Stacked**, not carousel — delete `RecommendationResultsCarousel` and related CSS/tests.
- Collapsed: **title only**. Expanded: full detail. **One expanded card at a time.**

### Ingredient taxonomy (shipped D3)

- Category chips: fixed taxonomy; only categories with matching ingredients in the result set.
- Cuisine/ethnic facet: **separate** from type chips; **hide cuisine row until DB tags exist (R11)**.
- Category chips on **manual pick** screen only.

### Trust copy

- **No “High confidence” badge** — use established trust rules (`estimated`, `directional`, etc.).

### Feedback

- `/feedback` link: Home footer **and** Settings tab (shipped D1).

### Tier C

- **No “Notify me”** — explain limited coverage, try different ZIP, check back later.

### Pantry check (shipped v2 — 2026-07-07)

- Pre-rank **Pantry check** step between Ingredients and Rank — always shown; **Continue to rank** never blocked.
- `POST /api/pantry-coverage` — near-miss checklist (1–4 missing lines), debounced full-pool reassess, `ingredientCatalog` on initial response.
- `pantryIngredientIds` pass-through on rank; plan builder emits `sourcedFromPantry` rows excluded from `estimatedTotal`.
- Session-only — not persisted. Retired post-rank `pantry-prompt-card.tsx`.

### Deferred after D7

Saved tab **persistence**, cuisine DB/tags (**R11**), and mockup layout polish (top-bar toggle, Cook FAB styling) remain deferred.

---

## Redesign — implementation slices (ordered)

| # | Slice | Touch areas | Gates |
|---|--------|-------------|--------|
| **1** | Remove `dinnersWanted` | `api-request`, contracts, `recommendation-service`, client payload, tests | `npm test` |
| **2** | TheMealDB merge + hide checkbox | `recommendation-service`, contracts, UI hide opt-in, merge tests, zero-import tests | `npm test`; `@verifier` |
| **3** | Store scope + drop 40-ID cap + **Settings prefs persistence** (completeness / factory-reset clears setup) | Settings prefs model, market/rank filtering, `parseSelectedIngredientIds`, pass-through | `npm test`; integration if rank contract changes |
| **4** | ~~Stacked accordion cards~~ | ~~Replace carousel, `meal-results-panel`, CSS, e2e~~ | ~~`npm test`; Playwright MCP~~ **done** |
| **5** | ~~Welcome + Settings gate + tap steps + full-screen loading + delete TheMealDB opt-in~~ | ~~`page.tsx`, meal-planner flow, contracts, Settings reset~~ | ~~`npm test`; Playwright MCP~~ **done** |
| **D1–D6** | ~~5-tab shell, interim theme, ingredient gate/chips, map overlay, session pantry~~ | ~~`bottom-nav`, `theme-tokens`, `ingredient-gate-panel`, `store-map-overlay`, `pantry-prompt-card`~~ | ~~`npm test`; `npm run build`~~ **done** |
| **D7** | ~~Mockup color/tokens port (colors only)~~ | ~~`theme-tokens.css`, `globals.css`, component CSS, `resolve-theme` default~~ | ~~`npm test`; owner browser verify; Playwright MCP for trust labels~~ **done** — owner browser verify pending |

**Discipline:** One slice per PR/session when possible. After each slice: changelog + decision log updates in this file.

**TheMealDB opt-in cleanup:** **done (slice 5)** — hidden UI and shopper `recipeSourceOptIn` path removed. **Superseded 2026-08-20:** shopper ranking is TheMealDB-with-full-recipe-page only; short internal writeups are not ranked.

---

## Changelog (newest first)

### 2026-08-31 — Membership DB-wins (`chain_registry`)

**Theme:** Who we *try* for dinners and fail-loud ingest comes from Postgres, not a TypeScript ranked list.

**Shipped:** `loadChainMembership()` reads `chain_registry.shopper_ranked`. Market search, promotion gates, Kroger official-API enablement, ingest fail-loud, OSM ranked gap-fill/suppress, owner Markets ranked warning, and honesty copy follow that roster. Floors (3 matches, confidence, freshness) stay in code. Market payload includes `shopperRankedChainIds` for Settings sort. CI asserts ranked ids have known dinner adapters — not that a TypeScript list equals the table. Empty roster in production → no dinner attempts; weekly-ad ingest exits if no ranked rows. Flyer-hash skip now rewrites when target stores are missing a full in-stock weekly-ad row set (integration wipes no longer leave e2e dinners at 0).

**Limits:** Known-adapter list remains for parsers/display. Banner-per-row split not started. Live yum4less.com waits image publish + Watchtower. TrueNAS already has Lidl/Walmart `shopper_ranked` from `027`/`028`. Hash skip still an optimization when every target store already has a full row set.

**Evidence:** this session `npm test` **1220/1220** (214 files). `npm run test:integration` **54/54** (17 files). `next build` pass (Next.js 15.5.21, inside `test:e2e:ci`). Playwright **32 passed** / 2 skipped (`npx playwright test` on `yum4less_test` after that build; Chromium reinstalled into the Cursor sandbox browsers path). Local Postgres MCP: six banners `shopper_ranked=true` on `yum4less_dev`. Semgrep not run on this slice.

### 2026-08-31 — Hardcoding follow-up: membership vs floors vs banners

**Theme:** Owner answers on roster cutover. **No code.**

**Locked:** (1) Membership-only = `chain_registry` becomes who we *try* for dinners and fail-loud ingest; shopper dinners the day of cutover stay the same if flags match today’s lists. (2) Tracked pin with thin sale data does not rank dinners — floors stay in code (already `weeklyAdPromotionGatesPass`). (3) Banner grain: one row per shopper banner, **shared adapter keys** (Kroger API / Kroger weekly-ad modules stay one copy). (4) Owner Check brand lists: research, not this slice.

### 2026-08-31 — Settings grocery picker (no new adapters)

**Theme:** Shopper store choice follows grocery pins in radius, not TypeScript `SHOPPER_RANKED_V1_CHAINS`.

**Shipped:** Wizard/Settings can select Whole Foods, Target, clubs, and other grocery/food-capable catalog pins when they appear in market search. Convenience, mini-marts, bakeries, and pharmacies stay omitted. Dinner estimates still require existing sale/price floors. Target `shop=department_store` OSM pins kept by name (Marshalls/Kohl's still dropped). No new Flipp/API/scrape adapters.

**Limits:** Pins must already be in catalog or live OSM for the search. OSM timeouts still hide stores that were never ingested. Independents stay `chain: unknown`. Dual-run `shopper_ranked` CI unchanged. Live yum4less.com waits on image publish + Watchtower.

**Evidence:** `npm test` **1213/1213**; `npm run build` pass; `npm run test:e2e:ci` **32 passed** / 2 skipped.

### 2026-08-31 — Unattended ingest-worker night (owner paste)

**Theme:** First 3am enqueue + host Cron Job drain on live, no hand `docker exec`.

**Shipped (ops):** `YUM4LESS_INGEST_QUEUE_WORKER=1`. Enqueue **07:00:01Z**. Worker **07:01:01Z–07:09:59Z** drained 6 jobs, all `succeeded` for `run_date` **2026-08-31**. Freshness **324/324 OK**. Sunday hand-drain rows for **2026-08-30** also `succeeded`.

**Limits:** Unchanged flyers skip Postgres rewrite, so some weekly-ad `hours_ago` stay from Sunday. Not a missed night. Extra ZIP `23220` not activated yet. Registry-wins picker not started.

**Evidence:** owner paste of `ingest-worker.log` grep + `ingest_jobs` (column `last_error`).

### 2026-08-31 — TrueNAS backup/restore drill (owner paste)

**Theme:** Prove dump → restore round-trip on the live volume without touching `yum4less_dev` as the restore target.

**Shipped (ops):** Host `pg_dump` of `yum4less_dev` (1.8M) into disposable `yum4less_backup_drill`. Source and restored counts matched **276** stores / **324** `price_observations` / **29** `schema_migrations`. Drill DB dropped. Logrotate dry-run: logs already rotated (file present, no rotate needed).

**Limits:** This is a one-shot proof, not a scheduled nightly backup. `29` migrations means **`029` is on live**. Do not claim more dinners.

**Evidence:** owner paste of the TrueNAS drill commands.

### 2026-08-30 — TrueNAS first ingest-worker drain (owner paste)

**Theme:** After Watchtower pulled `:homelab`, a hand `docker exec yum4less-ingest npm run ingest:worker` drained the queued pipeline on live ZIP `23111`.

**Shipped (ops):** Worker ran map-catalog → weekly-ad → snap-ensure → provider-sync → TheMealDB → freshness, **19:50:53Z–19:58:11Z**. Map-catalog **9 mi**. Weekly-ad **7** stores in **9 mi ∩ ZIP outline**; one fetch per banner then fan-out. Hash skip on unchanged Kroger/Aldi/Walmart flyer rewrites. `[freshness] OK` **361/361**.

**Limits:** This was a **manual** drain, not an unattended Cron Job night. Jobs were already queued (3am enqueue-only or equivalent) — if the TrueNAS Cron Job is still off, tonight will sit again. Freshness **361** vs prior **680** is the tighter fence, not a failed ingest. No Lidl flyer. Walmart **9** foods / **12.9h** (hash skip). TheMealDB **dev test key**. Do not claim more dinners. Extra ZIP `23220` later.

**Evidence:** owner paste of `npm run ingest:worker` stdout.

### 2026-08-29 — Market admission (density fence, Check inventory, flyer hash, queue)

**Theme:** Owner Check ZIP becomes a grocery inventory. Nightly ingest uses a per-market fence (Census ZCTA ∩ density miles+1), one flyer fetch per banner with content-hash skip, and an optional `ingest_jobs` worker. Shopper pin model unchanged.

**Shipped (local tree):** `db/init/029_market_admission_density.sql` — `active_markets.density_class` / `ingest_miles`, cached ZCTA geojson, `ingest_jobs`, `weekly_ad_flyer_hashes`. Check omits convenience/bakeries; groups will-ingest / food-only / Needs you. Activate saves class/miles (auto-widen only; first night with no class = urban 9). MUST = grocery in the fence; empty flyer does not fail the night. Weekly-ad: one fetch per banner globally; persist skip on unchanged hash. `npm run ingest:worker`; 3am enqueues only when `YUM4LESS_INGEST_QUEUE_WORKER=1`. Owner panel format helpers split to `owner-market-preview-format.ts` so the client bundle does not pull `pg`. Runbook §10.2.1.

**Limits:** Shopper wizard still GPS or ZIP → pin; no H3. Census TIGERweb is skipped in `NODE_ENV=test` unless `YUM4LESS_ZCTA_LIVE=1`. **Superseded 2026-08-30:** live worker drain on TrueNAS. Extra ZIP `23220` later. One Flipp ZIP fans out to all admitted storefronts — far-apart markets later need per-market flyers. No Target/pharmacy adapters. 24h freshness SLA unchanged.

**Evidence:** this session `npm test` **1210/1210** (213 files). `npm run test:integration` **54/54** (17 files; `029` applied on `yum4less_test`). `npm run build` pass (Next 15.5.21) after the format split. `npm run db:migrate` applied `029` on `yum4less_dev`; Postgres MCP: `029_market_admission_density.sql` `applied_at` **2026-08-29T20:20:57Z**; `density_class` + `ingest_miles` present. Did not run e2e (shopper flow wiring unchanged; `/owner` is key-gated). Semgrep MCP scanned unrelated temp copies — not a passed scan of these files. No image publish.

### 2026-08-29 — Owner Markets Check ZIP locality

**Theme:** `/owner` Markets Check ZIP was OSM-only, so missing `addr:city`/`addr:state` rendered as `Unknown`, and convenience pins filled the 20-row cap.

**Shipped:** Check ZIP overlays ingested catalog pins (same 5 mi box), lists ranked banners first, and shows OSM pins without address tags as **near** the ZIP city/state. OSM parse no longer writes the `Unknown` sentinel. No per-pin Geocodio reverse geocode.

**Limits:** `near Mechanicsville, VA` is ZIP-centroid locality, not a street address. New ZIPs with an empty catalog still depend on live Overpass. Convenience OSM pins can still appear after ranked banners.

**Evidence:** this session `npm test` **1204/1204** (212 files). Owner markets panel + preview merge/sort/fallback + OSM address parse. Did not run e2e (owner is key-gated; shopper flow wiring unchanged).

### 2026-08-29 — TrueNAS two-night 3am cron (owner paste-back)

**Theme:** Unattended scheduled ingest ran two consecutive nights with overlay off.

**Shipped (ops):** Cron **2026-08-28T07:00:01Z → 07:07:42Z** and **2026-08-29T07:00:01Z → 07:07:38Z**, both `Scheduled pricing ingest completed.` Mid-day re-check **2026-08-29 ~15:35Z:** `[freshness] OK` **680/681**, `hours_ago` **8.4–8.5**. `YUM4LESS_INGEST_ZIPS` unset; `active_markets` **23111** only. App/ingest `:homelab` created **2026-08-27T22:55Z**, Up 41h. Ingest migrate applied **`027`/`028`** at **2026-08-28 07:00:02–03Z**. Live `chain_registry`: Lidl and Walmart `shopper_ranked`. Site `https://yum4less.com/` HTTPS **200**.

**Limits:** Overpass **500** on 2026-08-29 (map-catalog continued; osm=0 that night). No `lidl-weekly-ad-scrape` rows in this ZIP. Walmart **9** unique foods / **18** rows — thin, not a failed night. One Kroger official row outside 24h (96/97 fresh). TheMealDB import still logs **dev test key**. Do not claim more shopper dinners. Backup drill still open. Local Docker ≠ yum4less.com.

**Evidence:** owner paste of ingest.log grep, freshness CLI + SQL, `schema_migrations`, `chain_registry`, catalog counts, `curl -sI https://yum4less.com/`.

### 2026-08-27 — Walmart same floors + banner display + registry dual-run

**Theme:** Drop the Walmart hard-stop. Same weekly-ad coverage floors as Lidl. Shoppers see banner names (Harris Teeter, not Kroger family). `chain_registry` flags match TypeScript ranked lists in CI.

**Shipped:** `SHOPPER_RANKED_V1_CHAINS` includes `walmart`. `weeklyAdPromotionGatesPass` no longer special-cases Walmart. `PROVIDER_ROLLOUT` Walmart uses the same directional note as other ranked banners. Settings lists Walmart. Weekly-ad ingest **fail-loud** for Walmart (fail-soft is Dollar General only). Shopper headlines prefer banner from store name (`inferShopperBannerDisplayName`). `db/init/028_promote_walmart_shopper_ranked.sql` sets Walmart `shopper_ranked` / `settings_selectable` / `promotion_blocked=false`. Integration dual-run: `chain_registry` where `shopper_ranked` equals `SHOPPER_RANKED_V1_CHAINS`. Owner Coverage `recipeReady` follows shopper-ranked + sales (not `promotion_blocked` as a never-rank switch).

**Limits:** Live Walmart Flipp/scrape is often thin — estimates appear only when floors pass; otherwise map context with an honest reason. **Superseded 2026-08-29:** TrueNAS `027`/`028` applied; two-night cron with overlay off. Client Settings still cannot query Postgres (dual-run, not DB-wins in the browser). Local Docker ≠ yum4less.com.

**Evidence:** this session `npm test` **1198/1198** (210 files). `npm run test:integration` **54/54** (17 files; `028` applied on `yum4less_test`). `npm run test:e2e:ci` **32 passed** / **2 skipped** (`PLAYWRIGHT_BROWSERS_PATH` user `ms-playwright`). `npm run build` pass (Next 15.5.21, as part of e2e:ci). Local Postgres MCP: `yum4less_dev` Walmart `shopper_ranked=true`, `rollout_stage=ranked`, `promotion_blocked=false` after `db:migrate`. Semgrep MCP scanned unrelated temp copies — not a passed scan of these files.

### 2026-08-27 — Lidl shopper-ranked v1

**Theme:** Unlock Lidl the same way as Food Lion: Settings-selectable and dinner estimates when weekly-ad promotion gates pass.

**Shipped:** `SHOPPER_RANKED_V1_CHAINS` now includes `lidl`. Coming-later meal-pricing hold stays empty. Weekly-ad ingest **fail-loud** for Lidl. `/owner` Markets Check warns when the first look has none of the ranked banners. `db/init/027_promote_lidl_shopper_ranked.sql` sets `chain_registry` Lidl flags for Coverage honesty. Shopper ranking lists stay TypeScript until a later dual-run cutover. **Superseded later this day:** Walmart same-floors unlock.

**Limits:** Live Lidl coverage was not promotion-reviewed in this slice. Coordinate sanity remains required before expanding Lidl rollout claims. TrueNAS still needs `027` plus app **and** ingest image pulls (Watchtower does not migrate; Lidl fail-loud is ingest-image). Extra ZIPs still wait for unattended 3am with overlay off. Local Docker ≠ yum4less.com.

**Evidence:** this session `npm test` **1194/1194** (210 files). `npm run test:integration` **54/54** (17 files; `027` applied on `yum4less_test`). `npm run test:e2e:ci` **32 passed** / **2 skipped** (first attempt failed: Playwright browsers missing from Cursor sandbox cache; retry with user `ms-playwright` cache). `npm run build` pass (Next 15.5.21, as part of e2e:ci). Local Postgres MCP: `yum4less_dev` Lidl `shopper_ranked=true`, `rollout_stage=ranked` after `db:migrate`. Semgrep MCP scanned unrelated temp copies — not a passed scan of these files.

### 2026-08-27 — Weekly-ad fail-soft for unranked chains

**Theme:** Cron stays green when Walmart / Lidl / Dollar General flyer paths error; shopper-ranked v1 chains stay fail-loud.

**Shipped:** `shouldFailWeeklyAdIngestExit` fails only when Kroger, Aldi, Publix, or Food Lion error or persist-fail (`SHOPPER_RANKED_V1_CHAINS`). Missing `chain` stays fail-loud. Unranked issues log a warning and do not exit 1. `/owner` Markets Check warns when the first look has none of those four banners; Activate is still offered. Not go/no-go. Does not rank Walmart.

**Limits:** Fail-loud is shopper v1 lists, not `WEEKLY_AD_RANKED_PRICING_CHAINS` (Lidl/Walmart still persist for rehearsal). Provider price-sync exit is unchanged (any persist fail still fails that script). Extra ZIPs still wait for unattended 3am cron with overlay off. Local Docker ≠ yum4less.com. **Superseded later this day:** Lidl moved into shopper-ranked v1, so Lidl flyer errors are fail-loud again.

**Evidence:** this session `npm test` **1192/1192** (210 files). `npm run test:e2e:ci` not run (`/owner` is not a shopper e2e surface; shopper flow unchanged). `npm run test:integration` not run (exit-code policy, no schema change). Semgrep MCP scanned unrelated temp copies — not a passed scan of these files.

### 2026-08-27 — Live overlay dropped; table ingest for 23111 (owner paste-back)

**Theme:** First scheduled ingest after `/owner` Markets activate + unset `YUM4LESS_INGEST_ZIPS`.

**Shipped (ops):** Owner activated `23111` (`active · ops`). Manual `docker exec yum4less-ingest` scheduled ingest **EXIT 0** at **2026-08-27T18:34:14Z**. One ZIP. No env overlay line. Map-catalog: OSM Overpass **504** (non-fatal, osm=0); 8 ranked + 10 Publix locator. Weekly-ad **live** for Kroger/Aldi/Publix/Food Lion/Walmart. Kroger official **97** unchanged, `last_verified_at` refreshed. Freshness **OK 671/671** in 24h. TheMealDB from-sales imported **15** (dev test key).

**Limits:** Many weekly-ad syncs skipped on match threshold this run (only **1** new Publix persist); existing 24h rows still count. Walmart observations in the heartbeat are **not** shopper-ranked. OSM timeout is expected-degraded, not a failed job. Local Docker ≠ yum4less.com.

**Evidence:** owner paste of ingest stdout (`Scheduled pricing ingest completed.`, `EXIT:0`).

### 2026-08-27 — Ranked ingest anchor ZIP 23111 (expansion lock)

**Theme:** Scale outwards with more owner-activated ZIPs; keep one ranked-chain market so nightly freshness stays alive.

**Shipped (decision):** Owner-chosen ranked ingest anchor is ZIP **`23111`**, activated into `active_markets` — not a silent app/cron default. Extra ZIPs are map/catalog expansion. Ranked dinners remain Kroger-family / Aldi / Publix / Food Lion where those banners exist. Chain go/no-go is later and will be trial-and-error on free sources only (no paid API/aggregator subscriptions).

**Limits:** Do not seed `23111` in git. Do not drop the overlay until `23111` is an active table row. A ZIP with none of the four ranked chains is Tier C. Go/no-go is not started.

**Evidence:** owner lock this session. No new code.

### 2026-08-27 — Phase C /owner Markets ZIP activate

**Theme:** Owner adds ingest ZIPs from `/owner` so cron can visit more markets; no organic waiting list.

**Shipped:** Fifth `/owner` tab **Markets**. Type a 5-digit ZIP → Check (preview nearby OSM pins, no insert) → Activate writes `active_markets` (`source=ops`, `status=active`) and remembers geocode cache. Same admin key as Coverage. `GET /api/owner/markets`, `POST .../preview`, `POST .../activate`. CLI `npm run markets:activate` remains backup. Overlay notice is always shown: cron uses the table only when `YUM4LESS_INGEST_ZIPS` is unset. No new `db/init` — reuses `025`.

**Limits:** Does not ingest ~41k ZIPs. Does not auto-queue shopper ZIPs (`organic_usage` paused queue is later). Does not cut shopper ranking over to `chain_registry`. Does not flip Walmart ranked. Public `/api/recommendations` and `/api/market-search` stay read-only. ZIP `23111` is allowed if typed — not a hidden default. Short/empty store preview is a first look, not a fail. Overlay unset + empty table still fails closed. Watchtower does not migrate. Local Docker ≠ yum4less.com. TrueNAS writes happen after an app image with this tab is pulled and the owner activates a ZIP.

**Evidence:** this session `npm test` **1183/1183** (210 files). `npm run build` pass (Next 15.5.21; `/api/owner/markets`, `/preview`, `/activate`, `/owner`). Local Postgres MCP: `active_markets` **0** rows (local Docker, not TrueNAS). `npm run test:e2e:ci` not run (`/owner` is not a shopper e2e surface). Semgrep MCP scanned unrelated temp copies — not a passed scan of these files. Integration `listIngestMarkets` assertion added; full `test:integration` not required (no schema change).

### 2026-08-26 — TrueNAS 025 + 026 applied (nationwide A / B1 / B2 current)

**Theme:** Live schema caught up to A, B1, and B2.

**Shipped (ops):** Owner ran `sudo docker exec yum4less-ingest npm run db:migrate` on TrueNAS. Ledger: `025_active_markets_and_zip_geocode_cache.sql` and `026_chain_registry_and_store_coverage.sql` both applied **2026-08-27 00:04:01Z**. Ingest skipped 000–013 and 015–024; applied **025** then **026**. `CREATE TABLE` / 18-banner seed / `store_coverage` view succeeded.

**Limits:** `active_markets` is still empty until `npm run markets:activate -- <ZIP>` (keep `YUM4LESS_INGEST_ZIPS` overlay). Organic shopper-ZIP queue (Phase **C**) is **not** started. Shopper ranking lists stay TypeScript. Watchtower still does not migrate future files. Coverage UI needs an app image that includes the tab; schema is ready. Local Docker ≠ yum4less.com. Do not claim deploy-ready.

**Evidence:** owner paste-back of migrate stdout + `schema_migrations` two rows (`025` / `026`).

### 2026-08-26 — Phase B2 chain_registry + /owner Coverage tab

**Theme:** Track banners in Postgres; search storefront coverage from `/owner`.

**Shipped:** `db/init/026_chain_registry_and_store_coverage.sql` — `chain_registry` seed (ranked Kroger/Aldi/Publix/Food Lion; Walmart blocked; upcoming Target/H-E-B/etc.) plus `store_coverage` view over existing `stores` + 24h in-stock `price_observations`. `GET /api/owner/store-coverage` (same admin key). Fourth `/owner` tab searches store name, city/state, and usable-in-app (`recipe_ready`). Missing `026` is a Coverage-tab notice, not a full console lockout. Shopper ranking lists stay in TypeScript (`SHOPPER_RANKED_V1_CHAINS`) until a later cutover.

**Limits:** Does not invent a second store directory. Convenience OSM pins stay Other / untracked. No ZIP column on `stores`. Does not auto-queue shopper cities (Phase C). Does not flip Walmart ranked. TrueNAS migrate `026` later landed **2026-08-27 00:04Z** (see newer changelog). Local Docker ≠ yum4less.com.

**Evidence:** this session `npm test` **1165/1165** (207 files). `npm run build` pass (Next 15.5.21; `/api/owner/store-coverage` + `/owner`). `npm run test:integration` **54/54** (17 files) on a second run; first run had 2 ledger timeouts while `next build` was competing. Local Postgres MCP: `026` applied **2026-08-26 22:06:34Z**; 18 registry banners; `store_coverage` **282** mapped storefronts, **0** fresh 24h sales (local Docker, not TrueNAS). `npm run test:e2e:ci` not run (`/owner` is not a shopper e2e surface). Semgrep MCP scanned unrelated temp copies — not a passed scan of these files.

### 2026-08-26 — Phase B active_markets (ingest SSOT)

**Theme:** Scheduled ingest markets live in Postgres; env is a debug overlay.

**Shipped:** `db/init/025_active_markets_and_zip_geocode_cache.sql` — empty `active_markets` + `zip_geocode_cache` (no 23111 seed). Cron uses `YUM4LESS_INGEST_ZIPS` overlay when set, else `active_markets` where `status=active`; both empty fails closed. `npm run markets:activate -- <ZIP>` inserts one ops market after geocode. Ingest writes ZIP cache; public `/api/geocode/zip` stays read-only (may **read** cache). CI/E2E still set overlay `23111`.

**Limits:** TrueNAS migrate `025` later landed **2026-08-27 00:04Z** (see newer changelog). Keep the ingest env overlay **or** `markets:activate` and drop the overlay. Does not auto-queue shopper cities (Phase C). Local Docker ≠ yum4less.com.

**Evidence:** this session `npm test` **1152/1152** (205 files). `npm run test:integration` **53/53**. Local Postgres MCP: `025` on `yum4less_dev`, empty `active_markets`. `npm run test:e2e:ci` not run (shopper flow unchanged; CI still sets overlay `23111`). Semgrep MCP timed out on the new ingest files.

### 2026-08-26 — Owner Coverage tab locked (plan only)

**Theme:** Phase B2 coverage is a searchable `/owner` list, not counts-only.

**Shipped (docs):** Plan requires a fourth `/owner` tab (**Coverage**) after Ingredient review / User feedback / Analytics. Search by store name, location, and checked/usable-in-app (`recipe_ready`). Read-only; same admin key. Not implemented.

**Limits:** Needs `store_coverage` + migrate on TrueNAS after that slice. Does not change shopper UI.

### 2026-08-26 — No silent 23111 default (Phase A)

**Theme:** Shopper ZIP and scheduled ingest must not invent Mechanicsville.

**Shipped:** Empty wizard ZIP until GPS or a typed ZIP + pin. `parseIngestZipCodesFromEnv` / weekly-ad ingest / owner probes **fail closed** when no valid ZIP is set (`YUM4LESS_INGEST_ZIPS` or explicit `YUM4LESS_PROVIDER_SYNC_ZIP` / `YUM4LESS_INGEST_ZIP`). Seed geocode table still resolves 23111/23116/23223/23231 when those ZIPs are actually entered in dev/CI. CI/E2E keep 23111 as **test geography only**.

**Limits:** `active_markets` is not shipped — env is still the ingest list, just without a silent default. Homelab ingest will exit non-zero until `YUM4LESS_INGEST_ZIPS` is set on the ingest container. Walmart ranked still deferred.

**Evidence:** this session `npm test` **1143/1143** (203 files). `npm run test:e2e:ci` **32 passed** / **2 skipped**.

### 2026-08-26 — TrueNAS catalog paste-back (024 is live)

**Shipped (docs):** Owner NAS snapshot recorded. Containers `yum4less-app` / `yum4less-ingest` on `:homelab` healthy (~24h); `yum4less-postgres` healthy. Ledger **000–013, 015–024** (no `014` in repo). **`024` applied 2026-08-24 07:00:02Z.** Live `ingredients`: TheMealDB **265**, internal **97**, weekly-ad-catalog **76** (**438** total). Pending `/owner` reviews **704**; weekly-ad aliases **90**; skips **675**.

**Freshness (same day, second paste):** in-stock ranked rows all **~10.3–10.4h** old — Kroger official API **97** foods / **97** rows; Publix weekly-ad **102** / **102**; Food Lion **62** / **310**; Kroger weekly-ad **35** / **129**; Aldi **30** / **60**; Walmart **14** / **28**. Newest cluster **2026-08-26 07:00–07:06 UTC** (~3:00am Eastern ingest window). Inside the 24h ranked-read gate.

**Limits:** These numbers are **TrueNAS**, not local Docker. Do **not** claim more shopper dinners. One morning of timestamps is **not** multi-night cron proof. Walmart ranked still deferred. Watchtower still does not migrate future `db/init` files.

### 2026-08-25 — Local DB is not homelab / yum4less.com

**Shipped (process):** Agents must not treat local `yum4less_dev` counts as live TrueNAS or `https://yum4less.com/` truth. When live catalog, ingest, or migration state is needed, give the owner paste-back commands from [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §4.5; update docs only after those results land.

**Limits:** TrueNAS still needs Watchtower `:homelab` pull for **new** images. Catalog-expansion numbers dated 2026-08-23/25 in this file are **local Docker** unless a paste-back says otherwise. **`024` is applied on TrueNAS** (see 2026-08-26 snapshot).

### 2026-08-25 — Universal weekly-ad junk skip + persist tighten

**Shipped:** Junk skip stays one SSOT (`isWeeklyAdJunkProduct`) for **every** chain — apparel, electronics, cleaning, and small appliances added from live Flipp titles. Classify runs junk **before** fuzzy match (owner Yes alias still wins). Price persist skips junk titles even if a matcher attached an ingredient id. Flipp flyer persist prefers grocery-tagged flyers and drops explicit merch departments. Walmart live ingest uses the shared Flipp resolver and always attempts a page scrape (no longer skips scrape after a weak Flipp match). Live probe `probe:walmart-live-scrape` uses Postgres catalog foods, not the 97-id fixture list, and does not persist.

**Limits:** Live Walmart.com scrape returned **0** parseable offers this run (Flipp still returned 144). Remaining 6 Flipp matches after junk were grocery (banana, bread, cheese, peanut butter, apple snack pack, grape jelly). Walmart ranked pricing is still hard-blocked. Do **not** claim more shopper dinners.

**Evidence:** `npm test` **1133/1133** (202 files). Live probe ZIP **23111**: Flipp 144 → junk 113 / match 6 / review 25; browser scrape 0. Integration and e2e not run (no shopper-route change). Semgrep MCP not run this slice.

### 2026-08-25 — Shrink Ingredient review by skipping junk

**Shipped:** Widened `isWeeklyAdJunkProduct` (electronics, housewares, personal care, pet, private-label prefixes, brand-only beer/wine leftovers). Classify now checks raw title and normalized label. Live weekly-ad persist heals pending reviews that match junk (`rejectPendingReviewsMatchingJunk`). One-shot `npm run owner:reject-pending-junk-reviews` (defaults to `yum4less_dev`; not a public API). Public shopper routes stay read-only.

**Limits:** Eastern Peaches, Boneless Strip Steaks, Garden Salad, and Grill Mates marinade stay in review — those are auto-create/head gaps, not junk. Do **not** claim more shopper dinners. `/owner` keyboard/bulk triage is still later.

**Evidence:** Postgres MCP `yum4less_dev` before heal: **743** pending / **112** skips. After `npm run owner:reject-pending-junk-reviews`: **619** pending / **236** skips (**124** rejected). Remaining by chain: Publix 301, Food Lion 84, Kroger 80, Walmart 71, Aldi 50, Lidl 33. `npm test` **1130/1130** (202 files). `npm run test:integration` **51/51**. e2e not run (`/owner` is not in the shopper suite). Semgrep MCP did not scan the requested junk-heal files (it scanned unrelated temp copies).

### 2026-08-25 — Owner console tabs

**Shipped:** `/owner` shows three tabs after unlock: **Ingredient review**, **User feedback**, and **Analytics**. Unlock, APIs, and Yes/No review are unchanged. Left/right arrows move between tabs.

**Limits:** Tabs appear only after a successful View. `/owner` is still not in the shopper e2e suite. Live `yum4less.com/owner` updates after Watchtower pulls a new image.

**Evidence:** `npm test` **1126/1126** (201 files). Owner console tests cover default review tab, switching, load-more on Analytics, and arrow-key wrap. Playwright opened `/owner` unlock copy only (did not paste the admin key). e2e CI not run (shopper flow unchanged).

### 2026-08-25 — Shopping style and dietary tap-to-continue

**Shipped:** **How do you shop?** and **Dietary focus** no longer show Continue. Tapping a choice saves it and goes to the next screen (same pattern as Use GPS / Enter ZIP). Radius, ZIP, pin, stores, and budget still use Continue.

**Limits:** Returning via Back still requires tapping a choice again to leave those two screens. Playwright MCP `chrome-for-testing` is not installed in this Cursor project; exploratory check used the user Playwright browser against `localhost:3000`.

**Evidence:** `npm test` **1126/1126** (201 files). `npm run test:e2e:ci` **32 passed** / **2 skipped**. Build inside the e2e gate passed. Playwright vs `http://localhost:3000`: Several stores → store picker; Vegetarian → Ingredients. Semgrep MCP did not scan the two screen files (it scanned unrelated temp copies); do not treat as a passed scan of this slice.

### 2026-08-24 — Onboarding wizard on master (live shopper UI)

**Shipped:** First visit is splash → GPS or ZIP+map pin → radius → shopping style → stores → budget → dietary → ingredients → pantry → rank. **6-tab** shell (Home, Deals, Cook, Saved, Feedback, Settings). `/faq`, `/faq/[slug]`, `/terms`. Device-local saved meals. Catalog matching and `/owner` ingredient review from `38bad3a` stay.

**Rollback:** Settings-first + catalog at **`backup/settings-ui-plus-catalog`** (`38bad3a`). Pre-catalog Settings UI at **`backup/pre-catalog-expansion-live`** (`389db47`) / image **`:800c450`**.

**Limits:** Live `yum4less.com` updates only after green `master` CI `publish-image` and Watchtower pull. `024` migrate on TrueNAS is still required. Mockup HTML/screenshots stayed uncommitted. Do not call this deploy-ready until publish is green and the NAS image is confirmed. Local Docker `:3000` is still the old Settings-first image until Watchtower pulls.

**Evidence:** `npx tsc --noEmit` pass. `npm test` **1124/1124** (199 files). `npm run build` pass (Next 15.5.21; `/faq`, `/faq/[slug]`, `/terms`). `npm run test:integration` **50/50**. `npm run test:e2e:ci` **32 passed** / **2 skipped** on isolated **3100** (`PLAYWRIGHT_FORCE_NEW_SERVER`; ZIP pin seeded at `37.6085`, `-77.3739`; ZIP helper picks **Several stores** so fixture ranks dinners). Semgrep MCP: no findings on the two files it actually scanned (`ingredient-id.ts`, `owner-console.tsx`); other requested TS/TSX paths were skipped. Remote CI / Watchtower not yet run at doc write time.

### 2026-08-24 — Owner console can create a canonical food id

**Shipped:** `/owner` ingredient review now has shopper-facing **name** and **category** fields plus on-page formatting rules. Yes maps a flyer line to an existing kebab-case id, or **creates** `ingredients` (`weekly-ad-catalog`) when the id is new. The API slugifies typed ids (`Imitation Crab` → `imitation-crab`). Shared slug helper lives in `src/lib/ingredient-id.ts` (max 56, letters/numbers/hyphens).

**Limits:** Creating an id does not by itself add shopper dinners. Next weekly-ad ingest can price it; pantry leftovers stay 1–4. Live TrueNAS still needs the post-merge `:homelab` image. e2e not run (`/owner` is not in the shopper Playwright suite).

**Evidence:** `npm test` **1123/1123** (199 files). Semgrep MCP: no findings on owner review route, repository, and slug helper. First scan of `owner-console.tsx` failed on Unicode encoding; ASCII copy in that file was not re-scanned as a clean pass.

### 2026-08-23 — First live catalog-expansion ingest (local) + docs for Watchtower

**Shipped (docs + pending master publish):** Recorded the first live `ingest:weekly-ads:scheduled` run that used Postgres `ingredients` as the matching SSOT (code from 2026-08-22). Public docs now describe `/owner` ingredient Yes/No, skip/alias tables, and the TrueNAS migrate step Watchtower does not perform.

**Local ingest evidence (ZIP 23111, 2026-08-23 ~15:28–15:38Z):** Map catalog OSM=261 / ranked=10 / Publix locator=10. Tracked weekly-ad matches: Kroger 41, Aldi 35, Publix 222, Food Lion 51, Lidl 26, Walmart 22. Freshness **772/772** ranked in-stock in 24h. Catalog tables on `yum4less_dev`: `ingredients` **319** (97 internal + 205 TheMealDB + **17** `weekly-ad-catalog`); **22** `ingredient_aliases` source `weekly-ad`; **112** `ingredient_match_skips` (junk-heuristic); **743** pending `ingredient_match_reviews` (Publix 329, Walmart 101, Food Lion 97, Kroger 90, Aldi 88, Lidl 38). TheMealDB from-sales: sale ingredients=**115**, imported=**15**, aliases saved=9, new catalog ingredients=**7**.

**Limits:** Auto-create wrote brand/prepared SKUs (Yoplait, bakery apple pie, onion rings). Walmart non-food (laptops, patio) landed in review, not skip. Eligible dinner count not measured — do not claim more shopper dinners. This run was **local Docker Postgres**, not TrueNAS. Live site updates only after green `master` CI `publish-image` / `publish-ingest-image` and Watchtower pull **plus** `024` migrate on the live volume.

**Evidence:** Prior slice gates 2026-08-22 (`npm test` **1117/1117**, integration **50/50**, build pass). This session: Postgres MCP counts above. Remote CI / Watchtower pull not yet run at doc write time.

### 2026-08-22 — Ingest food catalog expansion

**Shipped:** Weekly-ad matching loads food ids from Postgres `ingredients` (`024_ingredient_match_catalog.sql`: skip table + owner review queue). Fixture ingest still uses the 97-id seed. Flyer titles can become nicknames (`ingredient_aliases` source `weekly-ad`); junk is skipped; unclear lines wait on private `/owner` Yes/No (`GET/POST /api/owner/ingredient-reviews`, same admin key as feedback). Public `/api/recommendations` stays read-only. Pantry leftovers remain 1–4; TheMealDB ≥3 sale-overlap rule unchanged.

**Limits:** This does not by itself mean shoppers see more dinners. Eligible-recipe count only grows after ingest actually persists more sale ids and TheMealDB import runs. Homelab image is not this branch.

**Evidence:** `npm test` **1117/1117** (198 files). `npm run test:integration` **50/50**. `npm run build` pass (includes `/api/owner/ingredient-reviews`). Postgres MCP: `ingredient_match_skips` + `ingredient_match_reviews` present on `yum4less_dev`. e2e not run (shopper flow unchanged). Semgrep MCP timed out this session.

### 2026-08-21 — Settings FAQ/Terms, Reset Preferences, legal-page return

**Shipped:** The Settings tab (the “Let’s get started” screen after setup) now has FAQ and Terms of use links; Feedback still has them. `/faq` no longer links to Terms. The wipe-setup control is labeled **Reset Preferences**. Client navigation back from `/faq` or `/terms` restores the last tab and chrome theme and does not replay splash or wipe saved prefs. A full reload still does splash → budget.

**Evidence:** `npm test` **1105/1105**. Playwright against the wizard on `http://localhost:3000`: **24 passed** / **8 failed** / **2 skipped**. All four `faq-terms` cases passed, including Settings/Feedback links and Back-from-Terms theme/tab restore. The eight failures were empty ranked recipes / missing `kroger-mechanicsville` on `yum4less_dev`, not this UI slice. Isolated `npm run test:e2e:ci` (`next start` on **3100**) did not complete a clean gate this session (`output: standalone` warning; `127.0.0.1:3000` is the Compose app).

### 2026-08-21 — Slim dinner cards + FAQ/Terms pages

**Shipped:** Open dinner cards keep estimated total, cook time, confidence/freshness/difficulty pills, Save, and nested Store/Shopping/Recipe sections. Extra chrome stays in code behind `MEAL_CARD_SHOW_EXTENDED_CHROME`. Circle `?` controls link to `/faq/[slug]` articles. `/faq` and `/terms` are real pages. Last ready dinners restore from `sessionStorage` when Home remounts after FAQ (skipped on full reload so splash → budget still applies).

**Evidence:** `npm test` **1099/1099**. `npm run test:e2e:ci` **30 passed** / 2 skipped.

### 2026-08-21 — Ingredients gate in plain language

**Shipped:** The Ingredients choice screen no longer says “scope ranking.” It states how many items are on sale, then two choices: **Use everything on sale** and **Choose specific sale items**. Both share the same pantry follow-up: extra items at home can unlock more dinner options.

**Evidence:** `npm test` **1097/1097**. `npm run test:e2e:ci` **28 passed** / 2 skipped.

### 2026-08-21 — Docs + Obsidian sync after TheMealDB ranking lock

**Shipped (docs):** README, Resume, Decision log, redesign locked plan, application overview, decision trees, product-and-trust rule, e2e README, and redesign handoff now say shopper ranking is TheMealDB-with-full-recipe-page only. Pantry sticky count is documented as rank-aligned.

**Ingest (local `yum4less_dev` this session):** `npm run ingest:themealdb:from-sales` imported **15** new meals; catalog **150** TheMealDB rows with numeric meal ids. Not a weekly-ad/map-catalog run.

**Limits:** Homelab `yum4less.com` image is not this branch. CI still clones short seed dinners as TheMealDB rows with fake ids `900001+` on `yum4less_test` only.

### 2026-08-20 — Sticky pantry dinner count; TheMealDB-only ranking

**Shipped:** Pantry “dinners we can show next” stays pinned while the checklist scrolls. That count now uses the same budget / plan / ingredient-limit gates as ranking, so checking every pantry item should not jump from ~30 to ~17 on the next screen. Shopper ranking is TheMealDB-only when the meal has a numeric full-recipe page id; short internal-library writeups stay in the catalog for matching but are not listed.

**Limits:** TheMealDB still needs at least three overlapping sale ingredients and a priced shopping plan. CI/e2e clones seed dinners as linked TheMealDB rows (`db/ci/024_themealdb_rank_seed_clones.sql`) so `yum4less_test` is not empty; owner `yum4less_dev` uses real imports. Fake CI meal ids `900001+` are not shopper URLs.

**Evidence:** `npm test` **1097/1097** this session. `npm run test:e2e:ci` **28 passed** / 2 skipped. Build inside the e2e gate passed.

### 2026-08-20 — Dinner results: price ? + full-recipe link

- **Theme:** Price heads-up on Dinner recommendations is no longer a full banner. Recipe steps can link out to fuller TheMealDB instructions.
- **Shipped:** Lone `?` next to the Dinner recommendations title (same HelpHint pattern as store coverage). Map/discovery still uses the full heads-up banner. Expanded meals with a TheMealDB attribution URL show **Open full recipe instructions**. Internal library dinners have no invented outbound link.
- **Honest limits:** TheMealDB is a text blob (`strInstructions`), not a structured cook plan. Quality varies. Original blog `strSource` URLs are not stored yet. Internal recipes remain short curated steps.
- **Evidence this session:** `npm test` **1093/1093**. `npm run test:e2e:ci` **28 passed** / 2 skipped (after cleaning a mixed `.next` cache). `npm run build` ran inside e2e:ci (pass).

### 2026-08-20 — Store picker coverage behind help hint

- **Theme:** Sale-coverage ratios on “Which stores should we use?” are no longer always-visible shopper copy.
- **Shipped:** Small `?` next to the heading (same HelpHint pattern as ZIP/radius). Modal: tracked dinner-ingredient count + per-store estimated-price counts. Same help on the leftover Settings store fields if that panel is mounted.
- **Honest limits:** The tracked count is unique ingredients used in the current recipe library (often ~250 locally), not a promise of that many priced items this week. Expanding recipes is a catalog/ingest slice, not this UI change.
- **Evidence this session:** `npm test` **1089/1089**. `npm run test:e2e:ci` not run (no e2e spec or navigation wiring change).

### 2026-08-20 — Pantry checklist jump, accordion scroll, device-local Saved

- **Theme:** Pantry picking no longer drops checked rows; dinner cards scroll into view; Save meal uses this-browser storage (no user accounts).
- **Shipped:** Stable near-miss checklist (merge + skip follow-up loading flash); removed Add pantry item combobox; accordion `scrollIntoView` on expand; `yum4less.saved-meals.v1` localStorage + Saved tab list. Cross-device sync still needs accounts later.
- **Honest limits:** Suggested list is near-miss ingredients only — staples that never appear as 1–4-item misses cannot be checked. Saved totals are snapshots, not live prices.
- **Evidence this session:** `npm test` **1087/1087**. `npm run test:e2e:ci` **28 passed** / 2 skipped. `npm run build` ran inside e2e:ci (pass).

### 2026-08-20 — Splash brand title + CC0 photos

- **Theme:** Give Yum4Less the top of the splash; push intro copy down; fill the gap with grocery/dinner photos.
- **Shipped:** Large `Yum4Less` heading; CC0 WebP mosaic (produce aisle, peppers, plated dinner) in `public/splash/`; tagline + estimate copy stay below the photos. Continue unchanged.
- **Evidence this session:** `npm test` **1085/1085**; `npm run test:e2e:ci` **28 passed** / 2 skipped. `npm run build` ran inside e2e:ci (pass).

### 2026-08-20 — Splash intro copy (no loading line)

- **Theme:** Splash still has Continue (auto-advance timer remains). Replace “Loading your setup…” with plain-language what/why copy.
- **Shipped:** Dinner-planner intro + estimate/verify-in-store line. No cheapest / save-money claims.
- **Evidence this session:** `npm test` **1085/1085** (splash unit added). `npm run test:e2e:ci` **28 passed** / 2 skipped (mockup S6 + H12). `npm run build` ran inside e2e:ci (pass).

### 2026-08-20 — Onboarding wizard setup UI (`feat/onboarding-wizard`)

- **Theme:** Split the live Settings form into a sequential, mobile-first setup wizard; reuse GPS/ZIP/map/prefs/rank. Home/Deals/Cook/Saved visual restyle (Section H) and Q34/Q35 stay out of this slice.
- **Shipped on branch:** splash (2s, skip/shorten for reduced-motion); GPS vs ZIP equal-weight; GPS allow → radius (default 5 mi, no GPS pin map); GPS deny → ZIP; ZIP → Leaflet pin screen → arrow commits (no Yes/Pick-again); `/api/market-search` on leaving radius; shopping-style tiles; store checkboxes; budget then dietary; 6-tab nav with **Feedback** always open; locked tabs tappable with remaining-step copy; chrome moon/sun theme toggle. ZIP pin reuses cached pin when present so the e2e fast path does not re-hit geocode.
- **Not shipped:** Section H restyle; different compact Settings-after-setup (Q35); mockup HTML remains throwaway (`e2e/onboarding-wizard-mockup.spec.ts` skipped, S6). Work is **not** on `master` (`389db47`).
- **Evidence this session:** `npm test` **1084/1084**; `npm run test:e2e:ci` **28 passed** / 2 skipped (mockup S6 + H12). `npm run build` ran inside e2e:ci (pass). Integration tests not required (no DB/ingest persist change). Semgrep not run (UI/setup flow only).
- **Honest limits:** Not merge-ready to `master` until the owner reviews the branch. Homelab image unchanged.

### 2026-08-20 — Owner questionnaire for mockup-to-live UI (no product UI change)

- **Theme:** Capture wants + leads for each mockup screenshot vs live Settings/ZIP-pin/Welcome flow before any rewrite.
- **Shipped (docs-only):** [`docs/redesign/onboarding-wizard-owner-answers.md`](docs/redesign/onboarding-wizard-owner-answers.md). Linked from `docs/redesign/README.md`.
- **Not shipped:** No `src/` UI change. Implementation waits on filled answers. Old UI remains `389db47` on `master`.

### 2026-08-20 — Onboarding-wizard mockup in e2e (no product UI change)

- **Theme:** Load the static GPS/ZIP wizard HTML in Playwright without touching production app code.
- **Shipped (test-only):** `e2e/fixtures/yum4less_onboarding_wizard_v3.html` + harness that injects `src/app/theme-tokens.css`; `e2e/onboarding-wizard-mockup.spec.ts` (welcome → GPS/ZIP pin → D7 light/dark). Map in `e2e/README.md`.
- **Not shipped:** This is **not** Settings-first product UX. Mockup still has a sixth Feedback tab and no ZIP field / save / store picker.
- **Evidence this session:** isolated mockup spec **1/1**; `npm run test:e2e:ci` **28 passed** / 1 skipped (H12). `npm test` not required (no `src/` change).

### 2026-08-20 — Layman security/UX Q&A (audit-only, no code)

- **Theme:** Owner asked 30 plain-language questions (keys, HTTPS, XSS, SQL, rate limits, CSRF, CORS, headers, 404, robots, ToS, feedback-vs-reviews, etc.).
- **Shipped:** Read-only answers in [`docs/audits/layman-security-ux-qa-2026-08-20.md`](docs/audits/layman-security-ux-qa-2026-08-20.md). No product code.
- **Evidence this session:** Live `https://yum4less.com/` HTTPS `200`; `/robots.txt` and `/sitemap.xml` 404; `/feedback` 200; no HSTS/CSP on live headers. Postgres MCP: `customer_feedback` table present. Later the same day: specialist reports folded in (phone overlap, ranking APIs vs feedback writes, FAQ/sitemap not for v1).
- **Honest limits:** Playwright MCP could not browse (Chrome-for-testing missing); Semgrep MCP timed out; `npm test` not run (no implementation). Not a pentest or “production-ready” claim.

### 2026-08-10 — Owner console pagination + analytics by session

- **Theme:** Browse beyond the first 50 feedback/analytics rows; group analytics by session.
- **Shipped:** `offset` + `hasMore` on `GET /api/feedback` and `GET /api/analytics/events`; `/owner` **Show next 50** load-more; analytics UI groups events per `session_id`.
- **Evidence this session:** `npm test` **1074/1074**.
- **Honest limits:** Load-more pages accumulate in the tab; a single session may span pages until enough events are loaded.

### 2026-08-06 — Owner console for feedback + analytics (`/owner`)

- **Theme:** Friendly owner view after public feedback feed removal — no shopper nav link.
- **Shipped:** `/owner` unlock with `YUM4LESS_FEEDBACK_ADMIN_KEY` (sessionStorage); lists via `GET /api/feedback?limit=` and new `GET /api/analytics/events` (Postgres sink only for analytics rows). Docs: [`docs/feedback-path.md`](docs/feedback-path.md).
- **Evidence this session:** `npm test` **1070/1070**.
- **CI / GHCR:** [**31070957928**](https://github.com/sfh1980/Yum4Less/actions/runs/31070957928) @ **`f337317`** — verify / integration / e2e / semgrep / **publish-image** / **publish-ingest-image** (confirm in run).
- **Rollback pin:** **`f337317`**. Watchtower floats on `:homelab`.
- **Honest limits:** Page is obscurity + key, not SSO; analytics list empty unless `YUM4LESS_ANALYTICS_SINK=postgres`. Confirm Watchtower pull + `/owner` on live.

### 2026-08-04 — ZIP search-center map picker + Settings GPS/ZIP button order

- **Theme:** ZIP store search uses a shopper-picked map pin as the radius center; Settings CTAs emphasize GPS first.
- **Shipped:** “Find stores based on my ZIP” opens modal map + confirm (“Use this as your search center?”); cancel notice; `yum4less.zip-search-centers.v1` cache; `resolveLocationInput` honors ZIP+coords (pin center, ZIP label); radius re-search from cached pin. GPS button label **For Better Results, Use My GPS Location** (left); ZIP Find (right, primary).
- **Evidence this session:** `npm test` **1060/1060**; `npm run test:e2e:ci` **27 passed / 1 skipped**.
- **CI / GHCR:** [**30944198468**](https://github.com/sfh1980/Yum4Less/actions/runs/30944198468) @ **`eaee42a`** — verify / integration / e2e / semgrep / **publish-image** / **publish-ingest-image** all **success**. App: `ghcr.io/sfh1980/yum4less-app:{eaee42a,homelab,latest}` digest `sha256:380841bc…`.
- **Rollback pin:** **`eaee42a`** (supersedes `732cd22`). Watchtower floats on `:homelab`.
- **Honest limits:** Confirm TrueNAS Watchtower pull + ZIP picker / GPS button copy on `https://yum4less.com/`; single-ZIP beta makes multi-ZIP pin cache hard to exercise live.

### 2026-08-04 — CI high-audit unblock for Watchtower image (`732cd22`)

- **Theme:** Unblock `npm audit --audit-level=high` so master CI can finish `publish-image` / `publish-ingest-image` after the UI-trim + Tunnel docs push.
- **Shipped:** `package.json` overrides — `brace-expansion@1` → `1.1.18`, `brace-expansion@5` → `5.0.9`, `undici` → `7.29.0`, `postcss` → `8.5.25` (keep `sharp` `0.35.3`). Local `npm audit --audit-level=high` → **0 vulnerabilities**.
- **CI evidence:** Prior run [**30927963041**](https://github.com/sfh1980/Yum4Less/actions/runs/30927963041) @ `2af7b81` failed on audit. Follow-up [**30928503594**](https://github.com/sfh1980/Yum4Less/actions/runs/30928503594) @ **`732cd22`** — verify / integration / e2e / semgrep / **publish-image** / **publish-ingest-image** all **success**. App image: `ghcr.io/sfh1980/yum4less-app:{732cd22,homelab,latest}` digest `sha256:4f55282c…`.
- **Rollback pin:** **`732cd22`**. Watchtower floats on `:homelab` (and ingest `:homelab` / `:latest` as configured).
- **Honest limits:** Confirm TrueNAS Watchtower pull + trimmed shopper UI on `https://yum4less.com/`; browser analytics rows need the new app image (build-time `NEXT_PUBLIC_*`).

### 2026-08-04 — Shopper UI copy trim (feedback + trust expand)

- **Theme:** Remove operator/dev-facing text from the public UI before the next image publish; keep core estimate honesty.
- **Shipped:** `/feedback` — remove analytics transparency panel and public recent-feedback feed; shorten hero/form hints. Settings / Deals / ingredient primers shortened. Trust expand compressed to three plain sections (drop ingest/gates/OSM/cache jargon). Docs: [`docs/feedback-path.md`](docs/feedback-path.md).
- **Also this session (ops + publish path):** Cloudflare Tunnel documented live ([`docs/homelab-deploy.md`](docs/homelab-deploy.md) §12); Dockerfile/CI bake `NEXT_PUBLIC_YUM4LESS_ANALYTICS=1` into published app images so browser analytics can hit Postgres sink after Watchtower pulls `:homelab`.
- **Evidence this session:** `npm test` **1054/1054**.
- **Honest limits:** Live site updates after this commit’s CI `publish-image` + Watchtower (or manual) pull; M148 analytics notice/opt-out still not implemented.

### 2026-07-26 — TrueNAS ingest + Watchtower hardware deploy CLOSED (docs)

- **Theme:** Record completed TrueNAS enablement of ingest + Watchtower — documentation only; no application code changes. Pending Dockerfile.ingest / `.dockerignore.ingest` notes already on master as `0a4aa55`.
- **Shipped (ops + docs):** [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10–§11 marked **deployed and verified**; Resume / Decision log updated. Ingest in the **same** `yum4less` Custom App as `db`/`app`; app on **`:homelab`** with Watchtower enable label; Watchtower as **sibling** Custom App (docker.sock only).
- **Evidence (owner TrueNAS session — cited, not assumed):**
  - One-shot dry-run `YUM4LESS_INGEST_ONCE=1` against production data for ZIP **`23111`**: live scrapes for Kroger, Aldi, Publix, Food Lion, Walmart; **33** Publix `price_observations` synced; **15** TheMealDB meals imported; `check:ranked-price-freshness` **246/246** fresh across six sources; trailing success line `Scheduled pricing ingest completed.`
  - Watchtower logs: `Using notifications: discord`; `Only checking containers using enable label`; scoped to **app + ingest**; **db** unlabeled/excluded by design.
- **Still open (explicit — not folded into closed):** unattended **3am** cron confirmation; Watchtower first hourly scan; backup/restore drill on TrueNAS target; public/WAN via **Cloudflare Tunnel** (plan shifted from traditional reverse proxy + TLS; work **not started**).
- **Not claimed:** deploy-ready / production-ready / unattended cron proven / WAN-exposed.

### 2026-07-24 — Homelab ingest + Watchtower merged and GHCR-published

- **Theme:** Land the previously uncommitted ingest/Watchtower slice on `master` and record real publish evidence (same standard as app-image [29792952906](https://github.com/sfh1980/Yum4Less/actions/runs/29792952906)).
- **Shipped on master:** `29b83ea` — `Dockerfile.ingest`, `.dockerignore.ingest`, `docker/ingest/*`, TrueNAS fragments, `publish-ingest-image`, app/ingest `:homelab` tags, `YUM4LESS_EXTERNAL_POSTGRES` TCP path, [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10–§11. Follow-ups: `47cef6b` (spawn-safe d.ts exports for typecheck), `54e7b60` (Next **15.5.21** + `postcss`/`sharp` overrides — unblocked new high `npm audit` gate).
- **Evidence:** Full pipeline green [**30104150018**](https://github.com/sfh1980/Yum4Less/actions/runs/30104150018) @ **`54e7b60`** — verify / integration / e2e / semgrep / **publish-image** / **publish-ingest-image** all success. Manifests confirmed: `ghcr.io/sfh1980/yum4less-ingest:{54e7b60,homelab,latest}` (shared amd64 digest `sha256:1c8e2f38…`); `ghcr.io/sfh1980/yum4less-app:{54e7b60,homelab}` (shared amd64 digest `sha256:deab73cd…`).
- **Rollback pin:** **`54e7b60`** (immutable SHA). `:homelab` / `:latest` are mutable floats for Watchtower.
- **Honest limits (superseded in part by 2026-07-26):** Hardware dry-run was open at publish time; now closed for manual one-shot. Unattended cron / Watchtower first scan / backup drill / WAN still open. TrueNAS Apps vs Watchtower lifecycle caveat still §11.4.

### 2026-07-23 — Homelab ingest container + Watchtower (docs/CI) — superseded by publish evidence

- **Theme:** Separate TrueNAS ingest service (not baked into app image) + label-scoped Watchtower; TCP `ensure-test-db` path for containers without Docker socket.
- **Shipped (then uncommitted / pre-master):** `Dockerfile.ingest` (Node 22 + Playwright Chromium + cron + `postgresql-client`); `docker/ingest/entrypoint.sh` (`YUM4LESS_INGEST_ONCE` dry-run, in-container `0 3 * * *`, or `YUM4LESS_INGEST_CRON=0` + host exec); `YUM4LESS_EXTERNAL_POSTGRES=1` TCP/`psql` backend in `spawn-safe` + ensure/migrate/snap; CI `publish-ingest-image` + app/ingest `:homelab` float tags; TrueNAS YAML in [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10–§11; fragments in `docker/truenas/custom-app-fragments.yml`.
- **Superseded:** Publish claim → **2026-07-24** entry @ `54e7b60` / [30104150018](https://github.com/sfh1980/Yum4Less/actions/runs/30104150018).

### 2026-07-22 — TrueNAS Apps Custom App deploy CLOSED (docs)

- **Theme:** Record successful TrueNAS SCALE Custom App deploy and the two ops root causes that blocked earlier attempts — documentation only; no application code changes.
- **Shipped (ops + docs):** Working Custom App YAML + runbook in [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §9 — pin `ghcr.io/sfh1980/yum4less-app:f38ce73`; datasets `appPool/yum4less` / `repo` / `postgres-data`; db **no** host port; app **`3000:3000`** (LAN, not WAN); app healthcheck via Node `fetch` (wget absent in image → false unhealthy); `truenas_admin` needs `sudo docker`; use `sudo docker logs` (not only `/var/log/app_lifecycle.log`).
- **Closed issues:**
  1. **`postgres-data` permissions** — must be **UID:GID 999:999**, mode **700**, before first deploy (Postgres runs as 999).
  2. **`repo/db/init` unreadable by UID 999** — **`chmod -R a+rX`** on init tree (actual root cause of repeated `yum4less-postgres is unhealthy` / dependency-failed lifecycle errors).
- **Still open (host ops):** scheduled ingest cron on the box, backup/restore drill on target, reverse proxy + TLS before public exposure.
- **Not claimed:** deploy-ready / production-ready / WAN-exposed / unattended cron proven.

### 2026-07-20 — CI publishes app image to GHCR (TrueNAS prerequisite)

- **Theme:** TrueNAS “Install via YAML” needs a **pre-built** image; local `docker compose build` is not enough for that path.
- **Shipped:** Downstream CI job `publish-image` in `.github/workflows/ci.yml` — `needs: [verify, integration, e2e, semgrep]`, **master push only**; builds existing `Dockerfile`; pushes `ghcr.io/sfh1980/yum4less-app:<sha7>` + `:latest`. Docs: [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §8.
- **Pin rule:** SHA tag = deploy/rollback source of truth; `latest` = convenience only.
- **Visibility:** Intended private by default, but Actions-published packages from the **public** GitHub repo inherit **public** visibility (`GITHUB_TOKEN` cannot flip to private). Tradeoff: TrueNAS pulls **without** a PAT. Private later = manual package admin / unlink if desired.
- **Evidence:** Full pipeline green [**29792952906**](https://github.com/sfh1980/Yum4Less/actions/runs/29792952906) @ `f38ce73` — verify / integration / e2e / semgrep / **publish-image** all success. Image: `ghcr.io/sfh1980/yum4less-app:f38ce73` (**public**; unauthenticated `docker pull` OK). Prior partial @ `931b1fa` / [29792431759](https://github.com/sfh1980/Yum4Less/actions/runs/29792431759) (push OK, private-enforce failed).
- **Out of scope:** TrueNAS YAML, reverse proxy/TLS, Dockerfile changes.

### 2026-07-20 — App containerized (Compose `app` + `db`) — local proof

- **Theme:** Close the silent homelab gap — TrueNAS Apps only run containers; the shopper app had never been Dockerized (Postgres-only compose before).
- **Shipped:** Multi-stage `Dockerfile` (Node **22** bookworm-slim, `output: "standalone"`, non-root `node`, HTTP healthcheck); Compose **`app`** service with `depends_on: db` + `condition: service_healthy`; loopback publish `127.0.0.1:3000`; `DATABASE_URL` → `db:5432`; debug/API-write flags forced OFF; `package.json` `engines` + `compose:*` scripts; docs (README, `.env.example`, `docs/homelab-deploy.md`) mark host `next start` / `npm run dev` as hot-reload-only where superseded.
- **Proof-of-catch (this machine):** `docker compose build` OK; `docker compose up` — db healthy before app start; app **healthy**; `GET /` 200; `POST /api/market-search` with `37.6085,-77.3739` returned `ok: true` / `dataSource=database` (DB over Compose network).
- **Evidence this session:** `npm test` **1052/1052**; `npm run test:integration` **48/48**; `check:compose-db-bind` OK; Semgrep clean on Dockerfile / compose / next.config / package.json / `.dockerignore`.
- **Out of scope:** TrueNAS YAML, reverse proxy/TLS, LAN bind.
- **Not claimed:** deploy-ready / CI green until owner commits and inspects a `gh` run.

### 2026-07-20 — Homelab readiness convergence verdict — CLOSED (audit)

- **Theme:** Consolidate Tier 1 / Tier 2 / vision-gap / Decision log; re-verify CLOSED; strict OPEN-BLOCKS bar for real-user homelab testing. **No product fixes.**
- **Deliverable:** [`docs/audits/homelab-readiness-verdict.md`](docs/audits/homelab-readiness-verdict.md).
- **Verdict:** **READY WITH CONDITIONS** — OPEN-BLOCKS **empty**. Conditions = host ops (loopback confirm, cron+heartbeat, first ingest, backup drill on target, TLS if beyond LAN).
- **Agents:** `@senior-auditor` + `@verifier` (both READY WITH CONDITIONS).
- **CI at HEAD:** [**29771363076**](https://github.com/sfh1980/Yum4Less/actions/runs/29771363076) @ `1b23b0c` success.
- **Not claimed:** unattended cron proven on hardware; live `docker port` / Postgres freshness this session (Docker Desktop down).

### 2026-07-20 — Vision-gap sprint items 1–6 (privacy, geo completion, Cook empty, price wording) — CLOSED

- **Theme:** Confirmed Sean decisions from vision-gap report; separate from open P1-ops freshness.
- **Items 1–4:** External API Integration Standard; no exact-coord persistence; geolocation-only Settings completion; bottom-nav finish-setup hints.
- **Item 5:** Central `invalidateRankedResults` on Settings save, Welcome continue, and store-scope change; Cook always mounts results panel with honest idle copy (“Suggest recipes on Home first”) — **no auto-redirect**.
- **Item 6:** Shopper price wording keyed off `getSaleConfidence` levels; **`directional-provider-match` → Low** (weak `matchConfidence` &lt; 0.7). High/Medium keep flexed `$X` copy; Low has no bare dollar.
- **Evidence:** `npm test` **1052/1052**; Semgrep clean on touched product files; remote CI green [**29770945822**](https://github.com/sfh1980/Yum4Less/actions/runs/29770945822) @ `adf0a62` (e2e assert follow-up after `61f72bb`).
- **Not claimed:** P1-ops freshness closed; Settings ZIP-first visual layout rewrite (flagged separately).

### 2026-07-17 — Vision-gap sprint items 1–4 (docs + privacy + geo completion + nav hints) — local-green; CI pending commit

- **Theme:** Execute confirmed Sean decisions from vision-gap report; keep separate from open P1-ops freshness work.
- **Item 1 (docs):** Retired “two API routes forever”; Decision log **External API Integration Standard**; updated `web-backend-standards` agent + `docs/provider-integration-pattern.md`.
- **Item 2:** Exact lat/lng no longer written to Settings `localStorage`; strip on read/write; re-request geolocation each visit when `locationMode === geolocation`.
- **Item 3:** Settings save/complete succeeds on browser coordinates alone; ZIP required only for ZIP/fallback path.
- **Item 4:** Bottom nav shows “Finish setup to unlock this” (pre-setup) and “Suggest recipes on Home first” (Cook gated).
- **Items 5–6:** Investigation + copy checkpoint only — **not** implemented this entry (await Sean).
- **Evidence this session:** `npm test` **1040/1040**; Semgrep clean on touched files; e2e proof `coordinate-first` privacy/geo-complete + nav finish-setup assert green. Full `test:e2e:ci` / remote `gh run` **not** claimed (needs commit). Local ranked-store e2e flakes align with open P1-ops `fresh_24h=0` on `yum4less_dev`.
- **Flag:** Settings UI remains ZIP-first visually (default form ZIP `23111`); propose copy/layout pass separately if misleading after geo-only completion.

### 2026-07-17 — Vision-gap + UI stub sweep (investigation checkpoint) — CLOSED (audit)

- **Theme:** Full local gates + vision adherence check + UI stub inventory; separate from STOP-SHIP / P1-ops fix history.
- **Shipped (docs-only):** [`docs/audits/vision-gap-and-ui-stub-report.md`](docs/audits/vision-gap-and-ui-stub-report.md). **No product bug fixes. No bulk coming-soon apply.**
- **Part 1 (this session):** unit **1033/1033**; integration **48/48**; e2e **26 pass / 1 skip / 0 fail**. CI for audited SHA: [**29550992071**](https://github.com/sfh1980/Yum4Less/actions/runs/29550992071) @ `43768ff`.
- **Part 2 highlights:** literal “two API routes forever” vs eight handlers; exact coords in `localStorage` vs retention ethos; chain-neutral partial; identity expand still OFF; vision “cheapest / no data leaving household” tensions — open questions for Sean.
- **Part 3:** Saved + map context-only already honest; cuisine R11 absent (not a fake control); broken bucket includes pantry-step false-completion, TheMealDB 500 path, `fresh_24h=0`, name-based map join. Three example copy blocks awaiting tone confirm.
- **Not claimed:** deploy-ready / demo-complete; P1-ops freshness closed (MCP still `fresh_24h=0` on `yum4less_dev`).

### 2026-07-16 — Tier 2 SS-1: Postgres loopback bind + compose-lint gate — CLOSED

- **Theme:** STOP-SHIP fix — stop publishing local Postgres on all interfaces.
- **Shipped:** `docker-compose.yml` → `127.0.0.1:5433:5432`; `npm run check:compose-db-bind` + CI verify step; `docs/homelab-deploy.md` corrected (was falsely claiming localhost-only).
- **Credentials:** Local-dev `postgres:postgres` retained as intentional loopback convention (`.env.example` / scripts). Homelab doc now requires rotate-away for any non-loopback deploy. No non-loopback production publish found in this repo.
- **Proof-of-catch:** Before — `docker port` → `0.0.0.0:5433` + `[::]:5433`; `netstat` LISTENING on `0.0.0.0:5433`. After recreate — `127.0.0.1:5433` only. Gate fails on unqualified `5433:5432`, passes on loopback bind.
- **Evidence this session:** `npm test` **1033/1033**; `check:compose-db-bind` OK; Semgrep clean on `check-compose-db-bind.mjs` / compose / homelab doc / package.json (pre-existing `ci.yml` mutable-action-tag findings only). CI green: [**29550801049**](https://github.com/sfh1980/Yum4Less/actions/runs/29550801049) @ `8e1e705`.

### 2026-07-16 — Tier 2 comprehensive audit (audit-only) — CLOSED

- **Theme:** Security / data integrity / efficiency / Playwright edge-case coverage sweep after Tier 1 close.
- **Shipped (docs-only):** [`docs/audits/tier2-comprehensive-audit-report.md`](docs/audits/tier2-comprehensive-audit-report.md). **No product/code fixes.**
- **STOP-SHIP:** Compose publishes Postgres on `0.0.0.0:5433` with default `postgres:postgres` (live `netstat`/`docker port` proof); `docs/homelab-deploy.md` incorrectly claims localhost-only.
- **Key findings:** pantry-step false-completion (heading-only assert); older migration probes still existence-class; late TheMealDB DB read → 500 vs 503; deep e2e edge matrix largely uncovered; `yum4less_dev` still 0 fresh PO in 24h. Settings gate + Home Ingredients blank re-verified CLOSED (not reopened).
- **Verdict:** **not** Tier-2 / unattended-homelab ready. Checkpoint before any fix sprint.
- **Evidence this session:** typecheck **0**; identity-SSOT OK; `npm audit` 2 moderate; Semgrep 0 on scanned set; Postgres MCP identity sweep clean; backup-restore drill OK (281/308/23). Full unit/integration/e2e/CI **not** re-claimed this pass.


### 2026-07-16 — Identity SSOT CI gate (A+B) — CLOSED

- **Shipped:** `npm run check:identity-ssot` (client pair-graph allowlist) + structural `IDENTITY_SEED_SPECS` / `migrationEffectPresent`→`identitySeedEffectPresent` meta-tests; wired into CI verify next to typecheck.

### 2026-07-16 — Wave 2 Part 2: Phase 0 identity Q1–Q3 locked — CLOSED (policy)

- **Locked:** Q1=**1B** (Publix locator = Settings-selectable; align map merge/suppress — map drifted). Q2=**2A** (ephemeral search pins permanently out of identity/reconciliation; no provisional tier). Q3=**3B** (three-layer model intentional: DB / map merge / Settings).
- **Shipped this slice:** Decision log row + onboarding doc product-model section. **No** map-merge code change (Q1 implementation deferred — own small slice; see changelog note below).
- **Q1 implementation scope (not started):** Small dedicated slice — remove Publix locator from `isMapContextCatalogStore`, cover merge/suppress unit tests, smoke Settings+map Publix pin. Do **not** fold into an unrelated Tier/Wave pass.
- **Out of scope:** Slice D matcher; expand flag flip; Q1 code.

### 2026-07-16 — yum4less_dev Aldi identity live repair — CLOSED (Wave 2 Part 1)

- **Theme:** Manual data heal (not a code change) — align `yum4less_dev` Aldi graph with what ledger `023` already claimed.
- **Before:** one identity `aldi-mechanicsville` with confirmed aliases `match_method=self` (canonical catalog) + `match_method=pointer` (OSM) — functionally merged, **not** seeded shape. `identitySeedEffectPresent("023")` / `migrationEffectPresent("023")` both **false**.
- **Repair:** `npm run db:backup` → delete that identity graph only (stores / `price_observations` untouched) → apply `db/init/023_seed_aldi_mechanicsville_identity.sql` directly (not via `applyPendingMigrations`; ledger already had `023`).
- **After:** one identity `aldi-mechanicsville` (canonical), two confirmed `seeded` aliases (`aldi-mechanicsville` canonical + `osm-node-6531578976` alias). Both probes **true**. Ledger row unchanged. Integrity counts unchanged (stores=281 / PO=308 / migrations=23).
- **Backup (rollback):** `backups/yum4less_dev_2026-07-17T00-54-12-961Z.sql` (pre-delete).
- **Out of scope:** Phase 0 identity design memo (Wave 2 Part 2); expand flags remain OFF — no user-facing behavior change.
- **Evidence:** heal script used shipped `createPostgresMigrationDb` + `identitySeedEffectPresent` / `migrationEffectPresent` (same probe path as Kroger heal).

### 2026-07-16 — Wave 1c: Scale risk C portal rule docs — CLOSED (Wave 1 complete)

- **Theme:** Document the Pass 5 overlay/inert rule so new overlays do not reintroduce AT-hidden dialogs under an inerted shell.
- **Shipped (docs-only):** Scale risk C checklist in `.cursor/rules/yum4less-frontend-workflow.mdc` and `.cursor/agents/web-frontend-standards.md` — any `useModalDialog` overlay that would mount under `.meal-planner-grid` / `.meal-planner-grid-col` **MUST** `createPortal` to `document.body` (or a non-inert root), or mount outside the shell. Reference: `single-store-map-overlay.tsx`.
- **No behavior change:** no product/UI code edits.
- **Wave 1 close-out:** 1a + 1b + 1c all CLOSED — CI-trust-tax effort complete. Next: Wave 2 (Aldi `023` + Phase 0 memo).
- **Evidence:** `git diff` docs-only for this slice; Continuity deferred Scale risk C → CLOSED.

### 2026-07-16 — Wave 1b: single-store-map-overlay mobile false-sync flake — CLOSED

- **Theme:** CI trust — stop treating “Dinner recommendations” heading as rank completion on the meal-card map-pill mobile path.
- **Root cause (independent of Pass 5 portal):** Test clicked Suggest, waited on heading (always mounts when `flowStep === "results"`), then waited 30s for `.meal-results-accordion-trigger` with **no** `POST /api/recommendations` coupling. Accordion only mounts when rank is ready **and** `recommendations.length > 0` → CI `element(s) not found` at `:76` (reporter `:65` = test title). Pass 5 portal/inert applies only after overlay opens — not implicated.
- **Shipped (test-only):** Mobile path uses `completePantryAndSuggestRecipes` → shared `waitForRecommendationsAfterSuggest`; `assertRecommendationsHaveMeals` fails loud on ok-but-empty (Vitest proof-of-catch). No product UI change.
- **Continuity cleanup:** Deferred overlay-mobile row closed; post–Pass 5 remote flake label corrected (mvp-flow/Cook-tab rank-wait was the recurring reported flake, not overlay).
- **Out of scope:** Wave 1c Scale risk C portal rule docs; Wave 2 Aldi `023`.
- **Evidence:** Local gates this session (`npm test` **1030/1030**; typecheck **0**; build pass; isolated overlay mobile **5/5**; `test:e2e:ci` **26 passed** / 1 skipped). Remote CI green on **`734a5bc`** — [29545388893](https://github.com/sfh1980/Yum4Less/actions/runs/29545388893).

### 2026-07-16 — Wave 1a: e2e rank-wait flake family — CLOSED

- **Theme:** CI trust — stop `waitForResponse(... status===200)` hanging as a silent timeout on non-200 or starved budgets.
- **Root cause:** Shared waiter predicate required HTTP 200 (non-200 completed responses ignored → 90s hang); fat `runCoreMvpFlow` shared one test budget with map asserts; duplicated wait pattern in helper vs `runCoreMvpFlow`.
- **Shipped:** `waitForRecommendationsAfterSuggest` (`Promise.all` click+wait, explicit 60s timeout, loud assert via `assertRecommendationsHttpOk`); `completePantryAndSuggestRecipes` + `runCoreMvpFlow` single call site; mvp-flow / navigation-theme describe timeout 150s; Vitest proof-of-catch for 429/4xx/5xx/ok:false; in-process ZIP geocode memoization so market-search vs rank cannot diverge into HTTP 409 under Geocodio rate-limit/seed fallback; `stale-store-selection` reload race fixed (register market-search waiter **before** `page.reload()`).
- **Out of scope:** Wave 1b overlay mobile flake; Scale risk C docs (1c); Wave 2 Aldi `023`.
- **Evidence:** see Verification snapshot this session (`npm test` **1027/1027**; `test:e2e:ci` **26 passed** / 1 skipped).

### 2026-07-16 — Wave 0: Home Ingredients market-search blank hole — CLOSED

- **Theme:** Shopper honesty on Home Ingredients — never blank when market search fails or has no market.
- **Shipped:** `IngredientsMarketUnavailable` mirrors Deals loading / `role="alert"` error / “Complete Settings…” idle-empty; wired from `meal-planner/index.tsx` when `flowStep === "ingredients"` and no `scopedMarket`.
- **Tests:** `ingredients-market-unavailable.test.tsx` — error → visible alert (not blank); loading; fallback error copy; idle empty guidance.
- **Continuity triage close-out (same slice):** Home silent market-search → Deferred **CLOSED**; Aldi `023` seeded-method mismatch → Deferred **OPEN** tracked row (heal still Wave 2); triage confirm — Coverage Slice 4 fan-out + Slice 7 (best-offer/0.55) already shipped/CLOSED; Settings-first gate bypass already **CLOSED** (Pass 5) — no reopen.
- **Out of scope:** Deals/Settings copy; retry CTA; rank/pantry errors; Aldi `023` heal; Wave 1 flakes.
- **Evidence:** Full close-out gates this session: `npm test` **1021/1021**; `npm run build` **pass**; `npm run typecheck` **0** (typecheck after build — stale `.next/types` alone can false-fail).

### 2026-07-16 — yum4less_dev Kroger identity live repair — CLOSED

- **Theme:** Manual data heal (not a code change) — align `yum4less_dev` Kroger graph with what ledger `022` already claimed.
- **Before:** two self-only identities (`kroger-02900529`, `kroger-mechanicsville`), each `match_method=self`.
- **Repair:** `npm run db:backup` → delete those two identity graphs only (stores / `price_observations` untouched) → apply `db/init/022_seed_kroger_mechanicsville_identity.sql` directly (not via `applyPendingMigrations`; ledger already had `022`).
- **After:** one identity `kroger-02900529` (canonical), two confirmed `seeded` aliases (`kroger-02900529` canonical + `kroger-mechanicsville` alias). `identitySeedEffectPresent(022)` + `migrationEffectPresent("022")` both **true**. Ledger row unchanged.
- **Backup (rollback):** `backups/yum4less_dev_2026-07-16T14-45-46-486Z.sql` (pre-delete; stores=281 / PO=308 / migrations=23).
- **Out of scope:** Aldi `023` (separate already-flagged shape: merged but not `seeded`); expand flags remain OFF — no user-facing behavior change.
- **Evidence:** heal probes + Postgres MCP sanity SQL this session; no product code diff.

### 2026-07-16 — 022/023 vacuous identity-seed probes — CLOSED

- **Theme:** Ledger honesty — `migrationEffectPresent("022"|"023")` no longer treats “identity id exists” as success.
- **Shipped:** Structural effect probes (canonical id, exactly 2 confirmed `seeded` aliases, correct store_id pairing); post-apply `assertIdentitySeedEffectAfterApply` throws (no ledger record) when both members exist but seed effect is still incomplete; unit matrix + migration-ledger integration proof-of-catch.
- **Follow-up:** `yum4less_dev` Kroger live repair — **CLOSED** same day (see changelog entry above). Aldi `023` seeded-method mismatch remains a separate finding.
- **Evidence:** close-out gates this session (`npm test`, `test:integration`, `build`, `typecheck`).

### 2026-07-16 — Tier 1 Pass 7: GitHub MCP env launcher — CLOSED

- **Theme:** Owner/infra — stop recurring GitHub MCP discovery failures without committing tokens.
- **Root cause:** Cursor MCP process lacked `GITHUB_PERSONAL_ACCESS_TOKEN` while `gh` keyring auth worked; bare Docker image entry omitted explicit `stdio`.
- **Shipped:** `.cursor/hooks/github-mcp.ps1` (token from env **or** `gh auth token`; Docker `stdio`); `.cursor/mcp.json.example` + local gitignored `.cursor/mcp.json` switched to the wrapper; AGENTS / `.env.example` / testing-release-gates MCP notes.
- **Smoke:** wrapper starts `ghcr.io/github/github-mcp-server` v1.0.4 (`starting server`). **Cursor must reload MCP / restart** for in-IDE discovery to go green.
- **Out of scope:** 022 vacuous probe; changing GitHub PAT scopes; non-Windows launcher (PowerShell matches Semgrep MCP pattern on this host).
- **Evidence:** local smoke OK; `npm test` / typecheck / build not required for docs+launcher (run if touching product code — none).

### 2026-07-15 — Tier 1 Pass 6: Postgres backup/restore drill — CLOSED

- **Theme:** Data durability — prove `pg_dump`/`psql` restore exists before unattended cron claims.
- **Shipped:** `scripts/lib/db-backup-restore.mjs` + `db-backup.mjs` / `db-restore.mjs` / `db-backup-restore-drill.mjs`; npm `db:backup` / `db:restore` / `db:backup-restore-drill`; `backups/` gitignored; [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §4.4 + README row.
- **Drill evidence (this session):** source `yum4less_dev` stores=281 / PO=308 / migrations=23 → restore into disposable `yum4less_backup_drill` → counts matched → drill DB dropped. `yum4less_dev` never wiped.
- **Safety:** restore into `yum4less_dev` refused without `--i-understand-destructively-restore-dev`.
- **Out of scope:** Pass 7 GitHub MCP; 022 vacuous probe; offsite/S3 backup; automated retention prune.
- **Evidence:** drill OK; helper unit tests **4/4**; full `npm test` / typecheck / build in close-out.

### 2026-07-15 — Pass 5 flake triage: mvp-flow rank-wait (not portal)

- **CI history:** `mvp-flow` “keeps inline trust copy” flaky on Pass 5 remote only (`4a6db23`, `898f181`). Pass 1–4 / Slice 5c–6 e2e flaked on **`single-store-map-overlay` mobile** instead — mvp-flow was not the prior flake.
- **Diff-scope:** Failure = `waitForResponse(/api/recommendations)` inside `runCoreMvpFlow` at pantry Suggest — **before** any meal-card map overlay. Portal/`SingleStoreMapOverlay` **not** implicated. Tab-gate N/A post-setup. Live inert is a weak timing theory only; isolated evidence argues against hard break.
- **Isolated:** `--repeat-each=5 --retries=0` on that mvp-flow test → **5/5 clean**.
- **Verdict:** Treat like Cook-tab local flake (same family); **do not** reopen Pass 5 for portal. Named backlog: mvp-flow rank-wait + Scale risk C (overlay portal rule).
- **Also logged:** Scale risk C — overlays nested under inert shell must portal; Settings-first gate marked CLOSED in deferred table.

### 2026-07-15 — Tier 1 Pass 5: Settings-first gate + modal inert — CLOSED

- **Settings gate:** `isAppTabEnabled` blocks Home/Deals/Cook/Saved until `setupComplete`; BottomNav disables those tabs; `handleTabChange` enforces the same rule.
- **Modal inert:** `useModalDialog` targets `.meal-planner-grid` (and legacy `.meal-planner-grid-col`); focus-trap tests plant the live class.
- **Nested overlay:** `SingleStoreMapOverlay` portals to `document.body` so inerting the grid does not hide the dialog from AT (meal-card map pill on Home).
- **e2e:** Settings-gate assertion in `navigation-theme`; api-errors Deals copy tests complete Settings before switching; local `test:e2e:ci` **25 passed** / 1 skip / 1 flaky mvp-flow.
- **Out of scope:** Pass 6 backup/restore; Pass 7 GitHub MCP; 022 vacuous probe.

### 2026-07-15 — Tier 1 Pass 4: Publix e2e pin + migration-ledger timeout — CLOSED

- **4a:** `publix-catalog-sync` integration cleanup no longer deletes shared `publix-1626`; restores CI Publix pin afterEach; e2e prep re-applies `014` bootstrap + asserts four Settings pins (`9df88fe`).
- **4b:** `applyPendingMigrations` honors `stopAfterVersion`; partial-migrate itest batches 001–013 + stops at 016 (`978ad20`).
- **Evidence:** integration **46/46**; `npm test` **1003/1003**; typecheck **0**; build pass; `test:e2e:ci` **25 passed / 1 skipped** (Publix Settings restored); remote CI **green** on **`beb56d5`** ([**29447016878**](https://github.com/sfh1980/Yum4Less/actions/runs/29447016878)).

### 2026-07-15 — Tier 1 Pass 3: rank/pantry Postgres identity parity — CLOSED

- **Theme:** Close audit finding #7 — expand-ON rank/pantry must not use empty virtual-singleton lookup while market-search uses Postgres.
- **Shipped:** `resolveServerStoreIdentityLookup` in `store-identity-server-lookup.ts`; market-search, recommendations, and pantry-coverage all share it; rank/pantry pass the resolved lookup into internal `getMarketSearchExperience` calls.
- **Out of scope:** Expand flag flip; Slice D; Settings known-pair changes.
- **Evidence:** `npm test` **1003/1003**; typecheck **0**; build pass; remote CI **green** on **`3f43d40`** ([**29445257153**](https://github.com/sfh1980/Yum4Less/actions/runs/29445257153)).

### 2026-07-15 — Tier 1 Pass 2: debug pipeline shared admin key — CLOSED

- **Theme:** Close S6 — debug dumps must not be open to anyone who can hit a non-prod LAN host with the flag on.
- **Shipped:** `YUM4LESS_DEBUG_ADMIN_KEY` required after env gate; shared `isRequestAuthorizedWithAdminKey` (Bearer / `X-Yum4Less-Admin-Key`); feedback list now uses the same helper. Production still always 404 via `isDebugRoutesEnabled()`.
- **Out of scope:** Pass 3+; `timingSafeEqual` (Tier 1 S7 P2); Next.js loopback bind enforcement (operator note in `.env.example` only).
- **Evidence:** `npm test` **999/999**; `npm run typecheck` **0**; `npm run build` pass; remote CI **green** on **`485be3c`** ([**29427921631**](https://github.com/sfh1980/Yum4Less/actions/runs/29427921631)).

### 2026-07-15 — Tier 1 Pass 1: ranked-price freshness heartbeat + exit-policy doc — CLOSED

- **Theme:** Ops truth — make 0-in-24h ranked staleness cron-visible; align homelab exit-policy docs with fail-loud code.
- **Shipped:** `src/lib/ingest/ingest-freshness-heartbeat.ts` + `scripts/check-ranked-price-freshness.ts` + `npm run check:ranked-price-freshness`; final fatal step on `ingest:weekly-ads:scheduled`; optional `YUM4LESS_FRESHNESS_WEBHOOK_URL` (native fetch); emergency `YUM4LESS_SKIP_FRESHNESS_HEARTBEAT=1`. [`docs/homelab-deploy.md`](docs/homelab-deploy.md) L20/L366-class drift fixed (any-chain / any-persist fail-loud) + heartbeat documented.
- **Policy:** Fail closed only when **aggregate** ranked in-stock freshTotal is 0; per-source lines are diagnostic (single-chain thin week does not fail).
- **Out of scope:** Pass 2+; UI shopperNotice heartbeat; expand flag flips; SaaS monitoring.
- **Evidence:** `npm test` **988/988**; `npm run typecheck` **0**; `npm run build` pass; remote CI **green** on **`8f76e8b`** ([**29426088895**](https://github.com/sfh1980/Yum4Less/actions/runs/29426088895)) — verify/integration/semgrep/e2e (e2e: 24 pass / 1 known overlay flaky / 1 skip). Local smoke: `check:ranked-price-freshness` correctly exited 1 on stale `yum4less_dev` (0/308 fresh).

### 2026-07-15 — Tier 1 foundation hardening audit (read-only)
- **Shipped:** [`docs/audits/tier1-foundation-hardening-report.md`](docs/audits/tier1-foundation-hardening-report.md) — OWASP/resilience/data-integrity/trust/observability pass; supersedes reliance on full-system-run “gates green” alone for homelab precursors.
- **Evidence this session:** lint OK; unit **978/978**; typecheck **0**; build OK; integration **45/46** (migration-ledger timeout ×2); e2e **24 pass / 1 fail** (Publix missing from Settings select — trace saved); `npm audit` 2 moderate; Postgres MCP: 308 obs, **0** fresh_24h, ledger through **023**, Kroger twins still unmerged; Semgrep 0; GitHub MCP still error (root-caused to PAT/MCP env — used `gh`).
- **Limits:** Playwright MCP exploratory + live inert/a11y deep pass degraded; no live DB-kill chaos. **Not** verified / deploy-ready / Tier-2-complete.

### 2026-07-11 — Option A Slice 6: identity source onboarding doc — CLOSED

- **Theme:** Pluggability bar — real onboarding checklist + hypothetical Dollar Tree dry-run (docs only).
- **Shipped:** Full rewrite of [`docs/store-identity-source-onboarding.md`](docs/store-identity-source-onboarding.md) (replaced Slice 1 stub): checklist reflecting Slices 1–5c (write-path inventory, canonical-member honesty, structural 0.85, client lookup rule); interim allowlist vs Slice D framing; anti-patterns; lessons; Dollar Tree appendix; backlog #18 out-of-scope pointer.
- **Out of scope:** No Dollar Tree code / `source_system` registration; no flag flips; Slice D still open.
- **Evidence:** Docs + continuity only — no test/build gate required for this slice.

### 2026-07-11 — Option A Slice 5c: ingest upsert-alias — CLOSED

- **Theme:** First live alias writes outside a reviewed migration — self-alias on catalog upsert/refresh + allowlisted Aldi→OSM explicit-pointer only.
- **Shipped:** `ensureStoreSelfAlias` / `ensureAllowlistedPointerCrossLink` in `store-identity-ingest-aliases.ts`; hooked from **both** `upsertCatalogStores` and Aldi refresh (`updateIngestedRankedStoreCoordinates`); conflict log `store-identity.ingest-alias-conflict`; counters `aliasesEnsured` / `aliasesSkipped` / `aliasConflicts` in sync job output.
- **Policy:** `match_method=self` @ 1.0; pointer @ 1.0 (exact id; notes reference seed 023’s fixture 0.985); no proximity matcher; Kroger slug↔API not auto-linked; `AUTO_CONFIRM` + master expand **OFF**.
- **Tests:** 8 named cases (idempotency, self-alias, explicit-pointer, negative-no-proximity, negative-bad-pointer, collision, Kroger-non-link, rollback) — integration for DB/collision/rollback; unit for allowlist policy.
- **Out of scope:** Slice D batch matcher; provisional attach; default flag flip.
- **Evidence:** `npm test` 978/978; integration 46/46; build + typecheck clean; e2e 25 passed / 0 flaky / 1 skipped H12; Postgres MCP confirmed Aldi `self`+`pointer` and separate Kroger self-aliases on `yum4less_dev`; remote CI [29171092681](https://github.com/sfh1980/Yum4Less/actions/runs/29171092681) green on `dd4131d`.

### 2026-07-11 — Option A Slice 5b: Map pin contract (expand-aware scope) — CLOSED

- **Theme:** Thin Map contract after 5a — no Leaflet rewrite; close silent-empty when server emits canonical pins but client selection still holds an alias.
- **Shipped:** Server attaches `equivalentStoreIds` on each `nearbyStores` row from Postgres expand; client `scopeMarketSummaryToSelectedStoresForMap` / `resolveSelectedMapMarkerId` consume that payload only. **Deleted** the brief `createMapPinIdentityLookup` hardcoded mirror (would have been a third place to sync pairs). Settings known-pair stays Kroger-only. OSM suppress paths **untouched**.
- **Named finding:** Client/server expand flag mismatch can empty exact-id Map scope — closed by **server-fed membership**, not a client known-pair table. Remember: do not add another hardcoded pair registry for client surfaces that filter against server-collapsed lists; prefer payload membership (or a real identity API).
- **Tests:** linked Aldi/Kroger one-pin models; stale-alias → non-empty via `equivalentStoreIds`; highlight resolve; sanitizer preserves membership; unlinked OSM 1.5 mi suppress regressions — `store-identity-map-pin-5b.test.ts`.
- **Out of scope:** **5c** ingest upsert-alias; Leaflet pixel e2e; **no default flag flip** (master + `NEXT_PUBLIC_` OFF including dev).
- **Evidence:** `npm test` 974/974; build + typecheck clean; e2e 25 passed / 0 flaky / 1 skipped H12; remote CI [29156347884](https://github.com/sfh1980/Yum4Less/actions/runs/29156347884) green on `69a4be0` (payload-fed fix). Prior 5b push `9a68cd7` had client known-pair — superseded.

### 2026-07-11 — Option A Slice 5a: Postgres lookup + market-search coverage/merge — CLOSED

- **Theme:** First server-path identity read of seeds **022/023**; market-search coverage expand + confirmed-link catalog collapse behind master flag.
- **Shipped:** `createPostgresStoreIdentityLookup` (confirmed aliases only + virtual singleton for unlinked); `collapseConfirmedIdentityLinkedCatalogStores`; `buildNearbyStoresForSearch` / weekly-ad + Kroger official coverage accept `equivalentStoreIds`; `getMarketSearchExperience` loads Postgres lookup only when expand ON.
- **Tests:** coverage expand ON/OFF + fail-closed exact-id bypass; linked Aldi+OSM → one canonical; unlinked → two; 1.5 mi OSM suppress still fires for unlinked near/far; Food Lion ~0.2 mi negative; integration loads real 022/023 + ignores provisional — `store-identity-market-search-5a.test.ts` + `store-identity-postgres-lookup.integration.test.ts`.
- **Out of scope:** **5b** Map pin contract; **5c** ingest upsert-alias; Slice D batch matcher; **no default flag flip** (master + sub-flags OFF including dev).
- **E2e:** local full suite **24 passed** / **1 flaky** (Cook-tab `navigation-theme` — known backlog) / **1 skipped** (H12); no new skips.
- **Evidence:** `npm test` 966/966; integration 37/37; build + typecheck clean; remote CI [29155138961](https://github.com/sfh1980/Yum4Less/actions/runs/29155138961) green on `6d02a9a`.

### 2026-07-10 — Option A Slice 4: Aldi↔OSM identity seed — CLOSED

- **Theme:** Second real `store_identities` link — Mechanicsville Aldi catalog ↔ live OSM map-context twin.
- **Shipped:** `db/init/023_seed_aldi_mechanicsville_identity.sql` — seeded confirm when both members already exist (`match_method=seeded`, confidence **0.985**, canonical `aldi-mechanicsville`, alias `osm-node-6531578976`; **does not insert stores**); ledger probe `023` in `apply-migrations.mjs`.
- **Tests:** T1 resolver expand/canonicalize via `createLinkedAldiOsmIdentityLookup`; T2 flag-OFF exact-id; T3 Food Lion ~0.2 mi negative; T4 integration idempotent 023 + no-store-row guard + single-member no-op — `store-identity-aldi-osm.test.ts` + `store-identity-aldi-osm-seed.integration.test.ts`.
- **Settings:** **No surface changes.** Known-pair lookup remains Kroger-only (OSM not Settings-selectable when catalog Aldi present).
- **Named technical debt (updated):** Second seed (Aldi/OSM) landed via migration 023; Settings known-pair lookup remains Kroger-only because Aldi/OSM has no Settings-selectable surface (OSM is suppressed by `filterSettingsSelectableStores` when catalog Aldi is present). Generalize the lookup when Map wiring or a genuinely Settings-selectable twin pair needs it — not before.
- **Out of scope:** Map / market-search merge / ingest matcher; **no default flag flip** (master + sub-flags OFF including dev).
- **E2e flake triage (do not conflate):** Remote CI [29136665905](https://github.com/sfh1980/Yum4Less/actions/runs/29136665905) “1 flaky” = `single-store-map-overlay.spec.ts` mobile viewport — **pre-existing** (same flake on Slice 1–3 CI: [29132909311](https://github.com/sfh1980/Yum4Less/actions/runs/29132909311), [29134198168](https://github.com/sfh1980/Yum4Less/actions/runs/29134198168), [29135637011](https://github.com/sfh1980/Yum4Less/actions/runs/29135637011)); unrelated to Aldi↔OSM seed. Local full-suite gate separately saw Cook-tab `waitForResponse(/api/recommendations)` timeout once (retry pass) — **not** in CI Cook-tab logs; **unrelated by diff-scope**; isolated repeat **5/5 clean** — see Deferred backlog.
- **Evidence:** `npm test` 954/954; integration 36/36; build + typecheck clean; remote CI green on `bfe5f3a`. Slice 4 correctness not blocked by either flake.

### 2026-07-10 — Option A Slice 3: Kroger identity seed + Settings canonicalize — CLOSED

- **Theme:** First real `store_identities` / `store_identity_aliases` rows + first live Settings surface for alias-graph identity.
- **Shipped:** `db/init/022_seed_kroger_mechanicsville_identity.sql` — seeded confirm when both members already exist (`match_method=seeded`, canonical `kroger-02900529`, alias `kroger-mechanicsville`; **does not insert stores** so Settings collapse stays unchanged with flag OFF); Settings canonicalize at hydrate/autosave/save/rank-resync/market-rehydrate/UI selection behind master expand flag; narrow client known-pair lookup (`store-identity-settings-lookup.ts`); `NEXT_PUBLIC_YUM4LESS_STORE_IDENTITY_EXPAND` accepted for browser bundle.
- **Tests:** T1 stale-alias→canonical non-empty; T2 flag-OFF exact-id; T3 no over-broad link; T4 integration idempotent 022 re-apply — `store-identity-settings-canonicalize.test.ts` + `store-identity-kroger-seed.integration.test.ts`.
- **Structural finding (not fixed):** no-pointer perfect twins (distance=1, name=1, type=1, pointer=0) score exactly `1 − pointerWeight` = **0.85** = `confirmThreshold` — by weight design, will recur for Publix/Food Lion/future chains; classification uses `>=`; Kroger link is manual/seeded, not auto-confirm.
- **Named technical debt:** Settings identity lookup is currently a **hardcoded known-pair (Kroger Mechanicsville only)**; does not generalize to the next chain without a real client identity API or Postgres-backed lookup. **Revisit before/during Slice 4 (Aldi)** if a second consumer makes the pattern worth generalizing, or explicitly accept narrow-lookup-per-slice as the interim pattern if that's cheaper for now. → **Resolved in Slice 4:** second seed landed; known-pair left Kroger-only (see Slice 4 debt note).
- **Out of scope:** Aldi↔OSM, Map, Market-search merge, Ingest matcher; **no default flag flip** (master + sub-flags OFF including dev).
- **Evidence:** `npm test` 949/949; integration 33/33; build + typecheck clean; e2e 25 passed / 1 skipped; remote CI [29135637011](https://github.com/sfh1980/Yum4Less/actions/runs/29135637011) on `11fadca` (feature `892ae97`).

### 2026-07-10 — Option A Slice 2: rank/pantry identity expand + silent-empty guards — CLOSED

- **Theme:** Highest-blast fix pattern — wire `expandStoreIdsForRead` into ranking/pantry/store-scope so alias/canonical twin mismatches no longer silently empty pricing scope.
- **Shipped:** `resolvePricingScopeStoreIds` (single upstream expand); membership resolve via linked market members; merge missing scope twins into market nearby; expand-aware observation joins in `shopping-plan-builder` + `recipe-plan-coverage` (option a — provenance `store_id` kept); pass-through rehydrate expand; live path uses `createDefaultStoreIdentityLookup` (virtual singletons; no Postgres lookup this slice). Master flag **`YUM4LESS_STORE_IDENTITY_EXPAND` remains OFF** by default (including dev).
- **Tests:** T1 silent-empty ON, T2 flag-OFF regression, T3 Food Lion ~0.2 mi negative, T4 expand-bypass via `filterPriceObservationsByStoreIds`, membership false-drop guard — `src/lib/store-identity-expand-ranking.test.ts`.
- **Out of scope:** Settings, Map, Market-search, Ingest; no default flag flip; no `store_identities` seed rows.
- **Pre-Slice-3 checklist (resolved in Slice 3):** Kroger twin scorer confidence is exactly **0.85** (on `confirmThreshold`) — documented as structural; link seeded manually rather than auto-confirm.
- **Evidence:** `npm test` 943/943; integration 32/32; build + typecheck clean; e2e 25 passed / 1 skipped; remote CI [29134198168](https://github.com/sfh1980/Yum4Less/actions/runs/29134198168) on `938bb90`.

### 2026-07-10 — Option A Slice 1: alias-graph store identity infrastructure — CLOSED

**Theme:** Ship identity schema + resolvers + match policy + flags only — unused by live read paths until Slice 2.

**Shipped:**
- `db/init/021_store_identities.sql` — `store_identities` + `store_identity_aliases` (UNIQUE on `(source_system, external_id)`, partial UNIQUE on `store_id` / `snap_retailer_id`, one canonical alias per identity); ledger effect probe for `021`
- Resolvers: `resolveIdentity`, `expandStoreIds`, `expandStoreIdsForRead`, `canonicalizeStoreId`, `listAliases`, `scopeStoreIdsForPricing` + in-memory lookup; **read-time virtual singleton** for unlinked stores (no persisted singleton rows)
- Match policy: `store-identity-match-policy.ts` — proximity + name/type + pointer bonus; pair overrides; **pinned starting knobs** `hardMiles=0.15`, `softMiles=0.05`, `confirmThreshold≈0.85`, `provisionalThreshold≈0.70` — **unvalidated against real fixture pairs until Slice 2**
- Flags (all default **OFF**, including dev): `YUM4LESS_STORE_IDENTITY_EXPAND`, `…_AUTO_CONFIRM`, `…_SNAP_MATCHING`, `…_SEARCH_PROVISIONAL`
- Fixtures/tests: Kroger twin confirm, Aldi+OSM confirm (pointer bonus), ~0.2 mi Food Lion negative, expand-bypass silent-empty guard; integration constraint test
- Stub onboarding doc: [`docs/store-identity-source-onboarding.md`](docs/store-identity-source-onboarding.md) (full checklist → Slice 6)

**Explicitly out of this epic (deferred follow-up):** shopping-plan **`storeId`** (name-join fragility) — do **not** bundle into Slices 2–3; track under Deferred backlog.

**Not wired:** Settings / Map / Ranking / Market-search expand (Slice 2+). Provisional links remain debug/admin-only by policy (no admin UI in Slice 1).

**Evidence (local):** `npm test` **938/938**; `npm run test:integration` **32/32** (includes store-identity schema constraints); `npm run build` **pass**; `npm run typecheck` **0 errors**; `npm run test:e2e:ci` **25 passed** / 1 skipped (H12 baseline; no new skips)

**Remote CI:** [**29132909311**](https://github.com/sfh1980/Yum4Less/actions/runs/29132909311) **green** on **`71ac279`**

### 2026-07-10 — Geolocation denial asymmetry (P1-3) — CLOSED

**Theme:** First-visit “Use my location” denial hard-failed; return-visit auto-load already fell back to saved ZIP. Unify both paths.

**Shipped (behavioral fix, not mechanical-only):**
- `handleBrowserLocationSearch` denial callback now calls `runMarketSearchWithZipFallback` with notice `"Location access was denied — using your ZIP instead."` (same helper as Site A auto-load)
- **Side effect fixed:** denial no longer leaves `locationValidationMode` stuck on `"browser"` (ZIP field errors stayed suppressed); helper flips mode to `"zip"`
- Unit tests: Site B valid ZIP → ZIP body + notice; Site B invalid ZIP → error notice, no fetch; Site A denial regression (saved-ZIP notice)
- **Proof-of-catch:** restored hard-fail callback → Site B test failed (`expected 'error' to be 'ready'`); re-applied fix → pass

**Out of scope (unchanged):** `enableHighAccuracy` / PositionOptions; HTTPS/HSTS; Settings gate bypass (P1-1)

**Evidence (local):** `npm test` **925/925**; `npm run test:integration` **31/31**; `npm run build` **pass**; `npm run typecheck` **0 errors**; `npm run test:e2e:ci` **25 passed** / 1 skipped (baseline H12; no new skips)

**Remote CI:** [**29108969234**](https://github.com/sfh1980/Yum4Less/actions/runs/29108969234) **green** on **`295daee`**

### 2026-07-09 — TypeScript cleanup + CI typecheck gate (backlog #5) — CLOSED

**Theme:** `tsc --noEmit` hygiene from **102 errors → 0**; CI gate so drift cannot grow silently.

**Shipped:**
- **`npm run typecheck`** (`tsc --noEmit`) added to `package.json` and **verify** job in `.github/workflows/ci.yml`
- **B1 (behavioral, not noise):** `use-meal-planner.test.ts` pantry debounce test called `handleAddPantryIngredient("olive-oil")` after API changed to object shape — silently stored `[undefined]` in `pantryIngredientIds`. Fixed call + `toContain("olive-oil")` assertion; proof-of-catch: old shape fails with `expected [ undefined ] to include 'olive-oil'`
- **B3:** `listRecentCustomerFeedback(limit: number)` — widened from literal-`20` inference artifact
- Bulk mock/fixture drift: `NearbyStoreSummary` fields, stale `locationProvenance`, weekly-ad mocks, `ProcessEnv` test helpers, `@scripts-lib/*` ambient types for migration-ledger tests only

**Evidence (local):** `npx tsc --noEmit` **0 errors**; `npm test` **922/922**; `npm run test:integration` **31/31**; `npm run build` **pass**; `npm run test:e2e:ci` **25 passed** / 1 skipped

**Remote CI:** [**29066007641**](https://github.com/sfh1980/Yum4Less/actions/runs/29066007641) **green** on `a643aed` (verify typecheck + unit + build + integration + e2e)

**Limits:** No production pantry logic changed — test + type-narrowness fix only.

### 2026-07-09 — Chain coverage honesty (#13 + #16) + ingest slices 2–5 shipped — CLOSED

- **Theme:** [Backlog re-triage](#backlog-re-triage-2026-07-09) items **#13** (chain-content bias) and **#16** (Aldi/FL weekly-ad ceiling). Phase 1 concluded architectural asymmetry (Kroger official API ~full catalog vs weekly-ad chains ~17–35/97) is not closable via more search-term tuning without new product APIs; shopper honesty was the high-value fix.
- **Ingest (Track A ops only — `b9c4a46`):** `020_kroger_search_terms_p2_gaps.sql`; Flipp supplemental for unmatched tracked ingredients; `weekly-ad-ingest-store-priority` per-chain dedupe; Aldi Flipp+`aldi.us` scrape merge when matches stay &lt;25. Live `npm run ingest:weekly-ads:browser` + `npm run sync:provider-prices` on `yum4less_dev`.
- **UI honesty (Track B):** `chain-coverage-honesty.ts` + `matchedIngredientCount` on `NearbyStoreSummary`; trust banner **Chain coverage depth** section (static architecture + live per-chain ratios when market loaded); Settings multi-store live coverage summary; results `buildPricingTrustHeadsUp` skew notice when &gt;60% of priced plan items cluster on the chain with deepest coverage.
- **Phase 2a post-ingest (`yum4less_dev`, 90d, in-stock, official+weekly-ad):** Kroger **96/97**, Publix **34/97**, Food Lion **17/97** (−1 vs pre-ingest), Aldi **17/97**, Walmart **10/97**; **50/97** Kroger-only; **0/97** all five chains. Ingest parse saw Aldi **19** / Food Lion **16** matched at parse time — DB counts unchanged for Aldi/Publix/Kroger; Food Lion −1 at freshness edge. **No new search-term tuning** (same class as Walmart deferral).
- **#13 closure:** Addressed via UI honesty + documented architectural asymmetry — **not** “fixed” as equal cross-chain coverage.
- **#16 closure:** Aldi **at-ceiling re-confirmed**; UI now explains weekly-ad depth limits. Food Lion remains not a hard ceiling but deprioritized for matching work.
- **New backlog #18 (queued, out of scope):** Dollar Tree / Dollar General onboarding investigation — locator source, `getProviderRolloutForCatalogStore` pattern, ingest feasibility, 97-item catalog fit vs private-label inventory.
- **Evidence (local):** `npm test` **922/922**; `npm run test:integration` **31/31**; `npm run build` **pass**; `npm run test:e2e:ci` **25 passed** / 1 skipped. Remote CI [**29064540982**](https://github.com/sfh1980/Yum4Less/actions/runs/29064540982) **green** on **`5781348`**.

### 2026-07-09 — E2e: pin single-store-map-overlay Settings test (index-selection brittleness #2) — CLOSED

- **Theme:** Second instance this session of **index-based Settings store selection** against a **distance-sorted** dropdown (first: `navigation-theme` Kroger pin on `72f6460`). `:15` used `selectOption({ index: 1 })` + hard-coded `/Kroger —/` heading — failed in CI when closest store was not Kroger ([`d72465b` run 29062082986](https://github.com/sfh1980/Yum4Less/actions/runs/29062082986); same failure class `×±` on prior green runs).
- **Shipped:** `e2e/single-store-map-overlay.spec.ts:15` — wait for `/api/market-search`, `selectOption(kroger.id)` (ranked Kroger from response), assert dialog heading from **selected option label** (strip distance suffix), not positional index.
- **Pattern watch:** If a third e2e hits this class, consider a shared helper or lint/review pass on `selectOption({ index:` in `e2e/`.
- **Evidence:** isolated `:15` **5/5** (`--retries=0`, CI env); `npm test` **916/916**; `npm run test:e2e:ci` **25 passed** / 1 skipped. Remote CI [**29063232861**](https://github.com/sfh1980/Yum4Less/actions/runs/29063232861) **green** on **`9591428`** (verify + integration + e2e).

### 2026-07-09 — DB migration ledger (backlog #3) — CLOSED

- **Theme:** [Backlog re-triage 2026-07-09](#backlog-re-triage-2026-07-09) item **#3** — explicit prerequisite **“do before tombstones”** for trustworthy migration state on long-lived dev/homelab volumes.
- **Shipped:** `db/init/000_schema_migrations.sql`; `scripts/lib/apply-migrations.mjs` (ledger + effect probes incl. **015/016**); `applyPendingMigrations()` wired through `ensure-test-db.mjs` / `npm run db:migrate`; retires `applyPhaseCMigrationsIfMissing()`. Checksum warn-on-mismatch (fail in CI). `npm run db:probe:migration-ledger` for simulated-volume evidence.
- **Unblocks:** backlog **#4** Option A universal store reconciliation and any future `db/init/021+` tombstone/data migrations — ledger is now source of truth; incremental path no longer silently skips files.
- **Evidence (simulated volumes, before `yum4less_dev`):** partial volume (001–013 only, ledger absent) → **015** applied (plus any later files whose effects were missing, e.g. **020** when present locally), prior migrations backfilled, full ledger row count matches `db/init/*.sql`; fresh docker-style init → **`applied: []`**, all files **backfilled**, Kroger term count unchanged.
- **Evidence (local gates):** `npm test` **916/916**; `npm run test:integration` **31/31** (+2 migration-ledger specs); `npm run build` **pass**. Remote CI [**29062082986**](https://github.com/sfh1980/Yum4Less/actions/runs/29062082986) on **`d72465b`**: verify **905/905** + integration **31/31** **green**; e2e failed on overlay `:15` (**fixed in follow-up commit**). Overlay fix: `npm run test:e2e:ci` **25/25** pass locally.

### 2026-07-09 — Store-ID integrity bundle (#14–15) — CLOSED

- **Theme:** Ranking path trusted client `selectedStoreIds` without server-side membership validation or same-chain collocated collapse — twins could compete in multi-store price picking; stale localStorage ids (e.g. retired `aldi-23111`) silently dropped without user feedback or re-sync.
- **Shipped:** `resolveSelectedStoreIdsForRanking()` in `store-scope.ts` — **stale-filter against passed/rehydrated `market.nearbyStores` first**, then `collapseSameChainCollocatedCatalogStores` (0.05 mi default; Kroger 0.15 mi). Wired in `recommendation-service.ts` + `pantry-coverage-service.ts`. Option (c): drop invalid ids + `supplementaryShopperNotice` when partial survivors; primary **Selected stores unavailable** when all dropped. `RecommendationExperience.effectiveSelectedStoreIds` returned when normalization occurred; client **always** writes back on rank success (`use-meal-planner.ts`). `e2e/stale-store-selection.spec.ts` — notice + localStorage re-sync + no repeat notice on clean second rank.
- **Honest limits / scope boundary:** **Not** Option A / item 4 universal reconciliation (no locator↔OSM↔SNAP name similarity, no market-search merge changes, no new tombstones). Reuses existing `catalog-store-colocated-identity.ts` only. E2e uses route intercept to append stale id to rank POST when market-search prune would clear form state before rank — server + re-sync path still load-bearing.
- **Evidence (local):** `npm test` **911/911**; `npm run test:integration` **29/29**; `npm run build` **pass**; `npm run test:e2e:ci` **25 passed**, 1 skipped.
- **Remote CI:** [**29060088692**](https://github.com/sfh1980/Yum4Less/actions/runs/29060088692) **green** on **`debddf0`**.

### 2026-07-09 — Four audit quick wins: e2e scoped stores, ingest doc, M156 copy, overlay focus trap — CLOSED

- **Theme:** Close four independent P1/P2 items from [Backlog re-triage 2026-07-09](#backlog-re-triage-2026-07-09) with no new product behavior beyond honest copy and accessibility.
- **1 — e2e scoped-store assertion (P1):** `assertMarketSearchStoreResults` reads `selectedStoreIds` from Settings localStorage and asserts only those stores on the map overlay (not full `/api/market-search` body). Recommendations rollout gate in `runCoreMvpFlow` uses `{ requireKrogerInFixture: false }` because rank responses return scoped stores. `navigation-theme` Cook-tab test uses pantry→suggest path instead of full `runCoreMvpFlow` (avoids unrelated accordion timing flake).
- **2 — `ingest-standards.md` M128/M151 doc drift:** Agent file now matches manual-pause-only reality (no robots.txt automation, no auto-pause, no `YUM4LESS_DISABLE_INGEST_*` env vars in code).
- **3 — M156 `save money`:** Rephrased trust expanded + confidence help copy; added `/\bsave(?:s|d)?\s+(?:you\s+)?money\b/i` to `FORBIDDEN_TRUST_CLAIM_PATTERNS`; new `help-hint-content.test.ts` covers help popovers (old copy **does** match forbidden pattern — verified before fix).
- **4 — Map-overlay focus trap:** `useModalDialog` wired into `store-map-overlay.tsx`, `single-store-map-overlay.tsx`, `rank-loading-overlay.tsx`; `modal-overlay-focus-trap.test.tsx` asserts Tab stays in dialog + `.meal-planner-grid-col` inert.
- **Evidence (local):** `npm test` **903/903**; `npm run test:integration` **29/29**; `npm run build` pass; `npm run test:e2e:ci` **23 passed**, 1 skipped (post Kroger-pinned cook test); `npx playwright test e2e/navigation-theme.spec.ts --repeat-each=5 --retries=0` **15/15** pass.
- **Remote CI:** [**29056852462**](https://github.com/sfh1980/Yum4Less/actions/runs/29056852462) green on **`72f6460`** (stack: **`54a4cd6`** four fixes + **`b24bad7`**/**`72f6460`** navigation-theme CI stability).

### 2026-07-09 — Full backlog re-triage (read-only)

- **Theme:** Re-verified 17 audit/deferred backlog items against live codebase and `yum4less_dev` (not memory or prior descriptions).
- **Key refreshed evidence:** `npx tsc --noEmit` **84 errors** (grown from 64–66); no `schema_migrations` table; `applyPhaseCMigrationsIfMissing()` still omits `015`/`016`; Phase 2a per-chain coverage on `yum4less_dev` (90d, in-stock, official+weekly-ad): Kroger **96/97**, Publix **34/97**, Food Lion **18/97**, Aldi **17/97**, Walmart **10/97**; Kroger-only **50/97** (was 68/97 on 2026-07-08).
- **Quick-win queue (verified open):** e2e scoped-store assertion (**P1**); `ingest-standards.md` M128 doc drift; M156 `save money` in trust/help copy; map-overlay focus trap. **Accept/close:** OSRM for discovery (straight-line labeled); H12 e2e skip (UI shipped); Aldi Flipp at-ceiling (decision log); Walmart ranked path deferred.
- **Bundle queue:** ranking-path collocated collapse + stale `selectedStoreIds`; migration ledger before more tombstones; Settings gate bypass (geolocation denial P1-3 closed 2026-07-10).
- **Honest limits:** Read-only pass — no code changes, no `npm test` / e2e / Semgrep re-run. Full item-by-item table → [Backlog re-triage 2026-07-09](#backlog-re-triage-2026-07-09).

### 2026-07-09 — Coverage slices 2–5: local working tree (not on master)

- **Theme:** Changelog entries below document coverage slices 2–5 as implemented and tested locally; **`origin/master` HEAD `b18e647` includes slice 1 (`c18f99e`) only** — slices 2–5 remain **uncommitted** in the working tree as of re-triage.
- **Uncommitted surface:** `db/init/020_kroger_search_terms_p2_gaps.sql`; `weekly-ad-ingest-store-priority.ts` (+ tests); `flipp-weekly-ad-resolver.ts`; `weekly-ad-ingestion-service.ts`; `aldi-weekly-ad-ingestion.ts`; `ensure-test-db.mjs` (020 probe); related tests.
- **Owner action:** Commit + CI when ready; run `sync:provider-prices` after 020 lands to persist Kroger p2 term observations on `yum4less_dev`.

### 2026-07-09 — Meal-planner flow: skip rank intermediate screen — CLOSED

- **Theme:** Rank dinners intermediate screen added friction; pantry **Continue to rank** + separate rank panel duplicated trust copy already on Dinner recommendations. Composes with prior UX slice **#7** (**Use all ingredients and check pantry** → skip Ingredients confirmation) — **two stacked screen-skip changes** on the same Home path: Ingredients gate → Pantry (skip #7) → Dinner recommendations (this slice).
- **Shipped:** Removed `RankStepPanel` and `flowStep: "rank"`. Pantry primary **Suggest recipes for my store(s)** calls `handleRankMeals()` directly, transitions to results view, `RankLoadingOverlay` unchanged. **Gating:** pantry button respects `rankingPaused` / `rankLoading` (same as former rank button). Idle results copy pantry-centric.
- **Evidence:** `npm test` **898/898**; `npm run test:integration` **29/29**; `npm run test:e2e:ci` **23 passed**, 1 skipped, 1 flaky (`navigation-theme` Kroger map card — pre-existing). Remote CI on **`08e8801`** / **`4b511e9`** — [run 29048785870](https://github.com/sfh1980/Yum4Less/actions/runs/29048785870) green (verify + semgrep + integration + e2e).

### 2026-07-09 — Publix weekly-ad ingest exclusion bug (0/97) — CLOSED

- **Theme:** `ingest-weekly-ads.ts` resolved chain via `getProviderRolloutForStore(name)` only — locator-backed Publix rows (e.g. `Brandy Creek Commons`) resolved to `unknown` and were silently excluded from scheduled weekly-ad ingest (same bug class as display/search fix `0c73016`, never applied to ingest).
- **Shipped:** `buildWeeklyAdIngestStoreCandidates()` — shared entry point using `getProviderRolloutForCatalogStore` (source_name + id prefix before display name); wired from `scripts/ingest-weekly-ads.ts`.
- **Evidence (live ingest, ZIP 23111, non-fixture):** before **0** Publix `price_observations` rows, **0/97** tracked-ingredient coverage → after **`c18f99e`** fix + live run **31** rows persisted for `publix-1626`, **31/97** (32.0%) coverage; ingest parsed **501** scrape offers, **60** tracked-ingredient matches at parse, **31** synced to Postgres. Flipp-first hybrid **not** warranted for the 0/97 gap — operational store-selection fix was the root cause.
- **Tests:** `npm test` **899/899**; `npm run test:integration` **29/29** (all chains' weekly-ad store selection path). Remote CI on **`c18f99e`** — [run 29047864858](https://github.com/sfh1980/Yum4Less/actions/runs/29047864858) green (verify + semgrep + integration + e2e).

### 2026-07-09 — Meal-planner UX: collapsible sections, price-first multi-store, flow trim

- **Theme:** Reduce screen bloat on pantry/results; multi-store picks cheapest per-ingredient at session time; surface gate-failed stores in Settings; skip redundant Ingredients confirmation.
- **Shipped:** Collapsible pantry session list (count header); nested Store plan / Shopping plan / Recipe steps accordions in meal cards; TheMealDB `▢` junk filtered + index-based step keys; **Use all ingredients and check pantry** jumps straight to pantry; Settings shows gate-failed stores greyed/unselectable with `rolloutNote`; `compareMultiStoreObservationQuality` (price-first) in multi-store plan builder; multi-store shopping-plan trust note on price change.
- **Evidence:** `npm test` **899/899** (+6); `npm run build` pass; `npm run test:integration` **29/29**; `npm run test:e2e:ci` **23 passed**, 1 skipped, 1 flaky locally (`navigation-theme`); remote CI **green** on `19dff42` — [run 29043588801](https://github.com/sfh1980/Yum4Less/actions/runs/29043588801) (verify + semgrep + integration + e2e all success).

### 2026-07-09 — Coverage slice 5: Aldi Flipp + direct scrape merge on low coverage

- **Theme:** Aldi only scraped `aldi.us` when Flipp returned zero offers — thin Flipp sets (e.g. 13/97 matches) never tried the chain page.
- **Shipped:** After Flipp, count matched tracked ingredients; on full-catalog runs (`≥25` tracked IDs), scrape and **merge** when matches stay below **25** (`shouldSupplementAldiWeeklyAdWithDirectScrape`). Small test runs unchanged.
- **Evidence:** `npm test` **893/893** (+5); `npm run test:integration` **29/29**.

### 2026-07-09 — Coverage slice 4: per-chain weekly-ad dedupe + fan-out

- **Theme:** Scheduled ingest called `ingestWeeklyAd` once per nearby store (e.g. 6× Food Lion, 10× Publix browser scrapes) even though weekly-ad offers are ZIP-scoped.
- **Shipped:** `groupWeeklyAdIngestStoresByChain` + `pickPrimaryWeeklyAdIngestStoreForChain` (catalog row over OSM); non-Kroger chains ingest once per chain and fan out offers to all nearby store IDs (Kroger pattern).
- **Evidence:** `npm test` **888/888** (+4); `npm run test:integration` **29/29**.

### 2026-07-09 — Coverage slice 3: Flipp supplemental for unmatched ingredients

- **Theme:** Aldi/Food Lion/Publix Flipp resolver only ran per-ingredient searches when **zero** tracked items matched — so 13/97 matches blocked supplemental for the other 84.
- **Shipped:** `resolveFlippWeeklyAdOffersForChain` now searches Flipp for **unmatched** tracked ingredient IDs (one primary term each, max **30** lookups per chain). Publix inherits via existing Flipp supplemental path. Walmart unchanged.
- **Evidence:** `npm test` **884/884** (+2 resolver tests); `npm run test:integration` **29/29**.

### 2026-07-09 — Coverage slice 2: Kroger priority-2 search terms (6 gaps)

- **Theme:** Kroger official API sync had **91/97** INTERNAL_CATALOG coverage; six IDs had priority-1 terms only (`chickpeas`, `dried-oregano`, `cornstarch`, `jalapeno`, `shredded-cheese-blend`, `bread-loaf`) with no fallback when API/match failed.
- **Shipped:** `db/init/020_kroger_search_terms_p2_gaps.sql` — six priority-2 terms (`garbanzo beans`, `oregano leaves`, `corn starch`, `jalapeno pepper`, `shredded Mexican cheese`, `bread loaf`). `ensure-test-db.mjs` applies when p2 gap rows missing.
- **Honest limits:** Did not re-run `sync:provider-prices` on `yum4less_dev` in this slice — terms are seeded; owner should run sync to persist new observations.
- **Evidence:** `npm test` **882/882**; `npm run test:integration` **29/29** (020 applied to test DB).

### 2026-07-09 — Coverage slice 1: Publix weekly-ad ingest store selection

- **Theme:** Scheduled `ingest-weekly-ads` excluded all Publix locator stores because chain inference used display names only (`getProviderRolloutForStore(name)` → `unknown` for “Brandy Creek Commons”). API read path was fixed in `0c73016`; ingest path was not.
- **Shipped:** `buildWeeklyAdIngestStoreCandidates()` uses `getProviderRolloutForCatalogStore` (`source_name` + `publix-*` id before name). Wired from `scripts/ingest-weekly-ads.ts`.
- **Honest limits:** Did not re-run live Publix scrape ingest in this slice (owner approval pending). Kroger p2 terms, Flipp supplemental, per-chain dedupe still queued (slices 2–5).
- **Evidence:** `npm test` **882/882** (+3 unit); `npm run build` **pass**. New: `weekly-ad-ingest-store-selection.test.ts`.

### 2026-07-09 — Bug [pantry-ID-fix] closed; CI green on `648d745`

- **CLOSED:** Bug **[pantry-ID-fix]** — pantry Phase 2 (DB-backed `filterValidPantryIngredientIds`, full-catalog manual entry combobox, welcome budget $20 default). Commit `648d745`.
- **CI:** First push run [28987447695](https://github.com/sfh1980/Yum4Less/actions/runs/28987447695) **failed** e2e once — `navigation-theme.spec.ts:35` (`assertMarketSearchStoreResults` could not find `[data-store-id="kroger-mechanicsville"]` in map overlay). **Not a Phase 2 regression** — triage (2026-07-09): isolated spec **3/3 pass** on same commit; Phase 2 diff does not touch market-search/map path; helper asserts Kroger from **full** API response while map shows **scoped** `selectedStoreIds` (single-store default can omit Kroger when another ranked chain is closer); same run had `mvp-flow` pass the same assertion earlier. **Rerun** of [28987447695](https://github.com/sfh1980/Yum4Less/actions/runs/28987447695): **green** (verify + semgrep + integration + e2e); Playwright annotated **1 flaky** on `navigation-theme.spec.ts:35` (passed on retry).
- **Follow-up (queued next):** Fix `e2e/helpers.ts` `assertMarketSearchStoreResults` to assert selected/scoped stores — **P1**, third flake recurrence (meal-planner UX e2e 2026-07-09) — see [Deferred backlog](#deferred-backlog-not-v1).

### 2026-07-08 — Pantry Phase 2: DB validation, manual entry UX, chain-neutrality audit

- **Theme:** Pantry checklist silently dropped TheMealDB-normalized ingredient IDs because validation used the 97-item `INTERNAL_CATALOG` list instead of the live `ingredients` table; manual pantry entry was limited to that same static list.
- **Shipped (2b):** `filterValidPantryIngredientIds` validates against DB catalog (`loadCatalogIngredients` / snapshot ingredients); `/api/pantry-coverage` returns full 224+ row catalog; rank path uses snapshot ingredient ids; live fixture repro **+34 fully-covered** (8→42) on $30/multi-store/any-diet at `37.6085,-77.3739`.
- **Shipped (2c):** `IngredientCatalogCombobox` — fuzzy autocomplete, explicit rejection + “did you mean” suggestions, Add button, success/near-miss confirmation copy; pinned in unit/component tests (no silent no-op).
- **Shipped (side):** Welcome-step default budget **$16 → $20** (`use-meal-planner`).
- **Phase 2a finding (investigation only):** `INTERNAL_CATALOG` priced coverage in `yum4less_dev` (90d, in-stock, official+weekly-ad) is **heavily Kroger-skewed** — Kroger **91/97**, Aldi **13/97**, Publix **0/97**, Food Lion **13/97**, Walmart **3/97**; **68/97** ingredients Kroger-only; **0/97** across all five chains. Architectural call sites are chain-agnostic; **content/ingest success is not**. Flagged for follow-up — not fixed this slice.
- **Honest limits:** Did not rebalance the 97-item tracked list or non-Kroger weekly-ad match rates. `tsconfig` excludes `scripts/**` from Next typecheck so ad-hoc investigation scripts do not block `npm run build`.
- **Evidence:** `npm test` **879/879**; `npm run build` **pass**; live `scripts/.verify-pantry-phase2-fix.ts` output; chain audit `scripts/.investigate-internal-catalog-chain-neutrality.ts`. Remote CI: [28987447695](https://github.com/sfh1980/Yum4Less/actions/runs/28987447695) **green** on rerun (2026-07-09); first-run e2e failure documented in 2026-07-09 close-out above.

### 2026-07-08 — Same-chain collocated catalog identity (Aldi ZIP twin + Decision A)

- **Theme:** Stop Settings/map showing two ranked Aldi catalog pins (`aldi-mechanicsville` + `aldi-23111`) at the same storefront; generalize catalog↔catalog collocated collapse without claiming full Option A.
- **Decision A:** Per-chain merge radius — `CATALOG_COLLOCATED_MERGE_MILES = 0.05` for all chains except Kroger; named `KROGER_COLLOCATED_MERGE_MILES = 0.15` (= legacy `KROGER_SAME_STORE_MERGE_PROXIMITY_MILES`). Kroger’s wider radius is **unvalidated for other chains** — a future non-Kroger same-chain pair between 0.05–0.15 mi that *should* merge is a signal to revisit per-chain config, **not** to widen the shared 0.05 default.
- **Shipped:** `src/lib/catalog-store-colocated-identity.ts` (priority scorer + collapse + upsert redirect); Settings replaces `dedupeKrogerStoresByIdentity` call with shared helper; ingest prefer-colocate for Aldi + generic ranked upsert (non-Kroger only — Kroger keeps dedicated reconcile paths); `db/init/019_retire_aldi_zip_catalog_twin.sql`; ensure-test-db residual probe (chain-agnostic, non-Kroger &lt;0.05 mi = 0); permanent ~0.10 mi 0.05/0.15 pin tests.
- **Option A reusable primitive:** Cross-ref Deferred backlog — Identity Matching can import `storesAreCollocatedCatalogDuplicates` / `preferCollocatedCatalogStoreId` / collapse helpers rather than reimplementing proximity merge.
- **Honest limits:** Full Option A (locator↔OSM↔SNAP name similarity) still deferred. Market-search still uses Kroger-only `dedupeKrogerStoresByIdentity` for map merge. Generic `upsertCatalogStores` collocated redirect is **non-Kroger** by design (Kroger slug↔API distinct `source_store_id` rows remain intentional). **Ranking path** does not apply `collapseSameChainCollocatedCatalogStores` today — see deferred backlog → [**Ranking path: collocated-collapse + stale selectedStoreIds**](#ranking-path-collocated-collapse-and-stale-selectedstoreids-gap).
- **Evidence:** Local `npm test` **865/865**; `npm run test:integration` **29/29**; `npm run build` **pass**; `yum4less_dev`: `aldi-23111` gone; slug coords + `osm-node-6531578976`; 0 non-Kroger &lt;0.05 mi twins. **Remote CI** on `e5b1285`: [28954380879](https://github.com/sfh1980/Yum4Less/actions/runs/28954380879) **success** (verify + semgrep + integration + e2e).

### 2026-07-08 — Separate fixture OSM from live Overpass (identity + provenance)

- **Theme:** Root-cause fix so rehearsal map fixtures can never share the live `osm-*` / `openstreetmap-overpass` namespace or rewrite location provenance into weekly-ad scrape identity.
- **Contract:** Fixture upsert → `fixture-osm-{type}-{id}` + `source_name=yum4less-map-fixture`. Live Overpass → `osm-*` + `openstreetmap-overpass`. `touchStoreVerification` bumps `last_verified_at` only for OSM/fixture/SNAP/locator rows (does not overwrite `source_name`). Ranked Aldi nearest-OSM refuses synthetic 90000x ids.
- **Shipped:** Builders + map-context path; Settings/market-search shopper filters; `018_retire_synthetic_osm_fixture_pins.sql` (+ ensure-test-db); fixture-ingest identity asserts; trust copy `map-fixture` provenance; tests for the boundary.
- **Honest limits:** Phase D live-OSM geometry witnesses deferred. Stale localStorage / crafted `selectedStoreIds` can still reference retired fixture ids until prune (QA residual) — see deferred backlog → [**Ranking path: collocated-collapse + stale selectedStoreIds**](#ranking-path-collocated-collapse-and-stale-selectedstoreids-gap). Remote CI / e2e not re-run this slice.
- **Evidence:** `npm test` **855/855**; `npm run test:integration` **28/28**; `npm run build` **pass**; `yum4less_dev` post-018: **0** synthetic/fixture OSM rows; market-search at `37.6085,-77.3739` → Aldi ids `aldi-mechanicsville` / `aldi-23111` / live `osm-node-6531578976` only (`fixture_or_synthetic=0`).

### 2026-07-08 — Retire fake fixture Aldi pin `osm-node-900007`

- **Theme:** Settings “Multiple stores” listed a map-context Aldi at `0.9 mi` that is not a real storefront.
- **Shipped:** Corrected synthetic OSM fixture Aldi coords to verified Mechanicsville storefront (`37.611004`, `-77.336853`); added `db/init/017_retire_fake_aldi_osm_fixture_pin.sql` (migrate observations → `aldi-mechanicsville`, delete bad row); `ensure-test-db` applies 017 when the row still exists; integration expectations updated.
- **Honest limits:** Symptom fix only — superseded same day by fixture/live identity separation (entry above).
- **Evidence:** focused unit **23/23**; `store-catalog-sync` integration passed this session; `yum4less_dev` no longer has `osm-node-900007`.

### 2026-07-07 — Pantry check v2 (pre-rank step + rank integration)

**Theme:** Replace session-only post-rank free-text pantry with structured pre-rank pantry check affecting plan build and results display.

**Shipped (local):**
- `recipe-plan-coverage.ts` + `POST /api/pantry-coverage` + `ranking-recipe-pool.ts` shared eligible-pool helper
- Plan builder `sourcedFromPantry` rows; `pantryIngredientIds` on rank contract
- `PantryStepPanel` + catalog autocomplete; flow `ingredients → pantry → rank → results`
- Visible pantry rows on meal cards with trust copy; retired `pantry-prompt-card.tsx`
- `e2e/pantry-step.spec.ts`; updated `e2e/helpers.ts`

**Tests (this session):** `npm test` **848/848** pass; `npm run build` pass; `npm run test:e2e:ci` **23 passed / 1 skipped / 1 flaky** (includes `pantry-step.spec.ts`). `@verifier` **PASS** on pantry row trust copy.

**Honest limits:** Remote CI not re-run this session. Pantry still session-only (not Saved tab persistence).

### 2026-07-06 — Store-discovery display patch + straight-line distance labels

**Theme:** Close the four store-discovery bugs from the quick-patch pass (display names, Aldi bootstrap coord, distance semantics) without building the universal reconciliation engine.

**Shipped (local — commit pending):**
- **Bug 1 — Publix headline:** `store-display-labels.ts` — locator/weekly-ad Publix rows show **Publix** as headline; shopping-center label (e.g. Brandy Creek Commons) optional subtitle; DB unchanged
- **Bug 2 — chain casing:** `getCanonicalShopperChainDisplayName()` in `chain-rollout-policy.ts`; `buildNearbyStoresForSearch` applies display headlines at assembly
- **Bug 4 — Aldi bootstrap pin:** `aldi-mechanicsville` corrected to `37.611004`, `-77.336853` in dev DB + `db/ci/014_ci_bootstrap_stores.sql` + fixtures (aligns with `aldi-23111` / OSM node `6531578976`)
- **Distance clarity:** `formatStraightLineDistanceMiles()` — map tooltips, store list, and Settings dropdown now say **`X mi straight-line`**; investigation confirmed haversine was never wrong for Food Lion #2575 (`osm-node-1654396096`) — mismatch was geolocation origin vs driving expectation
- **Bug 3 (Food Lion #601):** no new write — prior `COORDINATE_SANITY_EXCEPTIONS` entry for `osm-node-3103220732` stands

**Deferred:** OSRM driving distance for store-discovery surfaces — reuse `multi-store-shopping-route.ts` OSRM client (see Deferred backlog).

**Tests:** `npm test` **816/816** pass (this session, post-relabel).

**Honest limits:** Remote CI **not re-run** until commits land on `origin/master`. Driving-distance upgrade deferred; geolocation accuracy surfacing (e.g. `coords.accuracy`) still backlog.

### 2026-07-06 — Locator chain inference P1 closed

**Theme:** Public ranked-dinner path no longer infers chain from locator display names alone (`Brandy Creek Commons` → `unknown`). Catalog stores resolve chain from `source_name` → `id` prefix → name fallback.

**Shipped (`0c73016`):**
- **`chain-rollout-policy.ts`** — `inferStoreChainFromCatalog()`, `inferStoreChainFromCatalogSource()`, `inferStoreChainFromIdPrefix()`
- **`provider-rollout.ts`** — `getProviderRolloutForCatalogStore()` + `resolveProviderRolloutForCatalogStore()`; **`getProviderRolloutForStore(name)` unchanged** for SNAP/OSM/external-name paths
- **Wired:** `buildNearbyStoresForSearch`, coordinate sanity, catalog sync filters, merge policy, Kroger canonical helpers
- **Tests:** locator display name regression (`publix-1626` / `Brandy Creek Commons` → `publix`)
- **CI:** [28825310364](https://github.com/sfh1980/Yum4Less/actions/runs/28825310364) — verify (lint + **813/813** + build) + integration **27/27** + e2e **21+1 skip** — **green**

**Locator → weekly-ad `source_name` transition (research):** `touchStoreVerification()` updates `stores.source_name` per persisted offer (not one atomic transaction with price rows). Mid-ingest can briefly show locator `source_name` while weekly-ad rows exist — **both imply `publix`**. Publix locator re-sync uses `preserveRankedSources: true` so `publix-weekly-ad-scrape` is **not** overwritten back to `publix-store-locator`. No observed `source_name` vs `id` chain disagreement in normal flows.

**`publix-1626` spot-check (`yum4less_dev`, post-fix):** `/api/recommendations` → `chain: publix`, `recommendationEnabled: true`, `weekly-ad-preview` (28 matched ingredients). **Not** “No ranked stores near this search.” **0 ranked meal cards** because no dev recipe has every ingredient priced at `publix-1626` (single-store plan requires full coverage). **`publix-1566`** (locator-only, no prices): `chain: publix`, `rolloutStatus: coming-soon` — inference fixed; promotion blocked only by missing prices.

### 2026-07-06 — FRESH-1 closed + Publix-1626 re-ingest

**Theme:** Weekly-ad promotion gate now shares the 24h ranked-read TTL; ranking test fixtures aligned without collapsing graduated freshness scoring.

**FRESH-1 — CLOSED**
- **Gate:** `1304542` — `WEEKLY_AD_PROMOTION_FRESHNESS_HOURS` (= `RANKED_PRICE_CACHE_TTL_HOURS`); `isFreshWeeklyAdObservation()`; all-time ingest status relabeling
- **Fixture follow-up:** `08f4bfb` — legacy day buckets → `3/11/17/23h` in `buildZip23111WeeklyAdPriceObservations()`; CI-02 baseline freshness **14/15/16** (totals **90/86/76**)
- **Rounding tweak:** `aa884a1` — day-1 bucket `4h→3h` so sheet-pan chicken score rounds to **16** (not **15**)
- **CI:** [28820142318](https://github.com/sfh1980/Yum4Less/actions/runs/28820142318) on `aa884a1` — verify (lint + **811/811** + build) + integration **27/27** + e2e **21+1 skip** — **green**

**`publix-1626` re-ingest:** `npm run probe:publix-live-ingest` (2026-07-06) — **644** offers parsed, **36** rows synced to `yum4less_dev`, all **36** within 24h; promotion gates **pass** on probe path. Public read-path chain inference was a **separate P1** (fixed `0c73016` — see changelog above).

### 2026-07-06 — Post-merge verification pass (read-only)

**Theme:** Canonical “where we stand” snapshot after Dependabot merges and local FRESH-1 work — verification only, no application code changes in this pass.

**Git truth (`origin/master` HEAD `5f2a7bb`):**
- Local `master` **in sync** with `origin/master` (no unpushed/unpulled commits on branch tip).
- Working tree **not clean:** 15 modified files (FRESH-1 code + docs + continuity) — **uncommitted**.
- **Three PR merge commits today** (not six): `6c695e3` PR #5 pg 8.22.0; `37802e8` PR #6 react-dom 19.2.7; `5f2a7bb` PR #8 zod 4.4.3 — each touches **only** `package.json` + `package-lock.json`; no unexpected conflict resolutions.
- **Three additional direct commits** already on master before today’s merges: `f970123` retire `publix-atlee` → `publix-1626`; `880dcd3` integration test fix; `759eee1` duplicate Publix OSM pin tombstone (Option B). PR #4 and #7 were **closed without merge**.

**Remote CI** ([28811806834](https://github.com/sfh1980/Yum4Less/actions/runs/28811806834) on `5f2a7bb`): verify (lint + **809** unit + build) **success**; integration **27/27** **success**; e2e **21 passed / 1 skipped** **success** (overlay spec flaky once, retried green); semgrep skipped (no token).

**FRESH-1 on `origin/master`:** **STILL OPEN** — committed `weekly-ad-coverage.ts` still exports `MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS = 14` and gates on `maxFreshnessDaysAgo > 14`. **Local working tree** has the fix (`WEEKLY_AD_PROMOTION_FRESHNESS_HOURS = RANKED_PRICE_CACHE_TTL_HOURS` from `ranked-price-cache-policy.ts`); `weekly-ad-coverage.test.ts` shared-threshold test **passes locally**; **not committed**.

**`publix-1626` spot-check (`yum4less_dev`):** store row exists (`publix-store-locator`); **`price_observations` count = 0** (all-time and 24h-fresh). Cannot confirm ranked dinner estimates — owner needs `probe:publix-live-ingest` or scheduled ingest.

**PR/regression cross-check:** Publix commits touch `publix-catalog-sync.ts` + migrations — **intended** closure of publix-atlee + OSM dedupe (Option B); no edits to coordinate-sanity, debug-route gating, or cron exit-code paths. Dependabot bumps only — no closed-finding regression surface.

**Canonical backlog status** → table below. **New findings for triage** → [deferred backlog](#new-findings-for-triage-2026-07-06).

**Audit / backlog status (canonical as of 2026-07-06):**

| ID | Status | Notes |
|----|--------|-------|
| P0-1 Settings hides market-search failures | **CLOSED** | On master; unchanged by 2026-07-06 merges |
| P0-2 Multi-store uncheck-all shows all stores | **CLOSED** | On master |
| **FRESH-1** Weekly-ad promotion gate freshness policy mismatch | **CLOSED** | `1304542` gate + `08f4bfb`/`aa884a1` fixtures; CI [28820142318](https://github.com/sfh1980/Yum4Less/actions/runs/28820142318) green on `aa884a1` |
| **P1** Locator display name breaks chain inference on API | **CLOSED** | `0c73016`; CI [28825310364](https://github.com/sfh1980/Yum4Less/actions/runs/28825310364) green |
| Publix-atlee retirement → `publix-1626` | **CLOSED** | `f970123` on master + migration `015` |
| Publix OSM/locator dedupe (Option B) | **CLOSED** | `759eee1` on master + migration `016` |
| P1-1 E2e CI regression | **CLOSED** | Remote e2e green; overlay spec still flaky on retry |
| P1-2 Debug pipeline exposure | **CLOSED** | Not touched by 2026-07-06 merges |
| P1-3 Rate limiting production-safe | **CLOSED** (partial) | Redis/multi-instance deferred |
| P1-4 Unauthenticated feedback GET | **CLOSED** | Not touched |
| P1-5 M128/M151 doc drift | **PARTIAL** | **Rules** corrected (`yum4less-security-and-dependencies.mdc`); **`.cursor/agents/ingest-standards.md` still open** (re-triage 2026-07-09) |
| P1-6 Provider-sync exit 0 on failure | **CLOSED** | Not touched |
| P1-7 Partial weekly-ad exit 0 | **CLOSED** | Not touched |
| P1-8 Cook tab vs marketBlocked | **DEFERRED** | Not touched |
| P1-9 Store selection invalidates rank | **CLOSED** | Not touched |
| P1-10 No DB migration ledger | **DEFERRED** | Migrations `015`/`016` add SQL files without ledger |
| tsc `--noEmit` | **CLOSED** | **0 errors** (2026-07-09); CI-gated via `npm run typecheck` in verify job; B1 pantry-add test bug found during cleanup |
| M128/M151 automation | **DEFERRED** | Homelab slice |
| Saved persistence | **PARTIAL** | Device-local `yum4less.saved-meals.v1` shipped 2026-08-20. Cross-device / accounts still deferred. |
| R11 — cuisine/ethnic filter chips | **DEFERRED** | Unchanged |
| General locator-vs-OSM dedupe (Option A) | **DEFERRED** | Must be a **universal** cross-source dedupe (distance + name/type similarity for **any** source pair) — **no** chain-specific hardcoding (not another Publix/Kroger-only patch). Option B shipped Publix-only tombstone; prioritize Option A before Aldi/Lidl locator rollout to avoid silent duplicate storefront rows. |

### 2026-07-06 — Weekly-ad freshness policy alignment (FRESH-1 — local only, not on master)

**Theme:** Single **24-hour** freshness rule for ranked reads and weekly-ad promotion gates; relabel all-time ingestion row counts so they are not read as freshness.

**Status:** Implemented in **uncommitted working tree** as of verification pass — **not** on `origin/master` HEAD `5f2a7bb`. Do not treat as shipped until committed and CI re-runs.

**Shipped (local working tree only):**
- **`weekly-ad-coverage.ts`** — promotion gate uses `WEEKLY_AD_PROMOTION_FRESHNESS_HOURS` (= `RANKED_PRICE_CACHE_TTL_HOURS`, 24h); removed 14-day `MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS`
- **`weekly-ad-promotion-readiness.ts`** — freshness-window gate copy updated to 24h
- **`getWeeklyAdIngestionStatusSummaries()`** — documented and messaged as **all-time inventory, not freshness**; internal modal + diagnostics copy updated
- **`weekly-ad-coverage.test.ts`** — shared-threshold test + boundary at 25h
- **Ranking fixtures** — weekly-ad rows use `freshnessHoursAgo: 2` (within 24h); CI-02 score baseline updated
- **Docs:** `homelab-deploy.md`, `application-decision-trees.md` (local edits uncommitted)

**Note:** `weeklyAdIngestionStatus` intentionally stays unfiltered so operators can distinguish “rows exist but stale” from “never ingested” when compared with promotion readiness. `getWeeklyAdIngestionStatusSummaries()` message: `"${count} all-time scraped weekly-ad row(s) in PostgreSQL for ${storeId} (${sourceName}); not a freshness signal."`

### 2026-07-06 — Weekly-ad promotion gate freshness policy mismatch (diagnosis only)

**Theme:** Document an open **DEFERRED** item — ranked-price reads, ingestion status reporting, and promotion freshness gates use **inconsistent time windows**, producing misleading “healthy ingest / failed gate” signals. **Not** caused by Publix OSM/locator dedupe (Option B, cleared 2026-07-05).

**Finding (distinct open item):** [Weekly-ad promotion gate freshness policy mismatch](#deferred-backlog-not-v1) — diagnosed when investigating why `publix-1626` showed `weeklyAdIngestionStatus` observation counts alongside a failed `weekly-ad-observations` promotion gate despite Postgres rows existing.

**Shipped:** Continuity journal entry only — no code changes.

**Fix options on record:** Re-run weekly-ad ingest for quick symptom relief; align the 24h ranked-read filter (`loadRankedPriceObservations`) with the 14-day promotion freshness window as the real fix; or apply the same filter to `weeklyAdIngestionStatus` so ingestion health and gate logic stop disagreeing.

**Priority note:** May silently suppress ranked pricing for any chain/store more often than currently visible — especially when data is older than 24h but younger than 14 days (common given weekly refresh cycles).

### 2026-07-05 — Retire duplicate Publix OSM pins near locator stores (Option B)

**Theme:** Tombstone `osm-*` Publix rows within `MAP_OSM_DEDUPE_PROXIMITY_MILES` (0.15 mi) of `publix-store-locator` rows — resolves `osm-way-789560637` → `publix-1626` and prevents split `price_observations` on future locator sync.

**Shipped:**
- **`retireDuplicateOsmPublixNearLocatorStores()`** in `publix-catalog-sync.ts` — runs after locator upsert alongside `retirePublixAtleeBootstrapStore()`
- **`db/init/016_retire_duplicate_publix_osm_pins.sql`** — one-time migration for existing DBs
- Integration test for OSM/locator dedupe + price migration

**Deferred (Option A):** General locator-vs-OSM dedupe across all v1 chains — see [Deferred backlog](#deferred-backlog-not-v1).

### 2026-07-05 — Retire legacy `publix-atlee` bootstrap pin

**Theme:** Remove the fictional Atlee Rd Publix bootstrap slug; anchor Mechanicsville Publix on official locator store **#1626 Brandy Creek Commons** (`37.610899`, `-77.335779`).

**Shipped:**
- **`db/init/015_retire_publix_atlee_bootstrap.sql`** — upserts `publix-1626`, migrates `price_observations`, deletes `publix-atlee`
- **`db/ci/014_ci_bootstrap_stores.sql`** — bootstrap pin replaced (`publix-1626` / store number `1626`)
- **`publix-catalog-sync.ts`** — `retirePublixAtleeBootstrapStore()` runs after locator upsert on map-catalog ingest
- Fixtures, probe scripts, weekly-ad tests, e2e store-scoping spec updated to `publix-1626`

**Evidence:** `npm test` **809/809** (152 files); owner `yum4less_dev` migration applied (`UPDATE 36` price rows migrated).

### 2026-07-04 — Six-batch remediation close-out (full-system audit follow-ups)

**Theme:** Close P1 security/cron/UI-state findings and P2 doc/CI hygiene from [`docs/audits/full-system-run-report.md`](docs/audits/full-system-run-report.md) in six local commits; re-verify runtime gates without inline tsc fixes.

**Shipped (Batches 0–5, local commits not pushed):**
- **Batch 0:** Audit report correction — 5 e2e failures were port contention, not regressions
- **Batch 1 (P1-2/3/4):** Debug pipeline env gate + rate limit; proxy-header startup warning; feedback GET admin key
- **Batch 2 (P1-6/7/9):** Cron scripts exit 1 on partial failure; rank state clears when selected stores change post-rank
- **Batch 3:** Food Lion coordinate exceptions + approximate-location badge + Nominatim `Market Place` normalization
- **Batch 4:** tsc mock/contract drift fixes (141→64 errors); e2e overlay flake fix (`single-store-map-overlay.spec.ts`)
- **Batch 5 (P2):** README D7 sync; merged-ranking help copy; e2e job `needs: [verify, integration]`; bootstrap upsert name/city/state; `e2e/README.md`; root audit PNG + `tsconfig.tsbuildinfo` gitignore

**Audit finding status (2026-07-04 verification pass):**

| ID | Status | Notes |
|----|--------|-------|
| P0-1 Settings hides market-search failures | **CLOSED** | `settings-panel.tsx` receives `marketSearchState`; errors render on Settings |
| P0-2 Multi-store uncheck-all shows all stores | **CLOSED** | `filterNearbyStoresBySelection` returns `[]` when selection empty |
| P1-1 E2e CI regression | **CLOSED** | Port contention; isolated rerun 22/1/0 |
| P1-2 Debug pipeline exposure | **CLOSED** | Batch 1 env gate + rate limit |
| P1-3 Rate limiting production-safe | **CLOSED** (partial) | Startup warning shipped; Redis/multi-instance still deferred |
| P1-4 Unauthenticated feedback GET | **CLOSED** | Batch 1 admin key |
| P1-5 M128/M151 doc drift | **CLOSED** (prior) | Rules document manual-pause-only reality |
| P1-6 Provider-sync exit 0 on failure | **CLOSED** | Batch 2 |
| P1-7 Partial weekly-ad exit 0 | **CLOSED** | Batch 2 |
| P1-8 Cook tab vs marketBlocked | **DEFERRED** | Not in remediation scope; needs dedicated UI slice |
| P1-9 Store selection invalidates rank | **CLOSED** | Batch 2 |
| P1-10 No DB migration ledger | **DEFERRED** | Structural backlog |
| tsc `--noEmit` (64 errors) | **STILL OPEN** | Test mock drift bucket; unchanged vs Batch 4 baseline |
| M128/M151 automation | **DEFERRED** | Homelab slice |
| Saved persistence | **PARTIAL** | Device-local localStorage shipped 2026-08-20 (no user accounts). Cross-device sync still deferred. |
| R11 — cuisine/ethnic filter chips | **DEFERRED** | Blocked on recipe DB cuisine tags per 2026-06-25 locked redesign plan (“hide cuisine row until DB tags exist”); recipes have generic `tags[]` / `dietary_tags[]` but no cuisine facet — data-dependency blocker, not a scope decision |

**Evidence (Batch 6, this session):**
- `npm run lint` — clean
- `npx tsc --noEmit` — **64 errors** (baseline unchanged)
- `npm test` — **808/808**, 152 files
- `npm run build` — OK (Next.js **15.5.19**)
- `npm run test:integration` — **24/24**, 7 files; bootstrap SQL `INSERT 0 8`
- `npm run test:e2e:ci` (isolated, `PLAYWRIGHT_FORCE_NEW_SERVER=1`) — **22 passed / 1 skipped / 0 failed**

**Honest limits:** tsc not clean; remote CI not re-run; local commits not pushed. Not claiming verified/CI green/deploy-ready.

---

### 2026-07-03 — Food Lion coordinate sanity audit, `flagReasons[]`, and verified pin correction

**Theme:** Harden the Food Lion coordinate sanity workflow from first real audit data: expose dual-flag rows honestly, separate real correction candidates from metadata-only noise, and only write the storefront correction that survives map-viewer verification.

**Shipped:**
- **Shared checker:** `src/lib/geo/coordinate-sanity-check.ts` now returns `flagReasons[]` instead of a single short-circuit reason, so `unknown_city_state` can coexist with `coordinate_delta`; geocode context stays separate from stored metadata so the checker can report metadata gaps honestly without poisoning the address query
- **Food Lion audit script:** `scripts/audit-food-lion-coordinates.mjs` now renders `flag_reasons`, buckets rows into correction candidates / metadata-only / manual review, and supports `--ids=...` reruns for targeted follow-up checks
- **Rollout policy metadata:** `chain-rollout-policy.ts` now owns shared store-name chain inference and coordinate-audit requirements; Food Lion + Lidl require audit review, while Kroger/Aldi/Publix stay non-blocking until address-backed audit evidence exists
- **Server-safe gate implementation:** `chain-rollout-coordinate-sanity.ts` hosts the SNAP/catalog lookup path and blocking failure list so rollout audits can run without bundling Postgres dependencies into client code
- **Verified coordinate correction:** `food-lion-mechanicsville` moved from the Bell Creek Middle School field to the storefront coordinate (`37.610174`, `-77.341778`) in `yum4less_dev`, `db/ci/014_ci_bootstrap_stores.sql`, and `src/lib/fixtures/market-catalog.fixtures.ts`
- **Withheld writes:** `osm-node-3103220732` and `osm-node-6527816794` remain unchanged because Google satellite + SNAP corroboration showed the current stored pins already land on the storefront while the Nominatim result lands on road geometry / an interchange
- **Config/test updates:** `.env.example` documents `YUM4LESS_NOMINATIM_USER_AGENT`; focused tests cover the checker, shared chain inference, and rollout requirement policy

**Evidence (this session):**
- `npm test` **780/780** (147 files)
- `npm run build` pass (Next.js **15.5.19**)
- `npx tsx scripts/audit-food-lion-coordinates.mjs` → **14 checked / 10 flagged** with the two dual-flag rows correctly moved into the correction-candidate bucket
- `npx tsx scripts/audit-food-lion-coordinates.mjs --ids=food-lion-mechanicsville` → **1 checked / 0 flagged**
- Playwright MCP Google satellite check: old `food-lion-mechanicsville` coord landed on Bell Creek Middle School field; corrected coord landed on the `7095 Mechanicsville Tpke` Food Lion storefront; local app Settings "Use my location" + store-map overlay now places the selected pin on the store side rather than the school

**Honest limits:**
- `npm run test:integration` and `npm run test:e2e:ci` were **not rerun** in this slice because the work did not change DB merge semantics or shopper UI flow wiring
- The two remaining correction-candidate rows in the Food Lion dossier are now classified honestly, but they still need a deeper multi-source/manual resolution because Nominatim contradicted SNAP + map-viewer storefront checks

---

### 2026-07-03 — Coordinate sanity exceptions persisted in code

**Theme:** Move the two manually withheld Food Lion coordinate-audit decisions out of chat-only memory and into the canonical exception source so reruns stay stable.

**Shipped:**
- `chain-rollout-policy.ts` now records `osm-node-3103220732` and `osm-node-6527816794` in `COORDINATE_SANITY_EXCEPTIONS`
- `chain-rollout-policy.test.ts` asserts both reviewed ids remain in the exception map with storefront-correct rationale text

**Evidence (this session):**
- `npm test` **785/785** (148 files)

**Honest limits:**
- `npm run build` and `npm run test:e2e:ci` were **not rerun** in this slice because the change is limited to the audit exception map plus unit coverage

---

### 2026-07-03 — Approximate location fallback for unknown city/state

**Theme:** Replace raw `Unknown` locality strings with an honest approximate-location treatment across store surfaces without silently backfilling city/state metadata.

**Shipped:**
- `store-display-labels.ts` now collapses literal `Unknown` city/state metadata to **`Approximate location`**
- shared store-name formatting now carries that fallback through the nearby-stores list, Settings store picker, single-store overlay title, and internal details provider-store list
- focused unit coverage added in `store-display-labels.test.ts`

**Evidence (this session):**
- `npm test` **784/784** (148 files)
- `npm run build` pass (Next.js **15.5.19**)

**Honest limits:**
- `npm run test:e2e:ci` was **not rerun** in this slice because the change is isolated to shared display formatting, not flow wiring
- the formatter normalizes the exact sentinel `Unknown`; new placeholder variants would still need an explicit follow-up if upstream data starts using them

---

### 2026-07-03 — Coordinate-first cold-start regression coverage

**Theme:** Close the last verification gap on the old coordinate-first cold-start stall by proving the bounded OSM deferral path on a genuinely cold geolocation, then keeping that path in committed CI coverage.

**Shipped:**
- **Original problem recorded:** first cold coordinate-based searches could block on synchronous OSM gap-fill for roughly **88s**, holding the critical path instead of returning saved stores promptly
- **Fix confirmed:** `/api/market-search` now defers OSM discovery off the critical path, caps synchronous wait at **3s**, and logs deferrals while the background cache warm continues
- **Permanent regression coverage:** added `e2e/coordinate-first-cold.spec.ts`, which asserts the chosen coordinate still has **zero** `openstreetmap-overpass` rows in `yum4less_test` after fixture prep, then checks bounded response time and visible `mapDiscoveryNotice`

**Evidence (this session):**
- `npm test` **780/780** (147 files)
- `npm run test:e2e:ci` **21 passed / 1 skipped / 1 flaky** (exit 0)
- True cold verification on `37.675, -77.280` against fresh `next start` + `yum4less_test`: **3227ms** market-search response, **3486ms** full geolocation-to-map-pricing flow; server log confirmed `deferred map context discovery after 3000ms`

**Honest limits:**
- The cold coordinate is protected against future fixture drift by the test's preflight DB assertion, but if fixtures expand into that radius later the spec will fail loudly and require picking a new cold anchor
- Full Playwright remains green-exit but not perfectly clean: `e2e/single-store-map-overlay.spec.ts` is still flaky on an unrelated mobile meal-card path

---

### 2026-07-03 — Lidl Flipp ingest, Publix supplemental tier, bounded OSM gap-fill, repository split

**Theme:** Weekly-ad chain expansion and cold-path search hardening without changing shopper-facing ranked-chain claims.

**Shipped:**
- **Lidl ingest wiring:** new Flipp-first weekly-ad client, fixture coverage, rollout/display wiring, and compound-name guard coverage; Lidl observations can land in `price_observations`, but shopper meal pricing stays **coming soon** until a live gate review promotes it honestly
- **Publix supplemental tier:** browser scrape remains primary; Flipp runs second and only fills uncovered ingredient matches, with explicit per-ingredient dedupe so scrape wins overlap
- **Cold-path market-search fix:** `/api/market-search` now bounds synchronous OSM gap-fill to **3s**, returns saved catalog stores first, and lets background discovery continue warming the cache for later requests
- **Repository split:** `market-catalog-repository.ts` and `market-pricing-repository.ts` now own the SQL/mappers; `market-repository.ts` remains the backward-compatible facade for callers
- **Freshness parity:** sale-driven recipe-import queries now reuse the same 24-hour freshness gate as ranked snapshot reads, so stale weekly-ad rows no longer leak into sale eligibility
- **Deferred backlog additions:** near-miss confidence analysis, gated ingredient-catalog expansion, shared `assertMarketDataAvailable()`, store geography audit, and bootstrap provenance audit added under [Deferred backlog](#deferred-backlog-not-v1)

**Evidence (this session):**
- `npm test` **766/766** (146 files)
- `npm run build` pass (Next.js **15.5.19**)
- `npx playwright test e2e/coordinate-first.spec.ts` **1/1 passed** against a freshly restarted dev server (cold first-run check)
- `npm run test:e2e:ci` **21 passed / 1 skipped / 0 failed** (exit 0)

**Notes:**
- `npm run test:integration` was **not rerun** in this slice because the work did not change DB merge-gating behavior or migration semantics
- Full Playwright CI initially failed in this shell because `PLAYWRIGHT_SKIP_WEBSERVER=1` was left over from earlier diagnostics; after clearing that env override, the suite passed cleanly

---

### 2026-07-01 — Geolocation persistence, trust hardening, DB 503 parity, Est. prefix fix

**Theme:** Beta v1 trust and resilience hardening — location persistence, server-side trust recompute, DB outage semantics, UI formatting, map model separation, scale-awareness governance.

**Shipped:**
- **Geolocation persistence:** `locationMode`, `lat`, `lng` persisted to settings; reload re-attempts geolocation when previously set; explicit denial message before ZIP fallback
- **Trust pass-through hardened:** `recomputePassedMarketTrustFields()` overwrites client-supplied trust fields server-side after store rehydration on rank — `lookupSource`, `dataSource`, `providerCoverageRollup`, and related fields no longer spoofable by the client
- **DB outage 503:** `/api/market-search` returns 503 on DB unavailability (consistent with `/api/recommendations`); UI shows honest failure copy instead of empty-store guidance
- **Double "Est." prefix fixed:** `formatEstimatedCurrency` is the single source of truth; `deals-panel.tsx` no longer adds a second prefix
- **Map model separation:** `buildDiscoveryMapModel` and `buildSingleStoreMapModel` are distinct builders; single-store overlay has one pin, no radius circle, backdrop dismiss works
- **Scale-awareness governance:** `.cursor/rules/yum4less-scale-awareness.mdc` (`alwaysApply: true`) — every fix response must include a `Scale check:` block answering small- and large-scale impact

**Evidence (this session):**
- `npm test` **746/746** (142 files)
- `npm run build` pass (Next.js **15.5.19**)
- `npm run test:e2e:ci` **19 passed / 1 skipped / 0 failed** (exit 0) — skipped: H12 Leaflet quirk (intentional); 2 flaky retries (`coordinate-first`, `api-errors` rank-500) passed on retry

**Deferred scale risks:** client-trust audit across all public API routes (Scale risk A); empty-vs-unavailable semantics on remaining read routes (Scale risk B) — see [Deferred backlog](#deferred-backlog-not-v1).

---

### 2026-07-01 — Single-store map model separation + scale-awareness rule

**Theme:** Fix single-store overlay backdrop dismiss by separating discovery vs single-store map builders; add governance rule for symptom vs root-cause fixes.

**Shipped:**
- `buildDiscoveryMapModel` / `buildSingleStoreMapModel` in `nearby-stores-map-model.ts` — discovery keeps radius circle + anchor; single-store is one pin only
- `NearbyStoresMap` branches on `StoresMapModel.kind`; `SingleStoreMapOverlay` uses minimal builder
- CSS `overflow: hidden` on single-store panel/map shell
- `e2e/single-store-map-overlay.spec.ts` — backdrop click at dimmed corner (not viewport center under panel)
- `.cursor/rules/yum4less-scale-awareness.mdc` + `AGENTS.md` + orchestration cross-ref + `beforeSubmitPrompt` hook reminder

**Evidence (this session):**
- `npm test` **743/743** (142 files)
- `npm run build` pass
- `npm run test:e2e:ci` **20 passed / 1 skipped / 0 failed** (2 flaky: `api-errors`, `coordinate-first` — passed on retry)

---

### 2026-07-01 — Walmart rollout copy test fix + live ingest isolation + full gate

**Theme:** Confirm live scheduled ingest isolated to `yum4less_dev`; fix stale Walmart `rolloutNote` expectation in integration test; full verification gate run.

**Shipped:**
- `recommendation-service.integration.test.ts` — Walmart assertion updated to plain-language copy from `provider-rollout.ts` (`dinner price estimates are not available`; was deprecated weekly-ad pricing string)

**Evidence (this session):**
- **DB isolation:** `ingest:weekly-ads:scheduled` reads `.env.local` `DATABASE_URL` → `yum4less_dev`. `run-integration-tests.mjs` / `run-e2e-tests.mjs` redirect `yum4less_dev` → `yum4less_test`. `yum4less_test`: **39** `price_observations` (`*-weekly-ad-scrape` only; no `*live*` sources); `kroger-mechanicsville` present. `yum4less_dev`: **337** rows incl. `kroger-official-api` — live ingest did not leak into test DB.
- `npm run test:integration` **24/24** (7 files)
- `npm test` **741/741** (142 files)
- `npm run build` pass (Next.js **15.5.19**)
- `npm run test:e2e:ci` **20 passed / 1 skipped (H12) / 1 failed** — `single-store-map-overlay.spec.ts`: Leaflet radius `path.leaflet-interactive` intercepts `Close store map` backdrop click (90s timeout)

**Honest limits:** `single-store-map-overlay` dismiss via backdrop still failing in full CI harness — use Escape (mobile test path) or fix z-index/pointer-events next slice. `coordinate-first` **passed** this run; geolocation persistence P1 not re-validated manually.

---

### 2026-06-30 — Shopper copy simplification (Slice 2)

**Theme:** Remove pipeline/BETA/chain-list jargon from normal flow copy; keep trust disclosure in expandable banner `<details>` unchanged.

**Shipped:** Chain-neutral hero, settings, rank, results, map legend/footnotes, store pills/badges, sale-confidence labels, trust banner summary (no “Beta” title), `sale-ingredient-picker` “Sale price — estimate only”. Updated committed e2e helpers/specs for changed strings.

**Evidence:** `npm test` **733/733** (140 files); `npm run build` pass. `npm run test:e2e:ci` **not re-run** this slice (specs updated only).

**Held unchanged:** `pricing-trust-heads-up-expanded.ts` (opt-in `<details>`), `internal-details-modal.tsx`, `recommendation-error-copy.ts` (error hints), dev-only provider messages.

### 2026-06-30 — Per-chain OSM gap-fill trigger

**Theme:** Replace total-pin sparse threshold with per-chain Postgres gap detection so seed-heavy markets still discover missing ranked branches.

**Shipped:**
- **`needsSearchTimeOsmGapFill()`** — ranked v1 chains need ≥ **2** Postgres pins in radius; context-only catalog chains (Walmart, BJ's) and Costco/Sam's name fragments need ≥ **1**; chains sourced from `chain-rollout-policy.ts`.
- **Removed** `YUM4LESS_MAP_SPARSE_PIN_THRESHOLD` / `DEFAULT_MAP_SPARSE_PIN_THRESHOLD` (no remaining readers).
- **`.env.example`** — sparse-pin env comment removed; inline comment documents old total-pin trap.

**Evidence:** `npm test` **733/733** (140 files); `npm run build` pass. Postgres MCP read-only spot-check: ZIP **23111**, **5 mi** — old rule skipped gap-fill; new rule triggers for Publix, Food Lion, Costco.

**Honest limits:** `npm run test:e2e:ci` / `npm run test:integration` not re-run this slice. Slice 2 shopper copy simplification **reported only** — pending owner review.

### 2026-06-29 — Chain rollout policy consolidation (Option A) + Kroger note parity + e2e bootstrap

**Theme:** One canonical rollout module; derived chain lists; four-chain Settings e2e green after CI bootstrap coord fix.

**Shipped:**
- **`chain-rollout-policy.ts`** — canonical `SHOPPER_RANKED_V1_CHAINS`; `SETTINGS_SELECTABLE_CHAINS`, `WEEKLY_AD_RANKED_PRICING_CHAINS`, and provider-rollout catalog display list derive from it (no independent hardcoded arrays).
- **Kroger base rollout note** — same `buildDirectionalRolloutNote()` template as Aldi, Publix, and Food Lion; no chain-specific trust-tier wording in the four v1 base notes.
- **Walmart** (weekly-ad-eligible, gate-blocked) and **BJ's** (catalog-display-only, not selectable) — confirmed intentional; documented inline in `chain-rollout-policy.ts`.
- **CI bootstrap** — `db/ci/014_ci_bootstrap_stores.sql` Publix/Food Lion coords within default 5 mi test radius; `ON CONFLICT DO UPDATE` (weekly-ad ingest rewrites `source_name`, so prior upsert no-op'd); `ensure-test-db.mjs` always reapplies bootstrap; fixture catalog coords aligned; `e2e/settings-stores.spec.ts` multi-store map scoping fix.

**Evidence:** `npm test` **731/731** (140 files); `npm run build` pass (Next.js **15.5.19**); `npm run test:e2e:ci` **19 passed / 1 skipped (H12 Leaflet quirk) / 0 failed** — confirmed clean uninterrupted run (not the prior session's partial **13/21**).

**Honest limits:** `npm run test:integration` not re-run this slice. Remote CI / homelab unchanged.

### 2026-06-29 — Four-chain copy/doc parity (Slice 1)

**Theme:** Remove stale Kroger/Aldi-primary hierarchy from shopper copy, tests, rules, and continuity; fix `listProviderRollout()` omitting Food Lion.

**Shipped:** Rank step + loading overlay; merged trust expander section (`Ranked v1 chains`); internal-details glossary; `listProviderRollout()` includes `food-lion`; `PROJECT_CONTINUITY.md` Working today + decision log ~1348 superseded; README, product rule, web-backend agent, redesign handoff; superseded banner on 2026-06-27 chain audit.

**Honest limits:** Kroger base rollout note BETA framing still pending owner decision (unchanged). Slice 2 rollout-toggle consolidation not started. `npm run test:e2e:ci` not re-run this slice.

### 2026-06-29 — Expand committed Playwright E2E suite

- **`e2e/`:** Shared `helpers.ts` + `fixtures/api-mocks.ts`; specs for coordinate-first geo, multi-store Settings, Tier C (mocked), API 400/500 panels, market pass-through, nav/theme, H11/H12 (promoted from CI-skipped `verify-h11-h12`), mobile smoke (`Pixel 5` project).
- **`playwright.config.ts`:** 90s timeout, failure video in CI, desktop + mobile projects.
- **Docs/rules:** `e2e/README.md`, `AGENTS.md`, `README.md`, testing + orchestration rules — committed Playwright is primary browser gate; MCP exploratory only.
- **Honest limits:** Local `npm run test:e2e:ci` — **13/21 passed** after expansion (H12 skipped — bundled Leaflet); full green re-run pending. Playwright MCP not re-run.

### 2026-06-29 — Promote Publix + Food Lion to shopper-ranked v1 (parity with Kroger/Aldi)

**Theme:** Remove `MEAL_PRICING_COMING_LATER_CHAINS` lock; add Publix and Food Lion to Settings store selection and OSM ranked-chain map policy.

**Shipped:** `provider-rollout.ts` — empty coming-later set; `settings-store-selection.ts` + `map-osm-ranked-chain-policy.ts` — four-chain ranked scope; trust copy (hero, heads-up, settings, help hints, shopper notices); `provider-rollout.test.ts`, `settings-store-selection.test.ts`, `e2e/mvp-flow.spec.ts` updated.

**Honest limits:** Publix/Food Lion have no Kroger-style official API path — weekly-ad ranked only. Walmart still context-only. Playwright MCP not re-run this slice.

### 2026-06-29 — Homelab scheduled-ingest runbook (prep only)

**Theme:** Document mechanical cron wiring for a future 24/7 Linux box — no hardware deploy, no ingest logic changes.

**Shipped:** [`docs/homelab-deploy.md`](docs/homelab-deploy.md) — prerequisites, `.env.local` (incl. real `YUM4LESS_INGEST_ZIPS`), cron wrapper + logrotate, Postgres freshness SQL, silent-failure playbook, stale-vs-thin product gap note. README daily-ingest section corrected (pipeline order map-catalog → weekly-ad; link to runbook).

**Honest limits:** Box not live; pre-go-live script gaps flagged in runbook (Docker-only `ensure-test-db`, schema-stale throw, partial chain success exit 0). No ingest-health UI slice. Food Lion promotion unchanged.

### 2026-06-28 — Kroger canonical store-id merge + weekly-ad fan-out (P0 live-session follow-up)

**Theme:** Close duplicate Kroger pins and thin per-store weekly-ad coverage after live browser diagnosis — slug ↔ numeric `locationId` merge, one Flipp ingest fan-out to all Kroger store ids in batch, OSM fixture pin suppression when official API catalog exists.

**Shipped:** `kroger-catalog-canonical.ts` — proximity dedupe (API-derived wins over bootstrap slug), OSM Kroger tombstone when `kroger-official-api` row in radius, weekly-ad primary-store picker. `store-catalog-sync.ts` — same-building proximity reconcile (0.15 mi). `weekly-ad-ingestion-service.ts` — single Kroger Flipp ingest + fan-out sync per store id. `market-search-service.ts` + `settings-store-selection.ts` — dedupe/filter before map/list and Settings dropdown. `provider-price-observation-sync.ts` — prefer API-derived Kroger id when `source_store_id` matches. Prior slice: honest empty-meals notice (TheMealDB schedule no longer masks zero recommendations).

**Owner context:** No scheduled ingest on owner machine — stale Aldi + empty API Kroger ids still require manual `npm run ingest:weekly-ads:scheduled` (or homelab cron) for fresh ranked reads; this slice fixes duplicate-id and fan-out gaps, not missing cron.

**Evidence:** `npm test` **727/727** (139 files); `npm run build` pass. Playwright MCP / integration / Postgres MCP not re-run this slice.

### 2026-06-28 — Publix weekly-ad matching close-out (compound-title guard batch)

**Theme:** Close Publix matching investigation after Stage 1 diagnosis — chain-agnostic guard batch for compound product titles; no threshold change.

**Shipped:** Extended `weekly-ad-match-guards.ts` — `butter` (butterbread/butterhead), `honey` (+turkey/ham/gouda/mango), `plain-yogurt` (yogurt bars/frozen greek), `garlic` (dip), `olive-oil` (focaccia), `lime` (beer), `yellow-onion` (onion cheese), `shrimp` (ravioli), `bacon` (sandwich), `cream-cheese` (pie/s'mores), `vanilla-extract` (cupcakes). Unit tests for 14 Publix false positives + 11 legitimate matches.

**Live re-measure post-guards (ZIP 23111, one pass):** **619 parsed → 71 matched (11.5%) → 32 unique ingredients** — **−15** false positives removed (86→71); unique **35→32**. Capture: `captures/weekly-ad-baseline/publix/2026-06-28T23-45-10.677Z/`. vs May **655/21 synced** — current week still richer (32 unique) but trust-cleaner; May typicality unconfirmed.

**Kroger/Food Lion cross-check:** No Kroger 13-match or Food Lion 15-match regressions from new guards (Land O Lakes Butter, Kerrygold, Chobani, Hormel Bacon unaffected).

**Decision:** Publix matching **actionable fixes applied** for compound-title class; remaining near-misses still wrong to promote. Not claiming at-ceiling — large feed supports more staples when on sale — but **no further fixes without wrong-target promotions**. Hunt's Tomatoes → canned-tomatoes (0.54) remains borderline, not shipped.

**Evidence:** `npm test` **718/718** (138 files).

### 2026-06-28 — Publix weekly-ad matching Stage 1 diagnosis (read-only)

**Theme:** Same funnel diagnosis as Aldi/Kroger/Food Lion — live browser scrape at ZIP 23111; bucket offers; classify near-misses; no matching logic changes this pass.

**Live capture (one pass):** **619 parsed → 86 matched (13.9%) → 35 unique ingredients** via Publix browser scrape + HTML/network parser. Capture: `captures/weekly-ad-baseline/publix/2026-06-28T23-28-25.850Z/`. vs May baseline **655/21 synced** — much larger raw feed than Flipp chains; **~15 clear false-positive matches** identified (butterbread→butter, yogurt bars→plain-yogurt, honey deli meat→honey, etc.); clean unique ~23–28 estimated. May **21 synced** plausible after dedupe + week variance.

**Findings:** Compound-title token collision is the dominant fixable class (same as Aldi). Near-misses mostly wrong to promote (baked beans, whiting/salmon, Ore-Ida, turkey breast→chicken). Hunt's Tomatoes → canned-tomatoes at 0.54 borderline. **Stage 2 guard batch proposal pending owner approval** — not at-ceiling until false-positive rate cleaned.

**Infrastructure:** `analyze-kroger-flipp-match-funnel.ts` extended with `--chain publix` (scrape path reuses baseline capture + funnel analysis).

**Evidence:** Live scrape only; Playwright Chromium install required this session; `npm test` not re-run.

### 2026-06-28 — Food Lion Flipp matching close-out (flour-tortilla alias + butter guard)

**Theme:** Close Food Lion weekly-ad matching investigation after Stage 1 diagnosis — one chain-agnostic alias + one butter false-positive guard; no threshold change.

**Shipped:** `"flour tortilla"` alias on `flour-tortillas`; `butter` rejects `/can't believe/i`, `/not butter/i`, `/brumel/i`. Unit tests for margarine rejection, Kerrygold pass-through, La Banderita match.

**Live re-measure post-fix (ZIP 23111, one pass):** **133 parsed → 15 matched (11.3%) → 13 unique ingredients** — **+1** `flour-tortillas` (La Banderita), **−1** false `butter` (margarine spread); matched **offer count unchanged** at 15 with cleaner ingredient mix. Capture: `captures/weekly-ad-baseline/food-lion/2026-06-28T23-24-57.298Z/`. vs May **137/20 synced** — May likely stronger week (12→13 unique now vs ~20 implied May).

**Kroger cross-check:** Land O Lakes Butter + Butter Croissants **not** caught by new butter guards — Kroger 13 matched unchanged.

**Decision:** Food Lion Flipp **not at hard ceiling** (broader grocery SKU coverage than Aldi/Kroger same ZIP/week) but **near-miss promotions still wrong** (baked beans, whiting, Ore-Ida, etc.). May **20 synced** remains unconfirmed typical — needs second-week capture. **Investigation closed** for actionable matching fixes this pass.

**Evidence:** `npm test` **683/683** (138 files).

### 2026-06-28 — Food Lion Flipp matching Stage 1 diagnosis (read-only)

**Theme:** Same funnel diagnosis as Aldi/Kroger — live Flipp capture at ZIP 23111; bucket offers; classify near-misses; no code changes this pass.

**Live capture (one pass):** **133 parsed → 15 matched (11.3%) → 12 unique ingredients**. Capture: `captures/weekly-ad-baseline/food-lion/2026-06-28T23-21-10.304Z/`. vs May baseline **137/20 synced** — current week thinner on unique dinner SKUs (12 vs ~20 implied May); staples present (lemon, olive oil, soy sauce) that Aldi/Kroger feeds lacked same ZIP/week.

**Findings:** One matched false positive (`I Can't Believe It's Not Butter` → butter); one evidence-backed alias gap (`flour tortilla` singular → 0.74); six near-misses wrong to promote (baked beans/black beans, whiting/salmon, Ore-Ida/baby potatoes, turkey/chicken breast combo, fresh strawberries/frozen-berries); Chobani `Greek or Zero Sugar` title scores 0.54 (0.74 without `or Zero Sugar` — scoring limit, not missing alias). **Stage 2 proposals pending owner approval.**

**Evidence:** Live Flipp only; `npm test` not re-run this sub-slice.

### 2026-06-28 — Aldi Flipp matching close-out (false-positive guards + at-ceiling)

**Theme:** Close Aldi weekly-ad matching investigation after Stage 1 funnel diagnosis — three chain-agnostic guard patterns for ingredient-name token collisions; no threshold change; no alias inflation.

**Shipped:** `weekly-ad-match-guards.ts` — `honey` rejects `/graham/i` + `/hot honey/i`; `cheddar-cheese` rejects `/brats?/i` + `/smoked sausage/i`; `vanilla-extract` rejects `/vanilla bars/i`, `/ice cream/i`, `/crunch bars/i`. Unit tests for five Aldi false positives + eleven legitimate Aldi matches unchanged. Flipp funnel script generalized with `--chain aldi` + confidence buckets (prior slice).

**Stage 1 diagnosis (ZIP 23111, one live Flipp pass):** **148 parsed → 23 matched (15.5%) → 14 unique ingredients** pre-guards; ~54% noise (LEGO/home goods); near-misses all wrong-target; no Greek-yogurt-class alias gap in this week's feed.

**Live re-measure post-guards (ZIP 23111, one pass, 2026-06-28):** **148 parsed → 18 matched (12.2%) → 11 unique ingredients** — exactly **−5** false positives removed (honey ×2, cheddar-cheese ×2, vanilla-extract ×1). Capture: `captures/weekly-ad-baseline/aldi/2026-06-28T23-19-38.380Z/`. **Investigation closed.**

**Decision:** Aldi Flipp **match rate at-ceiling for typical weekly inventory** — protein-heavy summer ad + off-list SKU noise; not a resolver bug. Known risk class: **compound product titles containing ingredient tokens** (honey/cheddar/vanilla in sausage, crackers, frozen bars) — check when diagnosing Food Lion/Publix.

**Kroger cross-check (read-only):** None of Kroger's **13 matched** offers (2026-06-28 capture) target `honey`, `cheddar-cheese`, or `vanilla-extract` — **Kroger 13 matched close-out number unchanged.**

**Evidence:** `npm test` **675/675** (138 files). Captures: pre-guard `…/2026-06-28T23-02-37.607Z/`; post-guard `…/2026-06-28T23-19-38.380Z/`.

### 2026-06-28 — Kroger Flipp matching close-out (`greek yogurt` alias + at-ceiling decision)

**Theme:** Close Kroger weekly-ad matching investigation after funnel diagnosis — one chain-agnostic alias fix; no threshold or wrong-target near-miss promotions.

**Shipped:** `"greek yogurt"` alias on `plain-yogurt` in `weekly-ad-ingredient-search-terms.ts` (covers Flipp titles like Chobani/Fage); unit tests; match-funnel + baseline capture tooling from prior slice retained.

**Live re-measure (ZIP 23111, one pass):** **119 parsed → 13 matched → 1 newly synced** (9 skipped unchanged — dev Postgres already held prior-session rows). vs pre-alias same inventory: **119 / 11 / 9** (2026-06-27). **+2 matched** (expected Chobani + Fage greek yogurt). Alias is chain-agnostic — may lift matching on Aldi/Food Lion/Publix/Walmart when those feeds include `"Greek Yogurt"` titles.

**Same-day Food Lion Flipp diagnostic (2026-06-28, pre-alias capture):** 133 parsed, **15 matched** — for context only; May 2026 baseline **20 synced** still unconfirmed as typical week.

**Decision:** Kroger Flipp **match rate treated as at-ceiling** for typical weekly inventory (~60% off-list SKU noise; Kroger ad lacked lemon/olive oil/soy/salmon/bell peppers present in Food Lion feed same ZIP/week). Not a bug; not further actionable without a second data source or a different week's capture. Food Lion May **20 synced** may be an unusually strong week — needs second-week data to confirm. **2026-06-28 Aldi guard slice:** none of Kroger's 13 matched offers (same ZIP/week capture) use `honey` / `cheddar-cheese` / `vanilla-extract` — **13 matched count unaffected** by the chain-agnostic false-positive guards.

**Evidence:** `npm test` **654/654** (137 files). Live baseline: `npx tsx scripts/run-kroger-weekly-ad-live-baseline.ts`.

### 2026-06-27 — Kroger weekly-ad Flipp-first parity (sale discovery path)

**Theme:** Align Kroger sale-discovery with Aldi/Food Lion — full `resolveFlippWeeklyAdOffersForChain` (merchant + flyer + supplemental ingredient searches) as primary tier; chain scrape secondary; official Products API partial fill last.

**Shipped:** `kroger-weekly-ad-ingestion.ts` reordered Flipp-first; `kroger-weekly-ad-ingestion.test.ts` (5 cases); Kroger case in `flipp-weekly-ad-resolver.test.ts`; `weekly-ad-chain-config.ts` termsNote; `docs/provider-integration-pattern.md` shape A now includes Kroger (three chains — shared-config trigger met, **not built**).

**Root cause (code):** Prior path was scrape-first (Flipp skipped when scrape returned anything) and used simple `fetchFlippWeeklyAdOffers` only — missing flyer lookup and supplemental ingredient searches Aldi/Food Lion get. Matching threshold (`MIN_WEEKLY_AD_MATCH_CONFIDENCE` 0.55) and weekly-ad alias terms are chain-agnostic; Kroger’s 101 `provider_search_terms` rows affect official API sync only, not Flipp matching.

**Honest limits:** Single live attempt 2026-06-27; Food Lion still 20 synced at same ZIP (May baseline). Supplemental Flipp ingredient searches did not appear in retrieval label this run (merchant+flyer already had matches). `probe:kroger-live-scrape.mjs` still documents old scrape-first path — update separately if kept as owner probe.

**Evidence:** Live baseline @ ZIP 23111 — **119 parsed → 9 synced** (11 matched pre-dedupe); Flipp-first, scrape/API not used. Prior May 2026: 122→4. `npm test` **650/650** before live run.


**Theme:** Generalize Kroger data-path audit lessons into store-agnostic documentation — no speculative plugin layer.

**Shipped:** [`docs/provider-integration-pattern.md`](docs/provider-integration-pattern.md) — three data-type categories (store location, item pricing, sale discovery); per-source structural capability matrix; generalized audit checklist; store-agnostic vs Kroger-hardcoded codebase inventory; explicit non-goals. Cross-linked from Resume + Decision log.

**Honest limits:** Documentation + flagging only; no code refactor. Weekly-ad fallback order remains hand-written per chain file; official price sync remains Kroger-only in `syncProviderPreviewsToPriceObservations`.

### 2026-06-26 — Post-audit follow-ups: trust banner expansion + M128 rule correction

**Theme:** Owner decisions from five-stage audit close-out — restore modal trust depth via banner disclosure; align scrape-compliance rule with shipped ingest behavior.

**Trust copy (item 1):** Expanded `PricingTrustHeadsUpBanner` with `<details>` disclosure — paragraph content recovered from deleted `trust-explainer-modal.tsx` (chain coverage, 24h cache/freshness, sale confidence, fallback, Kroger/Aldi production focus, other chains context-only, Walmart/OSM context). Inline heads-up message, card labels, and Tier C messaging unchanged. No modal, Settings section, or new route. Unit/component tests for section presence + M156 forbidden-claim patterns.

**M128/M151 (item 2):** `yum4less-security-and-dependencies.mdc` now documents **manual owner-pause only** today; robots.txt checks, auto-pause on block signals, and automated per-chain kill switches explicitly **homelab-slice planned**, not shipped. No ingest automation added this pass.

**Evidence:** `npm test` **644/644** (134 files); `npm run build` pass. Playwright MCP on production `next start` (:3000): ZIP **23111** flow; expanded banner light `#faece7` (`post-audit-light-trust-banner-expanded.png`) + dark `#101a14` (`post-audit-dark-trust-banner-expanded.png`); Chain coverage, 24h cache, Sale confidence, Fallback sections visible.

**Honest limits:** M128/M151 automation still homelab queue. Not claiming verified/CI green/deploy-ready.

### 2026-06-26 — Full-project audit close-out (Stages 1–5)

**Theme:** Doc-vs-reality + QA + test/build gates + trust explainer modal removal + continuity sync.

**Stage 1 (senior-auditor):** Cross-checked Resume/changelog vs code; flagged stale verification snapshot, mislabeled D7 Playwright screenshots, M128 scrape guard doc/code gap, Sprint E workflows local-only, decision-log contradictions.

**Stage 2 (qa-engineer):** Playwright partial + code review; stale results idle copy; manual-pick zero-selection UX; dev `.next` corruption when `build` runs parallel to `dev`.

**Stage 3 (testing-cicd):** Fixed `test-fixtures.ts` build types; updated results idle copy; manual-ingredient Continue guard; +3 unit tests; Playwright on `next start` — light/dark themes confirmed (`stage3-*.png`); Sprint D P0 claims match repo.

**Stage 4:** Deleted `trust-explainer-modal.tsx`, auto-open state, “How to read these labels” trigger, `trust_explainer_dismissed` analytics; updated unit + e2e tests.

**Stage 5 (verifier):** Re-ran `npm test` **636/636**, `npm run test:integration` **24/24**, `npm run build` pass; continuity + decision log updated below.

**Honest limits:** `npm run test:e2e:ci` not re-run. Remote CI not inspected (unpushed working tree). M128/M151 robots.txt + per-chain auto-pause still policy-only. Long chain-coverage essays from modal not relocated — inline trust + hero/help hints only (owner to choose if expansion needed). Semgrep MCP not re-run.

**Evidence:** `npm test` **636/636** (132 files); `npm run test:integration` **24/24**; `npm run build` pass; Playwright MCP production server ZIP **23111** rank **1** meal, themes light `#faece7` / dark `#101a14`.

---

### 2026-06-26 — Post-audit hardening Sprints A–E

**Theme:** Close provider-search-terms debt, add meal-ranking test harness, Zod settings/shopping-route spine, P0 redesign component tests, dependency monitoring.

**Shipped:**
- **Sprint A:** `resolveKrogerPreviewTrackedIngredients` / `resolveKrogerSyncTrackedIngredients`; auto DB term load in `buildProviderPricingPreviews`; required `trackedIngredients` on coverage rollup; full-catalog static fallback (97 ingredients)
- **Sprint B:** `recommendation-scoring.test.ts`, `shopping-plan-builder.test.ts`, frozen CI-02 regression baseline, `location-resolution.test.ts`, `meal-presentation.test.ts`
- **Sprint C:** `contracts/shared/settings-preferences.ts`; `contracts/shopping-route.ts`; corrupt localStorage → null
- **Sprint D (P0):** `test-fixtures.ts` + co-located tests for gate/ingredients/picker/rank/deals/meal-card trust branches
- **Sprint E:** `.github/dependabot.yml`, `dependency-watch.yml`, README PostCSS advisory note

**Honest limits:** Playwright MCP on P0 panels not run this slice. P1–P3 UI tests (settings, welcome, bottom-nav, map overlay, theme-sync) deferred. Workflow files not on remote — not claiming CI green.

**Evidence:** `npm test` **633/633** (132 files); `npm run test:integration` **24/24**; `npm run build` pass; Postgres MCP Kroger **101** `provider_search_terms` rows.

---

### 2026-06-26 — D7: mockup color/tokens port (Theme C/D)

**Theme:** Replace interim navy/mint tokens with mockup palette; flat page bg; system font; **light default on first visit**; apply trust/urgency/price roles to existing labels without copy changes.

**Shipped:**
- **`theme-tokens.css`:** Theme C (dark) + Theme D (light) from `.private/tokens.css` — base surfaces, action, trust/urgency/price/danger, tag-blue/coral/purple; legacy `--panel`/`--text`/`--accent` aliases; first-paint `html:not([data-theme])` = light (D7 overrides D2 OS-first)
- **`globals.css`:** flat `var(--bg)` page; system font stack; recolored panels, buttons, bottom nav, map chrome, accordion/cards, warnings/trust banners; store-group heading tag chips
- **First-visit default:** `defaultFormState.theme`, `ThemeSync`, and SSR `resolveThemePreference` fallback → **`light`** (Settings still offers light/dark/system; persisted choice unchanged after first save)
- **Trust color roles:** `meal-recommendation-card`, `sale-ingredient-picker`, `deals-panel` — price/trust/urgency badge classes on existing Est./freshness/directional labels (no wording changes)
- **`nearby-stores-map.tsx`:** search-radius circle reads `--action` token

**Honest limits:** Owner browser verification of both themes **not yet run**. `npm run test:e2e:ci` not re-run. Not claiming verified/deploy-ready without owner sign-off.

**Evidence:** `npm test` **549/549** (121 files); `npm run build` pass. Playwright MCP — first visit light (`#faece7`), dark switch (`#101a14`), trust-heads-up legible in both themes (`d7-light-trust-labels.png`, `d7-dark-trust-labels.png`).

---

### 2026-06-25 — Doc sync; Settings store dropdown + SSR hydration fixes

**Theme:** Align shared docs with shipped redesign; fix Settings store picker empty when gates off; fix React hydration error in Cursor/browser preview.

**Shipped:**
- **`settings-store-selection.ts`:** Settings dropdown lists **Kroger + Aldi** regardless of `recommendationEnabled`; prefers ingested/catalog rows over `osm-` pins; defaults + auto market search on Settings when setup incomplete
- **SSR hydration:** `SSR_DEFAULT_APP_TAB` (`settings`) for server/first paint; `resolveAppTabFromPreferences()` after mount; form prefs hydrate post-mount with guarded localStorage writes — fixes server Settings vs client Home mismatch

**Docs:** `PROJECT_CONTINUITY.md`, `README.md`, `docs/redesign/redesign-analysis-handoff.md` refreshed for slices 1–5 + D1–D6 + D7 queue.

**Honest limits:** D7 color port not started. Playwright MCP / `npm run test:e2e:ci` not re-run.

**Evidence:** `npm test` **548/548** (121 files); `npm run build` pass.

---

### 2026-06-25 — Deferred redesign D1–D6: 5-tab shell, theme, ingredients, map link, pantry

**Theme:** Ship deferred mobile-first shell and UX increments after slices 1–5 (Home/Deals/Cook/Saved/Settings tabs, light/dark theme, ingredient gate + manual pick chips, map overlay link, session pantry entry).

**Shipped:**
- **D1:** `bottom-nav.tsx`, `app-tab.ts`, `deals-panel.tsx`, `saved-placeholder-panel.tsx`; tab routing in `use-meal-planner.ts` + `index.tsx`; Cook enabled when `recommendationState.status === 'ready'` with results; Settings tab owns location/stores/theme; Home owns welcome → ingredients → rank → results
- **D2:** `theme-tokens.css`, `ThemeSync`, `resolve-theme.ts`; Settings theme select persists to localStorage; `prefers-color-scheme` first paint before manual override
- **D3:** `ingredient-gate-panel.tsx` (use-all vs manual); `sale-ingredient-picker.tsx` — search, category chips, multi-store grouping; `inferIngredientCategory` moved to client-safe `ingredient-category.ts`
- **D4:** Single-column shell layout under bottom nav (accordion unchanged from slice 4)
- **D5:** Map link bar above bottom nav on ingredients step; `store-map-overlay.tsx` (no map tab/column on main path)
- **D6:** `pantry-prompt-card.tsx` on results — session-only add/remove; no persistence

**Honest limits:** Playwright MCP and `npm run test:e2e:ci` not re-run. Pantry does not affect ranking yet. Saved tab is placeholder only. Cuisine chips (R11) not shipped.

**Evidence:** `npm test` **544/544**; `npm run build` pass.

---

### 2026-06-25 — Redesign slice 5: Settings gate + welcome flow + opt-in deletion

**Theme:** Settings-first entry, welcome budget/dietary, tap-step flow (ingredients → rank → results), full-screen rank loading, delete TheMealDB opt-in dead code.

**Shipped:**
- Flow steps on Home tab: `welcome` → `ingredients` → `rank` → `results` (`flow-step.ts`, `use-meal-planner.ts`); Settings is a **tab** (D1), not a flow step
- New panels: `settings-panel`, `welcome-panel`, `ingredients-step-panel`, `rank-step-panel`, `rank-loading-overlay`
- Settings gate via `isSettingsPreferencesComplete`; explicit `markSetupComplete` on Save (draft auto-save no longer completes setup)
- Factory reset in Settings (`clearSettingsPreferences` + re-gate)
- Deleted `location-search-panel.tsx`, TheMealDB opt-in UI/CSS, shopper `recipeSourceOptIn` on public API/contracts
- `recommendation-service`: removed opt-in gate; public parse requires `recipeSource: internal-library`
- Tests + e2e updated for new flow

**Honest limits:** Playwright MCP and `npm run test:e2e:ci` not re-run. Deferred shell (5-tab nav, map-as-link-only) unchanged.

**Evidence:** `npm test` **540/540**; `npm run build` pass.

---

### 2026-06-25 — Redesign slice 4: stacked accordion meal cards

**Theme:** Replace swipe carousel with stacked accordion — title-only collapsed, one expanded at a time.

**Shipped:**
- `meal-results-accordion.tsx` — expand/collapse triggers; `hideTitle` on `MealRecommendationCard` when expanded
- `meal-results-panel.tsx` — uses accordion instead of `RecommendationResultsCarousel`
- Deleted `recommendation-results-carousel.tsx` + unit test; removed carousel CSS from `globals.css`
- Tests: `meal-results-accordion.test.tsx`; C1 panel test + `meal-planner.test.tsx` expand before detail assertions; e2e accordion + core flow updates

**Honest limits:** Welcome/settings gate and TheMealDB opt-in deletion still slice 5. Playwright MCP session could not reach ranked results (dev on `:3002`, no sale ingredients in that DB state); `npm run test:e2e:ci` not re-run.

**Evidence:** `npm test` **542/542**; `npm run build` pass.

---

### 2026-06-25 — TheMealDB opt-in: schedule deletion (slice 5)

**Theme:** Owner chose delete over keep-hidden; dead opt-in code removal bundled with slice 5 flow/settings work.

**Changed:** Resume, implementation slices table, locked plan, decision log.

---

### 2026-06-25 — Redesign slice 3: store scope + ingredient defaults

**Theme:** Shopper-selected stores drive UI and rank scope; server resolves default sale ingredients; remove 40-ID POST cap.

**Shipped:**
- `selectedStoreIds` on `MealPreferenceForm` + API validation (`parseSelectedStoreIds`, shopping-style bounds)
- `store-scope.ts` — unselected stores hidden from scoped market, map, sale ingredients, rank observations
- Default rank: omit `selectedIngredientIds` → server resolves all rankable ingredients at selected stores (`resolveEffectiveSelectedIngredientIds`)
- Removed `selectedIngredientIds.length > 40` rejection; per-ID validation + 64 KB body limit unchanged
- Settings prefs: `settings-preferences.ts` localStorage (`setupComplete` marker); auto-save from form; store dropdown under shopping style (single select / multi checkboxes)
- Rank CTA enabled when store(s) selected; optional ingredient narrow only

**Honest limits:** Settings-first gate routing + factory-reset UX deferred to slice 5. Carousel and welcome flow unchanged (slices 4–5). Playwright MCP not run.

**Evidence:** `npm test` **540/540**; `npm run test:integration` **24/24**; `npm run build` pass.

### 2026-06-25 — Redesign slice 2: merged TheMealDB ranking

**Theme:** Single score-sorted list (internal library + sale-matched TheMealDB); hide shopper opt-in checkbox.

**Shipped:**
- `selectRecipesForRanking` / `filterRecipesForMergedRanking` — default `internal-library` path pools internal + TheMealDB imports; one sort, no per-source quota
- TheMealDB scheduled-refresh metadata check runs on merged default path (DB-backed markets)
- Client rank payload always sends `recipeSource: internal-library` (merged); checkbox hidden via `SHOW_THEMEALDB_OPT_IN_UI = false` in `location-search-panel.tsx` — `FormState.externalRecipeOptIn` + API `recipeSourceOptIn` kept for tests
- Trust copy: scheduled-refresh notice updated for merged ranking; TheMealDB empty notice no longer references unchecked checkbox
- Tests: merge sort order, zero-import eligibility (internal still ranks), sale-overlap exclusion, explicit `themealdb`+opt-in API path preserved

**Honest limits:** Checkbox code not deleted — owner decision pending. Carousel, 40-ID cap, welcome/settings flow unchanged (slices 3–5). Playwright MCP not run this slice.

**Evidence:** `npm test` **535/535** (116 files); `@verifier` Partially verified (Vitest only).

### 2026-06-25 — Redesign slice 1: remove `dinnersWanted`

**Theme:** No fixed meal-card cap; ranked result count = eligibility filters only.

**Shipped:**
- Removed `dinnersWanted` from `API_LIMITS`, Zod (`dinnersWantedSchema`), `MealPreferenceForm`, `parseRecommendationRequest`, client rank payload (`form-validation`, `use-meal-planner`), and `DEFAULT_DINNERS_WANTED`
- `getRecommendationExperience` returns **all** qualifying ranked meals (removed `.slice(0, preferences.dinnersWanted)`)
- Route/ranking/contract tests updated; out-of-bounds `dinnersWanted` rejection cases removed

**Honest limits:** Carousel, 40-ingredient POST cap, TheMealDB checkbox, and welcome/settings flow unchanged (slices 2–5). `npm run build`, Playwright MCP, integration, and e2e **not** run this slice.

**Evidence:** `npm test` **529/529** (116 files).

### 2026-06-25 — Settings-first gate + factory reset (doc lock)

**Theme:** Require saved Settings before welcome/ingredients; re-gate only on factory reset.

**Shipped (docs):**
- **Redesign plan:** entry order — no saved Settings or factory reset → Settings first; slice **3** owns prefs completeness; slice **5** owns routing + factory-reset control
- **Decision log** row added; welcome-flow row clarified (Settings gate triggers defined)

**Honest limits:** Not implemented in code yet.

### 2026-06-25 — Redesign plan consolidated into continuity (decisions log retired)

**Theme:** Single source of truth for redesign locks; owner refinements (budget/dietary on welcome, store dropdown under shopping style, unselected stores invisible).

**Shipped:**
- **Merged** former `docs/redesign/DECISIONS_LOG.md` into [**Redesign — locked plan**](#redesign--locked-plan-2026-06-25) + [**Implementation slices**](#redesign--implementation-slices-ordered)
- **Deleted** `docs/redesign/DECISIONS_LOG.md`; updated `docs/redesign/README.md` to point here only
- **Decision log:** superseded `dinnersWanted=3`, exclusive TheMealDB opt-in shopper UX, and split redesign rows — replaced with consolidated 2026-06-25 entries

**Honest limits:** Redesign **code slices 1–5 not started** this entry; shipped code still uses carousel, `dinnersWanted`, 40-ID cap, ZIP-on-home flow, and TheMealDB checkbox.

### 2026-06-25 — Redesign decisions log promoted to shared docs (superseded by consolidation entry above)

**Theme:** Lock UI/UX redesign direction; supersede handoff open questions.

**Shipped:** Initial promotion of redesign decisions to shared docs (later consolidated into this file).

**Honest limits:** No redesign code slices started.

### 2026-06-22 — Rank payload trim + honest error copy + meal-results badges (Playwright-found blocker)

**Theme:** Cross-cutting bug — full `market` object in `POST /api/recommendations` exceeded 64 KB; UI mapped body-too-large 400 to “Check your meal preferences.”

**Shipped:**
- **`trimMarketForRankingPassThrough(market)`** in `src/lib/market-pass-through.ts`; wired in `use-meal-planner.ts` before rank — keeps pass-through validation fields only (~11 KB vs ~105 KB for ZIP `23111`/5 mi).
- **`mapRecommendationApiError`:** distinct branches for body-too-large and invalid/stale market snapshot; preference blame only for invalid preference payload.
- **`meal-results-panel` badge:** error state no longer shows “Ready to suggest”; Tier C shows “No ranked meals in this area” instead of “Waiting for store search.”
- Tests: `market-pass-through.test.ts` trim size/parse; `recommendation-error-copy.test.ts`; `meal-results-panel.test.tsx` error/Tier C/M5 empty-filter cases.

**Honest limits:** Far-ZIP market-search scale (883 KB / 1,310 stores) and slow-search stuck-loading not addressed this slice.

**Evidence:** `npm test` **528/528**; `npm run build` pass. Playwright walkthrough found blocker; post-fix CLI Playwright happy path: rank 200, 2 meal cards, payload under limit (`happy-path-meal-cards.png`). Playwright MCP post-fix: store search confirmed (`mcp-happy-path-01-location-set.png`); full rank MCP run blocked by MCP server disconnect after dev-server restart — reconnect Playwright MCP to complete UI verification loop.

### 2026-06-19 — Rules/agents/hooks slice 3 closeout (K125, M153, K122)

**Theme:** Final three refactor items — live probe rename, owner decisions distill, AGENTS.md shrink.

**Shipped:**
- **`probe:*` rename (K125):** `test:kroger-api` → `probe:kroger-api` (and five other live/network probes) in `package.json`; references updated in README, `.env.example`, `@ingest-standards`, Kroger provider copy, `sync-provider-prices.ts`. CI unchanged (never referenced old names).

- **NEW** `.private/owner-decisions.md` (M153) — distilled bullets by topic + link to questionnaire.
- **`AGENTS.md` shrink (K122):** agent index, Q56 verification floor, MCP table only; detail moved to agent files + orchestration/testing rules. Hook/continuity references updated.

**Evidence:** `npm test` **522/522** after each step; `npm run build` pass.

### 2026-06-19 — Contracts / Zod slice (Q157 + Q158)

**Theme:** Shared Zod request contracts for public API routes and meal-planner form validation; types moved to `src/contracts/recommendations.ts` with thin shim.

**Shipped:**
- **`zod`** dependency added
- **NEW** `src/contracts/shared/{limits,location,meal-preferences}.ts` — shared bounds/enums (form budget 5–40 vs API 5–250 intentional)
- **NEW** `src/contracts/market-search.ts` — `parseMarketSearchRequest`
- **NEW** `src/contracts/recommendations.ts` — domain types + `parseRecommendationRequest`; `market` field is `unknown` pass-through (validated in `market-pass-through.ts`, not a token)
- **`recommendation-types.ts`** — thin re-export shim from contracts
- Routes wired to contract parsers; `form-validation.ts` uses shared schemas
- Unit tests: `src/contracts/*.test.ts`, extended `form-validation.test.ts`

**Evidence:** `npm test` **522/522** (116 files); `npm run build` pass.

### 2026-06-19 — Rules/agents/hooks refactor slice 3 phase 3e (`@ingest-standards`)

**Theme:** Seventh agent for ingest pipeline ownership (M166); engineering queue full order in product-and-trust.

**Shipped:**
- **`yum4less-product-and-trust.mdc`** — engineering queue: split (done) → contracts/Zod (next) → rules/agents/hooks refactor (active) → P1 items → homelab precursors
- **NEW** `.cursor/agents/ingest-standards.md` — Q50 pipeline, M128 scrape guard, Q32 fixture policy, map-catalog/OSM/SNAP, owner live probes, parser drift
- Wired `@ingest-standards` in `route-user-prompt.ps1`, `inject-orchestration-session-context.ps1`, `AGENTS.md`

**Still queued:** `probe:*` rename (K125); `.private/owner-decisions.md`; AGENTS.md shrink (K122).

**Evidence:** `npm test` **498/498**.

### 2026-06-19 — Rules/agents/hooks refactor slice 3 (phases 3b–3d complete)

**Theme:** K117(c) approved merges executed; coordinates language + queue order from steps 1–2; awaiting phase 3e (`@ingest-standards`).

**Shipped (steps 1–2, prior turn):**
- Coordinates-first language on `AGENTS.md`, `nudge-after-file-edit.ps1`, `route-user-prompt.ps1`
- Session hook queue order: split (done) → contracts → rules refactor (active)

**Shipped (phase 3b — Merge A):**
- **NEW** `yum4less-product-and-trust.mdc` — product scope + trust/fallbacks + doc owners
- **DELETED** `yum4less-trust-and-fallbacks.mdc`, `yum4less-product-direction.mdc`
- Updated `AGENTS.md`, `readme-living-document.mdc`

**Shipped (phase 3c — Merge B):**
- Expanded `yum4less-testing-and-release-gates.mdc` with full MCP adoption/verification sections
- **DELETED** `mcp-adoption-strategy.mdc`

**Shipped (phase 3d — Slim C + Merge D):**
- Slim `yum4less-governance-and-doc-sync.mdc` — approval workflow only; doc owners → product-and-trust
- Slim `yum4less-agent-orchestration.mdc` — trigger table authoritative; MCP/test detail → testing-and-release-gates
- Slim scoped workflows — Phase 1 audit deltas only; pointers to orchestration
- `yum4less-backend-api-workflow.mdc` globs include `meal-presentation.ts`

**Rule file count:** 10 (was 12; learning-notes deleted earlier)

**Not done (awaiting confirmation):** phase 3e `@ingest-standards`; `owner-decisions.md`; AGENTS.md shrink (K122); `probe:*` rename.

**Evidence:** `npm test` **498/498** after each of phases 3b, 3c, 3d.

### 2026-06-19 — Rules/agents/hooks refactor slice 3 (steps 1–2; merge map proposed)

**Theme:** Coordinate-first language on remaining ZIP-primary surfaces; correct engineering queue order in session hook; K117(c) merge map for owner review (no merges executed).

**Shipped (steps 1–2):**
- **AGENTS.md** — Playwright MCP table + checklist: coordinates `37.6085`, `-77.3739` primary; ZIP `23111` fallback-path only
- **Hooks** — `nudge-after-file-edit.ps1`, `route-user-prompt.ps1` aligned to same pattern; `inject-orchestration-session-context.ps1` queue order fixed to split (done) → contracts → rules refactor (active)
- **K117(c) merge map** — proposed below in this changelog entry's companion report; **awaiting owner approval** before any rule deletes or `@ingest-standards`

**Not done (awaiting approval):** rule file merges/deletions; `@ingest-standards` agent; `owner-decisions.md`; `probe:*` rename; AGENTS.md shrink (K122).

**Evidence:** docs/hooks only; `npm test` not re-run this sub-slice.

### 2026-06-19 — Five-file recommendation-service split

**Theme:** Split monolithic `recommendation-service.ts` into focused modules while preserving the public import surface via re-exports.

**Shipped:**
- `recommendation-types.ts` (166 lines) — shared types + `RecommendationDependencyUnavailableError`
- `recommendation-scoring.ts` (149 lines) — `scoreCandidate`, `comparePlanQuality`, `getPlanQuality`, `compareObservationQuality`, freshness/confidence labels
- `shopping-plan-builder.ts` (138 lines) — single/multi-store plan construction; one-directional dependency on scoring
- `market-search-service.ts` (455 lines) — `getMarketSearchExperience`, `buildNearbyStoresForSearch`, `collectRecipeIngredientIdsForRollout`
- `meal-presentation.ts` (144 lines) — `toRecommendation`, explanation/ThemealDB notices, `attachMealPresentation`
- `recommendation-service.ts` (297 lines, down from ~1334) — slim orchestrator + re-export shim; routes and ~40 consumer files unchanged

**Evidence:** `npm test` **498/498** after each extraction step; final `npm run build` pass. Playwright MCP / Postgres MCP / Semgrep not re-run.

### 2026-06-19 — Phase 1 correctness audit remediation (slices 0–8)

**Theme:** Governance-first fixes for Phase 1 audit Critical/High findings (C1–H12); medium/low deferred.

**Shipped:**
- **Slice 0 — Governance:** empty-vs-unavailable, ingest persist logging/exit codes, frontend request races/error boundary, direct unit-test requirements in scoped rules + `AGENTS.md` + stop hook
- **Slice 1 (C1):** `meal-results-panel` renders notice + carousel together; regression test
- **Slice 2 (C2/H4/M6):** request-generation guards in `use-meal-planner`; loading disables; hook tests
- **Slice 3 (H1–H3):** market pass-through on `/api/recommendations` (`market-pass-through.ts`); single `getMarketDataSnapshot` read per rank; client keeps map after rank
- **Slice 4 (M4/M5):** `RecommendationDependencyUnavailableError` → HTTP 503; explicit zero-ready-store notice
- **Slice 5 (H5–H7):** ingest `failedCount` + structured row logs; non-zero exit on persist failures / all-chain failure
- **Slice 6 (H8):** removed single-Kroger-store mapping guess
- **Slice 7 (H9/H10):** best offer per ingredient before persist; `MIN_WEEKLY_AD_MATCH_CONFIDENCE` 0.45 → 0.55
- **Slice 8 (H11/H12):** `src/app/error.tsx`; Leaflet mount try/catch + visible fallback

**Honest limits:** Medium/low audit items (M1–M3, M7–M15, L*) not in this batch. Playwright MCP, e2e CI, Semgrep, Postgres MCP not re-run. Slice 3 stayed under 800 LOC — no sub-split needed.

**Evidence:** `npm test` **498/498**; `npm run build` pass; `npm run test:integration` **24/24** (slice 5).

### 2026-06-18 — setup-local gap fixes (dev onboarding)

**Theme:** Close five setup gaps: dual DB provisioning, non-fatal SNAP, post-setup smoke, fixture safety copy, geolocation-first messaging.

**Shipped:**
- **Gap 1** — After dev `ensureTestDatabase()`, provision `yum4less_test` via `DATABASE_URL_TEST` or derived URL; log both databases migrated
- **Gap 2** — Removed fatal duplicate `runNpmScript("ensure:snap-context")`; SNAP remains non-fatal inside `ensureTestDatabase()` only (comment documents why)
- **Gap 3** — Post-setup `npm test` smoke; warn and exit non-zero on failure (unit tests only — not integration/e2e)
- **Gap 4** — No-live-keys branch documents `DATABASE_URL` must match `DATABASE_URL_TEST` before local fixture ingest; points to `.env.example`
- **Gap 5** — Final next-step copy: browser location or ZIP 23111 (not ZIP-only)

**Honest limits:** `setup:local` with live keys still runs full scheduled ingest (slow); does not run `test:integration` or `test:e2e:ci`.

**Evidence:** `npm test` 486/486 after changes.

### 2026-06-18 — Phase 3: ingest order, OSM reliability, copy cleanup, error UX

**Theme:** Scheduled ingest warms catalog before weekly-ad; Overpass retries/timeouts; decouple E2E from bootstrap slugs; map API 400/404 to actionable meal-planner copy.

**Shipped:**
- **#2 Scheduled ingest** — `run-scheduled-weekly-ad-ingest.mjs` order: map-catalog → weekly-ad → SNAP (non-fatal) → provider sync → TheMealDB; `setup-local.mjs` + README aligned; `scheduled-ingest-pipeline` unit test guards spawn order
- **#3 OSM Overpass** — configurable timeout/query timeout/attempts/backoff env vars; per-endpoint retries with backoff; `YUM4LESS_OSM_OVERPASS_URL` honored first; live ZIP 23111 ingest `osm=261` on owner dev
- **#4 Bootstrap/MVP copy** — `Seed catalog pin` / seed-catalog footnote; beta v1 wording in internal-details + recipe-source summary; E2E asserts ranked Kroger/Aldi by `chain` + `recommendationEnabled` (not `kroger-mechanicsville` slug)
- **#5 Error UX** — `recommendation-error-copy.ts` maps recommendation/market-search 400/404/500 to titled panels with hints; `recommendation-error-copy.test.ts` (5 cases)
- **Unit tests (+16 vs prior git HEAD 470; working tree now 486)** — pipeline-hardening additions not all named in initial Phase 3 evidence line:
  - `scheduled-ingest-pipeline.test.ts` (2) — canonical step order vs `run-scheduled-weekly-ad-ingest.mjs` (paired with #2 above)
  - `recommendation-error-copy.test.ts` (5) — paired with #5 above
  - `form-validation.test.ts` (3) — meal planner ZIP/budget validation bounds
  - `escape-regexp.test.ts` (2) — `escape-regexp.ts` helper for map HTML safety
  - `spawn-safe.test.ts` (2) — `assertSafeSqlIdentifier` in `scripts/lib/spawn-safe.mjs`
  - `osm-food-retail-discovery.test.ts` (+2) — `YUM4LESS_OSM_OVERPASS_URL` first-endpoint priority; Overpass timeout retry before empty fallback (behavior in #3; cases added in same slice)

**Honest limits:** Overpass can still timeout on overloaded public mirrors — tune via `.env` knobs; Tier C remains normal outside Kroger/Aldi gate coverage; remote CI not re-run on uncommitted work; Semgrep Guardian not re-run.

**Evidence:** `npm test` 486/486 at working-tree snapshot (482 when Phase 3 slice first recorded); `npm run build`; `npm run test:integration` 24/24; `npm run test:e2e:ci` 4/4; Postgres MCP OSM Aldi rows; Playwright MCP ZIP 23111 trust copy.

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

**Honest limits:** Preview/coverage/sync paths load Kroger `provider_search_terms` from Postgres when available; static full-catalog fallback (display names) when DB unavailable. Only Kroger seeded; other providers fall back to static list when no DB rows.

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

**Live ingest baseline (ZIP 23111):** Publix 655/21 (May 2026); Kroger **119/9 (2026-06-27 Flipp-first)** vs 122/4 (May 2026 old path); Walmart 143/0; Aldi 149/6; Food Lion 137/20.

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
| 2026-08-31 | **Membership DB-wins:** `chain_registry.shopper_ranked` is runtime authority for dinner *attempts* and weekly-ad fail-loud. TypeScript `SHOPPER_RANKED_V1_CHAINS` is the known-adapter seed only. CI: ranked ids ⊆ known dinner adapters. Floors stay in code. Honesty copy lists any store that passed floors (including Lidl/Walmart). | **Active** (narrows 2026-08-27 Registry dual-run) |
| 2026-08-31 | **Roster membership vs dinner floors:** `chain_registry` will own who we *attempt* (ranked eligible / fail-loud). Per-search dinner use still requires code floors (`weeklyAdPromotionGatesPass`: ~3 matched foods, confidence, freshness). Thin Lidl/Walmart/any banner stays a tracked pin; estimates stay off with a reason — not a permanent chain block. Honesty copy should follow that rule, not a leftover four-name list. | **Active** |
| 2026-08-31 | **Banner row, shared adapter:** intended `chain_registry` grain is one row per shopper banner (Harris Teeter ≠ Kroger). Plumbing is `family_id` + the existing `official_pricing_adapter` / `weekly_ad_adapter` / `location_strategy` keys — one Kroger client, many banner rows. Do not copy parser files per banner. Owner Check Wawa/CVS/Target fragments stay research. | **Active** (narrows 2026-08-27 Banner ≠ family: display already banner; roster grain not split yet) |
| 2026-08-31 | **Unattended ingest-worker night:** 3am enqueued 6 jobs; TrueNAS Cron Job drained them 07:01–07:09Z, all succeeded. Hash-skip may leave flyer `observed_at` from the prior drain. Extra ZIP `23220` next. | **Active** (closes “unattended worker night still open”) |
| 2026-08-31 | **Post-v1 shopper store gate:** Settings/wizard list grocery pins in radius (omit convenience/bakery/pharmacy/mini-mart). Not TypeScript `SHOPPER_RANKED_V1_CHAINS`. Dinner **estimates** still require `weeklyAdPromotionGatesPass` / official-API floors. No new adapters. Target OSM department_store kept by name only. | **Active** |
| 2026-08-31 | **TrueNAS backup/restore drill:** dump `yum4less_dev` → restore `yum4less_backup_drill` → counts match 276/324/29 → drop drill DB. One-shot proof. Nightly backup cron still optional. | **Closed** |
| 2026-08-30 | **First live ingest-worker drain (manual):** TrueNAS `yum4less-ingest` ran `npm run ingest:worker` and drained 6 jobs with `[freshness] OK`. Fence 9 mi ∩ ZIP. Not an unattended Cron Job proof. Keep the TrueNAS worker Cron Job Enabled while 3am only enqueues. Extra ZIP `23220` is next (`/owner`). | **Active** |
| 2026-08-29 | **Market admission:** Shopper radius stays around the GPS/ZIP pin — no H3 in the wizard. Check ZIP lists grocery/food-capable pins inside the Census ZCTA; omit convenience/bakeries; clubs food-only; Target/CVS/pharmacies and Giant/unknown = Needs you (no new adapters). Ingest fence = ZCTA ∩ density miles+1 (packed 5 / urban 8 / suburban 15 / rural 25 + 1; village = rural; class from grocery count in 8 mi of ZIP geocode). Auto-widen only; first night with no class = urban 9. Check = inventory (no live Flipp). Activate books the ZIP even if flyer tests time out. MUST = grocery in fence. One flyer per banner globally, then fan-out; content-hash skip. Queue: 3am may enqueue; worker drains. Extra ZIP `23220` after `23111` looks right on live. Not in this Build: H3, Target/pharmacy scrapers, whole-ZIP ingest, split 24h vs ad-week SLA. | **Active** (narrowed 2026-08-30: live worker drain; Watchtower pull done) |
| 2026-08-29 | **Unattended 3am cron two-night proof:** overlay off, `active_markets` ZIP `23111` only. Nights of 2026-08-28 and 2026-08-29 both completed with `[freshness] OK`. Extra ZIPs are now optional expansion, not blocked on cron proof. `027`/`028` applied on live by ingest migrate. Backup drill **closed 2026-08-31**. | **Active** (closes “keep only 23111 until two unattended nights”) |
| 2026-08-27 | **Walmart same floors as other ranked banners:** drop the hard-stop in `weeklyAdPromotionGatesPass`. Settings-selectable. Dinner estimates only when sale/price coverage floors pass. Thin Flipp or scrape misses stay map context with an honest reason — not a permanent block. Fail-loud ingest includes Walmart. `028` updates `chain_registry`. | **Active** (supersedes 2026-06 “Walmart ranked pricing deferred” and same-day “does not rank Walmart” clauses) |
| 2026-08-27 | **Banner ≠ family on shopper surfaces:** a Harris Teeter pin shows as Harris Teeter. Family (`kroger`) is plumbing (official API). `inferShopperBannerDisplayName` prefers longer banner fragments before canonical chain labels. | **Active** |
| 2026-08-27 | **No permanent store block:** pins can show. Estimates off = honest reason (no API, thin Flipp, scrape miss). Same coverage floors for every ranked banner, including Walmart. | **Active** |
| 2026-08-27 | **Registry dual-run:** CI still asserts `chain_registry.shopper_ranked` matches `SHOPPER_RANKED_V1_CHAINS`. Shopper Settings no longer uses that list as the picker allowlist (2026-08-31 grocery-pin cutover). | **Superseded** (2026-08-31 membership DB-wins) |
| 2026-08-27 | **Lidl shopper-ranked v1:** Settings-selectable and dinner estimates when weekly-ad promotion gates pass (same path as Food Lion). `SHOPPER_RANKED_V1_CHAINS` includes `lidl`; `MEAL_PRICING_COMING_LATER_CHAINS` stays empty. Lidl weekly-ad errors are fail-loud. `027` promotes `chain_registry` Lidl flags for Coverage honesty; ranking lists stay TypeScript. Coordinate sanity still required. | **Active** (supersedes 2026-08-27 fail-soft Lidl clause and 2026-06-29 “four-chain” shopper scope; Walmart clause superseded later this day) |
| 2026-08-27 | **Weekly-ad fail-soft for unranked chains:** cron succeeds if Dollar General flyer error or persist fail. Fail-loud set is `SHOPPER_RANKED_V1_CHAINS`. `/owner` Check warns when the first look has none of those ranked banners; Activate is not blocked. Not go/no-go. | **Active** (narrowed same day: Lidl then Walmart moved into shopper-ranked v1) |
| 2026-08-27 | **Live ingest overlay off:** owner activated ZIP `23111` in `/owner` Markets, removed `YUM4LESS_INGEST_ZIPS`, ran scheduled ingest by hand. Paste-back **EXIT 0** (2026-08-27T18:34:14Z); one ZIP from `active_markets`; freshness 671/671. Overlay unset + empty table still fails closed. | **Active** (closes “keep overlay until first activate” for this TrueNAS volume) |
| 2026-08-27 | **Expansion: ZIP `23111` is the owner-chosen ranked ingest anchor.** Activate it in `active_markets` (not a silent code default). Keep it active so the 24h ranked-price freshness check stays fed. Additional ZIPs are outward expansion (map/catalog first; ranked dinners only where Kroger-family / Aldi / Publix / Food Lion exist). Chain go/no-go is later, trial-and-error, **free sources only** (OSM, Flipp, scrape, existing Kroger/Geocodio keys — no paid aggregator). | **Active** |
| 2026-08-27 | **Phase C is owner ZIP activate, not an organic waiting list:** `/owner` Markets (same admin key) Check then Activate into `active_markets`. CLI `markets:activate` is backup. Keep `YUM4LESS_INGEST_ZIPS` until at least one active row exists, then drop the overlay. Fail closed on invalid ZIP, geocode failure, CONUS miss, unauthorized, missing DB/schema. Do not fail on typed `23111`, short store preview, or already-active (idempotent). No ~41k ZIP nightly ingest. Shopper collect / GPS→ZIP queue stays later. | **Active** (supersedes “C = organic paused candidates” as the next nationwide slice) |
| 2026-08-26 | **Nationwide A / B1 / B2 current on TrueNAS:** live `schema_migrations` has `025` and `026` (`applied_at` 2026-08-27 00:04:01Z). Phase **C** shipped 2026-08-27 as owner Markets ZIP activate (not organic paused candidates). Overlay later dropped; `23111` is active. Ranking cutover is membership DB-wins (2026-08-31). | **Active** (narrowed 2026-08-31: membership DB-wins; overlay off) |
| 2026-08-26 | **Ingest markets in Postgres (Phase B1):** cron reads `active_markets` when `YUM4LESS_INGEST_ZIPS` is unset. Env list is a debug overlay only. Empty overlay + empty table fails closed. No silent `23111`. `zip_geocode_cache` filled by ingest; public geocode GET does not write. Activate with `npm run markets:activate -- <ZIP>` after migrate `025`. | **Active** (narrows 2026-08-26 no silent ZIP; TrueNAS `025` applied) |
| 2026-08-26 | **Phase B2 coverage ledger shipped:** `chain_registry` + `store_coverage` view + `/owner` Coverage tab. Search by store name, city/state, and usable-in-app (`recipe_ready`). Read-only. Same admin-key gate. Not a shopper surface. Ranking policy cutover is membership DB-wins (2026-08-31). | **Active** (implements 2026-08-26 Coverage tab plan lock; TrueNAS `026` applied; ranking clause superseded 2026-08-31) |
| 2026-08-26 | **`/owner` Coverage tab (Phase B2):** fourth tab after Ingredient review / User feedback / Analytics. Searchable by store name, location, and checked/usable-in-app (`recipe_ready`). Read-only list over `store_coverage` / `stores`. Same admin-key gate. Not a shopper surface. | **Superseded** (shipped same day — see Phase B2 coverage ledger row) |
| 2026-08-26 | **No silent market ZIP:** ingest and probes fail closed without `YUM4LESS_INGEST_ZIPS` (or explicit single-ZIP alias) **or** `active_markets`. Shopper form ZIP starts empty. `23111` remains CI/E2E/fixture geography and a seed-geocode entry for that typed ZIP only. | **Active** (narrowed: B1 shipped; TrueNAS `025` applied) |
| 2026-08-26 | **TrueNAS paste-back:** live volume has `024` (applied 2026-08-24 07:00:02Z). Catalog **438** foods (TheMealDB 265 / seed 97 / weekly-ad-catalog 76); pending reviews **704**; weekly-ad aliases **90**; skips **675**. Ranked in-stock prices **~10.4h** old at paste (07:00–07:06 UTC same day): Kroger API 97/97, Publix 102, Food Lion 62, Kroger ad 35, Aldi 30, Walmart 14. One-night 3am-window evidence; not multi-night cron closed. Do not use local 319/619 as live. Watchtower still does not migrate. | **Active** (narrows 2026-08-25 local≠live; closes “024 not applied” for this volume) |
| 2026-08-25 | **Local `yum4less_dev` ≠ TrueNAS / yum4less.com:** never copy local catalog, pending-review, or freshness counts onto live docs. When homelab truth is required, the agent gives read-only paste-back commands ([`docs/homelab-deploy.md`](docs/homelab-deploy.md) §4.5); the owner runs them on the NAS and pastes output; then docs update. Watchtower does not migrate; `024` is applied on this live volume (2026-08-26 paste-back). | **Active** |
| 2026-08-25 | **Universal weekly-ad junk + persist tighten:** same junk SSOT for all chains; junk before fuzzy match; do not persist junk prices; Flipp grocery flyers first; Walmart uses shared Flipp resolver + live scrape. Matching SSOT remains Postgres catalog, not the 97-id seed list. Walmart ranked still deferred. | **Active** (narrows 2026-08-25 junk-skip and 2026-08-22 catalog expansion) |
| 2026-08-25 | **Skip more weekly-ad junk before `/owner`:** `isWeeklyAdJunkProduct` is the skip SSOT (no duplicate SQL lists). Live ingest and `npm run owner:reject-pending-junk-reviews` reject pending rows that match. Do not skip garden/grill/paper-bare food titles. Peaches/steaks remaining in review are expected until auto-create widens. Do not claim more dinners. | **Active** (narrows 2026-08-23 junk-heuristic follow-up for non-food; auto-create still later) |
| 2026-08-25 | **Shopping style and dietary advance on tap:** How do you shop? and Dietary focus have no Continue. Either choice (or any dietary option) saves the value and goes to the next screen. Radius, ZIP, pin, stores, and budget still use Continue. | **Active** (narrows 2026-08-20 wizard “arrow/continue on all screens” for those two choice screens) |
| 2026-08-24 | **Live shopper UI is the onboarding wizard:** `yum4less.com` should show splash → GPS/ZIP wizard and the 6-tab shell. The Settings-first ZIP hero is rollback-only (`backup/settings-ui-plus-catalog` @ `38bad3a`). Catalog expansion stays on that backup and on master. | **Active** |
| 2026-08-24 | **Owner `/owner` can create catalog food ids:** Yes accepts a kebab-case id (2–56, letters/numbers/hyphens; auto-slugified) plus shopper-facing name and category. Existing ids are reused (name/category ignored); new ids insert `weekly-ad-catalog` then a weekly-ad nickname. Brands/sizes/pack counts do not belong in the id. Public shopper APIs stay read-only. | **Active** (narrows 2026-08-22 Yes/No to include create) |
| 2026-08-23 | **First live catalog-expansion ingest (local ZIP 23111):** classify path wrote skips, auto-created foods, weekly-ad aliases, and `/owner` pending reviews. Auto-create quality and junk-heuristic gaps are follow-ups; do not claim more dinners. TrueNAS `024` later applied 2026-08-24 (paste-back 2026-08-26). | **Active** (evidence for 2026-08-22 lock; does not change shopper flow) |
| 2026-08-22 | **Ingest catalog expansion:** grow `ingredients` from weekly-ad ingest (nicknames + skip list + owner Yes/No). Matching SSOT is Postgres; the 97-id list is seed/fallback and fixture-only. Shopper flow stays sale foods → pantry **1–4 leftovers** → Dinner recommendations. No 50/50 pantry split. TheMealDB stays first recipe library. Public shopper APIs stay read-only; owner writes use `YUM4LESS_FEEDBACK_ADMIN_KEY`. Do not claim more dinners without ingest evidence. | **Active** (supersedes backlog “Ingredient catalog expansion (pending near-miss analysis)”) |
| 2026-08-21 | **Settings tab FAQ/Terms + return from legal pages:** After setup, Settings shows FAQ and Terms (Feedback keeps them). `/faq` does not link to Terms. Wipe-setup control is **Reset Preferences**. Client Back from `/faq` or `/terms` restores last tab and chrome theme and skips splash; full reload still splash → budget. Prefs write only after hydration so remount does not overwrite stores/theme. | **Active** (narrows 2026-08-20 “not last-tab restore” to reload-only) |
| 2026-08-21 | **FAQ and Terms pages:** `/faq` lists question-titled articles; `/faq/[slug]` is one article; `/terms` is a short beta disclaimer (estimates, no accounts, no price guarantee, location on-device except ZIP for store search). Circle `?` is a link to an article, not a popover. No extra bottom-nav tab. | **Active** (reverses 2026-08-20 audit Q28 “no FAQ route”) |
| 2026-08-21 | **Open dinner cards are action-first:** immediately visible = estimated total, cook time, confidence/freshness/difficulty, Save, nested Store/Shopping/Recipe. Hidden chrome remains behind `MEAL_CARD_SHOW_EXTENDED_CHROME`. | **Active** |
| 2026-08-20 | **Shopper dinners are TheMealDB with a full recipe page:** ranking and pantry “shown next” counts exclude short internal-library writeups. Pantry coverage uses the same budget/plan/max-ingredient gates as rank so the sticky count matches the next screen. | **Active** |
| 2026-08-20 | **Dinner recommendations price heads-up is opt-in help:** a lone `?` next to the title; map/discovery can still show the full banner. Recipe steps may link to TheMealDB meal pages when an attribution URL exists. Internal 3-step recipes stay as written. | **Superseded** 2026-08-21: `?` opens FAQ; banner is one line plus FAQ link |
| 2026-08-20 | **Store coverage ratios are opt-in help, not body copy:** “Which stores should we use?” shows a `?` next to the heading. The modal states how many dinner ingredients Yum4Less tracks and how many of those have estimated prices at selected stores. Always-visible `Sale-price coverage this week…` banners on that screen are removed. Honesty still exists; it is no longer a wide-open footer. | **Superseded** 2026-08-21: `?` opens FAQ; a short coverage one-liner may stay |
| 2026-08-20 | **Saved meals (this browser):** Save from a dinner card writes `yum4less.saved-meals.v1`. No user profiles. Cross-device sync would need accounts later. Factory reset clears saved meals. Totals are snapshots with estimate copy. | **Active** |
| 2026-08-20 | **Onboarding wizard (setup UI):** GPS allow → radius (no GPS pin map). ZIP → typed ZIP → Leaflet pin → arrow commits (no Yes/Pick-again dialog). GPS deny/unavailable → ZIP input. `/api/market-search` runs when leaving the radius screen. Feedback is a 6th bottom-nav tab and always works, including during setup. Returning with setup complete: splash → budget then dietary (not last-tab restore). Incomplete setup: splash → resume last wizard step. Cleared cache / factory reset: first-run again. No progress dots. Theme: moon/sun light↔dark in chrome; persisted `system` resolves once to binary. After `setupComplete`, Settings reuses the same wizard screens; factory reset stays on Settings. Home/Deals/Cook/Saved content restyle (Section H) and Q34/Q35 are not in this slice. | **Active** |
| 2026-08-04 | **ZIP search-center pin + Settings CTA order:** Settings GPS button (left) = “For Better Results, Use My GPS Location”; ZIP Find (right) = “Find stores based on my ZIP” opens a map picker (ZIP geocode focus → click pin → confirm). Radius is measured from the chosen pin. Pin cached in `yum4less.zip-search-centers.v1` (separate from settings prefs / `stripExactCoordinates`). ZIP change clears that ZIP’s pin. Radius change re-searches from cached pin or re-opens picker. | **Superseded** for shopper setup UI by the 2026-08-20 wizard (pin is a full screen; arrow commits; no confirm dialog). Cache key and radius-from-pin still **Active**. |
| 2026-08-04 | **Cloudflare Tunnel WAN live:** `yum4less.com` via TrueNAS `cloudflared` Custom App (tunnel `truenas-homelab`); origin `http://192.168.1.246:3000`. App requires `TRUST_PROXY_HEADERS=1` + `YUM4LESS_TRUSTED_PROXY_VERIFIED=1`. Published app images bake `NEXT_PUBLIC_YUM4LESS_ANALYTICS=1` at build time. Docs: [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §12. | **Closed** (tunnel healthy; cron/backup drill still open) |
| 2026-08-04 | **Shopper feedback UI:** no public recent-feedback feed; no analytics transparency panel (ops detail stays in docs/env). Admin list remains `GET /api/feedback` + admin key. | **Active** |
| 2026-07-26 | **WAN exposure path:** public/internet access for the TrueNAS shopper app uses **Cloudflare Tunnel** (not a traditional reverse proxy + TLS on the NAS). | **Superseded** (implemented 2026-08-04 — see Closed row above) |
| 2026-07-26 | **Homelab ingest + Watchtower TrueNAS enablement:** ingest service in the same `yum4less` Custom App as `db`/`app`; Watchtower as sibling Custom App; app+ingest on `:homelab` with enable labels; db unlabeled. Manual one-shot dry-run proved ranked freshness window; unattended 3am cron and Watchtower first hourly scan remain open. Docs: [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §10–§11. | **Closed** (deploy + dry-run verified; cron/scan/backup/WAN still open) |
| 2026-07-23 | **Homelab ingest container + Watchtower:** dedicated `yum4less-ingest` GHCR image (`Dockerfile.ingest`); in-container cron `0 3 * * *` or host `docker exec`; `YUM4LESS_EXTERNAL_POSTGRES` TCP path; Watchtower label-scoped hourly updates on app+ingest only (db never labeled); `:homelab` float tag for auto-update, SHA for rollback. Docs: [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §8/§10–§11. | **Active** (merged + GHCR @ `54e7b60` / [30104150018](https://github.com/sfh1980/Yum4Less/actions/runs/30104150018); TrueNAS enablement closed 2026-07-26 — unattended cron still open) |
| 2026-07-22 | **TrueNAS Apps Custom App:** dedicated-hardware path is Custom App YAML (not host `next start`). Pin SHA image (`f38ce73` working); never pin `:latest` for rollback. Datasets under `appPool/yum4less`. App LAN `3000:3000`; db unpublished on host. Pre-deploy: `postgres-data` **999:999**/700; `db/init` **`chmod -R a+rX`**. App healthcheck = Node `fetch`, not wget. Docs: [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §9. | **Closed** (stack healthy; ingest/Watchtower enabled 2026-07-26; Cloudflare Tunnel WAN still open) |
| 2026-07-20 | **Compose app + db:** local / CI-adjacent path is `docker compose up` (multi-stage Dockerfile, Next standalone). Host `npm run dev` / `next start` remain for hot-reload / debug only. TrueNAS Apps Custom App is the dedicated-hardware translation (see 2026-07-22). | **Active** |
| 2026-07-20 | **Shopper price confidence wording:** map existing `SaleConfidenceLevel` → high/medium/low shopper copy. High=`advertised-recent` → “Lowest price we found: $X”; Medium=`advertised-aging` → “Estimated lowest price: $X”; Low=`advertised-stale` / `regular-price` / `no-sale-data` / **`directional-provider-match`** → “Price estimate — worth verifying in store” (no bare $). `directional-provider-match` is weak match (`matchConfidence` &lt; 0.7), not merely aging data. | **Active** |
| 2026-07-17 | **External API Integration Standard** (replaces retired “two API routes forever”): Supporting App Router handlers beyond `/api/market-search` + `/api/recommendations` are allowed when they serve a real product need (today: pantry-coverage, shopping-route, geocode/zip, analytics/events, feedback, debug/pipeline). Adding **any** new external dependency requires: (1) document the gap vs current sources; (2) confirm ToS/legal (rate limits, caching, no-scrape); (3) cache appropriately; (4) fail gracefully with Tier C-style honest degradation — never a hard break on quota/outage; (5) no secrets client-side; (6) mock in tests — CI must not depend on a live third party; (7) monitoring/heartbeat for the dependency’s health (same philosophy as ranked-price freshness). Cache-first ranked reads on the two core shopper routes remain the product default. See also [`docs/provider-integration-pattern.md`](docs/provider-integration-pattern.md). | **Active** |
| 2026-07-17 | ~~**Two API routes forever**~~ (literal or implied hard cap on HTTP handlers) | **Superseded** (2026-07-17 External API Integration Standard) |
| 2026-07-17 | **Exact-coordinate privacy:** do not persist browser `latitude`/`longitude` in Settings `localStorage`; re-request geolocation each visit. ZIP (when known) remains the long-term stored location key. Settings may complete on session coordinates alone when geolocation is granted. | **Active** |
| 2026-07-16 | **Wave 2 Part 2 — Phase 0 identity product locks (Q1–Q3):** **Q1=1B** Publix locator is Settings-selectable catalog (map merge/suppress must align; map was the drift). **Q2=2A** ephemeral search-time provider/OSM pins stay **permanently excluded** from identity linking and coordinate reconciliation (no provisional shopper tier). **Q3=3B** three-layer store existence is intentional: DB `stores` = durable truth; map merge = nearby-now display; Settings = filtered selectable view — document, do not “converge” into one list. Implementation for Q1 is a separate small slice (not started). Policy text also in [`docs/store-identity-source-onboarding.md`](docs/store-identity-source-onboarding.md). | **Active** |
| 2026-07-15 | **Ranked-price freshness heartbeat (Pass 1):** scheduled ingest fails closed when **zero** in-stock ranked `price_observations` fall inside the shared **24h** cache window. Alert = non-zero exit + `[freshness]` log lines; optional `YUM4LESS_FRESHNESS_WEBHOOK_URL` via native fetch — no third-party monitoring SaaS. Per-source zeroes alone do not fail. | **Active** |
| 2026-07-09 | **Chain coverage honesty (#13):** Kroger official API vs weekly-ad depth asymmetry is architectural — addressed with shopper-facing honesty (trust banner depth, Settings multi-store live ratios, results skew heads-up), not by equalizing coverage via search-term tuning. Phase 2a post-ingest: Kroger **96/97**, Publix **34/97**, Food Lion **17/97**, Aldi **17/97**. | **Closed** |
| 2026-07-09 | **Aldi weekly-ad ceiling (#16) re-confirmed:** ~17/97 on dinner-tracked list is expected for weekly-ad inventory; UI explains limit. Further non-Kroger matching tuning deprioritized (same class as Walmart). Food Lion not at hard ceiling but risky without guard discipline. | **Closed** |
| 2026-07-09 | **Dollar Tree / Dollar General (#18 queued):** separate new-chain onboarding investigation — locator, chain inference, ingest feasibility, catalog fit — not part of coverage-honesty slice. | **Queued** |
| 2026-07-08 | **Catalog collocated merge radii (Decision A):** same-chain catalog↔catalog collapse uses chain-configurable radius — default `CATALOG_COLLOCATED_MERGE_MILES=0.05`; Kroger exception `KROGER_COLLOCATED_MERGE_MILES=0.15` (legacy API variance). Unvalidated for other chains — do not widen shared 0.05 from the Kroger exception. Module: `catalog-store-colocated-identity.ts`. | **Active** |
| 2026-07-08 | **Fixture OSM vs live Overpass identity:** rehearsal map rows persist only as `fixture-osm-*` + `yum4less-map-fixture`; live Overpass keeps `osm-*` + `openstreetmap-overpass`. Pricing/`touchStoreVerification` must not rewrite location-provenance `source_name`. Ranked Aldi nearest-OSM ignores synthetic 90000x ids. Owner/dev DBs purge residual synthetic/fixture OSM via `018`. | **Active** |
| 2026-07-03 | **Food Lion coordinate writes require storefront verification, not Nominatim alone.** `food-lion-mechanicsville` was corrected after Google satellite confirmed the old pin sat on Bell Creek Middle School and the new pin sat on the storefront; `osm-node-3103220732` and `osm-node-6527816794` stayed unchanged because SNAP + satellite showed the current stored pins already land on the storefront while Nominatim landed on road geometry | **Active** |
| 2026-07-03 | **Coordinate sanity audits are promotion-review gates, not live shopper runtime gates, until store rows persist address-backed audit evidence.** Food Lion + Lidl require the audit path; Kroger/Aldi/Publix stay grandfathered to avoid silent rollout regressions; Walmart/BJ's remain context-only | **Active** |
| 2026-06-28 | **Publix weekly-ad matching closed:** compound-title guard batch (butterbread, honey-in-deli, yogurt bars, garlic dip, focaccia, lime beer, onion cheese, shrimp ravioli, bacon sandwich, cream-cheese pie, vanilla cupcakes); live **619 → 71 matched / 32 unique** (from 86/35 pre-guard); **no** threshold or wrong-target near-miss promotions | **Closed** |
| 2026-06-28 | **Food Lion Flipp matching closed:** `"flour tortilla"` alias + margarine `butter` guards; live **133 → 15 matched / 13 unique** (swap: +flour-tortillas, −false butter); **no** threshold or wrong-target near-miss promotions. May **20 synced** typicality still unconfirmed — broader staple coverage than Aldi/Kroger same week but not unlimited upside | **Closed** |
| 2026-06-28 | **Aldi Flipp matching closed (at-ceiling):** chain-agnostic false-positive guards for `honey` (graham/hot-honey context), `cheddar-cheese` (brats/smoked sausage), `vanilla-extract` (bars/ice cream); live re-measure **148 → 18 matched / 11 unique** (from 23/14 pre-guard); **no** threshold change; **no** near-miss promotions. Aldi funnel ~12% match on dinner-tracked list is SKU-mix + off-list noise limited — compound titles with ingredient tokens are a known cross-chain guard class (check Food Lion/Publix when approved) | **Closed** |
| 2026-06-28 | **Kroger Flipp matching at-ceiling:** chain-agnostic `"greek yogurt"` → `plain-yogurt` alias shipped (+2 matched on same 119-offer Kroger feed); **no** global threshold change and **no** wrong-target near-miss promotions (Campari/canned, Ore-Ida/baby-potatoes). Kroger Flipp funnel ~9–11% match on dinner-tracked list is inventory/SKU-mix limited, not a resolver bug — further gains need different weekly ad inventory or second source, not more Kroger-only matching tweaks. **Aldi guard slice (same day):** 13 matched count **unchanged** — no honey/cheddar/vanilla false positives in that capture | **Active** |
| 2026-06-27 | **Provider integration pattern:** document three data-type categories (store location / item pricing / sale discovery) and per-source capability rules in [`docs/provider-integration-pattern.md`](docs/provider-integration-pattern.md); new chains run the checklist before wiring fallbacks — do not build a speculative plugin/adapter layer until a second chain proves the shape | **Active** |
| 2026-06-26 | **Trust depth via banner expansion:** recover deleted modal paragraphs inside expandable `PricingTrustHeadsUpBanner`; no new modal, Settings “About these estimates”, or route | **Superseded** 2026-08-21 by FAQ articles |
| 2026-06-26 | **M128/M151 rule accuracy:** security rule describes manual owner-pause only today; robots.txt + auto-pause + automated kill switches remain homelab-slice work — not implied as shipped | **Active** |
| 2026-06-26 | **Trust explainer modal removed:** no “How to read these results” dialog or results-panel trigger; trust via inline banners, cards, help hints, hero copy | **Active** (superseded for depth by banner expansion row above) |
| 2026-06-26 | **D7 color port (shipped):** Theme C + D from `.private/tokens.css`; **light default first visit**; flat bg; system font; trust/urgency/price/tag tokens on existing UI — not mockup layout | **Active** |
| 2026-06-25 | ~~**D7 color port (locked, pending)**~~ | **Superseded** (2026-06-26 ship) |
| ~~2026-06-25~~ | **Settings store dropdown:** list Kroger + Aldi for selection regardless of promotion gates; prefer non-OSM catalog rows | **Superseded** (2026-06-29: four-chain Settings selectable set — see row below) |
| 2026-06-25 | **SSR hydration:** `activeTab` + form prefs use stable SSR initial state; resolve from localStorage after mount | **Active** |
| 2026-06-25 | **5-tab shell + D2–D6:** Home/Deals/Cook/Saved/Settings tabs; interim theme; ingredient gate; map overlay; session pantry | **Active** |
| 2026-06-25 | **Redesign plan authority:** locked UX/backend targets live in [Redesign — locked plan](#redesign--locked-plan-2026-06-25) + [Implementation slices](#redesign--implementation-slices-ordered); `.private/` is archive only (not decision authority) | **Active** |
| 2026-06-25 | **Settings-first gate:** if no saved Settings preference data yet, or after **factory reset**, route to Settings before welcome/ingredients/rank; do not re-gate on normal return visits | **Superseded** (2026-08-20/24 wizard is first-run setup; Reset Preferences restarts splash → GPS/ZIP) |
| 2026-06-25 | **Welcome flow:** budget + dietary on welcome (not Settings); after valid Settings → welcome → straight to ingredients | **Active** |
| 2026-06-25 | **Store selection:** under Shopping style — single store = one dropdown pick; multi store = multiple picks; **unselected stores invisible** in all UI | **Active** |
| 2026-06-25 | **Meal results:** remove `dinnersWanted` completely; no fixed card cap; `maxIngredients` unchanged hidden | **Active** |
| 2026-06-25 | **TheMealDB opt-in:** deleted hidden UI + shopper API path (slice 5); public API `internal-library` only; merged ranking default | **Superseded** (2026-08-20 TheMealDB-only shopper ranking) |
| 2026-06-25 | **Ingredients API:** remove 40-ID POST cap; default all sale items at selected stores; safeguards = 64 KB body + rate limits + per-ID validation | **Active** |
| 2026-06-25 | **Results UI:** stacked accordion cards (one expanded at a time); delete carousel; tap-to-rank; full-screen loading with honest TheMealDB copy | **Active** |
| ~~2026-06-25~~ | ~~**Redesign deferred:** 5-tab shell, Deals, Cook session tab, Saved persistence, cuisine R11, pantry full UI, map-link-only shell move — after slices 1–5~~ | **Superseded** (D1–D6 shipped; Saved persistence + R11 + D7 still open) |
| ~~2026-06-25~~ | ~~UI/UX redesign details in `docs/redesign/DECISIONS_LOG.md`~~ | **Superseded** (consolidated into this file) |
| ~~2026-06-25~~ | ~~Redesign flow/UX rows (gate summary, Settings owns budget/dietary)~~ | **Superseded** (welcome budget/dietary + store dropdown locks above) |
| 2026-06-29 | **Publix + Food Lion shopper-ranked:** removed from `MEAL_PRICING_COMING_LATER_CHAINS`; added to `SETTINGS_SELECTABLE_CHAINS` + `MAP_RANKED_CHAIN_KEYS` — same weekly-ad promotion → `recommendationEnabled` path as Aldi when gates pass | **Active** (supersedes 2026-06-15 M5 Kroger+Aldi-only shopper scope) |
| 2026-06-15 | **M5 / Slice 4B:** Publix + Food Lion weekly-ad ingest/fixture gates remain for CI rehearsal; **shopper-facing ranked meal totals = Kroger family + Aldi only** (`MEAL_PRICING_COMING_LATER_CHAINS`) | **Superseded** (2026-06-29: Publix + Food Lion promoted to shopper-ranked v1) |
| 2026-06-11 | **Map search:** Merge provider discovery + ephemeral OSM (24h cache, sparse-pin threshold) into map pins on `/api/market-search`; **no Postgres writes** on public read path | **Active** |
| ~~2026-06-11~~ | ~~Step 2 defaults `dinnersWanted=3`, `maxIngredients=20` server-side~~ | **Superseded** (2026-06-25: remove `dinnersWanted`; `maxIngredients` default unchanged) |
| 2026-06-10 | **Phase 2A:** Owner daily path = live `ingest:weekly-ads:scheduled`; fixture ingest CI/rehearsal only | **Active** |
| 2026-06-10 | **Phase 2B:** Live map-catalog ingest overwrites bootstrap seed coordinates for ranked chains when official discovery succeeds; seed SQL bootstrap-only | **Active** |
| 2026-06-10 | **Slice 3:** TheMealDB cards require visible attribution (source name + meal link); trust labels remain estimated/directional | **Active** |
| ~~2026-06-10~~ | ~~TheMealDB on opt-in search is cache-first (Postgres); bounded refresh when imports stale/empty (24h TTL, 5 meals/run on search)~~ | **Superseded** (2026-06-25: merged rank; no shopper opt-in) |
| ~~2026-06-10~~ | ~~TheMealDB requires explicit shopper opt-in + API flag for shopper-facing rank~~ | **Superseded** (2026-06-25: merged rank; checkbox deleted slice 5) |
| ~~2026-06-10~~ | ~~**Slice 2:** “Rank full dinner options” kept as Advanced alternate path (not removed)~~ | **Superseded** (2026-06-11: removed from UI; API `standard` for tests only) |
| 2026-06-10 | **Slice 4B:** Publix + Food Lion weekly-ad promotion gates enabled when coverage passes; Walmart ranked pricing remains deferred | **Superseded** (2026-06-15: fixture/CI rehearsal only; not production-ranked shopper path) |
| 2026-06-10 | **Slice 4A:** `ingest:map-catalog` upserts OSM map-context rows + chain locators on scheduled ingest only | **Active** |
| 2026-06-10 | Catalog upserts for **map context** allowed on **daily cron only** (not user search) | **Active** |
| 2026-06-10 | OSM Overpass + chain locators as discovery sources; OSM attribution required on map | **Active** |
| 2026-06-09 | Public internet beta target; homelab/DNS/TLS deferred until owner satisfied | **Active** |
| 2026-06-09 | 24h cache TTL on ranked reads; no live refresh on user search | **Active** |
| 2026-06-09 | Daily scheduled ingest (`ingest:weekly-ads:scheduled`) is the write path | **Active** |
| ~~2026-06-09~~ | ~~Do not auto-upsert detected stores on search until post beta/v1~~ | **Superseded** (2026-06-10: cron map-catalog upserts OK; user-search upserts still off) |
| ~~2026-06-09~~ | ~~Near-term ranked chains: Kroger family, Aldi, Publix, Food Lion (Walmart deferred)~~ | **Superseded** (2026-06-15 M5: shopper-ranked = Kroger + Aldi only; Publix/Food Lion fixture/CI) |
| 2026-06 | Beta v1 = continental US entry + Tier C default | **Active** |
| 2026-06 | v1 ranked chains: Kroger family + Aldi only | **Superseded** (2026-06-29: + Publix + Food Lion shopper-ranked) |
| 2026-06 | Walmart ranked pricing deferred | **Superseded** (2026-08-27 same floors as other ranked banners) |
| 2026-06 | Homelab hosting via Docker Compose (`app` + `db`); TrueNAS/DNS/TLS when migration-ready | **Active** (2026-07-22: TrueNAS Custom App `app`+`db` healthy on hardware @ `f38ce73`; DNS/TLS + ingest cron still open) |
| 2026-06 | v1 = beta; keep estimate/directional/verify-in-store wording | **Active** |
| 2026-06 | No user accounts in v1 | **Active** |
| 2026-05 | Public API DB writes opt-in only; blocked in production | **Active** |
| 2026-05 | Fixture ingest = CI/rehearsal only; owner path = daily live scheduled ingest | **Active** (supersedes fixture-first demo wording) |
| 2026-05 | Internal recipe library only for rankings | **Superseded** (2026-08-20 TheMealDB-only shopper ranking; internal catalog kept for matching) |
| 2026-03 | Official APIs first; careful scraping only with terms review | **Active** |
| 2026-03 | Personalized teaching → `.private/learning-notes.md` only | **Active** |
| ~~2026-03~~ | ~~Hard limit MVP to ~35 mi from ZIP 23111~~ | **Superseded** (2026-06 continental US) |
| ~~2026-05~~ | ~~Near-term priority: Walmart matching for v1~~ | **Superseded** (2026-06 Walmart deferred) |

---

## Appendix

### Map catalog / OSM gap-fill trap (operational)

Bootstrap seed data is thin by design (roughly one pin per chain near a market), which is why search-time OSM gap-fill and `npm run ingest:map-catalog` exist. **Previously:** live Overpass on `/api/market-search` was skipped once **total** Postgres pins within the search radius reached `YUM4LESS_MAP_SPARSE_PIN_THRESHOLD` (default **3**) — so having *some* catalog rows could block discovering *more* nearby branches (e.g. 12 pins overall but only one Kroger). **Now (2026-06-30):** gap-fill runs when any ranked v1 chain has &lt; **2** Postgres pins in radius, or any context-only catalog chain (Walmart, BJ's) or Costco/Sam's name match has **0** pins — see `needsSearchTimeOsmGapFill()` in `map-osm-ranked-chain-policy.ts`. Steady-state fix: run `npm run ingest:map-catalog` (live keys) or rely on homelab cron when wired — not another bootstrap seed tweak. Expected operational gap until scheduled ingest is live on hardware; not a code bug to patch ad hoc.

**Owner dev DB spot-check (2026-06-30):** ZIP **23111**, coords **37.6085 / -77.3739**, **5 mi** — old total-pin rule would **skip** gap-fill (~12 pins); new rule **would trigger** for **Publix** (1 pin), **Food Lion** (1 pin), and **Costco** (0 pins). Kroger (2), Aldi (2), Walmart (1), BJ's (1), Sam's (1) satisfied.

### Verification snapshot

| Gate | Last verified | Result |
|------|---------------|--------|
| `npm test` (membership DB-wins + flyer-hash skip) | 2026-08-31 | **1220/1220** pass (214 files) |
| `npm run test:integration` (membership DB ⊆ adapters + flyer skip) | 2026-08-31 | **54/54** pass (17 files) |
| `npm run build` (membership DB-wins; e2e:ci webServer) | 2026-08-31 | **Pass** (Next.js 15.5.21) |
| Playwright e2e (membership + fixture prices on `yum4less_test`) | 2026-08-31 | **32 passed** / 2 skipped. First `test:e2e:ci` after membership failed: 0 `recommendationEnabled` (hash skip after integration wipe). Chromium missing on a later wrapper run; retry `npx playwright test` after `npx playwright install chromium`. |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-31 | Six banners `shopper_ranked=true`: kroger, aldi, publix, food-lion, lidl, walmart. |
| TrueNAS unattended ingest-worker night | 2026-08-31 | Owner paste: enqueue **07:00:01Z**; drain **07:01–07:09Z**; 6/6 `succeeded` for `2026-08-31`. Freshness **324/324**. |
| TrueNAS backup/restore drill (`yum4less_backup_drill`) | 2026-08-31 | Owner paste: source **276/324/29** = restored **276/324/29**. Drill DB dropped. Logrotate dry-run: already rotated. |
| TrueNAS `ingest:worker` first drain (manual, ZIP `23111`) | 2026-08-30 | Owner paste: drained **6** jobs **19:50:53Z–19:58:11Z**. Fence **9 mi ∩ ZIP**. `[freshness] OK` **361/361**. Hash skip on unchanged flyers. Not an unattended Cron Job night. |
| `npm test` (Settings grocery picker + Target OSM name keep) | 2026-08-31 | **1213/1213** pass (213 files) |
| `npm run test:integration` (`029` density columns + ingest_jobs + flyer hashes) | 2026-08-29 | **54/54** pass (17 files). Applied `029` on `yum4less_test`. |
| `npm run build` (Settings grocery picker) | 2026-08-31 | **Pass** (Next.js 15.5.21) |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-29 | `029_market_admission_density.sql` `applied_at` **2026-08-29T20:20:57Z**. `active_markets.density_class` + `ingest_miles` present. |
| `npm run test:e2e:ci` (Settings grocery picker) | 2026-08-31 | **32 passed** / 2 skipped |
| Semgrep MCP (market admission files) | 2026-08-29 | Scanned unrelated temp copies — **not** a passed scan of these files |
| TrueNAS `029` + ingest worker | 2026-08-31 | Unattended Cron Job night closed. |
| TrueNAS unattended 3am cron (two nights, overlay off) | 2026-08-29 | Owner paste: completed **2026-08-28T07:07:42Z** and **2026-08-29T07:07:38Z**. Mid-day `[freshness] OK` **680/681**, `hours_ago` **8.4–8.5**. `027`/`028` applied **2026-08-28 07:00Z**. ZIP **23111** only. |
| `npm test` (Walmart same floors + banner display + 028) | 2026-08-27 | **1198/1198** pass (210 files) |
| `npm run test:integration` (`028` Walmart registry flags + dual-run vs TS) | 2026-08-27 | **54/54** pass (17 files). Applied `028` on `yum4less_test`. |
| `npm run test:e2e:ci` (Settings ranked-chain list includes Walmart) | 2026-08-27 | **32 passed** / **2 skipped**. User `ms-playwright` cache. |
| `npm run build` (Walmart shopper-ranked; e2e:ci webServer) | 2026-08-27 | **Pass** (Next.js 15.5.21) |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-27 | `028` applied. Walmart `shopper_ranked=true`, `settings_selectable=true`, `promotion_blocked=false`, `rollout_stage=ranked`. Lidl still ranked from `027`. |
| Semgrep MCP (Walmart unlock files) | 2026-08-27 | Scanned unrelated temp copies — **not** a passed scan of these files |
| `npm test` (Lidl shopper-ranked v1) | 2026-08-27 | **1194/1194** pass (210 files) |
| `npm run test:integration` (`027` Lidl registry flags + ledger probe) | 2026-08-27 | **54/54** pass (17 files). First run 53/54 (`027` missing `migrationEffectPresent` probe); re-run green after probe. |
| `npm run test:e2e:ci` (Settings ranked-chain list includes Lidl) | 2026-08-27 | **32 passed** / **2 skipped**. First attempt failed (Playwright executable missing from Cursor sandbox cache). Retry with user `ms-playwright` cache. |
| `npm run build` (Lidl shopper-ranked; e2e:ci webServer) | 2026-08-27 | **Pass** (Next.js 15.5.21) |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-27 | `027` applied. Lidl `shopper_ranked=true`, `settings_selectable=true`, `rollout_stage=ranked`. |
| Semgrep MCP (Lidl unlock files) | 2026-08-27 | Scanned unrelated temp copies — **not** a passed scan of these files |
| `npm test` (weekly-ad fail-soft + owner Check warning) | 2026-08-27 | **1192/1192** pass (210 files) |
| TrueNAS scheduled ingest after overlay drop (`23111` from `active_markets`) | 2026-08-27 | Owner paste: **EXIT 0** at 18:34:14Z. Freshness **671/671**. OSM Overpass 504 non-fatal. Kroger API 97 refreshed. |
| `npm test` (Phase C /owner Markets) | 2026-08-27 | **1183/1183** pass (210 files) |
| `npm run build` (owner markets routes) | 2026-08-27 | **Pass** (Next.js 15.5.21; `/api/owner/markets`, `/preview`, `/activate`, `/owner`) |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-27 | `active_markets` **0** rows; **0** ZIP `23111` seeds |
| Semgrep MCP (owner markets files) | 2026-08-27 | Scanned unrelated temp copies — **not** a passed scan of C files |
| `npm run test:e2e:ci` (Phase C) | 2026-08-27 | **Not run** — `/owner` is not a shopper e2e surface |
| TrueNAS migrate `025` + `026` (ingest container `db:migrate`) | 2026-08-26 | Owner paste-back: applied **025** then **026** at **2026-08-27 00:04:01Z**. `schema_migrations` two rows. 18 `chain_registry` banners seeded. `active_markets` still empty until Markets activate or `markets:activate`. |
| `npm test` (Phase B2 coverage ledger) | 2026-08-26 | **1165/1165** pass (207 files) |
| `npm run build` (owner store-coverage route) | 2026-08-26 | **Pass** (Next.js 15.5.21; `/api/owner/store-coverage`) |
| `npm run test:integration` (026 chain_registry + store_coverage) | 2026-08-26 | **54/54** pass (17 files). First run 52/54 (2 ledger timeouts under parallel `next build`); isolated re-run green. Applied `026` on `yum4less_test` and `yum4less_dev`. |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-26 | `026` applied **2026-08-26 22:06:34Z**. 18 `chain_registry` banners. `store_coverage` **282** mapped / **0** fresh 24h sales. |
| Semgrep MCP (coverage route/UI) | 2026-08-26 | Scanned unrelated temp copies — **not** a passed scan of B2 files |
| `npm test` (Phase B active_markets) | 2026-08-26 | **1152/1152** pass (205 files) |
| `npm run test:integration` (025 markets + ZIP cache) | 2026-08-26 | **53/53** pass (16 files). Applied `025` on `yum4less_dev` and `yum4less_test`. |
| Postgres MCP (`yum4less_dev` — local Docker, not TrueNAS) | 2026-08-26 | `025` applied **2026-08-26 20:39:09Z**. Tables `active_markets` + `zip_geocode_cache` present. **0** market rows, **0** `23111` seeds, **0** geocode cache rows. |
| TrueNAS owner paste-back (`yum4less-postgres` / `yum4less_dev`) | 2026-08-26 | `024` applied **2026-08-24 07:00:02Z**; ingredients **438** (themealdb 265 / internal 97 / weekly-ad-catalog 76); pending **704**; weekly-ad aliases **90**; skips **675**. Freshness **~10.4h**: kroger-official-api 97/97, publix 102, food-lion 62, kroger-weekly-ad 35, aldi 30, walmart 14. Newest 07:00–07:06 UTC. App/ingest `:homelab` Up ~24h healthy. Ledger 000–013, 015–024 (no 014 in repo). **`025`/`026` applied later same day — see snapshot top row.** |
| `npm test` (no silent 23111 default) | 2026-08-26 | **1143/1143** pass (203 files) |
| Live `probe:walmart-live-scrape` (Flipp + scrape, no persist, Postgres catalog) | 2026-08-25 | Flipp **144**; browser scrape **0**; after junk: match **6** grocery / junk **113** / review **25**. ZIP **23111** |
| `npm run test:integration` (pending junk heal vs dinner leftover) | 2026-08-25 | **51/51** pass |
| Postgres MCP (`yum4less_dev` pending heal) | 2026-08-25 | pending **743 → 619**; skips **112 → 236**; **124** rejected. Peaches/steaks/garden salad still pending |
| `npm run owner:reject-pending-junk-reviews` | 2026-08-25 | scanned=743 rejected=124 remaining=619 on `localhost:5433/yum4less_dev` |
| Semgrep MCP (junk-heal files) | 2026-08-25 | **Did not scan requested files** (unrelated temp copies) — not a passed scan of this slice |
| `npm test` (owner console tabs) | 2026-08-25 | **1126/1126** pass (201 files) — superseded by junk-heal suite above |
| `npm test` (shopping-style + dietary tap-to-continue) | 2026-08-25 | **1126/1126** pass (201 files) |
| `npm run test:e2e:ci` (no silent 23111; wizard types ZIP) | 2026-08-26 | **32 passed** / **2 skipped** (build + fixture ingest with explicit `YUM4LESS_INGEST_ZIPS=23111` test geography) |
| Playwright vs `localhost:3000` | 2026-08-25 | Shopping style: no Continue; Several stores → store picker. Dietary: no Continue; Vegetarian → Ingredients. Project Playwright MCP chrome-for-testing missing; used user Playwright browser |
| `npx tsc --noEmit` (onboarding wizard on master) | 2026-08-24 | **Pass** |
| `npm test` (onboarding wizard on master) | 2026-08-24 | **1124/1124** pass (199 files) — superseded by 2026-08-25 suite above |
| `npm run build` (FAQ/Terms + wizard routes) | 2026-08-24 | **Pass** (Next.js 15.5.21) |
| `npm run test:integration` | 2026-08-24 | **50/50** pass |
| `npm run test:e2e:ci` (wizard on isolated :3100) | 2026-08-24 | **32 passed** / **2 skipped** — superseded by 2026-08-25 suite above |
| Semgrep MCP (wizard slice) | 2026-08-24 | **No findings** on `ingredient-id.ts` + `owner-console.tsx` (only files the scanner processed); not a full-repo pass |
| `npm test` (owner create canonical food id, earlier this day) | 2026-08-24 | **1123/1123** pass (199 files) — superseded by wizard suite above |
| Semgrep MCP (owner review route, repository, slug helper) | 2026-08-24 | **No findings**. `owner-console.tsx` first scan failed Unicode decode; not claimed clean |
| Postgres MCP (first live catalog-expansion ingest, `yum4less_dev`) | 2026-08-23 | `ingredients` **319**; **17** `weekly-ad-catalog`; **22** weekly-ad aliases; **112** skips; **743** pending reviews; freshness **772/772** in 24h. Eligible dinner count **not** measured |
| `npm test` (ingest catalog expansion, this session) | 2026-08-22 | **1117/1117** pass (198 files) |
| `npm run test:integration` (024 skip/review tables + owner yes/no persist) | 2026-08-22 | **50/50** pass |
| `npm run build` (owner ingredient-reviews route) | 2026-08-22 | **Pass** (Next.js 15.5.21) |
| Postgres MCP (`ingredient_match_skips` / `ingredient_match_reviews` on `yum4less_dev`) | 2026-08-22 | Both tables present after `npm run db:migrate` |
| `npm run test:e2e:ci` | 2026-08-22 | **Not run** — shopper pantry/rank wiring unchanged |
| Semgrep MCP (owner review route) | 2026-08-22 | **Timed out** — do not treat as a passed scan |
| `npm test` (Settings FAQ/Terms + return restore, this session) | 2026-08-21 | **1105/1105** pass (196 files) |
| Playwright vs wizard `http://localhost:3000` (this session) | 2026-08-21 | **24 passed** / 8 failed / 2 skipped. New `faq-terms` **4/4**. Failures: empty rank / store-id on `yum4less_dev`. Isolated `test:e2e:ci` on :3100 not a clean gate this session |
| `npm test` (FAQ/Terms + slim cards, this session) | 2026-08-21 | **1099/1099** pass (195 files) |
| `npm run test:e2e:ci` (FAQ/Terms + slim cards, this session) | 2026-08-21 | **30 passed** / 0 failed / 2 skipped. Build inside the gate passed (`/faq`, `/faq/[slug]`, `/terms`). |
| `npm run test:e2e:ci` (onboarding-wizard mockup harness) | 2026-08-20 | **28 passed** / 0 failed / 1 skipped (H12). Isolated mockup spec **1/1** with `PLAYWRIGHT_SKIP_WEBSERVER=1`. No product `src/` edits |
| Homelab ingest + Watchtower (GHCR) | 2026-08-10 | **Green** — [31426780947](https://github.com/sfh1980/Yum4Less/actions/runs/31426780947) @ `800c450`; verify / integration / e2e / semgrep / **publish-image** / **publish-ingest-image** success. Owner `/owner` pagination. Watchtower pull on TrueNAS still owner-confirm |
| GHCR `publish-image` (CI) | 2026-08-10 | **Green** — [31426780947](https://github.com/sfh1980/Yum4Less/actions/runs/31426780947) @ `800c450` (`:homelab` + SHA + `:latest`). Prior: [31070957928](https://github.com/sfh1980/Yum4Less/actions/runs/31070957928) @ `f337317` |
| Compose `app`+`db` containerize | 2026-07-20 | **Local proof** — build OK; db healthy→app start; `GET /` 200; market-search `dataSource=database`; unit **1052/1052**; integration **48/48**; Semgrep clean on Dockerfile/compose; remote CI later green on containerize commit |
| Aldi `023` heal (`yum4less_dev`) | 2026-07-16 | **OK** — probes true; backup `backups/yum4less_dev_2026-07-17T00-54-12-961Z.sql`; stores/PO/migrations unchanged (281/308/23) |
| Wave 1c docs-only (portal rule) | 2026-07-16 | Docs only — `yum4less-frontend-workflow.mdc` + `web-frontend-standards.md` + Continuity; **no** product code; unit/e2e gates N/A for this slice |
| `npm test` (Wave 1b full) | 2026-07-16 | **1030/1030** pass (183 files; +3 `assertRecommendationsHaveMeals` proof-of-catch) |
| `npm run typecheck` (Wave 1b) | 2026-07-16 | **0 errors** |
| `npm run build` (Wave 1b) | 2026-07-16 | **Pass** |
| Isolated overlay mobile `--repeat-each=5 --retries=0` | 2026-07-16 | **5/5** pass (`meal card primary store pill`) |
| `npm run test:e2e:ci` (Wave 1b local) | 2026-07-16 | **26 passed** / 0 failed / 1 skipped (H12) |
| **Remote CI** (Wave 1b `734a5bc`) | 2026-07-16 | **Green** — [29545388893](https://github.com/sfh1980/Yum4Less/actions/runs/29545388893) (verify / integration / semgrep / e2e **26 passed** / 1 skipped; no flaky) |
| `npm test` (Wave 1a full) | 2026-07-16 | **1027/1027** pass (183 files; ZIP cache + assert-recommendations proof-of-catch) |
| `npm run typecheck` (Wave 1a) | 2026-07-16 | **0 errors** |
| `npm run build` (Wave 1a) | 2026-07-16 | **Pass** (Next.js 15.5.19) |
| `npm run test:e2e:ci` (Wave 1a) | 2026-07-16 | **26 passed** / 0 failed / 1 skipped (H12); stale-store + mvp-flow green after ZIP cache + reload waiter race fix |
| `npm test` (Wave 0 full) | 2026-07-16 | **1021/1021** pass (182 files; includes IngredientsMarketUnavailable) |
| `npm run build` (Wave 0) | 2026-07-16 | **Pass** (Next.js 15.5.19) |
| `npm run typecheck` (Wave 0) | 2026-07-16 | **0 errors** (re-run after build) |
| `npm test` (Wave 0 scoped) | 2026-07-16 | **9/9** — `ingredients-market-unavailable.test.tsx` (4) + `deals-panel.test.tsx` (5) |
| **Remote CI** (022/023 probe `96824e0`) | 2026-07-16 | **Green** — [29503706147](https://github.com/sfh1980/Yum4Less/actions/runs/29503706147) |
| `npm test` (local) | 2026-07-16 | **1017/1017** pass (022/023 structural probe + post-apply assert matrix) |
| `npm run test:integration` (local) | 2026-07-16 | **48/48** pass (+2 proof-of-catch: broken→throw, clean→seeded) |
| `npm run typecheck` (local) | 2026-07-16 | **0 errors** |
| `npm run build` (local) | 2026-07-16 | **Pass** |
| **Remote CI** (Pass 7 `0eed3bf`) | 2026-07-16 | **Green** — [29501996180](https://github.com/sfh1980/Yum4Less/actions/runs/29501996180) |
| GitHub MCP smoke (local) | 2026-07-16 | **OK** — wrapper starts server v1.0.4 via `gh auth token` |
| **Remote CI** (Pass 6 `bac4135`) | 2026-07-15 | **Green** — [29464106035](https://github.com/sfh1980/Yum4Less/actions/runs/29464106035) |
| `npm test` (local) | 2026-07-15 | **1011/1011** pass (Pass 6 +4 backup helper tests) |
| `npm run test:integration` (local) | 2026-07-15 | Not required for Pass 6 (no schema/merge change) |
| `npm run test:e2e:ci` (local) | 2026-07-15 | Not required for Pass 6 (no UI/flow change) |
| `npm run typecheck` (local) | 2026-07-15 | **0 errors** (Pass 6) |
| `npm run build` (local) | 2026-07-15 | **Pass** (Pass 6) |
| `npm run db:backup-restore-drill` (local) | 2026-07-15 | **OK** — 281 stores / 308 PO / 23 migrations round-trip |
| **Remote CI** (Pass 3 `3f43d40`) | 2026-07-15 | **Green** — [29445257153](https://github.com/sfh1980/Yum4Less/actions/runs/29445257153) |
| **Remote CI** (Pass 2 `485be3c`) | 2026-07-15 | **Green** — [29427921631](https://github.com/sfh1980/Yum4Less/actions/runs/29427921631) |
| **Remote CI** (Pass 1 `8f76e8b`) | 2026-07-15 | **Green** — [29426088895](https://github.com/sfh1980/Yum4Less/actions/runs/29426088895) |
| **Remote CI** (Option A Slice 5c `dd4131d`) | 2026-07-11 | **Green** — [29171092681](https://github.com/sfh1980/Yum4Less/actions/runs/29171092681) |
| `npm test` (local) | 2026-07-11 | **978/978** pass (Slice 5c ingest upsert-alias; +4 unit policy cases) |
| `npm run test:integration` (local) | 2026-07-11 | **46/46** pass (+9 Slice 5c alias write cases on real Postgres) |
| `npm run build` (local) | 2026-07-11 | **Pass** (5c) |
| `npm run typecheck` (local) | 2026-07-11 | **0 errors** (5c) |
| `npm run test:e2e:ci` (local) | 2026-07-11 | **25 passed** / 0 flaky / 1 skipped (H12) — baseline; no UI wiring in 5c |
| `npm test` (local) | 2026-07-11 | **974/974** pass (Slice 5b payload-fed Map scope; no client known-pair) |
| `npm run build` (local) | 2026-07-11 | **Pass** (5b payload-fed fix) |
| `npm run typecheck` (local) | 2026-07-11 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-11 | **25 passed**, 0 flaky, 1 skipped (H12); no new skips |
| **Remote CI** (Option A Slice 5b payload-fed `69a4be0`) | 2026-07-11 | **Green** — [29156347884](https://github.com/sfh1980/Yum4Less/actions/runs/29156347884) |
| `npm test` (local) | 2026-07-11 | **973/973** pass (Option A Slice 5b Map pin contract + stale-alias gap) |
| `npm run test:integration` (local) | 2026-07-11 | **37/37** pass (no new DB surface in 5b) |
| `npm run build` (local) | 2026-07-11 | **Pass** |
| `npm run typecheck` (local) | 2026-07-11 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-11 | **24 passed**, 1 flaky (Cook-tab — known), 1 skipped (H12); no new skips |
| **Remote CI** (Option A Slice 5b `9a68cd7`) | 2026-07-11 | **Green** — [29155832474](https://github.com/sfh1980/Yum4Less/actions/runs/29155832474) |
| `npm test` (local) | 2026-07-11 | **966/966** pass (Option A Slice 5a coverage expand + merge + OSM suppress regressions) |
| `npm run test:integration` (local) | 2026-07-11 | **37/37** pass (includes Postgres `createPostgresStoreIdentityLookup` + 022/023 live read) |
| `npm run build` (local) | 2026-07-11 | **Pass** |
| `npm run typecheck` (local) | 2026-07-11 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-11 | **24 passed**, 1 flaky (Cook-tab `navigation-theme` — known), 1 skipped (H12); no new skips |
| **Remote CI** (Option A Slice 5a `6d02a9a`) | 2026-07-11 | **Green** — [29155138961](https://github.com/sfh1980/Yum4Less/actions/runs/29155138961) |
| `npm test` (local) | 2026-07-10 | **954/954** pass (Option A Slice 4 Aldi/OSM T1–T3 + known-pair Kroger-only guard) |
| `npm run test:integration` (local) | 2026-07-10 | **36/36** pass (includes T4 `023` Aldi/OSM seed idempotency + no-store-row) |
| `npm run build` (local) | 2026-07-10 | **Pass** |
| `npm run typecheck` (local) | 2026-07-10 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-10 | Full suite: **24 passed**, 1 flaky (local Cook-tab once — see backlog), 1 skipped (H12). Remote CI flaky on `bfe5f3a` = overlay mobile (pre-existing). Isolated Cook-tab `--repeat-each=5 --retries=0`: **5/5** |
| **Remote CI** (Option A Slice 4 `bfe5f3a`) | 2026-07-10 | **Green** — [29136665905](https://github.com/sfh1980/Yum4Less/actions/runs/29136665905); e2e 1 flaky = `single-store-map-overlay` mobile (pre-existing Slices 1–4) |
| `npm test` (local) | 2026-07-10 | **949/949** pass (Option A Slice 3 Settings canonicalize T1–T3 + structural 0.85) |
| `npm run test:integration` (local) | 2026-07-10 | **33/33** pass (includes T4 `022` Kroger seed idempotency) |
| `npm run build` (local) | 2026-07-10 | **Pass** |
| `npm run typecheck` (local) | 2026-07-10 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-10 | **25 passed**, 1 skipped (H12 baseline; no new skips) |
| **Remote CI** (Option A Slice 3 `11fadca`) | 2026-07-10 | **Green** — [29135637011](https://github.com/sfh1980/Yum4Less/actions/runs/29135637011) (feature `892ae97` + 022 no-store-insert fix) |
| `npm test` (local) | 2026-07-10 | **943/943** pass (Option A Slice 2 rank/pantry expand; T1–T4 + membership) |
| `npm run test:integration` (local) | 2026-07-10 | **32/32** pass (no new Postgres identity lookup this slice) |
| `npm run build` (local) | 2026-07-10 | **Pass** |
| `npm run typecheck` (local) | 2026-07-10 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-10 | **25 passed**, 1 skipped (H12 baseline; no new skips) |
| **Remote CI** (Option A Slice 2 `938bb90`) | 2026-07-10 | **Green** — [29134198168](https://github.com/sfh1980/Yum4Less/actions/runs/29134198168) |
| `npm test` (local) | 2026-07-10 | **938/938** pass (Option A Slice 1 identity infra) |
| `npm run test:integration` (local) | 2026-07-10 | **32/32** pass (includes `store-identity.integration.test.ts` constraints) |
| `npm run build` (local) | 2026-07-10 | **Pass** |
| `npm run typecheck` (local) | 2026-07-10 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-10 | **25 passed**, 1 skipped (H12 baseline; no new skips) |
| **Remote CI** (Option A Slice 1 `71ac279`) | 2026-07-10 | **Green** — [29132909311](https://github.com/sfh1980/Yum4Less/actions/runs/29132909311) |
| `npm test` (local) | 2026-07-10 | **925/925** pass (geolocation denial ZIP fallback P1-3) |
| `npm run test:integration` (local) | 2026-07-10 | **31/31** pass |
| `npm run build` (local) | 2026-07-10 | **Pass** |
| `npm run typecheck` (local) | 2026-07-10 | **0 errors** |
| `npm run test:e2e:ci` (local) | 2026-07-10 | **25 passed**, 1 skipped (H12 baseline; no new skips) |
| **Remote CI** (geolocation denial P1-3 `295daee`) | 2026-07-10 | **Green** — [29108969234](https://github.com/sfh1980/Yum4Less/actions/runs/29108969234) |
| `npm test` (local) | 2026-07-09 | **922/922** pass (chain coverage honesty + ingest slices) |
| `npm run test:integration` (local) | 2026-07-09 | **31/31** pass |
| `npm run build` (local) | 2026-07-09 | **Pass** |
| `npm run test:e2e:ci` (local) | 2026-07-09 | **25 passed**, 1 skipped |
| Phase 2a chain coverage (`yum4less_dev`, post-ingest) | 2026-07-09 | Kroger **96/97**, Publix **34/97**, Food Lion **17/97**, Aldi **17/97**, Walmart **10/97**; **50/97** Kroger-only — `scripts/.investigate-internal-catalog-chain-neutrality.ts` |
| Coverage ingest slices 2–5 on `origin/master` | 2026-07-09 | **Shipped** — `b9c4a46` |
| **Remote CI** (chain coverage honesty `5781348`) | 2026-07-09 | **Green** — [29064540982](https://github.com/sfh1980/Yum4Less/actions/runs/29064540982): verify **922/922** + integration **31/31** + e2e **25+1 skip** |
| **Remote CI** (ingest slices `b9c4a46`) | 2026-07-09 | **Green** — [29063845905](https://github.com/sfh1980/Yum4Less/actions/runs/29063845905) |
| `npm test` (local) | 2026-07-09 | **911/911** pass (store-ID integrity #14–15) |
| `npm run test:integration` (local) | 2026-07-09 | **29/29** pass |
| `npm run build` (local) | 2026-07-09 | **Pass** (store-ID integrity #14–15) |
| `npm run test:e2e:ci` (local) | 2026-07-09 | **25 passed**, 1 skipped (`stale-store-selection.spec.ts` added) |
| `navigation-theme.spec.ts` ×5 (local) | 2026-07-09 | **15/15** pass (`--repeat-each=5 --retries=0`) — scoped-store map assertion stable |
| **Remote CI** (store-ID integrity #14–15 `debddf0`) | 2026-07-09 | **Green** — [29060088692](https://github.com/sfh1980/Yum4Less/actions/runs/29060088692): verify + semgrep + integration + e2e all **success** |
| **Remote CI** (four quick-win stack `72f6460`) | 2026-07-09 | **Green** — [29056852462](https://github.com/sfh1980/Yum4Less/actions/runs/29056852462): verify + semgrep + integration + e2e all **success** |
| **Remote CI** (rank-screen removal `08e8801` / `4b511e9`) | 2026-07-09 | **Green** — [run 29048785870](https://github.com/sfh1980/Yum4Less/actions/runs/29048785870): verify + semgrep + integration + e2e all **success** |
| **Remote CI** (Publix ingest fix `c18f99e`) | 2026-07-09 | **Green** — [run 29047864858](https://github.com/sfh1980/Yum4Less/actions/runs/29047864858): verify + semgrep + integration + e2e all **success** |
| `yum4less_dev` after `019` | 2026-07-08 | **no** `aldi-23111`; `aldi-mechanicsville` @ `37.611004,-77.336853` + `osm-node-6531578976`; **0** non-Kroger same-chain catalog pairs &lt;0.05 mi |
| Postgres MCP / `yum4less_dev` fixture purge | 2026-07-08 | After `018`: **0** `osm-node-90000*`, **0** `fixture-osm-*` / `yum4less-map-fixture`; live Aldi `osm-node-6531578976` → `openstreetmap-overpass` |
| market-search spot-check (`37.6085,-77.3739`) | 2026-07-08 | Prior fixture-OSM slice: Aldi selectable pool catalog + live OSM; **fixture_or_synthetic=0** — not re-run after `019` |
| `npm run test:e2e:ci` (local) | 2026-07-08 | **Not run** — Settings/unit + integration cover collocated collapse; no e2e spec change |
| **Remote CI** (Bug [pantry-ID-fix] `648d745`) | 2026-07-09 | **Green** — [run 28987447695](https://github.com/sfh1980/Yum4Less/actions/runs/28987447695) (rerun): verify + semgrep + integration + e2e all **success**; e2e **1 flaky** (`navigation-theme.spec.ts:35`, passed retry). First push attempt on same run id **failed** e2e — see 2026-07-09 changelog. |
| **Remote CI** (Bug 4c `e5b1285`) | 2026-07-08 | **Green** — [run 28954380879](https://github.com/sfh1980/Yum4Less/actions/runs/28954380879): verify + semgrep + integration + e2e all **success** |
| **Remote CI** (`0c73016`) | 2026-07-06 | **Green** — [run 28825310364](https://github.com/sfh1980/Yum4Less/actions/runs/28825310364): verify (lint + **813/813** unit + build) + integration **27/27** + e2e **21+1 skip** — **not re-run** after fixture-OSM / collocated slices |
| `npm run lint` (local) | 2026-07-06 | **Not re-run** this slice; build lint step passed 2026-07-08 |
| `npx tsc --noEmit` / `npm run typecheck` (local) | 2026-07-09 | **0 errors** (was 102 at slice start; CI-gated); B1 pantry-add test bug fixed |
| `npm test` (local) | 2026-07-09 | **922/922** pass (tsc cleanup slice) |
| `npm run test:integration` (local) | 2026-07-09 | **31/31** pass (tsc cleanup slice) |
| `npm run build` (local) | 2026-07-09 | **Pass** (tsc cleanup slice) |
| `npm run test:e2e:ci` (local) | 2026-07-09 | **25 passed** / 1 skipped (tsc cleanup slice) |
| Phase 2a chain coverage (`yum4less_dev`) | 2026-07-09 | Superseded by post-ingest row above |
| `schema_migrations` ledger | 2026-07-09 | **Shipped** — `000_schema_migrations.sql` + `applyPendingMigrations()`; simulated partial/fresh volume evidence via `npm run db:probe:migration-ledger` |
| `npm test` (local) | 2026-07-09 | **916/916** (+5 migration ledger unit tests) |
| `npm test` (CI `d72465b`) | 2026-07-09 | **905/905** — verify job green |
| `npm run test:integration` (local + CI) | 2026-07-09 | **31/31** (+2 migration-ledger integration specs) |
| `npm run test:e2e:ci` (local) | 2026-07-09 | **25 passed** / 1 skipped — after overlay `:15` pin fix |
| Coverage slices 2–5 on `origin/master` | 2026-07-09 | **Shipped** — `b9c4a46` (see changelog) |
| Locator chain inference regression | 2026-07-06 | `chain-rollout-policy.test.ts` + `provider-rollout.test.ts` on `0c73016` (CI unit job) |
| `publix-1626` ranked path (`yum4less_dev`) | 2026-07-06 | **36** fresh obs; API `chain: publix`, `recommendationEnabled: true`, `weekly-ad-preview`; **0 meal cards** — no recipe with 100% ingredient coverage at store (not a chain gate failure) |
| **Remote CI** (`aa884a1`) | 2026-07-06 | **Green** — [run 28820142318](https://github.com/sfh1980/Yum4Less/actions/runs/28820142318): verify (lint + **811/811** unit + build) + integration **27/27** + e2e **21+1 skip** |
| Live ingest DB isolation | 2026-07-01 | `yum4less_test` fixture-only; `yum4less_dev` **263** total obs — **not re-audited** this pass |
| Postgres (`provider_search_terms` kroger) | 2026-06-15 | 101 rows — **not re-checked** |
| Playwright MCP (localhost) | 2026-06-26 | **Not re-run** this pass |
| Owner browser (both themes) | 2026-06-26 | **Pending** |
| Semgrep MCP / hook | 2026-07-06 | CI job skipped (no `SEMGREP_APP_TOKEN`); not run locally |

**Historical note:** the old `coordinate-first.spec.ts` cold-path timeout was fixed on 2026-07-03 by bounding search-time OSM gap-fill and warming the cache in the background. True cold verification on `37.675, -77.280` (zero `openstreetmap-overpass` rows in `yum4less_test` after fixture prep) stayed bounded at **3227ms** response / **3486ms** full flow, and committed regression coverage now lives in `e2e/coordinate-first-cold.spec.ts`.

**Local demo:** `docker compose up --build` (or host `npm run db:up` → ingest → `npm run start`) with ZIP `23111` / coords `37.6085,-77.3739`.

**Optional probes (not merge gates):** `npm run probe:kroger-api`, `npm run probe:publix-live-ingest`, live weekly-ad ingest scripts.

### Live weekly-ad baseline (ZIP 23111)

| Chain | Measured | Live result | Notes |
|-------|----------|-------------|-------|
| Publix | 2026-05 | 655 parsed, 21 synced | Browser + HTML parser |
| Publix | **2026-06-28** | **619 parsed, 71 matched, 32 unique ingredients** | Post-guard browser scrape re-measure; closed; vs May **655/21 synced** |
| Kroger | 2026-05 | 122 parsed, 4 synced | Scrape-first + simple Flipp merchant search |
| Kroger | **2026-06-28** | **119 parsed, 13 matched, 1 newly synced** | Post-`greek yogurt` alias; +2 matched vs 2026-06-27; 9 sync skips = unchanged rows from prior dev DB session |
| Kroger | **2026-06-27** | **119 parsed, 11 matched, 9 synced** | Flipp-first full resolver; fresh-ish dev DB |
| Walmart | 2026-05 | 143 parsed, **0 synced** | Matching gap |
| Aldi | 2026-05 | 149 parsed, 6 synced | Flipp primary path |
| Aldi | **2026-06-28** | **148 parsed, 18 matched, 11 unique ingredients** | Post-guard live Flipp re-measure; closed at-ceiling; vs May 2026 **149/6 synced** (SKU-mix + week variance) |
| Food Lion | 2026-05 | 137 parsed, 20 synced | HTTP often 403 |
| Food Lion | **2026-06-28** | **133 parsed, 15 matched, 13 unique ingredients** | Post-fix live Flipp re-measure; closed; vs May **137/20 synced** (May likely stronger week) |
| Lidl / DG | — | Stub | Not wired |

**Kroger before/after (23111):** 122→4 (May 2026, old path) → **119→9 synced / 11 matched** (2026-06-27 Flipp-first) → **119→13 matched** (2026-06-28, `greek yogurt` alias; sync skip noise on warm dev DB). Still below Food Lion May **20 synced** — SKU mix + week variance, not unresolved Kroger matching bug.

**Trusted local path:** `npm run ingest:weekly-ads:fixture` → Postgres → promotion gates.

**Live Kroger re-measure:** `npx tsx scripts/run-kroger-weekly-ad-live-baseline.ts` · **Flipp funnel diagnostic (Kroger + Food Lion):** `npx tsx scripts/analyze-kroger-flipp-match-funnel.ts` — persists under `captures/weekly-ad-baseline/`.

### Deferred backlog (not v1)

| Item | Why later |
|------|-----------|
| **`yum4less_dev` Kroger identity live repair** | **CLOSED (2026-07-16)** — Manual data heal: deleted self-only identities, re-applied `022` seed SQL; probes true. Pre-heal backup: `backups/yum4less_dev_2026-07-16T14-45-46-486Z.sql`. |
| **Aldi `023` seeded-method mismatch** | **CLOSED (2026-07-16 Wave 2 Part 1)** | Manual heal: deleted `self`/`pointer` graph, re-applied `023` seed SQL; probes true. Pre-heal backup: `backups/yum4less_dev_2026-07-17T00-54-12-961Z.sql`. Expand flags remain OFF. |
| **Home Ingredients silent on market-search error / empty** | **CLOSED (2026-07-16 Wave 0)** — Was blank when `ingredients` + no `scopedMarket` + not loading. Now `IngredientsMarketUnavailable` matches Deals error alert + idle “Complete Settings…” guidance. |
| **Coverage Slice 4 weekly-ad fan-out / Slice 7 best-offer+0.55** | **CLOSED (2026-07-09)** — Triage 2026-07-16 confirmed: fan-out/dedupe = Coverage Slice 4; Slice 7 = best-offer persist + confidence 0.55. Do not reopen as “optional fan-out narrowing.” |
| Homelab deploy + exposure | **Partial:** TrueNAS Custom App + ingest + Watchtower **CLOSED**. Cloudflare Tunnel WAN **CLOSED** (2026-08-04) @ `yum4less.com`. 3am ingest **one-night** evidence 2026-08-26 (all ranked sources ~10.4h, 07:00 UTC). Still open: multi-night cron, Watchtower first hourly scan, backup drill |
| Walmart ranked pricing | Shopper API + Flipp matching work |
| BJ's ranked pricing | Regional; stub ingest — see Resume for v1 production-ranked chains (Publix + Food Lion shipped 2026-06-29) |
| Lidl / DG | Stub ingest |
| Spoonacular / Edamam rankings | License + alignment gates |
| Redis / platform rate limits | Multi-instance production |
| User accounts | Explicitly out of v1 |
| **Live near-miss confidence analysis** | Before changing the 0.55 weekly-ad match threshold or expanding the ingredient catalog, run a targeted live-data diagnostic per chain on offers in the 0.35-0.55 confidence band. This confirms whether filtered-out weekly-ad items are legitimate near-misses before threshold or catalog changes lock in extra noise. |
| **Ingredient catalog expansion (pending near-miss analysis)** | **SUPERSEDED (2026-08-22)** — Catalog now grows from weekly-ad ingest + owner Yes/No, not from a one-shot near-miss list. Rotisserie/salad-kit candidates remain out of scope (junk/assembly meals). Live near-miss analysis still applies before changing the **0.55** persist threshold. |
| **assertMarketDataAvailable() shared helper** | The DB-availability check is still repeated per-route. Extract it into a tiny shared helper alongside the next route addition so empty-vs-unavailable behavior cannot drift again across read APIs. |
| **Store geographic breakdown audit** | Run a read-only Postgres query against `stores` to see whether the current 288 discovered rows are concentrated in Virginia or already spread across multiple states/regions. This should inform how much existing map/discovery head start Yum4Less has before expanding `YUM4LESS_INGEST_ZIPS`. |
| **Bootstrap seed data provenance audit** | Confirm whether bootstrap rows in `yum4less_dev` carry a distinct `source_name` that separates hand-planted/CI bootstrap stores from real discovered stores. If not, add one in the bootstrap SQL so the app and future audits can distinguish seed rows from real discovery coverage. |
| **Scale risk A — Client-trust audit across all public API routes** | From trust pass-through hardening (2026-07-01): only the rank pass-through path was hardened; other routes or client-supplied fields may still influence trust display without server-side recomputation. Systematic audit of all public API responses for client-controllable trust-sensitive fields deferred — should precede any significant traffic increase or public launch. Suggested owner: `@verifier` + `@web-backend-standards` |
| **Scale risk B — Empty-vs-unavailable semantics on remaining API routes** | From DB outage 503 fix (2026-07-01): `/api/market-search` now consistent with `/api/recommendations`; other read routes (e.g. `/api/shopping-route`) may still return HTTP 200 + empty on DB outage, indistinguishable from genuine empty results. Audit and align remaining routes before homelab goes live. Suggested owner: `@web-backend-standards` |
| **General locator-vs-OSM dedupe across all v1 chains (Option A)** | **IN PROGRESS** — Slice 1–6 **CLOSED** (2026-07-11; 5a/5b/5c + onboarding); Slice D open | Alias-graph. **5c:** ingest self-alias + allowlisted Aldi→OSM pointer; flags + `AUTO_CONFIRM` **OFF**. **Safety boundary until Slice D:** no proximity/name matcher at ingest; allowlist is temporary, not permanent per-chain policy. **6:** [`docs/store-identity-source-onboarding.md`](docs/store-identity-source-onboarding.md). **Not yet:** Slice D batch matcher. |
| **e2e `single-store-map-overlay` mobile viewport flake** | **CLOSED (2026-07-16 Wave 1b)** | Historical CI: accordion not found at `:76` after false heading sync (Option A Slices 1–4 / Tier 1 Passes 1–4). **Pass 5 portal did not fix this** (pre-overlay). Post–Pass 5 remote flaky reports shifted to **mvp-flow / Cook-tab rank-wait** (closed in Wave 1a). Wave 1b: shared rank waiter + loud empty-meals assert. |
| **e2e Cook tab / `navigation-theme` local flake** | **CLOSED (2026-07-16 Wave 1a)** | Same family as mvp-flow rank-wait — shared `waitForRecommendationsAfterSuggest` (no status-in-predicate; loud non-200; Promise.all; 60s rank timeout). |
| **e2e mvp-flow rank-wait flake (`keeps inline trust copy`)** | **CLOSED (2026-07-16 Wave 1a)** | See changelog Wave 1a. Isolated + full `test:e2e:ci` evidence in Verification snapshot. |
| **Scale risk C — Modal overlays nested under inert shell** | **CLOSED (2026-07-16 Wave 1c)** | Rule documented in `yum4less-frontend-workflow.mdc` + `@web-frontend-standards` checklist. Pass 5 already portaled `SingleStoreMapOverlay`; sibling overlays remain safe until relocated. Docs-only — no runtime change. |
| **Shopping-plan `storeId` (name-join fragility)** | **DEFERRED follow-up** (explicitly out of Option A Slices 2–3) | Plans still emit `storeName` only; map/route join by name. Track separately from identity expand wiring. |
| **Ranking path: collocated-collapse + stale selectedStoreIds** | **CLOSED** (2026-07-09) | `resolveSelectedStoreIdsForRanking` + Option (c) notices + `effectiveSelectedStoreIds` client re-sync. See [2026-07-09 store-ID integrity changelog](#2026-07-09--store-id-integrity-bundle-1415--closed). **Not** Option A. |
| **Weekly-ad promotion gate freshness policy mismatch (FRESH-1)** | **CLOSED** on `origin/master` (`1304542` + `08f4bfb`/`aa884a1`; CI green [28820142318](https://github.com/sfh1980/Yum4Less/actions/runs/28820142318)). |
| **INTERNAL_CATALOG chain-content bias (Phase 2a)** | **Re-measured 2026-07-09** on `yum4less_dev` (90d, in-stock, official+weekly-ad): Kroger **96/97**, Publix **34/97**, Food Lion **18/97**, Aldi **17/97**, Walmart **10/97**; **50/97** Kroger-only (was 68/97 on 2026-07-08; Publix ingest fix + coverage slices shifted numbers). Architectural call sites chain-agnostic; **content/ingest success still Kroger-heavy**. Rebalance tracked list and/or non-Kroger weekly-ad match rates. Evidence: `scripts/.investigate-internal-catalog-chain-neutrality.ts`. |
| **e2e `assertMarketSearchStoreResults` scoped-store assertion** | **CLOSED** (2026-07-09) — Helper asserts Settings `selectedStoreIds` on map overlay; recommendations gate no longer requires Kroger in scoped body. `navigation-theme.spec.ts` **15/15** with `--repeat-each=5 --retries=0`. |
| **Settings-first gate bypass (P1-1)** | **CLOSED** (2026-07-15 Pass 5 `4a6db23`) — `isAppTabEnabled` + BottomNav disable + `handleTabChange` guard. Triage 2026-07-16 confirmed still CLOSED — no reopen. |
| **Geolocation denial asymmetry (P1-3)** | **CLOSED** (2026-07-10) — **`295daee`**; CI [29108969234](https://github.com/sfh1980/Yum4Less/actions/runs/29108969234). Behavioral: Site B denial → `runMarketSearchWithZipFallback` (unifies with Site A). Also clears stuck `locationValidationMode === "browser"` after denial. `enableHighAccuracy` still deferred. |
| **M156 `save money` trust-copy gap (P2-3)** | **CLOSED** (2026-07-09) — Copy rephrased; pattern added; `help-hint-content.test.ts` guards help popovers. |
| **Map-overlay focus trap (P2-6)** | **CLOSED** (2026-07-09) — All three overlays use `useModalDialog`; unit tests in `modal-overlay-focus-trap.test.tsx`. |
| **`ingest-standards.md` M128 doc drift (P1-4 agent half)** | **CLOSED** (2026-07-09) — Agent file aligned with manual-pause-only shipped reality. |
| **`schema_migrations` ledger (backlog #3)** | **CLOSED** (2026-07-09) — ledger + unified runner; prerequisite for tombstones / Option A |
| **OSRM driving distance in store discovery (map/list/Settings)** | Wire the **existing** OSRM driving-distance capability from `multi-store-shopping-route.ts` (today used only for the multi-store shopping-route planner) into nearby-store discovery distances. **Smaller lift than initially assumed** — routing infrastructure already exists; this extends an existing capability rather than building new infrastructure. Straight-line haversine remains acceptable fallback when OSRM is unavailable. **Re-triage 2026-07-09: recommend accept for beta v1** — distances labeled straight-line. |

#### Ranking path: collocated-collapse and stale selectedStoreIds gap — CLOSED (2026-07-09)

**Was:** Ranking path trusted client `selectedStoreIds` without membership validation or collocated collapse. **Now:** `resolveSelectedStoreIdsForRanking` in rank + pantry services; Option (c) notices; `effectiveSelectedStoreIds` client re-sync. **Out of scope:** Option A universal reconciliation (item 4). See [2026-07-09 store-ID integrity changelog](#2026-07-09--store-id-integrity-bundle-1415--closed).

### Backlog re-triage (2026-07-09)

Read-only re-verification of 17 items from `docs/audits/full-system-run-report.md` + deferred backlog. Evidence: live code grep, Postgres MCP, `npx tsc --noEmit`, `scripts/.investigate-internal-catalog-chain-neutrality.ts`.

| # | Item | Verified status | Scope | Risk (1 mo) | Group |
|---|------|-----------------|-------|-------------|-------|
| 1 | Mobile GPS/HTTPS | **Denial asymmetry CLOSED** (`295daee` / [29108969234](https://github.com/sfh1980/Yum4Less/actions/runs/29108969234)); still no `enableHighAccuracy`; no app HTTPS redirect | Med | Med mobile without TLS | Homelab + UX (`enableHighAccuracy` / HTTPS remain) |
| 2 | Settings gate bypass | Home/Deals/Saved reachable before `setupComplete`; only Cook disabled (recipes) | Small | Low–Med UX | Bundle with #1 |
| 3 | No migration ledger | **CLOSED** (2026-07-09) — `schema_migrations` + `applyPendingMigrations()` | Med | — | Was prerequisite for tombstones / #4 |
| 4 | Universal store reconciliation | **Slice 1–6 CLOSED** (5a/5b/5c + onboarding doc); Slice D open | Med | Low–Med | Option A slices |
| 5 | `tsc` bucket | **CLOSED** (2026-07-09) — **0 errors** + `npm run typecheck` in CI; B1 pantry-add test fix found via cleanup | — | — | Hygiene |
| 6 | Ingest auto-pause doc drift | `ingest-standards.md` still claims robots.txt/auto-pause/kill switches | Small | Low ops / Med agent trust | Quick win |
| 7 | OSRM in discovery | OSRM shopping-route only; discovery haversine + "straight-line" labels | Large if pursued | **Low** | **Accept** |
| 8 | M156 `save money` | In trust/help copy; missing from `FORBIDDEN_TRUST_CLAIM_PATTERNS` | Small | Low–Med trust | Quick win |
| 9 | Map-overlay focus trap | Overlays lack `useModalDialog` pattern | Small | Low–Med a11y | Quick win |
| 10 | Geocodio quota/key | `geocodio:global` 20/min; key in server URL only | Med homelab | Low dev / Med scale | Homelab |
| 11 | H12 e2e skip | Intentional Leaflet skip; H12 UI shipped | Small | **Low** | **Accept** |
| 12 | `navigation-theme` flake | 3rd recurrence; helper asserts full API vs scoped stores | Small | Med CI noise | **Quick win P1** |
| 13 | Chain-content bias | **CLOSED** (2026-07-09) — UI honesty + documented API vs weekly-ad asymmetry; Phase 2a **96/34/17/17/10** per chain | — | — | Track B |
| 14 | Ranking collocated collapse | **CLOSED** (2026-07-09) — `resolveSelectedStoreIdsForRanking` | Small–Med | — | Was bundle #14–15 |
| 15 | Stale `selectedStoreIds` | **CLOSED** (2026-07-09) — Option (c) + client re-sync | Small–Med | — | Was bundle #14–15 |
| 16 | Aldi/FL weekly-ad ceiling | **CLOSED** (2026-07-09) — Aldi at-ceiling **re-confirmed**; UI explains weekly-ad depth; FL deprioritized for tuning | Accept Aldi | Low Aldi | Track B |
| 17 | Walmart matching | Deprioritized; 10/97 obs; promotion hard-blocked | Large if v1 | **None v1** | **Won't-fix v1** |
| 18 | Dollar Tree / Dollar General onboarding | **Queued** — locator source, chain ID pattern, ingest feasibility, 97-item catalog fit vs private-label SKUs | Design | TBD | New-chain scope |

**Recommended order:** #12 → #6, #8, #9 (quick wins) → #14+#15 → #3 → #4 (planning) → #1+#2.

### New findings for triage (2026-07-06)

| Finding | Severity | Notes |
|---------|----------|-------|
| `publix-1626` zero price rows in `yum4less_dev` | **CLOSED** | Re-ingest 2026-07-06: **36** rows; promotion gates pass on probe path |
| Publix locator display name breaks chain inference on API | **CLOSED** | `0c73016` — `inferStoreChainFromCatalog`; API now promotes `publix-1626` (`weekly-ad-preview`) |
| Local lint/build fail while CI green | **P2** | Windows host: ESLint circular JSON + `theme-tokens.css` type error on `npm run build`; Linux CI passes on `5f2a7bb` — investigate env drift before trusting local gates |
| e2e overlay flake persists | **CLOSED** (2026-07-09) — `:15` pinned by store id + heading from selected label (was index-1 / hard-coded Kroger). `:41` mobile path unchanged. **Pattern:** index-based Settings selection brittleness — instance **#2** (`navigation-theme` was #1). |
| Unit test count local vs CI mismatch | **P3** | Local **811** vs CI **809** — uncommitted FRESH-1 tests/fixtures (+2) |
| “Six PR merges” expectation vs git | **info** | Only **3** PR merges on 2026-07-06 (#5, #6, #8); plus **3** direct master commits (Publix); PR #4/#7 closed without merge |

### Transcript index

Full chat prose lives in agent transcripts; use these links for deep context.

| When | Topic | Transcript |
|------|-------|------------|
| 2026-08-31 | Settings grocery picker (no new adapters) | [Market admission Build](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-31 | TrueNAS unattended ingest-worker night | [Market admission Build](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-30 | TrueNAS first ingest-worker drain | [Market admission Build](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-29 | Market admission (density fence, Check inventory, queue) | [Market admission Build](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-29 | TrueNAS two-night 3am cron paste-back | [TrueNAS two-night cron](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-27 | Phase C /owner Markets ZIP activate | [Owner ZIP markets](82f5fdae-afba-449a-9ce9-affa69f0c88a) |
| 2026-08-26 | Nationwide markets, DB coverage, no silent 23111 | [Aggregator and catalog alignment](135fee61-b70d-417b-b7c2-7639f6a73a8a) |
| 2026-08-25 | Aggregators, shelf quotes, local ≠ homelab | [Aggregator and catalog alignment](135fee61-b70d-417b-b7c2-7639f6a73a8a) |
| 2026-08-25 | Shrink Ingredient review by skipping junk | [Faster ingredient review](34544998-cd03-498a-9d19-e276bc180d85) |
| 2026-08-24 | Onboarding wizard shipped on `master` (Watchtower) | [Onboarding wizard UI](093dd1be-4914-4da5-b0e7-3e9dc2668289) |
| 2026-08-20 | Onboarding wizard setup UI on `feat/onboarding-wizard` | [Onboarding wizard UI](093dd1be-4914-4da5-b0e7-3e9dc2668289) |
| 2026-03 | MVP planning, stack, competitors, Cursor setup | [Yum4Less MVP planning](0e5bcef8-54ed-4c87-b5a6-1b4423cc1d08) |
| 2026-04/05 | Autonomous MVP slices, providers, map | [Autonomous MVP build slices](40f83ef1-d284-41d5-8f4f-7f7ade1daa2f) |
| 2026-05 | MCP, weekly-ad gates, integration CI | [MCP setup MVP completion](8145bf83-1d8c-4b90-9431-990a72d04817) |
| 2026-05 | UI cleanup, security, live ingest | [UI cleanup MVP gaps](18194906-4795-46c3-b3bd-7ba257b5db93) |
| 2026-06 | Phase 0 beta v1 + continuity journal automation | [Phase 0 and continuity hooks](ec7ad734-c4f5-4cda-b131-6c28a0f98262) |
| 2026-06-25 | Redesign D1–D6, Settings store fix, SSR hydration, doc sync | [Redesign shell and doc sync](4755f11f-00a0-4417-830c-829823799f7d) |
| 2026-06-11 | Deploy-readiness audit + Kroger/Aldi doc/trust/security/E2E slices | [Deploy-readiness audit slices](ad4a04bf-68c6-4e8e-b1f8-bded8f60e22a) |

### How to update this file

Follow **`.cursor/rules/yum4less-continuity-journal.mdc`** and **`.cursor/rules/yum4less-governance-and-doc-sync.mdc`**. Compare against the repo before claiming “shipped”; this file is a journal, not immutable truth.
