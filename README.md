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
6. The app returns dinner options with estimated pricing, shopping guidance, and recipe instructions.

The product is being designed to balance ease of use with practical savings. Users should be able to choose between a more convenient trip and a lower-cost multi-store strategy.

## Technical Direction

Yum4Less is now in early implementation. The repository already contains a runnable web-first scaffold that proves the first recommendation flow with mock data, while the broader MVP architecture and live integrations are still being designed.

### Planned stack

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

## Environment and Secrets

Sensitive configuration is expected to be managed through environment variables. That includes, where applicable:

- database connection details
- geolocation or geocoding provider configuration
- store API credentials
- any future third-party recipe or enrichment services

The project should avoid hard-coding sensitive values in source files, commit history, or client-exposed runtime code.

Current local environment setup:

- copy `.env.example` to `.env.local`
- set `GEOCODIO_API_KEY` when you want live ZIP resolution
- set `DATABASE_URL` when you want recommendation reads to come from Postgres

If `GEOCODIO_API_KEY` is missing, the app still works for the small seeded local ZIP set used by the current MVP slice.
If `DATABASE_URL` is missing or the database is unavailable, the app falls back to the seeded in-memory market dataset.

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

The app now includes a small server-side repository layer that prefers this Postgres foundation for stores, recipes, and current price observations, while gracefully falling back to the seeded in-memory dataset if the DB is not configured yet.

## Current Implementation

The repo currently contains a hybrid, guided-demo-first MVP slice:

- a manual `Next.js + TypeScript` scaffold
- a simple app shell
- an interactive recommendation flow that still uses demo-oriented framing
- an MVP-oriented ZIP-first recommendation flow with clearer trust messaging
- a server-side ZIP lookup boundary with `Geocodio`
- a local seeded ZIP fallback when `GEOCODIO_API_KEY` is not configured
- runtime validation and invalid-input feedback for the current form
- nearby-store discovery driven by resolved coordinates and a market dataset loaded through a small server-side data-access layer
- normalized mock store, ingredient, recipe, and price-observation data
- a richer internal mock recipe dataset with structured recipe metadata
- isolated recommendation and scoring logic
- store-by-store shopping-plan output
- recipe-step output and score breakdowns in the recommendation cards
- a dismissible trust explainer plus source/freshness labels in the results UI
- custom global styling

Current file roles:

- `src/app/page.tsx` keeps the home page thin and compositional
- `src/components/recommendation-demo.tsx` contains the mock location, preferences, and recommendation UI flow
- `src/app/api/geocode/zip/route.ts` provides the server-side ZIP lookup endpoint
- `src/app/api/recommendations/route.ts` provides the server-side recommendation endpoint
- `src/lib/geocoding.ts` contains the Geocodio integration and local ZIP fallback behavior
- `src/lib/mock-market-data.ts` contains normalized mock market entities and price observations
- `src/lib/mock-recommendations.ts` contains the recommendation, shopping-plan, and scoring logic
- `src/lib/market-repository.ts` loads market records from Postgres first, then falls back to the seeded in-memory dataset
- `src/lib/db.ts` owns the shared Postgres connection pool
- `vitest.config.ts` and `vitest.setup.ts` define the local test harness
- `src/**/*.test.ts[x]` covers geocoding fallback, repository fallback/mapping, recommendation behavior, route validation, and a UI smoke path
- `db/init/001_schema.sql` defines the first PostgreSQL schema
- `db/init/002_seed.sql` seeds the database with the same local market concepts used by the mock app flow

This first slice is intentionally hybrid. The ZIP lookup boundary is real, and the market, pricing, and recommendation layers now read through a server-side repository boundary so the workflow can evolve one layer at a time:

- user constraints go in
- invalid input is stopped at the UI boundary
- ZIP input is resolved through `Geocodio` when configured, otherwise through a small local fallback set
- ZIP and radius inputs produce a nearby-store market snapshot
- Postgres-backed market data can be loaded behind the same recommendation flow when `DATABASE_URL` is configured
- seeded market data still works as a graceful fallback when the DB layer is unavailable
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

## Getting Started

### Prerequisites

- `Node.js` 20 or newer
- `npm`
- `Docker Desktop` or another working local PostgreSQL runtime if you want to exercise the DB-backed path locally

### Install dependencies

```bash
npm install
```

### Configure live ZIP lookup (optional)

```bash
copy .env.example .env.local
```

Then set:

```bash
GEOCODIO_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/yum4less_dev
```

If you skip this, the app still works with the seeded local ZIP fallback set used for the current MVP slice.
If you skip `DATABASE_URL`, the app still runs and simply uses the seeded market dataset instead of Postgres.

### Start the development server

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually [http://localhost:3000](http://localhost:3000) unless that port is already in use.

### Available commands

- `npm run dev` starts the Next.js development server
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run lint` runs ESLint across the project
- `npm test` runs the current Vitest suite
- `npm run test:watch` runs the tests in watch mode
- `npm run db:up` starts the local PostgreSQL container
- `npm run db:down` stops the local PostgreSQL container
- `npm run db:reset` recreates the local PostgreSQL volume and reapplies schema + seed data
- `npm run db:logs` tails the PostgreSQL container logs

### Start the local database

```bash
npm run db:up
```

This starts a local PostgreSQL container with:

- database: `yum4less_dev`
- user: `postgres`
- password: `postgres`
- port: `5433` on the host, mapped to `5432` inside the container

The schema and seed files in `db/init/` are applied automatically on first container initialization.

Docker Desktop is now installed and the local Postgres container can start successfully in this environment.

Yum4Less uses host port `5433` for the Dockerized Postgres instance because this machine already has another local `postgres.exe` listener on host port `5432`.

## Development Status

Yum4Less is past the planning-only stage and now has a runnable hybrid MVP slice plus a local database foundation. The current experience can already demonstrate:

- live ZIP resolution through `Geocodio` when configured
- seeded local ZIP fallback when `GEOCODIO_API_KEY` is not configured
- ZIP- and radius-based nearby-store discovery for a small local market
- budget, ingredient-count, dinner-count, shopping-style, and dietary filtering
- richer internal recipe records
- store-by-store shopping plans
- explicit score breakdowns for price fit, convenience, freshness, and filter fit
- recipe-step output and explanation-driven result cards
- a dismissible trust explainer plus card-level source/freshness labels
- a PostgreSQL schema that mirrors the normalized local market model
- a server-side repository layer that can load stores, recipes, and price observations from Postgres
- a local automated test harness for trust-sensitive logic and UI smoke coverage

The current experience is still hybrid and does not yet include:

- live store discovery
- map rendering
- real external pricing/provider ingestion
- recipe ingestion pipelines

What has been verified in the current scaffold:

- `npm run lint` passes
- `npm run build` passes
- `npm run dev` starts successfully
- `npm test` passes

The current experience now validates inputs, resolves ZIP codes through a server-side geocoding boundary, loads nearby-store, recipe, and price data through a server-side repository boundary, assembles shopping plans, and ranks meals using an explicit local scoring model.

The next implementation work should focus on replacing individual mock layers with real integrations without discarding the UI and data boundaries already established here.

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

### Phase 1: MVP foundation

- establish web application architecture
- implement browser geolocation and ZIP-based search
- support a limited local market
- normalize nearby store and pricing data
- create a curated dinner recipe library
- build recommendation logic for budget, ingredient count, dietary filters, and store preference
- add clear trust/provenance/fallback messaging before broadening live coverage

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

The most practical next steps are to keep the current hybrid flow intact while replacing the remaining non-production data layers one at a time:

1. Add CI around the new test harness for ranking, request validation, trust metadata, and DB-versus-seed fallback behavior.
2. Start live provider work with `Kroger`, then evaluate `Publix` and `Walmart` behind the same normalized source boundary.
3. Add maps and browser geolocation polish only after the core store/pricing/recommendation flow is stable.

That order keeps the product aligned with the MVP direction: keep the trustworthy dinner-planning workflow, then replace the remaining in-memory mock infrastructure behind it deliberately.


## Guiding Philosophy

Yum4Less is being built with a practical philosophy:

- start local
- stay security-conscious
- prefer clarity over unnecessary complexity
- keep the MVP useful and realistic
- expand only after the core workflow proves value

The objective is to create a durable product with strong consumer utility, attractive long-term positioning, and a disciplined technical foundation.
