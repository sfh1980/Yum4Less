# Yum4Less

Yum4Less is a location-aware grocery search and dinner meal-planning platform designed to help people find affordable meals using nearby store pricing, sale data, and practical shopping preferences. The product is built around a simple goal: help users identify the cheapest realistic dinner options in their area without forcing them to manually compare stores, ingredients, and recipes.

The initial vision focuses on public use and long-term scalability. The MVP is being designed as a professional, consumer-facing web application that can later expand into a broader food savings ecosystem.

## Vision

Yum4Less aims to combine grocery discovery, local price awareness, budget-based meal planning, and recipe guidance in a single experience. Instead of acting only as a meal planner or only as a store comparison tool, Yum4Less is intended to bridge both workflows:

- identify nearby stores that sell meaningful grocery ingredients
- evaluate available sale items and product pricing
- respect a user's budget and ingredient-count limits
- support both convenience-focused and savings-focused shopping behavior
- return complete dinner options with instructions

The long-term product goal is to make low-cost meal planning easier, faster, and more intelligent for everyday households.

## Problem

Consumers often face a fragmented process when trying to plan affordable meals. Grocery store apps may show deals, recipe apps may suggest meals, and price-comparison tools may help with shopping lists, but these experiences are usually disconnected. Users are left to piece together:

- which stores are nearby
- what is on sale this week
- whether shopping at multiple stores is worth it
- which meals fit their budget
- how to turn those ingredients into dinner

Yum4Less is being designed to reduce that friction by turning local grocery pricing and user constraints into practical dinner recommendations.

## MVP Scope

The initial MVP is focused on local dinner meal planning within a limited region, starting around ZIP code `23111`. Rather than attempting nationwide coverage immediately, the product is intended to begin with a manageable set of supported stores and ingredient sources in one market, then expand over time.

### Planned MVP capabilities

- browser geolocation and ZIP code-based search
- user-defined search radius
- nearby store discovery for any store selling meaningful grocery ingredients
- support for grocery stores, big-box retailers, and dollar-store-style food sellers where useful
- pricing and sale lookup through official APIs where available
- careful, terms-aware web data collection where reliability and permitted usage allow
- dinner-focused recommendation engine
- budget-based filtering
- ingredient-count filtering
- number-of-dinner-options filtering
- single-store versus multi-store shopping preference
- dietary and practical filters such as vegetarian, vegan, low-cost, and quick meals
- recipe instructions for each recommended dinner option
- store-by-store ingredient sourcing and estimated total meal cost

## User Experience

The intended user flow for the MVP is:

1. The user shares browser location and/or enters a ZIP code.
2. The user chooses a search radius.
3. The user enters preferences such as budget, ingredient count, number of dinner ideas, and whether they prefer one store or are willing to visit multiple stores for savings.
4. Yum4Less identifies supported nearby stores and gathers the best available pricing and sale information.
5. The recommendation engine evaluates curated dinner recipes against local ingredient availability and cost.
6. The app returns dinner options with estimated pricing, shopping guidance, and recipe instructions. Ranked dinners appear in a **horizontal swipe carousel** (one card at a time with Previous/Next, dots, and touch swipe) so users can browse options without scrolling through a long vertical stack.

The product is being designed to balance ease of use with practical savings. Users should be able to choose between a more convenient trip and a lower-cost multi-store strategy.

## Technical Direction

Yum4Less is in **active local MVP implementation**. The repository contains a runnable web-first app with PostgreSQL, multi-chain weekly-ad ingestion (fixture-backed), provider scaffolding, trust-aware UI, and automated tests — not a planning-only scaffold.

### Current stack

- `Next.js`
- `TypeScript`
- `CSS Modules` and/or carefully managed custom CSS
- `PostgreSQL`
- direct SQL access rather than an ORM-first approach
- `npm` as the package manager

### Maps and location approach

The planned mapping approach is a combined model:

- `Leaflet` for map rendering and UI
- browser geolocation for convenience
- ZIP code search for flexibility and accessibility
- a separate geocoding or search data source behind the scenes

This approach is intended to keep the map experience flexible and cost-conscious while still delivering a practical location workflow for the MVP.

### Data acquisition approach

Yum4Less is planned to use a layered data strategy:

- official store APIs where available
- internal normalization of product and pricing data
- careful use of web-based collection only where terms and reliability allow
- curated internal recipe data as the primary MVP source
- selective future use of external recipe APIs as the platform grows

The MVP will focus on dinner recipes first, with broader meal coverage reserved for later expansion.

## Caching and Refresh Strategy

To improve speed, reduce unnecessary external requests, and increase platform stability, Yum4Less is planned around a cache-first pricing model.

Instead of depending entirely on live external requests every time a user performs a search, the platform will store recent location, store, pricing, and deal data when appropriate. When a new search is performed, Yum4Less can compare fresh incoming data against cached results and update records when changes are detected.

This approach is intended to:

- improve response times
- reduce API and scraping load
- avoid redundant requests
- improve resiliency when store data is inconsistent
- support a more stable recommendation engine

As the system grows, background refresh jobs and scheduled sync processes may be introduced to keep pricing data reasonably current without making every user query dependent on live external lookups.

## Security Principles

Security and dependency discipline are part of the product strategy from the beginning. Yum4Less is intended to use a small, deliberate, low-friction stack rather than a dependency-heavy setup.

Core principles include:

- minimize third-party packages wherever practical
- prefer mature, widely understood technologies
- avoid unnecessary UI frameworks and dependency sprawl
- keep sensitive values in environment variables rather than hard-coded configuration
- review external packages carefully before adoption
- protect both developer environments and production environments
- treat location-related data with care and avoid unnecessary retention

The current direction favors controlled complexity, transparent architecture, and long-term maintainability over rapid dependency expansion.

### Implemented security controls (local MVP)

A May 2026 audit covered SQL injection, IDOR, and BOLA. Classic vulnerabilities were **not found** (parameterized SQL everywhere; no client-supplied resource IDs; no user ownership model yet). The following hardening is **shipped** to close adjacent gaps:

| Control | What it does |
|---------|----------------|
| **Read-only public APIs by default** | `POST /api/recommendations` and `POST /api/market-search` do **not** insert provider snapshots or sync Kroger prices unless `YUM4LESS_ENABLE_API_DB_WRITES=1`. Weekly-ad and ingest scripts remain the intended write path. |
| **Public response sanitization** | Market payloads strip `persistedSnapshotId` and `internalStoreId` before JSON leaves `/api/recommendations` and `/api/market-search`. |
| **Shopping-route abuse limits** | `/api/shopping-route` enforces max **8** stops and valid lat/lng bounds (same rules as other routes). |
| **MVP geographic scope** | Browser coordinates and live Geocodio ZIP results must fall within the MVP service radius (~35 mi from ZIP `23111`). |
| **Proxy-aware rate limiting** | `X-Forwarded-For` / `X-Real-IP` are ignored unless `TRUST_PROXY_HEADERS=1` (set only behind a trusted reverse proxy). |
| **Security headers** | `next.config.ts` sets X-Frame-Options, nosniff, Referrer-Policy, and Permissions-Policy. |
| **Input validation** | Recommendation and market-search payloads use bounded enums, clamps, and ZIP regex; all SQL uses `$n` placeholders. |

**Before production:** keep public APIs read-only; enable `TRUST_PROXY_HEADERS=1` only with a trusted proxy; consider Redis-backed rate limits for multi-instance deploys.

### Production deployment safety (local vs hosted)

The local ZIP `23111` demo and a hosted deployment are different milestones. Local dev may opt into API DB writes for debugging; production must not.

| Setting | Local MVP | Hosted / production |
|---------|-----------|---------------------|
| `YUM4LESS_ENABLE_API_DB_WRITES` | Leave **unset** (default). Set `=1` only when debugging provider snapshot persistence from public routes. | **Never set.** Code ignores the flag when `NODE_ENV=production`; ingest/cron scripts are the only intended Postgres write path. |
| `TRUST_PROXY_HEADERS` | Leave **unset** unless testing behind a local reverse proxy. | Set `=1` **only** when a trusted reverse proxy strips client `X-Forwarded-For` and sets the real client IP. Without it, all clients share one `"unknown"` rate-limit bucket (safer than trusting spoofable headers). |
| Rate limits | In-memory per-process buckets in `src/lib/rate-limit.ts` (~20–30 req/min per route). Resets on restart; fine for single-process local dev. | Same code runs in production but **does not scale horizontally** — each instance has its own counters, and limits reset on deploy. Add platform edge limits or Redis-backed buckets before multi-instance traffic. |
| Postgres writes | Fixture ingest (`npm run ingest:weekly-ads:fixture`) and optional live ingest scripts write to real tables. | Schedule ingest jobs separately; public HTTP routes stay read-only. |

**Production checklist (when you choose to deploy):**

1. Do **not** set `YUM4LESS_ENABLE_API_DB_WRITES` in the host environment.
2. Set `TRUST_PROXY_HEADERS=1` only if the platform terminates TLS and forwards a trusted client IP header.
3. Add platform or Redis rate limits if running more than one app instance.
4. Keep retailer credentials and `DATABASE_URL` in host secrets — never in client bundles or git.
5. Run scheduled weekly-ad ingest out-of-band; do not rely on user traffic to refresh prices.

Hosting provider setup (Vercel, Docker, etc.) is not documented here yet — this section only records deploy-safe defaults the codebase enforces today.

## Environment and Secrets

Sensitive configuration is expected to be managed through environment variables. That includes, where applicable:

- database connection details
- geolocation or geocoding provider configuration
- store API credentials
- any future third-party recipe or enrichment services

The project should avoid hard-coding sensitive values in source files, commit history, or client-exposed runtime code.

Current local environment setup:

- copy `.env.example` to `.env.local`
- set `GEOCODIO_API_KEY` when you want live ZIP resolution (still MVP-radius scoped)
- set `DATABASE_URL` when you want recommendation reads to come from Postgres
- optional `YUM4LESS_ENABLE_API_DB_WRITES=1` when you want public API calls to persist provider snapshots and sync Kroger preview prices into Postgres (default is read-only; **never set in production** — code blocks it when `NODE_ENV=production`)
- optional `TRUST_PROXY_HEADERS=1` only when deployed behind a trusted reverse proxy that sets client IP headers (without it, rate limits use a shared `"unknown"` bucket)

If `GEOCODIO_API_KEY` is missing, the app still works for the small seeded local ZIP set used by the current MVP slice.
If `DATABASE_URL` is missing or Postgres is unavailable, market reads return an empty catalog and the UI shows infrastructure messaging — configure Postgres and run fixture ingest for the ZIP `23111` demo (see **Quick start** below).
Public API routes do **not** write to Postgres unless `YUM4LESS_ENABLE_API_DB_WRITES=1` is set.

## Cursor MCP servers (project)

This repo includes `.cursor/mcp.json` with three project-scoped MCP servers:

| Server | Purpose | Prerequisites |
|--------|---------|----------------|
| **postgres** | Read-only SQL + schema inspection on local `yum4less_dev` | Docker Postgres on port `5433` (`npm run db:up`) |
| **github** | PR/issue/CI queries via official GitHub MCP | Docker Desktop + `GITHUB_PERSONAL_ACCESS_TOKEN` |
| **playwright** | Browser automation for map/ZIP/UI flows | Node 18+ (uses `npx @playwright/mcp`) |

### One-time setup

1. **Restart Cursor** after pulling this repo so it loads `.cursor/mcp.json`.
2. Open **Cursor Settings → Tools & MCP** and confirm all three servers appear.
3. **Postgres:** run `npm run db:up` before using DB tools.
4. **GitHub:** create a fine-grained PAT at [github.com/settings/tokens](https://github.com/settings/tokens) with repo read access, then either:
   - set a user environment variable `GITHUB_PERSONAL_ACCESS_TOKEN`, or
   - paste the token in Cursor’s MCP settings editor for the `github` server (recommended on Windows).
5. **GitHub Docker image (first run):**
   ```powershell
   docker pull ghcr.io/github/github-mcp-server
   ```
6. **Playwright:** first MCP use may download Chromium via `npx`; optional preinstall:
   ```powershell
   npx playwright install chromium
   ```

Do **not** commit PATs into `.cursor/mcp.json` or `.env.local`. The GitHub server uses `${env:GITHUB_PERSONAL_ACCESS_TOKEN}` in the committed config.

### Verify

- Green status dots in **Settings → Tools & MCP**
- Test prompts: “List tables in yum4less_dev”, “Show recent GitHub Actions runs for this repo”, “Open localhost:3000 and describe the page”

Project rules (`.cursor/rules/`) and subagents (`.cursor/agents/`) reference all three MCPs for agent-driven verification: Postgres for schema/seed/ingest evidence, GitHub for PR and workflow status, Playwright for browser-only UI flows. Vitest and integration tests remain the automated merge gate.

## Local Database Foundation

The repo now includes a first local PostgreSQL foundation that mirrors the normalized mock market model:

- `stores`
- `ingredients`
- `recipes`
- `recipe_ingredients`
- `price_observations`

The database artifacts live in:

- `docker-compose.yml`
- `db/init/001_schema.sql`
- `db/init/002_seed.sql`

This foundation is intentionally plain SQL and Docker-based. It does not add an ORM or migration framework yet because the current goal is to establish the right data model first.

The app now includes a small server-side repository layer that reads stores, recipes, and ingested price observations from Postgres when `DATABASE_URL` is configured.

## Current Implementation

The repo currently contains a **local MVP implementation** (ZIP `23111`, Postgres-backed, trust-aware UI):

- `Next.js + TypeScript` app with location-first recommendation flow
- server-side ZIP lookup (`Geocodio`) and local ZIP fallback
- browser geolocation, Leaflet map, staged meal preferences
- an explicit provider-rollout layer that distinguishes recommendation-ready seed preview chains from coming-soon chains
- a first official-provider adapter foundation for Kroger nearby-store discovery, with truthful fallback behavior when credentials are missing or provider calls fail
- a second provider adapter foundation for Publix with website store-locator discovery and honest coming-soon pricing messaging (no direct developer API; Apify is the common third-party path)
- a third official-provider adapter foundation for Walmart with env scaffold credentials and honest not-configured discovery/preview messaging until an approved official API path is wired; Walmart ranked recommendation pricing stays on trusted seed/DB coverage
- persisted local snapshots for official provider store-discovery searches, so provider discovery can be audited without changing recommendation pricing trust
- cached readback for recent provider store-discovery snapshots, so Yum4Less can reuse saved official discovery results when live provider calls fail
- a Kroger product/pricing preview foundation for a small tracked ingredient set, with persisted snapshots and cache-aware fallback that still stays outside ranked recommendations
- provider-side ingredient-match scoring and preview-coverage labels for Kroger pricing previews, so official product hits are evaluated more honestly before any future recommendation use
- a market-level provider preview coverage rollup with explicit trust gates, tracked-ingredient summaries, and a hard separation from ranked meal pricing
- per-provider promotion-readiness gate checklists for Kroger, Publix, and Walmart, each with provider-aware technical gates plus an MVP promotion lock that keeps ranked meal pricing on seed/DB data
- per-provider directional seed-vs-provider preview comparisons on ranked meal cards for overlapping recipe ingredients, without changing ranked totals
- a Leaflet nearby-stores map anchored to ZIP or browser location, using local market-store coordinates and OpenStreetMap tiles with explicit trust messaging
- runtime validation and invalid-input feedback for the current form
- nearby-store discovery driven by resolved coordinates and a market dataset loaded through a small server-side data-access layer
- normalized mock store, ingredient, recipe, and price-observation data
- a richer internal mock recipe dataset with structured recipe metadata
- isolated recommendation and scoring logic
- store-by-store shopping-plan output
- recipe-step output and score breakdowns in the recommendation cards
- a dismissible trust explainer plus source/freshness labels in the results UI
- a horizontal swipe carousel for ranked dinner cards (`recommendation-results-carousel.tsx`) with Previous/Next controls, dot pagination, keyboard arrows, and touch scroll-snap
- custom global styling

Current file roles:

- `src/app/page.tsx` keeps the home page thin and compositional
- `src/components/recommendation-demo.tsx` contains the mock location, preferences, and recommendation UI flow
- `src/components/recommendation-results-carousel.tsx` renders the swipeable ranked-dinner carousel
- `src/components/nearby-stores-map.tsx` renders the client-side Leaflet map for nearby stores
- `src/lib/nearby-stores-map-model.ts` builds trust-aware map markers and bounds from the market summary
- `src/app/api/geocode/zip/route.ts` provides the server-side ZIP lookup endpoint
- `src/app/api/market-search/route.ts` provides the explicit nearby-store discovery endpoint for the staged UI flow
- `src/app/api/recommendations/route.ts` provides the server-side recommendation endpoint
- `src/app/api/shopping-route/route.ts` provides multi-store route planning (OSRM) with stop-count and coordinate validation
- `src/lib/geocoding.ts` contains the Geocodio integration, MVP-radius ZIP checks, and local ZIP fallback behavior
- `src/lib/location-resolution.ts` centralizes ZIP-or-browser location resolution for server routes
- `src/lib/public-api-db-write-policy.ts` gates provider snapshot persistence and price sync on public API routes (opt-in via env)
- `src/lib/public-api-response-sanitizer.ts` strips internal snapshot and store IDs from public market JSON
- `src/lib/rate-limit.ts` and `src/lib/api-rate-limit.ts` provide in-memory per-IP throttling and Geocodio upstream throttling
- `src/lib/provider-rollout.ts` defines the current trusted chain rollout and gates ranked recommendations accordingly
- `src/lib/providers/provider-types.ts`, `src/lib/providers/provider-registry.ts`, `src/lib/providers/kroger-provider.ts`, `src/lib/providers/publix-provider.ts`, and `src/lib/providers/walmart-provider.ts` define the official store-discovery provider boundary
- `src/lib/provider-market-service.ts` runs official provider store discovery alongside the local market-search flow
- `src/lib/provider-store-search-cache.ts` persists official provider store-discovery snapshots when the local database is available
- `src/lib/provider-store-search-cache.ts` also reads back recent provider snapshots so the app can distinguish live discovery from saved discovery
- `src/lib/provider-pricing-preview-service.ts` builds a trust-aware Kroger pricing preview for tracked ingredients without feeding ranked meal pricing
- `src/lib/provider-product-pricing-cache.ts` persists and reads back provider pricing preview snapshots
- `src/lib/providers/provider-price-matching.ts` scores provider product-to-ingredient matches and classifies preview coverage strength
- `src/lib/provider-coverage-rollup.ts` rolls provider preview coverage into market-level trust gates and tracked-ingredient summaries without changing ranked meal pricing
- `src/lib/provider-promotion-readiness.ts` evaluates explicit per-provider promotion gates before provider preview could ever influence ranked meal pricing
- `src/lib/seed-vs-provider-recipe-comparison.ts` compares overlapping recipe ingredient prices between seed/DB shopping plans and each provider preview separately without affecting ranking
- `src/lib/provider-tracked-ingredients.ts` defines the small curated ingredient set used for provider preview coverage measurement
- `src/lib/weekly-ad-ingestion/` — multi-chain weekly-ad scrape, Playwright browser fallback, Postgres sync, promotion gates
- `src/lib/recipe-sources/recipe-source-registry.ts` — external recipe API research (internal library active only)
- `src/lib/sale-confidence.ts` — shopping-plan sale/freshness labels
- `src/lib/recommendation-service.ts` contains the recommendation, shopping-plan, and scoring logic
- `src/lib/market-repository.ts` loads market records from Postgres; returns empty catalog when DB is unavailable
- `src/lib/db.ts` owns the shared Postgres connection pool
- `vitest.config.ts` and `vitest.setup.ts` define the local test harness
- `src/**/*.test.ts[x]` covers geocoding fallback, repository fallback/mapping, recommendation behavior, route validation, and a UI smoke path
- **Playwright MCP** (see Cursor MCP setup above) supplements Vitest for agent-driven browser checks: ZIP `23111` search, trust/fallback labels, map interactions, and weekly-ad status UI on `localhost` with seeded data
- **Postgres MCP** supplements integration tests for read-only checks of schema, seeded stores, and latest `price_observations` after ingest (`npm run db:up` first)
- **GitHub MCP** supports PR and workflow inspection during review; use `gh` CLI for creating PRs and other write operations
- `db/init/001_schema.sql` defines the first PostgreSQL schema
- `db/init/002_seed.sql` seeds the database with the same local market concepts used by the mock app flow

This first slice is intentionally hybrid. The ZIP lookup boundary is real, and the market, pricing, and recommendation layers now read through a server-side repository boundary so the workflow can evolve one layer at a time:

- user constraints go in
- invalid input is stopped at the UI boundary
- ZIP input is resolved through `Geocodio` when configured, otherwise through a small local fallback set
- browser geolocation can also anchor the local market when the user allows it
- location and radius inputs produce a nearby-store market snapshot before meal ranking begins
- nearby stores can now be labeled as recommendation-ready seed preview coverage or coming soon depending on the current rollout
- Kroger official nearby-store discovery can now be attempted separately from recommendation pricing when provider credentials are configured
- official provider store-discovery results can now be saved to the local database with separate provenance from ZIP lookup and pricing provenance
- recent saved provider snapshots can now be reused when live official discovery is unavailable, with cache freshness surfaced separately from pricing freshness
- Kroger official pricing previews can now be attempted for a small tracked ingredient set and served as live or cached previews without changing recommendation totals
- Kroger pricing preview items are now ranked by ingredient-match confidence and summarized with coverage status before they can be considered for any future recommendation use
- market-search now also rolls provider preview coverage into a market-level trust gate that keeps ranked meal pricing on trusted seed/DB data regardless of preview strength
- market-search now also exposes per-provider promotion-readiness checklists that show which technical gates passed while the MVP promotion lock keeps ranked pricing on seed/DB data
- ranked meal cards now include per-provider directional preview comparisons for overlapping ingredients while the card total stays on trusted seed/DB pricing
- the staged location flow now includes a Leaflet map of nearby stores anchored to the resolved ZIP or browser location, separate from official provider discovery pins
- Postgres-backed market data loads when `DATABASE_URL` is configured and fixture ingest has run
- when Postgres is unavailable, the UI shows infrastructure messaging instead of ranked pricing
- ranked dinner options come out
- each result explains why it was recommended and how the shopping plan is assembled
- the UI now explains source, freshness, fallback, and estimate quality with a dismissible trust explainer plus card-level labels

The approved MVP direction for the next build phases is:

- keep the MVP no-login and local-area-limited around ZIP `23111`
- determine location from browser geolocation and/or ZIP
- choose a radius, then show nearby stores in that radius
- only then apply dinner-specific preferences like ingredient count, cost cap, recipe count, and one-store versus multi-store behavior
- prioritize live-chain work in this order: `Kroger`, then `Publix`, then `Walmart`
- show unsupported chains as coming soon or disabled with explanation
- hide chains from recommendation pricing until their sale and price coverage is strong enough to support trustworthy output
- explain freshness, source, fallback, and estimate quality clearly in the UI
- keep current ranked recommendation pricing limited to the explicit rollout layer instead of implying equal support across every nearby chain
- keep official provider discovery truthfully separate from ranked recommendation pricing until coverage is strong enough to trust
- keep ZIP lookup provenance, official store-discovery provenance, and pricing provenance separate in both code and UI wording
- distinguish live provider discovery from saved provider snapshots so cached discovery never reads like a fresh live response
- keep provider pricing previews explicitly labeled as previews until ingredient matching, coverage, and freshness are strong enough for ranked recommendation use

## Getting Started

### Prerequisites

- `Node.js` 20 or newer
- `npm`
- `Docker Desktop` (or another local Docker runtime) for the Postgres-backed demo

### Install dependencies

```bash
npm install
```

### Quick start — ZIP `23111` local demo

The trusted local demo uses **Postgres plus fixture weekly-ad ingest**. Fixture ingest loads checked-in HTML samples into real `price_observations` rows — **rehearsal data in real tables, not live retailer feeds**. Ranked pricing shows as directional weekly-ad preview; confirm in store.

**Shortcut (after `npm install`):**

```bash
npm run setup:local
npm run dev
```

`setup:local` creates `.env.local` from `.env.example` when missing, starts Postgres, and runs fixture ingest.

Then open [http://localhost:3000](http://localhost:3000) and search ZIP **23111** → find nearby stores → rank dinners.

**Manual steps (same result):**

| Step | Action |
|------|--------|
| 1 | `npm run db:up` — start Postgres on host port **5433** |
| 2 | Copy `.env.example` → `.env.local` and keep `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/yum4less_dev` |
| 3 | `npm run ingest:weekly-ads:fixture` — sync rehearsal weekly-ad prices into Postgres |
| 4 | `npm run dev` |
| 5 | Open the app → search ZIP **23111** |

Without steps 1–3, `npm run dev` may start but ranked pricing and weekly-ad rollout labels will not match the intended demo.

### Optional environment variables

Copy env only if you skipped `setup:local` and need to create `.env.local` yourself:

```bash
copy .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

Then adjust as needed:

```bash
GEOCODIO_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/yum4less_dev
KROGER_CLIENT_ID=your_kroger_client_id
KROGER_CLIENT_SECRET=your_kroger_client_secret
KROGER_API_ENV=certification
# Optional: pin a known Kroger locationId (example for ZIP 23111: 02900529)
# KROGER_LOCATION_ID=
WALMART_CLIENT_ID=your_walmart_client_id
WALMART_CLIENT_SECRET=your_walmart_client_secret
# Optional: allow public API routes to write provider snapshots / sync prices (local dev only; blocked in production)
# YUM4LESS_ENABLE_API_DB_WRITES=1
# Optional: trust X-Forwarded-For only when behind a known reverse proxy that strips spoofed headers
# TRUST_PROXY_HEADERS=1
```

New Kroger developer apps start in **certification** (`https://api-ce.kroger.com`). That environment supports OAuth, nearby store lookup, and product catalog search, but it does **not** return store-specific prices. Promote the app to production in the Kroger developer portal and set `KROGER_API_ENV=production` when you need live pricing.

Verify Kroger credentials locally with:

```bash
npm run test:kroger-api
```

Verify Publix store discovery (website store-locator, no token required):

```bash
npm run test:publix-api
```

Optional live weekly-ad scrape probes (require network; not CI merge gates):

```bash
npm run test:kroger-live-scrape
npm run test:publix-live-scrape
```

On Windows PowerShell, enable artifact capture during Publix scrape development with:

```powershell
$env:YUM4LESS_WEEKLY_AD_CAPTURE="1"
npm run test:publix-live-scrape
```

If you skip Kroger credentials, the app still works with the seeded local ZIP fallback set used for the current MVP slice. Official Kroger discovery/preview stays not configured until credentials are present.

Publix store discovery is live via the website store-locator service (`services.publix.com`) for nearby-store lookup only. **Publix has no direct developer API.** Live weekly-ad scraping uses Playwright against `publix.com` with a **listed-savings-card HTML parser** that can extract hundreds of offers from captured pages (BOGO items use explicit **Directional** pricing labels). Ranked Publix pricing remains coming soon until promotion gates pass. For product search via third party, the common path is **[Apify’s Publix Scraper](https://apify.com/outstanding_vegetable/publix-scraper)** — not wired in this MVP.

Walmart credentials are scaffold-only for now. If `WALMART_CLIENT_ID` and `WALMART_CLIENT_SECRET` are set, Yum4Less detects them but still reports store discovery and pricing preview as not wired until an approved official API path is implemented.

If you are using the local Postgres-backed seed data and want the latest seeded store lineup after provider-rollout updates, run:

```bash
npm run db:reset
```

This is also the easiest way to pick up new local schema files like the provider-store snapshot table if your Docker volume already existed before a new migration landed.

The same applies to the provider product-pricing snapshot table added in the latest slice.

### Local database details

Postgres runs in Docker with:

- database: `yum4less_dev`
- user: `postgres`
- password: `postgres`
- port: `5433` on the host, mapped to `5432` inside the container

The schema and seed files in `db/init/` are applied automatically on first container initialization.

Yum4Less uses host port `5433` because many machines already have another Postgres listener on `5432`.

### Available commands

- `npm run setup:local` — first-run helper: `.env.local` from example (if missing), `db:up`, fixture ingest
- `npm run dev` starts the Next.js development server
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run lint` runs ESLint across the project
- `npm test` — unit tests (mocked DB; no Docker required)
- `npm run test:integration` starts Docker Postgres when needed and runs `*.integration.test.ts` files
- `npm run test:integration:reset` recreates the Postgres volume first, then runs integration tests
- `npm run test:watch` runs the fast suite in watch mode
- `npm run test:all` runs unit tests plus integration tests
- `npm run test:e2e` runs Playwright browser tests against localhost (reuses an existing dev server when port 3000 is free)
- `npm run test:e2e:ci` builds, fixture-ingests, starts the app on port **3100**, and runs Playwright (CI path)
- `npm run test:kroger-api` probes Kroger OAuth, location lookup, and catalog search (certification)
- `npm run test:publix-api` probes Publix website store-locator for a ZIP
- `npm run test:kroger-live-scrape` live Kroger weekly-ad browser scrape probe (network)
- `npm run test:publix-live-scrape` live Publix weekly-ad browser scrape probe (network)
- `npm run db:up` starts the local PostgreSQL container
- `npm run db:down` stops the local PostgreSQL container
- `npm run db:reset` recreates the local PostgreSQL volume and reapplies schema + seed data
- `npm run db:logs` tails the PostgreSQL container logs
- `npm run ingest:weekly-ads:fixture` syncs deterministic weekly-ad fixtures to Postgres (**recommended for local demo**)
- `npm run ingest:weekly-ads` attempts live weekly-ad fetch (HTTP + browser fallback; currently often 0 offers)
- `npm run ingest:weekly-ads:browser` forces Playwright browser fetch for weekly ads
- `npm run ingest:weekly-ads:scheduled` cron/Task Scheduler wrapper for live ingest

Integration tests use Docker Postgres on port `5433`. The harness runs `npm run db:up` when the container is missing and `npm run db:reset` when the seed looks stale (for example after schema/seed changes). Use `npm run test:integration:reset` to force a full volume reset before tests.

**Agent verification (MCP):** project rules and agents layer MCP tools after automated tests:

| MCP | When to use | Prerequisite |
|-----|-------------|--------------|
| **Postgres** | Verify seed stores, latest `price_observations`, ingest append semantics | `npm run db:up` |
| **Playwright** | ZIP search, trust copy, map, weekly-ad status UI | `npm run dev` |
| **GitHub** | Failed CI checks, workflow runs, PR status | `GITHUB_PERSONAL_ACCESS_TOKEN` |

Playwright E2E is a **CI merge gate** via `npm run test:e2e:ci` (`e2e/mvp-flow.spec.ts`). Cursor **Playwright MCP** remains for agent-driven spot checks beyond the committed suite.

### Weekly-ad ingestion (pricing refresh)

Weekly-ad ingestion is **offline from user searches** — it runs via npm scripts and appends rows to PostgreSQL `price_observations`. The app reads the **latest** row per store + ingredient on the next DB snapshot.

| Command | Purpose |
|---------|---------|
| `npm run ingest:weekly-ads:fixture` | **Reliable local path** — deterministic HTML fixtures for Aldi, Food Lion, Publix, Kroger, Walmart (**rehearsal data in real tables; not live retailer feeds**) |
| `npm run ingest:weekly-ads` | Live HTTP first, then Playwright headless browser fallback |
| `npm run ingest:weekly-ads:browser` | Force headless browser fetch |
| `npm run ingest:weekly-ads:scheduled` | Task Scheduler/cron wrapper (starts Postgres, then live pull) |

Ingest env flags (scripts only; see `.env.example`):

| Flag | Effect |
|------|--------|
| `YUM4LESS_WEEKLY_AD_FIXTURE=1` | Use checked-in HTML fixtures |
| `YUM4LESS_WEEKLY_AD_BROWSER=1` | Force browser fetch |
| `YUM4LESS_WEEKLY_AD_NO_BROWSER=1` | Disable browser fallback |

First browser ingest may require `npx playwright install chromium`.

**Live ingest status (verified locally, May 2026):** **Publix** live browser fetch can parse **650+ offers** and sync **20+ ingredient matches** to Postgres. **Kroger**, **Aldi**, and **Food Lion** can sync rows via the **Flipp syndicated feed** (direct scrape still often blocked). **Walmart** Flipp fetch returns offers but **live ingredient matching still syncs 0** — use fixtures for Walmart ranked demos until matching improves. **Lidl** / **Dollar General** remain research stubs. Fixture ingest remains the trusted local/CI baseline.

When fixture ingest has run and promotion gates pass, Kroger/Publix/Walmart can show **`weekly-ad-preview`** rollout status with explicit verify language on scraped prices.

### Recipe sources

- **Active:** internal Postgres/seed recipe library (`recipeSource: internal-library`)
- **Research only:** TheMealDB (dev-only), Spoonacular (later), Edamam (not approved for commercial free tier)
- Registry: `src/lib/recipe-sources/recipe-source-registry.ts`
- UI: meal-preferences **Recipe source** dropdown (external options disabled) + **Advanced → Recipe source research**

## Development Status

Yum4Less has a **runnable local MVP** around ZIP `23111` with Postgres, trust-aware recommendations, and fixture-backed weekly-ad pricing. It is **not deployed** and **live retailer ingest is not production-ready**.

### Shipped locally

- location-first flow: ZIP/browser geolocation → radius → stores → meal preferences → ranked dinners
- Leaflet map, trust explainer, sale-confidence labels, provider preview panels (separate from ranked pricing)
- PostgreSQL schema/seed + repository fallback to in-memory seed
- multi-chain weekly-ad ingest pipeline with promotion gates (`weekly-ad-preview` when fixture/scraped data passes gates)
- Playwright browser fallback for live ingest scripts (devDependency + ingest path, separate from Cursor Playwright MCP)
- external recipe source research registry + UI scaffold
- **215** unit tests (**55** files), **5** Postgres integration tests, **3** Playwright E2E tests; CI runs lint, unit tests, build, integration (Docker Postgres), and E2E (fixture ingest + browser on port **3100**)
- public API read-only default (production write guard when `NODE_ENV=production`), response sanitization, shopping-route caps, MVP ZIP radius checks, proxy-aware rate limiting, and route-level validation/429 tests (May 2026 security + merge-gate pass)
- first-run helper `npm run setup:local`; store pills say **Weekly ad prices** (not “Priced”); E2E covers ZIP `23111` core loop + trust vocabulary

### Recommended local demo flow

See **Quick start — ZIP `23111` local demo** in Getting Started. Shortcut:

```powershell
npm run setup:local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), search ZIP **23111**, rank dinners.

### Not shipped / blocked

| Area | Status |
|------|--------|
| **Live weekly-ad ingest** | **Partial** — Publix live + Flipp paths sync rows for Kroger/Aldi/Food Lion; **Walmart live sync still 0** (matching gap); direct scrape blocked for some chains |
| **Lidl / Dollar General** | Research stubs only |
| **External recipe APIs** | Research only; internal library feeds rankings |
| **Production deployment** | Not started |
| **Committed Playwright CI suite** | **Shipped** — `e2e/mvp-flow.spec.ts` via `npm run test:e2e:ci` |
| **Official Kroger API pricing** | Credentials wired for certification; store discovery + catalog search work; store prices require production promotion |

### Verified commands

- `npm run lint`, `npm run build`, `npm test` (**215**), `npm run test:integration` (**5**), `npm run test:all`, `npm run test:e2e:ci` (**3/3**) pass locally (last verified 2026-05-27)
- Optional network probes (manual): `npm run test:kroger-api`, `npm run test:publix-api`, `npm run test:publix-live-scrape`, `npm run test:publix-live-ingest`
- `.github/workflows/ci.yml` — `verify` + `integration` + `e2e` jobs

## Competitive Positioning

Yum4Less operates in a market where several products cover parts of the workflow, but few appear to combine the full feature set in one focused experience.

### Relevant competitors

- `Saverly`: strong overlap in sale-driven meal planning, but more tightly connected to Kroger-family stores
- `Grocery Dealz`: strong overlap in multi-store price comparison and radius-based shopping, but less centered on dinner generation
- `Jow`: strong overlap in recipe-to-cart planning, but more focused on grocery partner integration than local sale-first optimization
- `Cooklist`: adjacent through pantry, shopping, and grocery integrations, but positioned more around household inventory than budget dinner discovery
- `Mealime`: strong recipe and planning experience, but not centered on local store-sale optimization
- `Flipp`: strong local deal discovery, but not a meal-planning engine

### How Yum4Less is intended to differ

Yum4Less is being designed to unify several features that are often separated across competitor products:

- geo-based nearby store search
- ZIP code and location-based discovery
- local sale-item-driven dinner generation
- budget-cap-based filtering
- ingredient-count filtering
- one-store versus multi-store user preference
- dietary and convenience filters
- complete dinner instructions alongside shopping guidance

The strategic differentiator is not simply grocery comparison or recipe planning alone. It is the combination of local pricing intelligence, meal practicality, and user-controlled shopping tradeoffs in a single product.

### Product positioning statement

Yum4Less is being positioned as a platform that helps users find the cheapest realistic dinners near them this week, then choose between a simpler one-store trip or a lower-cost multi-store plan.

## Roadmap

The initial roadmap is centered on building a focused, credible MVP before expanding feature scope.

### Phase 1: MVP foundation (largely complete locally)

- web application architecture — **done**
- browser geolocation and ZIP-based search — **done**
- limited local market (23111) — **done**
- normalized store/pricing data + Postgres — **done**
- curated internal recipe library — **done**
- recommendation logic (budget, filters, store preference) — **done**
- trust/provenance/fallback messaging — **done**
- public API security hardening (read-only default, production write guard, input bounds, response sanitization, route 429/validation tests) — **done**
- Playwright E2E CI gate (`test:e2e:ci`) — **done**
- first-run setup docs + `setup:local` — **done**
- live weekly-ad refresh at retailers — **partial** (fixture path + Flipp/Publix live; Walmart live matching gap)
- production deployment — **not started**

### Phase 2: Recommendation quality and platform strength

- improve ingredient-to-product matching
- strengthen cache and refresh logic
- expand supported stores and local coverage
- refine ranking logic for savings versus convenience
- improve pricing freshness and recommendation confidence

### Phase 3: Expansion and scalability

- expand beyond dinner into broader meal planning
- add saved favorites and account-based personalization if warranted
- support broader regional and multi-market growth
- evaluate mobile-first experiences or native mobile applications
- deepen recipe variety and personalization
- expand analytics, operational tooling, and data quality systems

## Near-Term Next Steps

Priority order given current status (live ingest baseline recorded May 2026):

1. **Walmart live ingredient matching** — Flipp fetch returns offers but live sync still **0**; fixture path syncs **7** rows for local demos
2. **Keep fixture ingest as the local trust path** — demos, integration tests, E2E CI, and promotion-gate verification
3. **Remote CI verification** — run `gh auth login` and confirm `.github/workflows/ci.yml` on push
4. **Deployment + scheduled fixture/live ingest** — only after live parsers show repeatable offer counts; follow **Production deployment safety** above
5. **TheMealDB dev import prototype** — normalization layer before any external source is selectable
6. **Scale rate limiting** — Redis or platform limits when running multi-instance

Defer unless reprioritized: Lidl, Dollar General, Spoonacular/Edamam production paths, Kroger production API promotion for live store pricing.


## Guiding Philosophy

Yum4Less is being built with a practical philosophy:

- start local
- stay security-conscious
- prefer clarity over unnecessary complexity
- keep the MVP useful and realistic
- expand only after the core workflow proves value

The objective is to create a durable product with strong consumer utility, attractive long-term positioning, and a disciplined technical foundation.
