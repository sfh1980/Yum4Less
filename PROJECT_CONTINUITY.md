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
- project rules tuned to Yum4Less
- project hooks for README and package-command review
- project agents specialized for frontend, backend, database, testing, audit, and verification

Important rule themes:
- keep the MVP local and focused
- preserve security-first dependency discipline
- keep the `README` accurate and investor-ready
- keep MCP adoption lean and phased
- keep personalized educational notes in the private notes file only

## MCP Strategy

The current MCP direction is deliberately conservative:
- do not add MCPs just because they exist
- use Cursor native tools first where they are already efficient
- keep the active MCP set small

Planned MCP order:
1. read-only `PostgreSQL` MCP once a dev database exists
2. `GitHub` MCP once PR/CI/issues become active enough to justify it
3. consider `Playwright MCP` only after comparing it against Cursor’s native Browser tool on real UI flows

Later candidates only if needed:
- `Postman MCP`
- `Context7`
- `Sentry MCP`
- hosted browser MCPs such as Browserbase

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
- server-side recommendation reads that prefer Postgres and fall back to seeded in-memory market data
- a richer internal mock recipe dataset with structured meal metadata
- reusable recommendation, shopping-plan, and scoring logic
- store-by-store shopping-plan output
- recipe-step output and score breakdowns in the recommendation cards
- a dismissible trust explainer and clearer source/freshness labels in the results UI
- custom styling
- private learning notes file ignored by git
- repo-local rules and agent guidance tightened around MVP direction, trust/fallback behavior, and testing expectations
- a local Vitest harness covering geocoding fallback, repository behavior, route validation, recommendation behavior, and a UI smoke path

Current file roles:
- `src/app/page.tsx` keeps the top-level page simple
- `src/components/recommendation-demo.tsx` contains the mock location, preference, and recommendation UI flow
- `src/app/api/geocode/zip/route.ts` exposes the server-side ZIP lookup endpoint
- `src/app/api/recommendations/route.ts` exposes the server-side recommendation endpoint
- `src/lib/geocoding.ts` contains the Geocodio integration and local ZIP fallback behavior
- `src/lib/mock-market-data.ts` contains normalized mock market entities and price observations
- `src/lib/mock-recommendations.ts` contains the isolated recommendation, shopping-plan, and scoring logic
- `src/lib/market-repository.ts` loads stores, recipes, and price observations from Postgres first, then falls back to the seeded in-memory dataset
- `src/lib/db.ts` manages the shared Postgres connection pool
- `db/init/001_schema.sql` defines the first PostgreSQL schema
- `db/init/002_seed.sql` seeds the local database with the current market model
- `docker-compose.yml` provides the local Postgres dev container

This slice uses a real ZIP boundary plus a server-side repository boundary on purpose to prove:
- input -> ranking -> result explanation flow
- invalid input is blocked before recommendations are ranked
- ZIP and radius inputs can drive a nearby-store discovery layer
- the location boundary can be swapped to live geocoding without breaking the rest of the workflow
- normalized market records can be transformed into shopping plans
- the same normalized market records can now be represented in a local PostgreSQL schema and read back through application code
- richer recipe records can be transformed into user-facing recommendation cards
- separation of page, component, and logic layers
- a trustworthy recommendation presentation model before adding live integrations

Approved MVP direction:
- keep the MVP no-login and hard-limited to the initial local area around ZIP `23111`
- determine location from browser geolocation and/or ZIP
- choose a radius and show nearby stores before asking for deeper meal constraints
- prioritize live-chain work in this order: `Kroger`, then `Publix`, then `Walmart`
- keep `Aldi` and `BJ's` as later targets unless reprioritized
- use official APIs first, reputable third-party sources second, and only then carefully reviewed web collection
- show unsupported chains as coming soon or disabled with explanation
- hide chains from recommendation pricing until sale and price coverage is strong enough
- explain source, freshness, fallback, and estimate quality clearly in the UI
- keep maps important, but land them after the core store/pricing/recommendation flow stabilizes

## Verification State

At the time this file was created:
- `npm run lint` passes
- `npm run build` passes
- `npm test` passes
- `GitHub CLI` was installed with `winget`, but the current shell session has not yet picked up the new PATH
- `GitHub CLI` is now available in the shell
- `Docker Desktop` is now available in the shell
- the local Postgres container starts and reaches a healthy state with schema + seed data applied
- host port `5432` is already occupied on this machine by a separate local `postgres.exe` listener, so Yum4Less Docker Postgres was moved to host port `5433`

Near-term implementation direction after the approved MVP-direction update:
- add CI around ranking, validation, trust metadata, and DB-versus-seed fallback behavior
- start live provider work with `Kroger`, then evaluate `Publix` and `Walmart`
- refine score weights only after live data makes recommendation tradeoffs more meaningful
- add maps and browser geolocation polish only after the real location and store layers stabilize

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

## How To Use This File In Future Chats

Future chats should use this file as a continuity summary, not as immutable truth.

Before making new decisions, future chats should:
1. compare this file against the actual repository state
2. update this file if major project direction changes
3. avoid duplicating this content across multiple continuity files

If the project evolves significantly, this file should be updated rather than replaced with multiple competing summaries.
