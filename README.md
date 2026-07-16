# Yum4Less

Yum4Less helps people find **affordable dinner ideas** using nearby grocery stores, weekly-sale data, and practical filters (budget, dietary, single-store vs multi-store shopping). Ranked totals are **estimates** — verify in store before checkout.

**Beta v1** accepts continental US ZIP codes and browser geolocation. The map and store context work broadly; **ranked meal estimates** use **Kroger-family, Aldi, Publix, and Food Lion** when daily ingest and promotion gates pass (Tier C — map/context only — is normal for Walmart and other unsupported chains).

> **Other docs:** [`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md) — project history, [**redesign plan**](PROJECT_CONTINUITY.md#redesign--locked-plan-2026-06-25), decisions, verification snapshot · [`docs/redesign/redesign-analysis-handoff.md`](docs/redesign/redesign-analysis-handoff.md) — redesign slice handoff summary · [`AGENTS.md`](AGENTS.md) — Cursor agents, MCP, test gates · [Customer feedback](docs/feedback-path.md)

---

## Active redesign (2026-06-25)

**Slices 1–5** and shell **D1–D6** are **shipped**. Full locks and history → [`PROJECT_CONTINUITY.md` → Redesign plan](PROJECT_CONTINUITY.md#redesign--locked-plan-2026-06-25).

**What shipped:** Settings-first gate; **5-tab** bottom nav (Home, Deals, Cook, Saved, Settings); welcome **budget + dietary** → ingredients → tap rank → **stacked accordion** results; **merged** internal + TheMealDB ranking; store scope from Settings (**Kroger, Aldi, Publix, and Food Lion** dropdown); ingredient gate + category chips; map **link + overlay**; session pantry prompt; light/dark/system theme with **mockup Theme C/D tokens** (D7, 2026-06-26).

**Still deferred:** Saved persistence, cuisine filters (R11).

---

## Quick start (ZIP `23111`) — current UI

**Normal owner path:** Postgres + **daily live ingest** (scheduled scripts write retailer/OSM data; public APIs stay cache-only on reads).

```bash
npm install
# Copy .env.example → .env.local and set GEOCODIO_API_KEY + KROGER_CLIENT_ID + KROGER_CLIENT_SECRET
npm run setup:local   # .env.local, db:up, live scheduled ingest when keys are set
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **First visit:** complete **Settings** (location, radius, stores, theme) → **Home** welcome (budget, dietary) → ingredients → rank dinners. Returning visits with saved Settings open on **Home** when setup is complete.

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

*Redesign slices 1–5 + D1–D7 shipped — see [Active redesign](#active-redesign-2026-06-25) for deferred items.*

1. **Settings** (tab): ZIP and/or browser location, radius, shopping style, **Kroger / Aldi / Publix / Food Lion store** selection, theme — required on first visit or after factory reset.
2. **Home:** welcome budget + dietary → sale ingredients at selected stores (all-sale default or manual narrow) → tap rank.
3. Yum4Less discovers nearby stores (map overlay link on ingredients step) and scopes UI to **selected stores only**.
4. The recommendation engine ranks **merged** internal + TheMealDB recipes against ingested prices where gates allow.
5. Results show **Est.** totals, trust labels, and shopping plans in a **stacked accordion** (one card expanded at a time). **Cook** tab opens results when a rank session exists.

**v1 production-ranked chains:** Kroger family (official API + weekly-ad fallback), Aldi, Publix, and Food Lion (weekly-ad). Walmart and other unsupported chains remain map context only.

**Not shipped:** homelab hosting automation, user accounts, live checkout prices, Saved tab persistence, cuisine chips (R11).

Current snapshot and gaps → [`PROJECT_CONTINUITY.md` → Resume](PROJECT_CONTINUITY.md#resume-as-of-2026-06-25).

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

**Kroger:** set `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_API_ENV=production`; verify with `npm run probe:kroger-api`. Certification API omits store-specific prices.

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
| `npm run test:e2e` / `npm run test:e2e:ci` | Playwright browser suite — CI uses port **3100**; see [`e2e/README.md`](e2e/README.md) |
| `npm run db:up` / `db:down` / `db:reset` / `db:logs` | Local Postgres on host port **5433** |
| `npm run db:backup` / `db:restore` / `db:backup-restore-drill` | Logical `pg_dump`/`psql` backup + disposable restore drill (see [`docs/homelab-deploy.md`](docs/homelab-deploy.md) §4.4) |
| `npm run ingest:weekly-ads:fixture` | **CI/rehearsal only** — deterministic weekly ads → Postgres |
| `npm run ingest:weekly-ads` | Live weekly-ad fetch (HTTP + browser fallback) |
| `npm run ingest:weekly-ads:browser` | Force Playwright browser fetch |
| `npm run sync:provider-prices` | Sync official provider prices into `price_observations` |
| `npm run ingest:map-catalog` | **Cron primary** — OSM Overpass + Kroger-family Location API + nearest OSM Aldi + Publix locator context → Postgres `stores` rows; complements search-time ephemeral OSM merge |
| `npm run ingest:map-catalog:fixture` | Deterministic OSM-style map catalog for CI/rehearsal (ZIP 23111; skips live Kroger/Publix locators) |
| `npm run ingest:weekly-ads:scheduled` | **Daily cron wrapper** — map catalog → weekly-ad ingest → provider sync → TheMealDB import |
| `npm run ingest:weekly-ads:scheduled:fixture` | Rehearsal cron path (CI/tests — fixture weekly ads only) |
| `npm run probe:kroger-api` | Kroger OAuth + store pricing probe (owner-only, not CI) |
| `npm run probe:publix-api` | Publix store-locator probe (owner-only, not CI) |
| `npm run probe:kroger-live-scrape` | Kroger weekly-ad live scrape probe |
| `npm run probe:publix-live-scrape` | Publix weekly-ad live scrape probe |
| `npm run probe:walmart-live-scrape` | Walmart weekly-ad live scrape probe |
| `npm run probe:publix-live-ingest` | Publix live ingest rehearsal probe |

Live ingest chain-by-chain baseline → [`PROJECT_CONTINUITY.md` → Live weekly-ad baseline](PROJECT_CONTINUITY.md#live-weekly-ad-baseline-last-measured-2026-05-zip-23111).

### Daily pricing refresh (24-hour cache)

Public `/api/market-search` and `/api/recommendations` reads are **cache-only for ranked prices**: meal totals come from Postgres rows observed within the last **24 hours**. User searches do **not** call live Kroger pricing APIs or write new price rows. **Map pins** merge ingested Postgres stores, cached provider discovery, and (when pins within radius are sparse) ephemeral OpenStreetMap context via Overpass — merged in memory only unless you run ingest scripts.

Schedule one daily ingest on your host (homelab cron, Task Scheduler, etc.). **Set `YUM4LESS_INGEST_ZIPS` in `.env.local` to your real market ZIP(s)** — do not rely on the `23111` default (CI anchor only).

**Homelab/Linux step-by-step:** [`docs/homelab-deploy.md`](docs/homelab-deploy.md) (cron line, logs, Postgres freshness checks, pre-go-live gaps).

```bash
# Example: markets are usually set in .env.local, not inline
npm run ingest:weekly-ads:scheduled
```

That wrapper runs **map-catalog → weekly-ad ingest → SNAP ensure → `sync:provider-prices` → `ingest:themealdb:from-sales`** (after env guard + `ensure-test-db`). CI/rehearsal only: `npm run ingest:weekly-ads:scheduled:fixture`.

---

## Security (local beta)

May 2026 audit: no classic SQL injection / IDOR / BOLA; parameterized SQL throughout.

| Control | Summary |
|---------|---------|
| Read-only public APIs | No Postgres writes from `/api/recommendations` or `/api/market-search` unless `YUM4LESS_ENABLE_API_DB_WRITES=1` (blocked when `NODE_ENV=production`) |
| Response sanitization | Internal store/snapshot IDs stripped from public JSON |
| Shopping-route limits | Max 8 stops; bounded coordinates and labels |
| Geographic scope | Continental US bounds (`us-service-area.ts`) |
| Rate limiting | In-memory per-process; `TRUST_PROXY_HEADERS=1` for trusted proxy IP; optional edge `/api/*` throttle before multi-instance; Redis only when running multiple app instances |

**Dependency monitoring:** A moderate PostCSS advisory (`GHSA-qx2v-qp2m-jg93`, transitive via Next.js) is tracked via Dependabot and the weekly `dependency-watch` workflow — wait for an upstream Next.js fix; do **not** run `npm audit fix --force`.
| Security headers | X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| Analytics gate | Disabled by default; allowlisted, privacy-safe events only |

### Production deployment safety

| Setting | Local | Hosted |
|---------|-------|--------|
| `YUM4LESS_ENABLE_API_DB_WRITES` | Unset (opt-in for debug only) | **Never set** |
| `TRUST_PROXY_HEADERS` | Unset unless testing proxy | `=1` only with trusted reverse proxy |
| Rate limits | Fine for single process | Add edge/Redis limits before multi-instance |
| Postgres writes | Fixture/live ingest scripts | Schedule ingest; HTTP routes stay read-only |

Homelab scheduled-ingest wiring: [`docs/homelab-deploy.md`](docs/homelab-deploy.md). Full app TLS/reverse-proxy detail remains host-specific ([`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md)).

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

CI E2E uses port **3100** via `PLAYWRIGHT_FORCE_NEW_SERVER=1` (`npm run test:e2e:ci`) — no conflict with a local dev server on 3000. The committed suite covers happy-path ranking, geolocation-first Settings, multi-store selection, Tier C (mocked), API error panels, market pass-through, navigation/theme, and H11/H12 error surfaces (`e2e/README.md`).

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

- **Rankings:** internal Postgres recipe library **merged** with TheMealDB imports in one ranked list (scheduled ingest — cache-first, not live on every search).
- **Research only:** Spoonacular / Edamam — not in shopper UI.

---

## Development status

Runnable **local beta v1** with daily live ingest + Postgres — **not deployed**; homelab cron wiring documented, not yet owner-run in production. **Redesign slices 1–5 + D1–D7** shipped; **Saved persistence** and cuisine chips (R11) still deferred.

Verification snapshot (test counts, CI link) → [`PROJECT_CONTINUITY.md` → Appendix](PROJECT_CONTINUITY.md#appendix).

Roadmap, redesign detail, deferred backlog, and decision log → same file (do not duplicate here).
