# Homelab deploy — scheduled ingest runbook

Copy-paste guide for a **dedicated Linux box** running Postgres, the Yum4Less app, and **daily live ingest** via cron. Assumes a generic Linux host with **Docker** and **Node.js** — not a specific distro or hardware profile.

**Scope:** wiring `npm run ingest:weekly-ads:scheduled` to run unattended. App hosting (`next start`, reverse proxy, TLS) is outlined briefly; ingest is the focus.

**Related:** [`README.md`](../README.md) (commands), [`.env.example`](../.env.example) (env truth), [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) (product scope), [`docs/provider-integration-pattern.md`](provider-integration-pattern.md) (chain data paths).

---

## What the scheduled wrapper does

`npm run ingest:weekly-ads:scheduled` runs `scripts/run-scheduled-weekly-ad-ingest.mjs` in this **fixed order** (see `src/lib/scheduled-ingest-pipeline.ts`):

| Step | Command / script | Fatal on failure? |
|------|------------------|-------------------|
| 1. Env guard (live only) | `scripts/assert-live-ingest-env.ts` | **Yes** — missing keys |
| 2. Postgres prep | `scripts/ensure-test-db.mjs` | **Yes** — Docker/DB/schema |
| 3. Map catalog | `npm run ingest:map-catalog` | **No** — logs warning, continues |
| 4. Weekly-ad ingest | `scripts/ingest-weekly-ads.ts` | **Yes** if all chains error or DB persist failures |
| 5. SNAP ensure | `scripts/ensure-snap-context.mjs` | **No** — warning only |
| 6. Kroger official sync | `npm run sync:provider-prices` | **Yes** |
| 7. TheMealDB import | `npm run ingest:themealdb:from-sales` | **Yes** if script throws |

**Not the CI path:** `npm run ingest:weekly-ads:scheduled:fixture` — deterministic rehearsal only; do not use on the homelab cron.

---

## 1. Prerequisites

### Software

| Requirement | Notes |
|-------------|--------|
| **Node.js 22.x LTS** (or current repo-supported LTS) | `node -v` on the cron user. No `engines` pin in `package.json`; match dev CI. |
| **npm** | Bundled with Node. |
| **Docker Engine + Compose plugin** | `ensure-test-db.mjs` expects container `yum4less-postgres` from repo `docker-compose.yml`. |
| **Git** | Clone the repo; cron runs from repo root. |
| **Playwright Chromium** (recommended before first live ingest) | Kroger/Publix/Walmart use headless browser fallbacks when Flipp/HTTP is empty. After `npm ci`: `npx playwright install chromium` and on Linux typically `npx playwright install-deps chromium` (or install distro libs Playwright documents). |

### Network egress (outbound HTTPS)

Cron has no TTY; scripts must reach:

| Target | Used for |
|--------|----------|
| `api.geocodio.com` | ZIP → coordinates (`GEOCODIO_API_KEY`) |
| `api.kroger.com` (production) | Location + product pricing (`KROGER_*`, `KROGER_API_ENV=production`) |
| Flipp syndicated feed | Aldi, Food Lion, Kroger weekly-ad primary tier |
| Chain weekly-ad / retailer sites | Browser/HTTP scrape fallbacks (403/WAF possible) |
| `overpass-api.de` / `overpass.kumi.systems` | Map catalog OSM ingest |
| `www.themealdb.com` | Sale-driven recipe import (dev/test key in `.env.example`) |

No inbound ports required for ingest itself. Postgres default `5433:5432` is localhost-only unless you expose it deliberately.

### File system

- Cron user needs **read** on repo + `.env.local`, **write** on Docker volume `postgres-data`, and permission to run `docker` (usually membership in the `docker` group).
- Create a log directory the cron user owns, e.g. `/var/log/yum4less/` or `~/logs/yum4less/`.

---

## 2. First-time host setup

### 2.1 Clone and install

```bash
git clone <your-repo-url> /opt/yum4less   # choose your path
cd /opt/yum4less
npm ci
npx playwright install chromium
# Linux only — system libraries for headless Chromium:
npx playwright install-deps chromium
```

### 2.2 Start Postgres (persistent volume)

```bash
cd /opt/yum4less
npm run db:up
docker ps --filter name=yum4less-postgres
```

Schema is applied from `db/init/` on first container start. `ensure-test-db.mjs` also applies missing migration files on later runs.

**Decision:** This runbook assumes **Docker Compose Postgres** on the same box. A standalone Postgres install works if `DATABASE_URL` points at it, but `ensure-test-db.mjs` still tries to manage the Docker container — see [Pre-go-live gaps](#pre-go-live-gaps-flag-dont-fix-in-this-pass) below.

### 2.3 Configure `.env.local`

```bash
cp .env.example .env.local
chmod 600 .env.local
```

Edit `.env.local`. **Required for live scheduled ingest** (enforced by `assert-live-ingest-env.ts`):

| Variable | Purpose |
|----------|---------|
| `GEOCODIO_API_KEY` | Geocode ingest ZIP markets |
| `KROGER_CLIENT_ID` | Kroger OAuth |
| `KROGER_CLIENT_SECRET` | Kroger OAuth |

**Strongly recommended for ranked Kroger official-online path:**

| Variable | Purpose |
|----------|---------|
| `KROGER_API_ENV=production` | Without this, `sync:provider-prices` skips writing official Kroger prices (certification mode). Weekly-ad prices can still rank when gates pass. |

**Database:**

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/yum4less_dev` |

**Your actual market(s) — do not leave default:**

| Variable | Purpose |
|----------|---------|
| `YUM4LESS_INGEST_ZIPS` | Comma-separated **5-digit ZIPs** for map catalog, weekly-ad scope, and provider sync. |

> **Important:** If `YUM4LESS_INGEST_ZIPS` is unset or invalid, code falls back to `YUM4LESS_PROVIDER_SYNC_ZIP` or **`23111`** (Mechanicsville, VA — CI/E2E anchor). That is fine for development; it is **wrong** for a homelab serving your real geography. Set your real ZIP(s) before enabling cron.

Example (replace with your markets):

```bash
YUM4LESS_INGEST_ZIPS=23220,23221
```

Optional tuning (see `.env.example` for full list):

- `YUM4LESS_PROVIDER_SYNC_RADIUS_MILES=8` — weekly-ad store radius per ZIP
- `YUM4LESS_MAP_CATALOG_RADIUS_MILES=12` — OSM / locator discovery radius
- `YUM4LESS_MAP_SNAP_CONTEXT=1` — SNAP context pins (non-fatal ensure step)
- `THEMEALDB_API_KEY=1` — dev/test key; replace for production Patreon key when applicable

**App production (when you serve the UI from this box):**

- `NODE_ENV=production`
- Do **not** set `YUM4LESS_ENABLE_API_DB_WRITES=1` on a public host
- Set `TRUST_PROXY_HEADERS=1` only behind a trusted reverse proxy

Child ingest scripts call `loadEnvLocal()` when they start, so cron does **not** need to `export` every key **if** it runs from the repo root and `.env.local` exists. The env guard still runs in a child process first; keeping `.env.local` complete is the reliable approach.

### 2.4 One manual dry run (before cron)

```bash
cd /opt/yum4less
npm run ingest:weekly-ads:scheduled 2>&1 | tee /tmp/yum4less-ingest-first-run.log
echo "Exit code: $?"
```

Expect a trailing line:

```text
[<ISO timestamp>] Scheduled pricing ingest completed.
```

Investigate any **non-zero exit code** before scheduling cron.

Optional probes (interactive diagnostics, not cron gates):

```bash
npm run probe:kroger-api
```

---

## 3. Cron setup

### 3.1 Wrapper script (recommended)

Cron environments have minimal `PATH`. Use a small wrapper:

```bash
sudo mkdir -p /var/log/yum4less
sudo chown "$USER:$USER" /var/log/yum4less

cat > /opt/yum4less/scripts/cron-ingest.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
REPO="/opt/yum4less"          # <-- change if needed
LOG_DIR="/var/log/yum4less"
mkdir -p "$LOG_DIR"
cd "$REPO"
# Optional: load nvm — uncomment and set if Node is not on default PATH
# export NVM_DIR="$HOME/.nvm"
# . "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
/usr/bin/npm run ingest:weekly-ads:scheduled >> "$LOG_DIR/ingest.log" 2>&1
EOF
chmod +x /opt/yum4less/scripts/cron-ingest.sh
```

Adjust `REPO`, `npm` path (`which npm`), and nvm lines for your host.

### 3.2 Crontab line

Run daily at **03:00 local time** (after typical weekly-ad publish windows; adjust for your timezone):

```cron
0 3 * * * /opt/yum4less/scripts/cron-ingest.sh
```

Install: `crontab -e`

**Mail:** If cron mail is unset, failures only appear in the log file — monitor the log (below).

### 3.3 Log rotation

Prevent unbounded growth on a 24/7 box. Example `/etc/logrotate.d/yum4less`:

```
/var/log/yum4less/*.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    copytruncate
}
```

`copytruncate` avoids fighting an open file handle from a long-running redirect. Alternatively rotate daily with `rotate 14` if you want finer granularity.

---

## 4. Verify ingest health

Ranked meal reads and weekly-ad promotion gates both use a **24-hour** freshness window (`src/lib/ranked-price-cache-policy.ts`, `src/lib/weekly-ad-ingestion/weekly-ad-coverage.ts`). For the UI, you care about **< 24 hours** since the last successful write. `weeklyAdIngestionStatus` reports **all-time** row counts only — not freshness; compare with promotion readiness when diagnosing stale ingest.

### 4.1 Quick log check

```bash
tail -n 80 /var/log/yum4less/ingest.log
grep -E 'Starting scheduled|completed|failed|error|Exit' /var/log/yum4less/ingest.log | tail -20
```

Success signature: `Scheduled pricing ingest completed.`  
Failure signature: non-zero exit (if wrapper uses `set -e`), or lines like `Scheduled ingest failed during ...`.

### 4.2 Postgres — freshness by source

```bash
docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
SELECT
  source_name,
  COUNT(*) AS obs_rows,
  COUNT(DISTINCT ingredient_id) AS unique_ingredients,
  MAX(observed_at) AS newest_observed_at,
  ROUND(EXTRACT(EPOCH FROM (now() - MAX(observed_at))) / 3600, 1) AS hours_ago
FROM price_observations
WHERE in_stock = true
  AND (source_name LIKE '%weekly-ad-scrape' OR source_name = 'kroger-official-api')
GROUP BY source_name
ORDER BY newest_observed_at DESC;
"
```

**Healthy homelab (ranked v1 chains):** `kroger-weekly-ad-scrape`, `aldi-weekly-ad-scrape`, and/or `kroger-official-api` rows with `hours_ago` **< 24** after the cron window.

Per-store check near your ingest ZIP:

```bash
docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
SELECT
  s.id,
  s.name,
  po.source_name,
  COUNT(DISTINCT po.ingredient_id) AS unique_ingredients,
  MAX(po.observed_at) AS newest
FROM stores s
JOIN price_observations po ON po.store_id = s.id AND po.in_stock = true
WHERE po.source_name LIKE '%weekly-ad-scrape'
GROUP BY s.id, s.name, po.source_name
ORDER BY newest DESC
LIMIT 20;
"
```

### 4.3 One-liner “is ranked data fresh?”

```bash
docker exec yum4less-postgres psql -U postgres -d yum4less_dev -t -c "
SELECT CASE
  WHEN COUNT(*) FILTER (WHERE coalesce(last_verified_at, observed_at) >= now() - interval '24 hours') > 0
  THEN 'OK: fresh ranked observations exist'
  ELSE 'STALE: no ranked observations in last 24h'
END
FROM price_observations
WHERE source_kind IN ('weekly-ad', 'official-online')
  AND in_stock = true;
"
```

Run this **after 03:30** on the day following first cron, or after a manual ingest.

---

## 5. When ingest silently stops working

There is **no dedicated in-app “ingest heartbeat”** today. Symptoms overlap with a genuinely thin weekly ad week:

| What you see | Possible cause |
|--------------|----------------|
| Ranked stores flip to **context only** / empty sale-ingredient list | No observations within **24h** SQL filter |
| Same UI as a **thin sale week** (few ingredients on ad) | Cron failed **or** ad simply has few dinner SKUs |
| `ingest.log` stops growing | Cron not installed, wrong path, or permission error |
| Log shows `Live scheduled ingest requires ...` | Missing `.env.local` keys for cron user |
| Log shows `Docker is not available` | Docker down or cron user not in `docker` group |
| Log shows `Local Postgres seed looks stale` | Schema drift after `git pull`; needs one-time `npm run db:reset` or manual migration (see gaps) |
| Map catalog warnings, weekly-ad continues | OSM Overpass timeout — ranked path may still work from Flipp |
| `sync:provider-prices` wrote 0 Kroger API rows | `KROGER_API_ENV` not `production`, store mapping, or weak product match — weekly-ad may still rank |

**Until a product slice adds ingest-health signaling**, treat **log monitoring + Postgres freshness queries** (§4) as the owner workflow. Check logs at least weekly; automate the SQL check with a simple external script or monitoring hook if desired.

### Known product gap (do not fix in this pass)

**Stale data vs thin data:** The app does not clearly distinguish “cron has not run / observations aged out” from “ingest ran but this week’s ad has few matched dinner ingredients.” Both can present as limited ranked coverage or empty sale-ingredient pickers with generic daily-refresh copy (`RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE`). After cron has run successfully for a few weeks, if freshness SQL says OK but coverage is still thin, trust the **thin week** explanation; if SQL says STALE, fix **operations** first.

**Future slice candidate:** ingest heartbeat / last-success timestamp surfaced in admin or `shopperNotice` when ranked reads are empty due to cache miss vs filter-empty.

---

## 6. App on the same box (brief)

After ingest is reliable:

```bash
cd /opt/yum4less
npm run build
NODE_ENV=production npm run start   # default port 3000
```

Use a reverse proxy (Caddy, nginx) for TLS. Set `TRUST_PROXY_HEADERS=1` only when the proxy strips client `X-Forwarded-For`. Continental US ZIP search in production requires `GEOCODIO_API_KEY` in `.env.local`.

Process supervision (systemd, pm2) is host-specific — pick one and restart on boot.

---

## 7. Production-ranked scope reminder

As of this doc, **shopper-facing ranked meal totals** use **Kroger family, Aldi, Publix, and Food Lion** when weekly-ad (or Kroger official API) promotion gates pass. Walmart remains context-only. See [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) Decision log.

---

## Pre-go-live gaps (flag — don’t fix in this pass)

Issues to resolve **before** relying on unattended cron:

| Gap | Risk under cron | Mitigation until code changes |
|-----|-----------------|-------------------------------|
| **`ensure-test-db.mjs` requires Docker** | Cron fails if Docker stopped or user lacks permission | `restart: unless-stopped` on compose; add cron user to `docker` group; consider a second cron line `*/5 * * * * cd /opt/yum4less && docker compose up -d db` |
| **Stale schema detection throws** (no auto-reset without `YUM4LESS_ALLOW_DB_RESET=1`) | After pulling migrations, cron may exit until manual `db:reset` or migrate | After each deploy with `db/init` changes, run `npm run db:up` and verify schema once |
| **`assert-live-ingest-env` does not require `KROGER_API_ENV=production`** | Cron exits 0 but Kroger official API sync no-ops | Set `KROGER_API_ENV=production` explicitly in `.env.local` |
| **`YUM4LESS_INGEST_ZIPS` defaults to 23111** | Ingest warms wrong market silently | Set real ZIPs in `.env.local`; verify stores in §4.2 SQL |
| **Map catalog failure is non-fatal** | Cron exit 0 with degraded OSM/catalog | Read warnings in log; rerun `npm run ingest:map-catalog` manually |
| **Partial weekly-ad chain failure** | Exit 0 if any chain succeeds — other chains may be stale | Scan per-chain `[kroger]` / `[aldi]` lines in log |
| **Playwright / headless deps on Linux** | Kroger scrape fallback fails with browser launch errors | Run `playwright install-deps` once; test manual ingest |
| **No interactive prompts in scheduled path** | ✅ None found — safe for no-TTY cron | — |
| **Parent wrapper does not load `.env.local` before `ensure-test-db`** | ✅ Child TS scripts load it; DB URL defaults match compose | Set `DATABASE_URL` in `.env.local` anyway |
| **M128 automated per-chain kill switches** | Not implemented — manual pause only | Watch for 403/WAF strings in logs; pause chains operationally |
| **README step order was wrong** | Confusion only | Fixed — see README link to this doc |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-29 | Initial homelab scheduled-ingest runbook |
