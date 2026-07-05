# Yum4Less — Application overview

## What it is

Yum4Less is a beta v1 web app that helps people plan affordable dinners using nearby grocery stores, weekly-sale data, and filters for budget, dietary needs, and single-store vs multi-store shopping. Users set location (browser geolocation or ZIP), choose stores and sale ingredients, then get ranked dinner ideas with estimated totals and trust labels—not live checkout prices. Ranked meal estimates target Kroger-family, Aldi, Publix, and Food Lion when ingest and promotion gates pass; other chains (e.g. Walmart, BJ’s) appear as map context only.

## Core stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | Next.js 15 (App Router), React, TypeScript, CSS Modules / global CSS |
| **Backend** | Next.js route handlers, Zod request validation |
| **Database** | PostgreSQL (plain SQL in `db/init/`, no ORM), Docker Compose locally |
| **Maps** | Leaflet (client map UI) |
| **Tooling** | npm; Vitest (unit/integration); Playwright (e2e) |

## APIs and external services

### Yum4Less HTTP API (Next.js)

Public read-only routes (cache-first; ingest scripts are the write path):

| Route | Purpose |
|-------|---------|
| `POST /api/market-search` | Nearby stores, sale ingredients, map context, provider coverage |
| `POST /api/recommendations` | Rank dinners from selected stores, budget, and ingredients |
| `POST /api/geocode/zip` | ZIP → coordinates (continental US) |
| `POST /api/shopping-route` | Multi-store stop ordering for a shopping plan |
| `POST /api/analytics/events` | Optional first-party analytics (off by default) |
| `POST /api/feedback` | Optional customer feedback (feature-flagged) |
| `GET /api/debug/pipeline` | Local dev only — ingest/freshness debug |

### Location

| Service | Role |
|---------|------|
| **Browser Geolocation API** | Primary shopper location (coordinates) |
| **Geocodio** | ZIP and address geocoding (`GEOCODIO_API_KEY`; seed ZIP fallback in dev when unset) |

### Grocery — store discovery & pricing

| Service | Role | Chains / notes |
|---------|------|----------------|
| **Kroger Developer API** (`api.kroger.com`) | OAuth, store Location API, product search with `locationId` | Kroger-family; production env for store-specific prices |
| **Publix store locator** | Website locator sync (no public developer API) | Publix map/catalog bootstrap |
| **Apify** (optional) | Third-party Publix product/weekly-ad research actor | Optional; not required for v1 locator path |
| **Walmart API** | Scaffold only | Credentials in `.env.example`; ranked pricing not shipped |
| **OpenStreetMap Overpass** | Ephemeral map-context pins + scheduled map-catalog ingest | Kroger, Aldi, Food Lion, BJ’s, independents, etc. |
| **USDA SNAP retailer data** (optional CSV) | Batch reference pins labeled “SNAP context” | Not ranked pricing |

### Grocery — weekly ads & sale discovery

| Service | Role | Chains |
|---------|------|--------|
| **Flipp syndicated feed** | Weekly-ad offer discovery when direct scrape is weak | Kroger-family, Food Lion, others |
| **Chain weekly-ad page scrape** | Browser/HTTP parsers for ad HTML | Kroger-family, Aldi, Publix, Food Lion |
| **Kroger product API** (fallback) | Partial last-resort fill when scrape + Flipp return nothing | Kroger only; not full ad coverage |

Ingest runs via scheduled scripts (`npm run ingest:weekly-ads:scheduled`, `ingest:map-catalog`, `sync:provider-prices`) — not on every user search.

### Recipes

| Service | Role |
|---------|------|
| **Internal recipe library** | Primary ranking catalog (curated in-repo) |
| **TheMealDB** | Sale-driven recipe import merged into rankings (`THEMEALDB_API_KEY`; cron/script path) |
| **Spoonacular / Edamam** | Research only — not wired to user-facing ranking |

### Research / ops (not app runtime)

| Service | Role |
|---------|------|
| **GitHub API** | CI workflow inspection (Cursor MCP / `gh`) |
| **Semgrep** | Security/dependency scans in CI and local hooks |

Env var reference → [`.env.example`](../.env.example) · integration pattern → [`provider-integration-pattern.md`](provider-integration-pattern.md)

**See also:** [`README.md`](../README.md) (setup and commands) · [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) (current status)
