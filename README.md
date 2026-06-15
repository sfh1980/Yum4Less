# Yum4Less

Yum4Less helps people find **affordable dinner ideas** using nearby grocery stores, weekly-sale data, and practical filters (budget, ingredient count, one-store vs multi-store). Ranked totals are **estimates** — verify in store before checkout.

**Beta v1** accepts continental US ZIP codes and browser geolocation. The map and store context work broadly; **ranked meal estimates for production deploy** focus on **Kroger-family and Aldi** when daily ingest and promotion gates pass (Tier C — map/context only — is normal elsewhere). Publix, Food Lion, Walmart, and other chains may appear on the map; ranked pricing for them is planned in **upcoming releases**.

> **Other docs:** [`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md) — project history, decisions, verification snapshot · [`AGENTS.md`](AGENTS.md) — Cursor agents, MCP, test gates · [Customer feedback](docs/feedback-path.md)

---

## Quick start (ZIP `23111`)

**Normal owner path:** Postgres + **daily live ingest** (scheduled scripts write retailer/OSM data; public APIs stay cache-only on reads).

```bash
npm install
# Copy .env.example → .env.local and set GEOCODIO_API_KEY + KROGER_CLIENT_ID + KROGER_CLIENT_SECRET
npm run setup:local   # .env.local, db:up, live scheduled ingest when keys are set
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → ZIP **23111** → find nearby stores → rank dinners.

If port **3000** is already in use, start the app on another port and point Playwright or your browser at it:

```bash
npm run dev -- -p 3001
# Browser: http://localhost:3001
# Playwright against an already-running dev server:
# PowerShell: $env:PORT="3001"; $env:PLAYWRIGHT_SKIP_WEBSERVER="1"; $env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:3001"; npm run test:e2e
```

**Manual equivalent (live):** `npm run db:up` → copy `.env.example` to `.env.local` with keys → `npm run ingest:weekly-ads:scheduled` → `npm run dev`.

**Without live ingest keys:** `setup:local` starts Postgres only. Run `npm run ingest:weekly-ads:scheduled` after adding keys, or use **CI/rehearsal** fixture ingest (`npm run ingest:weekly-ads:fixture`) — deterministic tests only, not the daily owner workflow.

Without Postgres + ingest, ranked pricing stays empty and map pins remain bootstrap seed coordinates.

### Prerequisites

- Node.js 20+
- npm
- Docker Desktop (or compatible runtime) for Postgres-backed demo

---

## What the app does today

1. User enters ZIP and/or shares browser location and chooses a radius.
2. Yum4Less resolves location, discovers nearby stores, and shows them on a Leaflet map.
3. User sets meal preferences (budget, filters, store preference).
4. The recommendation engine ranks curated internal recipes against ingested prices where gates allow.
5. Results show **Est.** totals, trust labels, shopping plans, and recipe steps in a swipe carousel.

**v1 production-ranked chains:** Kroger family (official API + weekly-ad fallback) and Aldi (weekly-ad / Flipp). Publix, Food Lion, Walmart, and others may appear on the map as context; ranked pricing for them is **planned in upcoming releases** (not the current production deploy focus).

**Not shipped:** homelab hosting automation, user accounts, live checkout prices.

Current snapshot and gaps → [`PROJECT_CONTINUITY.md` → Resume](PROJECT_CONTINUITY.md#resume-as-of-2026-06-08).

---

## Stack

- Next.js, TypeScript, CSS Modules / global CSS
- PostgreSQL (plain SQL in `db/init/`, no ORM)
- Leaflet + Geocodio (or seed ZIP fallback when `GEOCODIO_API_KEY` is unset)
- npm

---

## Trust and data policy

Ranked pricing trust order:

1. Official/public API prices when strongly store-matched (Kroger production API).
2. Unexpired weekly-ad observations in Postgres.
3. Website-scraped sale data (lower trust labels).
4. Cached, stale, or sparse data — **directional** only.
5. Fixture/rehearsal data — **CI and automated tests only**, never daily owner workflow or live pricing claims.

Expired sale rows stay in `price_observations` as history; unchanged sales with extended end dates refresh `valid_through` instead of duplicating rows.

**Kroger:** set `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_API_ENV=production`; verify with `npm run test:kroger-api`. Certification API omits store-specific prices.

**Analytics:** first-party, off by default; rejects raw ZIPs, coordinates, prices, and meal titles. **Feedback:** `/feedback` when `YUM4LESS_FEEDBACK_ENABLED=1` — see [`docs/feedback-path.md`](docs/feedback-path.md).

**Semgrep:** CI runs `semgrep ci` when the GitHub repository secret `SEMGREP_APP_TOKEN` is set (Settings → Secrets → Actions). Local Cursor hooks use the optional `semgrep` CLI — not the same token. Lint, unit tests, build, integration, and E2E remain merge gates.

---

## Environment

Copy `.env.example` → `.env.local`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (`postgresql://postgres:postgres@localhost:5433/yum4less_dev`) |
| `GEOCODIO_API_KEY` | Live ZIP geocoding (continental US); omit for seed ZIP fallback |
| `KROGER_*` | Kroger OAuth + store/pricing API |
| `YUM4LESS_KROGER_LOCATION_SEARCH_LIMIT` | Kroger Location API store search cap for map-catalog ingest (default 25, max 50) |
| `YUM4LESS_INGEST_ZIPS` | Comma-separated ZIPs for scheduled ingest (`sync:provider-prices`, `ingest:map-catalog`) |
| `YUM4LESS_ENABLE_API_DB_WRITES` | Local dev only — allow public API Postgres writes (**never in production**) |
| `TRUST_PROXY_HEADERS` | `=1` only behind a trusted reverse proxy |
| `NEXT_PUBLIC_YUM4LESS_ANALYTICS` + `YUM4LESS_ENABLE_ANALYTICS` | Both required to record events |
| `YUM4LESS_FEEDBACK_ENABLED` | Enable `/feedback` (requires `db/init/007_customer_feedback.sql`) |

Full list and ingest flags → `.env.example`.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run setup:local` | First-run: `.env.local`, `db:up`, SNAP auto-ensure when enabled, live scheduled ingest when keys set |
| `npm run dev` | Development server (auto-ensures SNAP context when `YUM4LESS_MAP_SNAP_CONTEXT=1` and table is empty) |
| `npm run ensure:snap-context` | Idempotent SNAP load — skips when rows exist; use `--force` to re-ingest |
| `npm run dev:clean` | Clear `.next` then dev (after build/webpack glitches) |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (mocked DB) |
| `npm run test:integration` | Postgres integration tests (starts Docker if needed) |
| `npm run test:integration:reset` | Recreate DB volume, then integration tests |
| `npm run test:all` | Unit + integration |
| `npm run test:e2e` / `npm run test:e2e:ci` | Playwright (CI uses port **3100**) |
| `npm run db:up` / `db:down` / `db:reset` / `db:logs` | Local Postgres on host port **5433** |
| `npm run ingest:weekly-ads:fixture` | **CI/rehearsal only** — deterministic weekly ads → Postgres |
| `npm run ingest:weekly-ads` | Live weekly-ad fetch (HTTP + browser fallback) |
| `npm run ingest:weekly-ads:browser` | Force Playwright browser fetch |
| `npm run sync:provider-prices` | Sync official provider prices into `price_observations` |
| `npm run ingest:map-catalog` | **Cron primary** — OSM Overpass + Kroger-family Location API + nearest OSM Aldi + Publix locator context → Postgres `stores` rows; complements search-time ephemeral OSM merge |
| `npm run ingest:map-catalog:fixture` | Deterministic OSM-style map catalog for CI/rehearsal (ZIP 23111; skips live Kroger/Publix locators) |
| `npm run ingest:weekly-ads:scheduled` | **Daily cron wrapper** — weekly-ad ingest + map catalog + provider sync + TheMealDB import |
| `npm run ingest:weekly-ads:scheduled:fixture` | Rehearsal cron path (CI/tests — fixture weekly ads only) |
| `npm run test:kroger-api` | Kroger OAuth + store pricing probe |
| `npm run test:publix-api` | Publix store-locator probe |

Live ingest chain-by-chain baseline → [`PROJECT_CONTINUITY.md` → Live weekly-ad baseline](PROJECT_CONTINUITY.md#live-weekly-ad-baseline-last-measured-2026-05-zip-23111).

### Daily pricing refresh (24-hour cache)

Public `/api/market-search` and `/api/recommendations` reads are **cache-only for ranked prices**: meal totals come from Postgres rows observed within the last **24 hours**. User searches do **not** call live Kroger pricing APIs or write new price rows. **Map pins** merge ingested Postgres stores, cached provider discovery, and (when pins within radius are sparse) ephemeral OpenStreetMap context via Overpass — merged in memory only unless you run ingest scripts.

Schedule one daily ingest on your host (homelab cron, Task Scheduler, etc.):

```bash
# Example: run at 03:00 local time with markets you want warm
YUM4LESS_INGEST_ZIPS=23111,30301 npm run ingest:weekly-ads:scheduled
```

That wrapper runs `ensure-test-db` → weekly-ad ingest → `ingest:map-catalog` → `sync:provider-prices` → `ingest:themealdb:from-sales`. CI/rehearsal only: `npm run ingest:weekly-ads:scheduled:fixture`.

---

## Security (local beta)

May 2026 audit: no classic SQL injection / IDOR / BOLA; parameterized SQL throughout.

| Control | Summary |
|---------|---------|
| Read-only public APIs | No Postgres writes from `/api/recommendations` or `/api/market-search` unless `YUM4LESS_ENABLE_API_DB_WRITES=1` (blocked when `NODE_ENV=production`) |
| Response sanitization | Internal store/snapshot IDs stripped from public JSON |
| Shopping-route limits | Max 8 stops; bounded coordinates and labels |
| Geographic scope | Continental US bounds (`us-service-area.ts`) |
| Rate limiting | In-memory per-process; `TRUST_PROXY_HEADERS=1` for trusted proxy IP |
| Security headers | X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| Analytics gate | Disabled by default; allowlisted, privacy-safe events only |

### Production deployment safety

| Setting | Local | Hosted |
|---------|-------|--------|
| `YUM4LESS_ENABLE_API_DB_WRITES` | Unset (opt-in for debug only) | **Never set** |
| `TRUST_PROXY_HEADERS` | Unset unless testing proxy | `=1` only with trusted reverse proxy |
| Rate limits | Fine for single process | Add edge/Redis limits before multi-instance |
| Postgres writes | Fixture/live ingest scripts | Schedule ingest; HTTP routes stay read-only |

Hosting provider steps are not documented yet — homelab deploy is deferred ([`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md)).

---

## Troubleshooting

### Port 3000 in use (Windows)

Port **3000** is the default; another process (or a second dev server) may already be listening. Either free the port or use a different one:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run dev
```

**Or keep the other process and use another port:**

```powershell
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001). For Playwright or Playwright MCP against that server:

```powershell
$env:PORT = "3001"
$env:PLAYWRIGHT_SKIP_WEBSERVER = "1"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3001"
npm run test:e2e
```

CI E2E uses port **3100** via `PLAYWRIGHT_FORCE_NEW_SERVER=1` (`npm run test:e2e:ci`) — no conflict with a local dev server on 3000.

### Missing provider snapshot tables

If errors mention `provider_store_search_snapshots` or `provider_product_pricing_snapshots`, the Docker volume may predate `db/init/003`–`004`:

```bash
npm run db:reset
```

Back up any local ingest rows you care about first — reset wipes the volume.

### Integration tests and Docker

Integration tests use port **5433** and run `db:up` when needed. Force a fresh volume: `npm run test:integration:reset`. Local stale-seed reset is not automatic unless you pass `--reset`, set `YUM4LESS_TEST_DB_RESET=1`, or `YUM4LESS_ALLOW_DB_RESET=1`.

### Cursor agents and MCP

Agent checklists, Playwright MCP flow, and MCP setup → [`AGENTS.md`](AGENTS.md). Copy `.cursor/mcp.json.example` → `.cursor/mcp.json` locally; never commit tokens.

---

## Recipe sources

- **Rankings:** internal Postgres recipe library only
- **Research:** TheMealDB dev import (`npm run ingest:themealdb:from-sales`), Spoonacular/Edamam — not selectable in UI yet

---

## Development status

Runnable **local beta v1** with daily live ingest + Postgres — **not deployed**; homelab cron wiring documented, not yet owner-run in production.

Verification snapshot (test counts, CI link) → [`PROJECT_CONTINUITY.md` → Appendix](PROJECT_CONTINUITY.md#appendix).

Roadmap, deferred backlog, and decision log → same file (do not duplicate here).
