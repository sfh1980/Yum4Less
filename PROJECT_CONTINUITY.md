# Yum4Less Project Continuity

This file captures durable project context from earlier chats so future chats can recover the current direction quickly without relying on session memory or raw transcript history.

## Product Summary

`Yum4Less` is a web-first grocery search and dinner meal-planning application focused on helping users find affordable dinner options based on nearby store pricing, sale items, and shopping preferences.

The core product idea is:
- search nearby stores that sell meaningful grocery ingredients
- consider local sale and pricing data
- let users choose budget, ingredient-count, and dinner-count constraints
- support either `single-store convenience` or `multi-store savings`
- return affordable dinner options with explanations and cooking guidance

## Current MVP Direction

The current MVP is intentionally narrow:
- local-first, starting around ZIP code `23111`
- no-login initially
- dinner-focused first, not all meal types
- browser geolocation plus ZIP search
- user-defined search radius
- support grocery stores, big-box stores, and dollar-store-style retailers when they sell meaningful ingredients
- curated internal recipe library first
- official APIs first for store/pricing data
- careful, terms-aware scraping only where reliability and maintenance burden are acceptable

Important user-facing filters and constraints:
- budget cap
- maximum ingredient count
- number of dinner options
- shopping style: one store vs multiple stores
- dietary focus: vegetarian, vegan, quick, low-cost style filters

## Technical Direction

Current intended stack:
- `Next.js`
- `TypeScript`
- `CSS Modules` or carefully managed custom CSS
- `PostgreSQL`
- direct SQL instead of an ORM-first approach
- `npm`

Maps and location direction:
- `Leaflet` for map UI
- browser geolocation
- ZIP code search
- separate geocoding/search provider behind the scenes

Security and dependency direction:
- keep dependencies lean and deliberate
- prefer built-in or mature tooling over unnecessary packages
- use environment variables for secrets
- keep sensitive logic server-side
- treat external data and location-related data as untrusted/sensitive

## Architecture Principles

The project currently favors:
- a web-first MVP
- cache-first pricing and store data
- refreshing cached data when new search results differ materially
- clear separation between raw provider data, normalized data, and user-facing recommendation data
- recommendation explainability, not opaque scoring
- minimal retention of location and preference data

## Competitive/Product Positioning

Relevant competitor categories discussed:
- sale-driven meal planning apps
- grocery price comparison apps
- meal planning plus grocery list apps
- local deal discovery apps

Named competitors previously reviewed:
- `Saverly`
- `Grocery Dealz`
- `Jow`
- `Cooklist`
- `Mealime`
- `Flipp`

Yum4Less is intended to differentiate by combining:
- geo-based nearby store search
- ZIP and radius-based discovery
- sale-item-driven dinner generation
- budget filtering
- ingredient-count filtering
- one-store vs multi-store tradeoffs
- complete dinner explanations and instructions

## Cursor Project Setup

The repo has a project-specific `.cursor` setup with:
- project rules tuned to Yum4Less, including **`yum4less-agent-orchestration.mdc`** (always on) and scoped workflow rules for frontend, API, and DB/ingest
- **`AGENTS.md`** at repo root — index of project agents, MCP servers, hooks, and verification gates
- project hooks for README check, package-command review, session orchestration context with port preflight, prompt routing (`beforeSubmitPrompt`), after-edit nudges, Semgrep Guardian scans, MCP schema reminders, explore handoff, and diff-aware stop verification (`loop_limit: 1`)
- **`AGENTS.md`** includes MVP shoring-up routing, suggested prompt footer, and per-slice agent/MCP table
- project agents specialized for frontend, backend, database, testing, audit, and verification

Important rule themes:
- keep the MVP local and focused
- preserve security-first dependency discipline
- keep the `README` accurate and investor-ready
- keep MCP adoption lean and phased
- keep personalized educational notes in the private notes file only

## MCP Strategy

**Configured (local project `.cursor/mcp.json`, copied from `.cursor/mcp.json.example`):**
- **postgres** — read-only `@modelcontextprotocol/server-postgres` against local `yum4less_dev` on port `5433`; used by rules/agents for schema, seed, and latest `price_observations` verification after `npm run db:up`
- **github** — official `ghcr.io/github/github-mcp-server` via Docker (requires `GITHUB_PERSONAL_ACCESS_TOKEN`); used by rules/agents for PR/workflow inspection; `gh` CLI remains preferred for mutating GitHub actions
- **playwright** — `@playwright/mcp` headless Chromium for UI/map/ZIP verification on localhost after `npm run dev`
- **semgrep** — Semgrep Guardian MCP and hook wrapper for security/dependency/secrets review; requires local Semgrep CLI and `semgrep login` for Guardian products

Rules and subagents reference these MCPs for agent-driven verification; Vitest/integration tests remain the automated merge gate.

The current MCP direction remains conservative beyond this set:
- do not add MCPs just because they exist
- use Cursor native tools first where they are already efficient
- keep the active MCP set small (currently 4 project servers when Semgrep CLI is installed)

Later candidates only if needed:
- `Postman MCP`, `Context7`, `Sentry MCP`, hosted browser MCPs

Early MCP types to avoid:
- overlapping filesystem MCPs
- overlapping shell MCPs
- multiple browser MCPs at once
- broad write-capable admin MCPs without strong need and controls

## Current Implementation State

The repo now contains a hybrid, guided-demo-first MVP slice.

What exists:
- manual `Next.js + TypeScript` scaffold
- working app shell
- interactive recommendation flow reframed toward the approved MVP experience
- server-side ZIP lookup through `Geocodio`
- local seeded ZIP fallback when `GEOCODIO_API_KEY` is not configured
- runtime validation for ZIP code and numeric inputs in the mock form
- nearby-store discovery driven by resolved coordinates and a server-side market data-access layer
- normalized mock store, ingredient, recipe, and price-observation data
- local PostgreSQL foundation with schema and seed data matching the normalized market model
- server-side recommendation reads that prefer strongly matched official/online provider price rows, then unexpired weekly-ad observations; expired sale rows remain historical and do not feed current ranked pricing
- a staged location-first UI that finds nearby stores before asking for deeper meal constraints
- a browser-geolocation path alongside ZIP search for establishing the local market
- an explicit provider-rollout layer that marks weekly-ad-preview, limited-coverage, or coming-soon chains before ranked recommendations are built
- a first official-provider adapter foundation for Kroger nearby-store discovery, with fallback back to local store coverage when provider credentials are missing or provider calls fail
- persisted local snapshots for official provider store-discovery searches, plus clearer separation between ZIP lookup provenance and official store-discovery provenance
- readback of recent provider store-discovery snapshots, so provider discovery can now be live or cached without changing recommendation-pricing trust
- a Kroger product/pricing preview foundation for a small tracked ingredient set, with persisted snapshots and cached readback that still stays outside ranked recommendations
- ingredient-match scoring plus coverage-status measurement for Kroger pricing previews, so official product hits can be assessed before any future recommendation use
- a market-level provider preview coverage rollup with explicit trust gates and tracked-ingredient summaries that still do not feed ranked meal pricing
- explicit per-provider promotion-readiness gate checklists for Kroger, Publix, and Walmart, each with provider-aware technical gates and an MVP promotion lock that prevents ranked pricing from switching to provider preview data
- per-provider directional seed-vs-provider preview comparisons on ranked meal cards for overlapping recipe ingredients, without changing ranked totals
- Walmart env scaffold credentials (`WALMART_CLIENT_ID`, `WALMART_CLIENT_SECRET`) with honest not-configured discovery/preview messaging until an approved official API path is wired
- the UI now places the Leaflet map at the top of the main results column instead of the sidebar
- shopping-plan line items now expose sale-confidence labels so advertised deals are not implied to be current without verification
- `npm run ingest:weekly-ads:fixture` runs deterministic HTML fixtures for five live chains (recommended local/demo path)
- `npm run ingest:weekly-ads` runs live HTTP + Playwright browser fallback (Publix now parses hundreds of offers from HTML when pages load; other chains still often 0 offers — see Live weekly-ad baseline below)
- `npm run ingest:weekly-ads:browser` forces headless browser fetch
- weekly-ad promotion gates and dynamic `weekly-ad-preview` rollout (`weekly-ad-coverage.ts`, `weekly-ad-promotion-readiness.ts`, `resolveProviderRolloutForStore`)
- `src/lib/recipe-sources/recipe-source-registry.ts` — external recipe research; only internal library active in rankings
- recipe source selector in meal preferences (external options disabled) + Advanced → Recipe source research panel
- official Kroger API preview matches can sync into PostgreSQL `price_observations` with source/confidence, valid-through, and hour-level freshness metadata so ranked reads prefer eligible online provider rows over weekly-ad rows when available — **public API sync is opt-in only** via `YUM4LESS_ENABLE_API_DB_WRITES=1`; `npm run sync:provider-prices` and scheduled ingest remain the primary write path
- non-Walmart weekly-ad scraping has been strengthened: shared HTTP/Flipp retries, Aldi/Food Lion Flipp merchant + flyer + tracked-ingredient search fallback, and Aldi/Food Lion capture artifacts when enabled; Walmart ranked pricing/promotion remains intentionally skipped for the current phase even though fixture/live ingest code paths still exist
- public API hardening now includes route-level JSON size validation, route-level generic failure handling, shopping-route store/home label bounds, and deeper public sanitizer removal of internal/provider/weekly-ad IDs including nested provider product IDs and weekly-ad readiness store IDs
- first-party analytics scaffolding exists through `/api/analytics/events`, disabled by default, strict per-event allowlisted, and sinkable to memory/stdout/Postgres without storing raw ZIPs, coordinates, IPs, prices, meal titles, store IDs, provider IDs, or user agents; customer complaints, bug reports, wrong-price reports, and general feedback remain a separate planned feedback path
- DB/test preflight starts Postgres automatically when Docker is running but no longer performs local stale-seed `db:reset` without explicit reset intent; CI remains automatic; MVP seed detection counts total `stores` rows (8) so integration runs that update `source_name` during Kroger sync do not falsely mark the DB stale
- Semgrep CI is configured to run `semgrep ci` only when `SEMGREP_APP_TOKEN` is present; local Semgrep hooks remain advisory until the CLI is installed and a scan actually runs
- chain rollout and official provider discovery panels are collapsed under **Project & data details (internal)** modal (temporary link; not primary user UI)
- a local Vitest harness covering geocoding fallback, repository behavior, route validation (including 429 and bounds), recommendation behavior, ranking fixtures, rate limiting, public API write policy, response sanitization, shopping-route caps, weekly-ad parsing/matching, carousel UI, trust copy, and a UI smoke path
- Playwright E2E CI gate via `npm run test:e2e:ci` (`e2e/mvp-flow.spec.ts` — **3/3**); Playwright MCP supplements agent-driven browser checks on localhost
- Postgres MCP read-only verification for schema, seed stores, and latest `price_observations` after ingest; complements integration tests
- GitHub MCP for PR and workflow status inspection during review; `gh` CLI preferred for creating PRs and pushes

Current file roles:
- `src/app/page.tsx` keeps the top-level page simple
- `src/components/recommendation-demo/` contains the split location, preference, and recommendation UI flow (`use-recommendation-demo.ts`, location/results panels, trust modal)
- `src/components/internal-details-modal.tsx` houses dev/admin/investor diagnostics (provider rollout, ingest status, score breakdowns) behind a temporary internal link
- `src/components/recommendation-results-carousel.tsx` renders the swipeable ranked-dinner carousel (scroll-snap, Previous/Next, dots, keyboard)
- `src/components/nearby-stores-map.tsx` renders the client-side Leaflet map for nearby stores
- `src/lib/nearby-stores-map-model.ts` builds trust-aware map markers and bounds from the market summary
- `src/app/api/geocode/zip/route.ts` exposes the server-side ZIP lookup endpoint
- `src/app/api/market-search/route.ts` exposes the explicit nearby-store discovery endpoint
- `src/app/api/recommendations/route.ts` exposes the server-side recommendation endpoint
- `src/lib/geocoding.ts` contains the Geocodio integration and local ZIP fallback behavior
- `src/lib/location-resolution.ts` centralizes ZIP-or-browser location resolution for server routes
- `src/lib/provider-rollout.ts` defines the current trusted chain rollout and gates ranked recommendations
- `src/lib/providers/provider-types.ts`, `src/lib/providers/provider-registry.ts`, `src/lib/providers/kroger-provider.ts`, `src/lib/providers/publix-provider.ts`, and `src/lib/providers/walmart-provider.ts` define the official store-discovery provider boundary
- `src/lib/provider-market-service.ts` runs official provider store discovery alongside the local market-search flow
- `src/lib/provider-store-search-cache.ts` persists official provider store-discovery snapshots when the DB is available
- `src/lib/provider-store-search-cache.ts` also reads back recent provider snapshots so provider discovery can degrade to cached results honestly
- `src/lib/provider-pricing-preview-service.ts` builds trust-aware Kroger pricing previews for tracked ingredients without feeding recommendation pricing
- `src/lib/provider-product-pricing-cache.ts` persists and reads back provider pricing preview snapshots
- `src/lib/providers/provider-price-matching.ts` scores provider product matches against internal ingredients and labels preview coverage
- `src/lib/provider-coverage-rollup.ts` rolls provider preview coverage into market-level trust gates and tracked-ingredient summaries
- `src/lib/provider-promotion-readiness.ts` evaluates explicit per-provider promotion gates before provider preview could ever influence ranked meal pricing
- `src/lib/seed-vs-provider-recipe-comparison.ts` compares seed/DB and each provider preview separately for overlapping recipe ingredients without affecting ranking
- `src/lib/provider-tracked-ingredients.ts` defines the curated tracked-ingredient set used for provider preview coverage measurement
- `src/lib/weekly-ad-ingestion/` — multi-chain weekly-ad boundary including Kroger/Publix dedicated fetchers, shared `weekly-ad-fetch-helpers.ts`, Flipp syndicated feed with retry/flyer/search-term fallback for non-Walmart chains, Publix browser fetch, listed-savings-card HTML parser, capture artifacts under `captures/weekly-ad/`, Playwright devDependency for ingest scripts, Postgres sync, promotion gates, per-chain clients, HTML fixtures
- `src/lib/analytics/` and `src/app/api/analytics/events/route.ts` provide disabled-by-default privacy-safe event tracking for local memory/stdout or deployed Postgres sinks
- `src/lib/recipe-sources/` — external recipe API research registry and types
- `npm run ingest:weekly-ads:scheduled` wraps Postgres startup plus a live weekly-ad pull and provider price sync for local Task Scheduler or cron use
- `src/lib/sale-confidence.ts` labels shopping-plan sale references with explicit hourly freshness, source-quality, and verification wording
- `src/lib/multi-store-shopping-route.ts` and `src/app/api/shopping-route/route.ts` estimate home → stores → home routes for multi-store browser-location trips (max 8 stops, coordinate bounds enforced)
- `src/lib/rate-limit.ts` and `src/lib/api-rate-limit.ts` — in-memory per-IP API throttling and Geocodio upstream throttling (seed fallback when limited); proxy headers trusted only when `TRUST_PROXY_HEADERS=1`
- `src/lib/public-api-db-write-policy.ts` — public API routes stay read-only by default; provider snapshot persistence and Kroger price sync require `YUM4LESS_ENABLE_API_DB_WRITES=1`
- `src/lib/public-api-response-sanitizer.ts` — strips `persistedSnapshotId` and `internalStoreId` from `/api/recommendations` and `/api/market-search` JSON
- `src/lib/price-source-policy.ts` defines ranked source tiers (official/online first, weekly-ad second) and excludes legacy `mock-market-data` or unknown rows from ranked reads
- `src/lib/internal-catalog.ts` holds the curated Postgres-backed ingredient catalog for weekly-ad and provider matching
- `src/lib/price-observation-writes.ts` append-only inserts with change-aware dedupe and `last_verified_at` refreshes for unchanged re-checks (`insertPriceObservationIfChanged`)
- `src/lib/mock-market-data.ts` remains for unit-test fixtures only (not a runtime ranking path)
- `src/lib/recommendation-service.ts` contains the recommendation, shopping-plan, and scoring logic (renamed from `mock-recommendations.ts`)
- `src/lib/market-repository.ts` loads stores, recipes, and ranked-eligible price observations from Postgres using source priority and hourly freshness; returns empty snapshot when DB unavailable
- `src/lib/db.ts` manages the shared Postgres connection pool
- `db/init/001_schema.sql` defines the first PostgreSQL schema
- `db/init/002_seed.sql` seeds the curated Postgres catalog (stores, ingredients, recipes) without sample `price_observations`
- `docker-compose.yml` provides the local Postgres dev container

This slice uses a real ZIP boundary plus a server-side repository boundary on purpose to prove:
- input -> ranking -> result explanation flow
- invalid input is blocked before recommendations are ranked
- ZIP, browser location, and radius inputs can drive a nearby-store discovery layer
- the UI can now pause after store discovery and only then ask for deeper meal filters
- nearby stores can now be shown as recommendation-ready seed preview coverage or as coming soon, instead of implying equal support across chains
- Kroger official nearby-store discovery can now be attempted separately from ranked recommendation pricing, with explicit fallback messaging when it is not configured or fails
- Publix is now registered as the second official-provider adapter with honest not-configured discovery/preview messaging until an approved official API path exists; ranked recommendation pricing for Publix stays coming soon
- Walmart is now registered as the third official-provider adapter with honest not-configured discovery/preview messaging until an approved official API path exists; ranked recommendation pricing for Walmart stays on trusted seed/DB coverage in this MVP
- official provider store-discovery snapshots can now be stored locally with separate provenance from geocoding and pricing
- official provider store discovery can now be returned as either live or cached while keeping pricing trust on the separate DB/seed path
- Kroger provider pricing previews can now be returned as either live or cached for a tracked ingredient subset while keeping meal ranking on the separate trusted seed/DB pricing path
- Kroger provider pricing previews now score candidate products by ingredient-match confidence and expose strong/limited/weak/none coverage labels in the UI
- market-search now also exposes a provider preview coverage rollup with closed/monitoring/not-available trust gates while ranked meal totals stay on the trusted seed/DB pricing path
- market-search now also returns per-provider promotion-readiness gate results, including the always-on MVP promotion lock that prevents provider preview pricing from affecting ranked meal totals
- the location boundary can be swapped to live geocoding without breaking the rest of the workflow; live Geocodio ZIP results outside the MVP service radius are rejected the same way as out-of-area browser coordinates
- normalized market records can be transformed into shopping plans
- the same normalized market records can now be represented in a local PostgreSQL schema and read back through application code
- richer recipe records can be transformed into user-facing recommendation cards
- separation of page, component, and logic layers
- a trustworthy recommendation presentation model before adding live integrations

Approved MVP direction:
- keep the MVP no-login and hard-limited to the initial local area around ZIP `23111`
- determine location from browser geolocation and/or ZIP
- choose a radius and show nearby stores before asking for deeper meal constraints
- prioritize live-chain work in this order: `Kroger`, then `Publix`, then `Walmart`; when deployment is discussed, remind the owner to promote the Kroger API app to production and set `KROGER_API_ENV=production`
- keep `Aldi` and `BJ's` as later targets unless reprioritized
- use official APIs first, reputable third-party sources second, and only then carefully reviewed web collection
- show unsupported chains as coming soon or disabled with explanation
- hide chains from recommendation pricing until sale and price coverage is strong enough
- explain source, freshness, fallback, and estimate quality clearly in the UI
- keep ranked recommendations limited to the explicit rollout layer so nearby-store discovery does not overstate chain support
- keep official provider discovery clearly separate from recommendation-pricing trust until coverage is strong enough to justify promotion
- keep geocoding-provider state and official store-provider state distinct instead of reusing one generic provider-configured concept in successful market summaries
- label cached provider discovery as cached rather than live so stale-but-usable store snapshots do not overstate freshness
- label provider-backed pricing previews as previews, not trusted recommendation inputs, until matching coverage and freshness are strong enough
- keep maps important, but land them after the core store/pricing/recommendation flow stabilizes

## Verification State

Last updated: **2026-05-27** (eleventh epic re-audit — full local §2 checklist).

### Security posture (May 2026)

Audited for SQL injection, IDOR, and BOLA — no classic issues. **Shipped hardening:**

1. Public read APIs **read-only by default**; `YUM4LESS_ENABLE_API_DB_WRITES=1` opt-in for local dev only; **hard-blocked when `NODE_ENV=production`** (`public-api-db-write-policy.ts`).
2. Market JSON sanitized at API boundary (no snapshot IDs or internal store IDs in responses).
3. `/api/shopping-route` enforces max 8 stops and valid coordinate ranges.
4. Live Geocodio ZIP lookup rejected when resolved coordinates fall outside MVP radius.
5. Rate-limit client IP ignores spoofable proxy headers unless `TRUST_PROXY_HEADERS=1`.
6. Route-level validation bounds and **429 + Retry-After** tests on all public API routes.

**Before production:** Redis or platform rate limits for multi-instance; keep ingest/cron as the write path; add auth when user accounts arrive.

### Merge gates shipped (May 2026)

| ID | Area | Status |
|----|------|--------|
| CI-19 / CI-05 | E2E ZIP flow + trust vocabulary | **Done** — `e2e/mvp-flow.spec.ts` **3/3** |
| CI-03 / CI-04 / CI-07 | Geocode + 429 + validation bounds | **Done** — route test files |
| CI-06 | Full DB recommendation integration | **Done** — `recommendation-service.integration.test.ts` |
| CI-02 | Ranking fixture guards | **Done** |
| DB-05 | Seed drift (3 vs 8 stores) | **Done** — `ensure-test-db.mjs` auto-`db:reset` |
| TRUST-04 / FE-03 | “Priced” pill | **Done** — **Weekly ad prices** |
| DOC-01 | First-run setup | **Done** — README + `npm run setup:local` |
| SEC-01 / SEC-02 / API-03 | Production write guard + proxy/rate-limit docs | **Done** (Redis/platform limits deferred) |

### Automated gates (2026-05-27)

- `npm run lint` — passes (map ref ESLint warning only)
- `npm run build` — passes
- `npm test` — **227** tests, **58** files (last verified 2026-06-02)
- `npm run test:integration` — **6** tests, **3** files (Docker Postgres on port `5433`; auto-`db:reset` when seed stale; last verified 2026-06-02)
- `npm run test:e2e:ci` — **3/3** Playwright tests (build + fixture ingest + browser on port `3100`)
- `npm run test:all` — unit + integration
- `npm audit --audit-level=high` — **0 high** (2 moderate postcss via next)
- `.github/workflows/ci.yml` — `verify` + `integration` + `e2e` jobs (**remote green** on first push 2026-05-27 — [run 26529795179](https://github.com/sfh1980/Yum4Less/actions/runs/26529795179))
- **GitHub repo:** https://github.com/sfh1980/Yum4Less (private)

### Optional manual network probes (not CI merge gates)

- `npm run test:kroger-api` — Kroger OAuth, location, catalog (certification)
- `npm run test:publix-api` — Publix website store-locator
- `npm run test:kroger-live-scrape` / `npm run test:publix-live-scrape` — live weekly-ad browser probes
- `npm run test:publix-live-ingest` — live Publix scrape → Postgres sync + promotion gate report

### Local environment

- Docker Desktop available; Yum4Less Postgres on host port **5433** (host `5432` occupied by separate local Postgres)
- **First-run demo (ZIP `23111`):** `npm run setup:local` — or manually `db:up` → copy `.env.example` to `.env.local` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/yum4less_dev` → `ingest:weekly-ads:fixture` → `npm run dev`. Fixture ingest = **rehearsal data in real Postgres tables**, not live retailer feeds.
- Cursor MCP: postgres, github, playwright, and semgrep configured from `.cursor/mcp.json.example`; rules/agents reference them for the relevant verification paths
- GitHub MCP requires `GITHUB_PERSONAL_ACCESS_TOKEN` (user-scoped, not committed)
- Semgrep Guardian requires the local `semgrep` CLI and `semgrep login` for Code/Supply Chain/Secrets scans; project wrappers also check Python user-script installs, and hooks are non-blocking advisory checks that remind rather than pass silently when setup is incomplete

### Live weekly-ad ingest baseline (May 2026)

`npm run ingest:weekly-ads` against ZIP `23111`:

| Chain | Live result | Notes |
|-------|-------------|-------|
| **Publix** | Browser loaded, **655 offers parsed**, **21 synced to Postgres** | Scroll/wait hardening required; promotion gates can pass → `weekly-ad-preview` |
| **Kroger** | **122 offers via Flipp syndicated feed**, **4 synced** | Direct scrape often 0; HTTP2 fallback + store resolution shipped |
| **Walmart** | **143 offers via Flipp**, **0 synced** | Fetch works; ingredient matching gap blocks Postgres sync |
| **Aldi** | **149 offers via Flipp syndicated feed**, **6 synced** | Direct Aldi.us scrape still 0 parseable rows (JS layout); Flipp is live path |
| **Food Lion** | **137 offers via Flipp syndicated feed**, **20 synced** | Direct HTTP still 403/WAF; browser fallback on HTTP error shipped; Flipp is live path |
| Lidl / Dollar General | Research stub | Not wired |

**Trusted local pricing path:** `npm run ingest:weekly-ads:fixture` → Postgres append → promotion gates → `weekly-ad-preview` where thresholds pass.

Browser fallback (`weekly-ad-page-fetcher.ts`, Playwright in ingest scripts) is **shipped** but does not yet overcome blocks or missing chain-specific parsers.

### Application behavior (unchanged from prior verification)

- staged location-first flow: `/api/market-search` and `/api/recommendations`
- rollout: Kroger/Walmart weekly-ad-preview when promotion gates pass, otherwise coming soon or limited coverage; Publix coming soon until gates pass; Aldi/BJ's coming soon
- official provider adapters: Kroger optional; Publix/Walmart honest not-configured; provider preview separate from ranked pricing (ranked totals use ingested cache only)
- ranked meal cards include directional ranked-cache-vs-provider comparisons; totals stay on ingested weekly-ad/official API observations only

Near-term implementation direction:
- **Done locally:** fixture weekly-ad ingest, promotion gates, browser fallback scaffolding, recipe source research registry, MCP/rules/agents, integration CI job, public API security hardening (read-only default, sanitization, route caps, MVP ZIP scope, proxy-aware rate limits)
- **Partially unblocked:** live weekly-ad ingest — Publix and Kroger (Flipp) sync rows; Walmart fetch/parser paths exist but ranked pricing/promotion stays intentionally locked; Aldi/Food Lion sync via Flipp syndicated feed (direct scrape still blocked or empty; rollout gates unchanged)
- **Next:** Walmart ingredient matching; Kroger chain parser hardening; deployment; TheMealDB dev import prototype
- **Defer:** Lidl, Dollar General, Spoonacular/Edamam production, official Kroger API production promotion for live store pricing

### MVP completion status (local)

The local MVP slice is **demo-complete for ZIP `23111`** when using **fixture weekly-ad ingest** + Postgres:

- weekly-ad ingest → PostgreSQL → promotion gates → `weekly-ad-preview` ranked pricing (directional, verify in store)
- internal recipe library only for rankings; external sources documented in `src/lib/recipe-sources/`
- **Live retailer ingest is not production-ready** — see Live weekly-ad baseline above

Post-MVP: Walmart live matching hardening, deployment, scheduled refresh, TheMealDB dev import, Redis/platform rate limits for multi-instance.

## Approved Research Tracks (Not Yet Implemented)

### Weekly-ad and sale ingestion for trusted nearby markets

Goal: include nearby markets in trusted ranked pricing by ingesting current food and recipe-ingredient sales.

Approved order:
1. official retailer APIs and approved partner feeds (Kroger first, then Publix/Walmart when paths exist)
2. terms-aware weekly-ad sources only where usage, attribution, and maintenance burden are acceptable
3. scraping only as a last resort with explicit legal review, robots/terms checks, and stale-data labeling

Every ingested sale must carry freshness, source, and confidence metadata compatible with the new `sale-confidence` model.

### Live data replacement priority

1. **Shipped locally:** terms-aware weekly-ad ingestion for Kroger, Publix, Food Lion, Walmart, and Aldi with Postgres sync, sale-confidence metadata, and weekly-ad promotion gates; Kroger official API remains optional
2. wire Lidl and Dollar General weekly-ad ingestion; harden live pulls with browser rendering where retailer pages require JavaScript — **browser fallback shipped for five live chains; Lidl/DG still deferred**
3. promote chains from seed/coming-soon rollout to scraped-data rollout only when per-chain coverage gates pass — **Kroger/Publix/Walmart gates implemented; promotion is dynamic after ingest**
4. expand Postgres price observations with scheduled ingest refresh when material changes are detected
5. external recipe import — **research registry + UI scaffold shipped; only internal library is active**

### Weekly-ad scraping research (Kroger first)

Kroger developer app **Yum4Less** is registered in certification with Locations + Products (`product.compact`) scopes. OAuth, nearby store lookup, and catalog search work against `https://api-ce.kroger.com`, but certification responses omit store-specific prices. Promote to production for live pricing; until then weekly-ad ingest and seed/DB pricing remain the trusted ranked path.

Approved next implementation steps (live hardening):
1. capture/save HTML on ingest failure for parser development
2. Kroger store-specific ad URL + chain-specific parser (first priority)
3. review robots.txt, terms, and rate limits before expanding automated fetch
4. evaluate Flipp/syndicated feeds if direct scrape remains blocked
5. never promote scraped offers without stale-data warnings and coverage gates (gates already implemented for fixture path)

Alternative sources to evaluate after Kroger:
- Flipp-style syndicated weekly-ad feeds (terms/licensing review required)
- Publix and Walmart public weekly-ad pages with the same terms-first gate

### Publix data path (no direct API)

Publix does **not** offer a Kroger-style developer API. Current MVP wiring:

| Need | Path | Status |
|------|------|--------|
| Nearby store lookup | Website store-locator (`services.publix.com/api/v1/storelocation`) | **Live** — discovery only |
| Weekly-ad offers (live) | Own Playwright scrape + listed-savings-card HTML parser + GraphQL savings parser | **Partial** — hundreds of offers from HTML; BOGO directional; not promoted for ranked pricing |
| Product / pricing preview | Third-party Apify actor or future official path | Not wired for ranked pricing |
| Demos / tests | Fixture weekly-ad ingest | **Works** |

Apify (`outstanding_vegetable/publix-scraper`) remains optional; current priority is strengthening the in-repo scraper and parser rather than paying for third-party tokens unless the user reprioritizes.

### Wiring Publix live ingest into PostgreSQL

The Postgres path is **already implemented** — no new tables required. Live Publix uses the same pipeline as fixture Kroger:

```mermaid
flowchart LR
  A[resolvePublixStoreForZip] --> B[fetchPublixWeeklyAdPage]
  B --> C[parsePublixWeeklyAd]
  C --> D[matchWeeklyAdOffers]
  D --> E[syncWeeklyAdOffersToPriceObservations]
  E --> F[(price_observations)]
  F --> G[market-repository snapshot]
  G --> H[weeklyAdPromotionGatesPass]
  H --> I[resolveProviderRolloutForStore]
```

1. **Scrape** — `publix-weekly-ad-ingestion.ts` resolves store cookie, browser-fetches weekly-ad pages, parses HTML/GraphQL.
2. **Match** — `matchWeeklyAdOffers()` maps product names to tracked dinner ingredients (`MIN_WEEKLY_AD_MATCH_CONFIDENCE = 0.45`).
3. **Sync** — `runWeeklyAdIngestionForStores({ persistToDatabase: true })` calls `syncWeeklyAdOffersToPriceObservations()`, which **append-only inserts** rows into `price_observations` with `source_name = publix-weekly-ad-scrape` for offers that have an `ingredientId`.
4. **Read** — `market-repository.ts` picks the latest observation per store + ingredient on the next snapshot.
5. **Promote** — `weeklyAdPromotionGatesPass()` requires ≥3 matched recipe ingredients, average confidence ≥0.45, freshness ≤14 days, and non-`none` coverage. When passed, `resolveProviderRolloutForStore("Publix", …)` upgrades rollout to **`weekly-ad-preview`** (directional ranked pricing).

**Commands**

| Command | Purpose |
|---------|---------|
| `npm run ingest:weekly-ads:fixture` | Deterministic Publix → Postgres (5 synced ingredients today) |
| `npm run ingest:weekly-ads` | Live all chains including Publix (when parser returns offers) |
| `npm run test:publix-live-ingest` | Live Publix only → Postgres + promotion gate report |

**What still blocks live Publix promotion**

- Browser fetch must render savings cards (lazy JS); empty HTML → 0 offers → nothing to sync.
- Even with hundreds of parsed offers, only rows with **ingredient matches** sync (unmatched BOGO/deli items are skipped).
- Promotion needs **≥3 distinct recipe ingredients** with weekly-ad source rows — not just raw offer count.
- BOGO/directional prices must stay labeled honestly in UI; gates do not imply “high confidence.”

### External recipe sources (research summary)

Research module: `src/lib/recipe-sources/recipe-source-registry.ts`

| Source | MVP verdict | Key gate |
|--------|-------------|----------|
| **Internal library** | **Active** | Primary; ingredient IDs aligned to local pricing |
| **TheMealDB** | Dev-only | Supporter key + attribution for commercial/app-store use; needs ingredient normalization |
| **Spoonacular** | Later | 1-hour cache limit on most fields; anti-competition clause; source attribution required |
| **Edamam** | Not approved (commercial) | Free tier is personal/non-profit only; paid tier required for Yum4Less-style product |

Planned UX: recipe source selector is in the meal-preferences step; only **Internal recipe library** is selectable today. External options appear as disabled “research only” entries; terms notes live in **Project & data details (internal)** modal.

### Weekly-ad live scrape hardening

Live chains (Aldi, Food Lion, Publix, Kroger, Walmart — not Lidl/Dollar General) use HTTP first, then **Playwright headless browser fallback** when offer rows are missing (`weekly-ad-page-fetcher.ts`, `weekly-ad-browser-fetcher.ts`).

Ingest env flags (scripts only):

| Flag | Effect |
|------|--------|
| `YUM4LESS_WEEKLY_AD_FIXTURE=1` | Use checked-in HTML fixtures |
| `YUM4LESS_WEEKLY_AD_BROWSER=1` | Force browser fetch |
| `YUM4LESS_WEEKLY_AD_NO_BROWSER=1` | Disable browser fallback |
| `YUM4LESS_WEEKLY_AD_CAPTURE=1` | Save HTML/network JSON under `captures/weekly-ad/` for parser development |

Commands: `npm run ingest:weekly-ads:fixture` (recommended), `npm run ingest:weekly-ads` (live HTTP + browser fallback), `npm run ingest:weekly-ads:browser` (force browser), `npm run test:publix-live-scrape` (probe). First browser run may need `npx playwright install chromium`. On PowerShell use `$env:YUM4LESS_WEEKLY_AD_CAPTURE="1"`.

**Live baseline (May 2026):** Publix browser path parses hundreds of offers from listed-savings-card HTML (BOGO uses directional labels); Kroger, Food Lion, Walmart, and Aldi still often return 0 offers; fixtures remain the trusted refresh path until all chains pass promotion gates.

The project also has:
- `.gitignore` configured for `node_modules`, `.next`, env files, and `.private`
- a private notes file at `.private/learning-notes.md`

## Private Learning Notes

The user requested a private, git-ignored document for personalized lessons and walkthroughs:
- path: `.private/learning-notes.md`

Important boundary:
- educational guidance for the repo owner goes in the private notes file
- source-of-truth project requirements, setup steps, architecture decisions, and shared documentation should stay in normal project files

## Transcript Reference

Primary transcript for the early Yum4Less product-definition and project-setup discussion:
- [Yum4Less MVP planning](0e5bcef8-54ed-4c87-b5a6-1b4423cc1d08)

This transcript covers:
- initial product definition and user flow
- recipe-source and pricing-data strategy
- MVP stack and security-conscious dependency direction
- naming the app `Yum4Less`
- competitive analysis and positioning work
- initial Cursor agents/rules/hooks templating into the Yum4Less project

Primary transcript for the autonomous MVP implementation and provider-rollout work in this chat:
- [Autonomous MVP build slices](40f83ef1-d284-41d5-8f4f-7f7ade1daa2f)

This transcript covers:
- scaffold review, dev-server startup, and early feature testing guidance
- staged location-first UI, mock slices, README and `PROJECT_CONTINUITY.md` updates
- Kroger official provider adapter, snapshot persistence/readback, and pricing preview foundation
- provider ingredient matching, market-level coverage rollup, and promotion-readiness gates
- directional seed-vs-provider recipe comparisons without changing ranked totals
- Leaflet nearby-stores map UI with trust-aware separation from official provider discovery
- Publix official provider adapter foundation with honest not-configured rollout messaging
- test, lint, and build verification across incremental slices

Primary transcript for MCP setup, MVP completion slices, live scrape hardening, and recipe research (May 2026):
- [MCP setup MVP completion and live ingest baseline](8145bf83-1d8c-4b90-9431-990a72d04817)

This transcript covers:

**MCP and agent workflow**
- installed and configured Postgres, GitHub (Docker official server), and Playwright MCP in `.cursor/mcp.json`
- GitHub MCP troubleshooting: `GITHUB_PERSONAL_ACCESS_TOKEN` required (not in `mcp.json`); classic tokens use `ghp_` prefix; fine-grained use `github_pat_`
- updated `.cursor/rules/` and `.cursor/agents/` so Postgres, GitHub, and Playwright MCP are part of testing/verification workflows
- confirmed hooks (README check, package-command) and rules apply automatically; subagents and MCP used when the slice warrants it

**MVP completion slices (back-to-back)**
- weekly-ad coverage rollup and promotion readiness gates (`weekly-ad-coverage.ts`, `weekly-ad-promotion-readiness.ts`)
- dynamic `weekly-ad-preview` rollout status via `resolveProviderRolloutForStore` for Kroger, Publix, Walmart
- integration test: Kroger fixture ingest → Postgres → promotion gates (`weekly-ad-offer-sync.integration.test.ts`)
- CI `integration` job with Docker Postgres; **85** unit + **2** integration tests passing
- UI: weekly-ad promotion pills, rollout status copy, map labels

**Live scrape hardening (Lidl/Dollar General deferred)**
- Playwright headless browser fallback for ingest scripts (`weekly-ad-page-fetcher.ts`, `weekly-ad-browser-fetcher.ts`)
- `playwright` added as devDependency; ingest env flags and `npm run ingest:weekly-ads:browser`
- five live chains use HTTP-first, browser-fallback strategy

**External recipe research**
- `src/lib/recipe-sources/recipe-source-registry.ts` — internal library active; TheMealDB dev-only; Spoonacular later; Edamam not approved for commercial free tier
- recipe source selector in meal preferences (external options disabled) + Advanced → Recipe source research panel
- TheMealDB explained: good for variety experiments, not local pricing alignment; needs normalization + supporter key for commercial use

**Live weekly-ad ingest baseline (user-run, May 2026)**
- `npm run ingest:weekly-ads` returned **0 offers** for all five live chains:
  - Aldi, Publix: browser loaded, parser found no offers
  - Food Lion: HTTP 403
  - Kroger: operation aborted (timeout)
  - Walmart: HTTP 521
- Lidl, Dollar General: research stubs (expected)
- **Trusted local path documented:** `npm run ingest:weekly-ads:fixture`

**Documentation sync (end of session)**
- `README.md`, `PROJECT_CONTINUITY.md`, `.env.example` updated to reflect fixture-first demo flow, live ingest baseline, recipe research, test counts, and near-term priorities (Kroger chain parser first, deployment, TheMealDB dev prototype)

**Session decisions / open next steps**
- do not paste GitHub tokens into committed `mcp.json`
- do not treat live ingest failure as MVP failure — fixture ingest + Postgres catalog remain valid; ranked pricing requires ingested observations
- next implementation priority: chain-specific live parsers (Kroger first), then deployment
- defer: Lidl, Dollar General, Spoonacular/Edamam production paths, Kroger production API promotion for live store pricing

Primary transcript for UI cleanup, live-ingest hardening, security audit, and code-health refactor (May 2026):
- [UI cleanup MVP gaps and code health](18194906-4795-46c3-b3bd-7ba257b5db93)

This transcript covers:

**Top 3 MVP gaps (live weekly-ad + Kroger API)**
- Kroger weekly-ad: hardened fetcher (90s timeout, `--disable-http2`, HTTP fallback), store resolution, Flipp syndicated fallback when direct scrape returns 0 offers
- Walmart weekly-ad: dedicated ingest via Flipp feed (`flipp-weekly-ad-feed.ts`)
- Kroger production API: promotion checklist in probe, `.env.example` docs; certification auth works but store prices await production promotion

**Security and hygiene**
- removed committed GitHub PAT from `.cursor/mcp.json`; file gitignored; `.cursor/mcp.json.example` added; user must rotate token and set `GITHUB_PERSONAL_ACCESS_TOKEN` in user env
- API validation bounds, MVP browser geo radius (~35 mi from 23111), security headers in `next.config.ts`
- deduplication and organization pass across weekly-ad and provider modules

**UI bloat cleanup**
- main page slimmed for end users: nearby stores, map, meal cards, short trust labels, one-line estimate warning
- **Project & data details (internal)** temporary link opens modal with dev/admin/investor content (provider rollout, ingest pills, score grids, sale-confidence notes, provider preview comparisons, environment glossary)
- **How to read these labels** trust modal shortened to user-facing essentials only
- new `src/components/internal-details-modal.tsx`

**Runtime fixes**
- `/api/recommendations` returned **400** for browser location because validation required ZIP while market-search accepted lat/long — aligned validation so browser ranking works
- `__webpack_require__.n is not a function` from `next/dynamic` inside client component — removed dynamic import; `NearbyStoresMap` loads Leaflet in `useEffect` directly

**Live ingest baseline (user-run, May 2026)**
- Publix: 655 offers, 21 ingredient matches synced (~3 min browser scrape)
- Kroger: 122 offers via Flipp, 4 synced
- Walmart: 143 offers via Flipp, **0 synced** (matching gap, not fetch)
- Kroger API: certification auth + catalog OK; no store prices until production promotion
- Food Lion 403; Aldi 0 offers — still blocked

**Code health refactor**
- renamed `mock-recommendations.ts` → `recommendation-service.ts` (with test renames)
- split monolithic `recommendation-demo.tsx` into `src/components/recommendation-demo/` (hook, panels, meal card, route panel, trust modal)
- moved weekly-ad capture artifacts from `src/lib/weekly-ad-ingestion/captures/` to project-root `captures/weekly-ad/`
- unified weekly-ad fetch helpers (`weekly-ad-fetch-helpers.ts`); Kroger/Publix/generic page fetcher share HTTP, retry, network capture, scroll, embedded JSON extraction
- in-memory rate limiting: per-IP limits on all public API routes; Geocodio upstream limit with seed fallback
- CI: added `npm audit --audit-level=high` to verify job
- verification: **110** unit tests pass; build succeeds

**Security hardening pass (follow-up, May 2026)**
- IDOR / SQLi / BOLA audit: no classic vulnerabilities; adjacent gaps addressed in code
- `src/lib/public-api-db-write-policy.ts` — public APIs read-only by default (`YUM4LESS_ENABLE_API_DB_WRITES=1` opt-in)
- `src/lib/public-api-response-sanitizer.ts` — strips internal IDs from market JSON at API routes
- `/api/shopping-route` — max 8 stops + coordinate validation
- `src/lib/geocoding.ts` — MVP radius check on live Geocodio ZIP results
- `src/lib/rate-limit.ts` — `TRUST_PROXY_HEADERS=1` required to honor forwarded client IP
- `.env.example` documents new flags; **119** unit tests pass

**Session decisions / open next steps**
- complete UI verify with live Postgres after ingest
- Walmart ingredient matching (0 sync despite 143 Flipp offers)
- Kroger production API portal promotion
- scheduled ingest, deployment, rate limiting at scale (Redis) if multi-instance
- optional: split remaining large modules, Playwright CI suite as merge gate

## How To Use This File In Future Chats

Future chats should use this file as a continuity summary, not as immutable truth.

Before making new decisions, future chats should:
1. compare this file against the actual repository state
2. update this file if major project direction changes
3. avoid duplicating this content across multiple continuity files

If the project evolves significantly, this file should be updated rather than replaced with multiple competing summaries.
