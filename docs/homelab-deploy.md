# Homelab deploy — scheduled ingest runbook

Copy-paste guide for a **dedicated Linux box** running Postgres, the Yum4Less app, and **daily live ingest** via cron. Assumes a generic Linux host with **Docker** (Compose) and **Node.js** (for ingest scripts / Playwright) — not a specific distro or hardware profile.

**Scope:** wiring `npm run ingest:weekly-ads:scheduled` to run unattended. **App + Postgres** run as Compose services (`Dockerfile` + `docker-compose.yml`). CI publishes a pre-built app image to GHCR for TrueNAS “Install via YAML” (see [§8](#8-ghcr-app-image-for-truenas)). Reverse proxy / TLS / TrueNAS Apps YAML itself remain **out of scope** here — next after the image path is proven.

**Related:** [`README.md`](../README.md) (commands), [`.env.example`](../.env.example) (env truth), [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) (product scope), [`docs/provider-integration-pattern.md`](provider-integration-pattern.md) (chain data paths).

---

## What the scheduled wrapper does

`npm run ingest:weekly-ads:scheduled` runs `scripts/run-scheduled-weekly-ad-ingest.mjs` in this **fixed order** (see `src/lib/scheduled-ingest-pipeline.ts`):

| Step | Command / script | Fatal on failure? |
|------|------------------|-------------------|
| 1. Env guard (live only) | `scripts/assert-live-ingest-env.ts` | **Yes** — missing keys |
| 2. Postgres prep | `scripts/ensure-test-db.mjs` | **Yes** — Docker/DB/schema |
| 3. Map catalog | `npm run ingest:map-catalog` | **No** — logs warning, continues |
| 4. Weekly-ad ingest | `scripts/ingest-weekly-ads.ts` | **Yes** if **any** chain errors or **any** DB persist failure |
| 5. SNAP ensure | `scripts/ensure-snap-context.mjs` | **No** — warning only |
| 6. Kroger official sync | `npm run sync:provider-prices` | **Yes** |
| 7. TheMealDB import | `npm run ingest:themealdb:from-sales` | **Yes** if script throws |
| 8. Ranked-price freshness | `npm run check:ranked-price-freshness` | **Yes** if **0** ranked in-stock observations in the shared **24h** window |

**Not the CI path:** `npm run ingest:weekly-ads:scheduled:fixture` — deterministic rehearsal only; do not use on the homelab cron.

---

## 1. Prerequisites

### Software

| Requirement | Notes |
|-------------|--------|
| **Node.js 22.x** (`package.json` `engines`: `>=22 <23`) | Required on the **host** for ingest/cron (`node -v`). App container uses `node:22-bookworm-slim`. |
| **npm** | Bundled with Node (host ingest path). |
| **Docker Engine + Compose plugin** | `app` + `db` from repo `docker-compose.yml`. `ensure-test-db.mjs` expects container `yum4less-postgres`. |
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

No inbound ports required for ingest itself. Compose publishes Postgres as `127.0.0.1:5433:5432` (loopback only). Do **not** change that to an unqualified `5433:5432` or `0.0.0.0:…` publish — that binds all interfaces and is a STOP-SHIP regression (enforced by `npm run check:compose-db-bind`). For any non-loopback deploy, rotate away from the local-dev `postgres:postgres` credentials and put the secret in env, not the compose file.

### File system

- Cron user needs **read** on repo + `.env.local`, **write** on Docker volume `postgres-data`, and permission to run `docker` (usually membership in the `docker` group).
- Create a log directory the cron user owns, e.g. `/var/log/yum4less/` or `~/logs/yum4less/`.

---

## 2. First-time host setup

### 2.1 Clone and install (host Node — ingest only)

Host Node/npm are still required for **scheduled ingest** (Playwright Chromium, `tsx` scripts). The **shopper app** no longer needs a host `next start` process.

```bash
git clone <your-repo-url> /opt/yum4less   # choose your path
cd /opt/yum4less
npm ci
npx playwright install chromium
# Linux only — system libraries for headless Chromium:
npx playwright install-deps chromium
```

### 2.2 Start app + Postgres (Compose)

**Supersedes** the older “`npm run db:up` then host `next start`” app path. For this pass, both services are containers; TrueNAS/Apps-specific volume paths come later.

```bash
cd /opt/yum4less
docker compose up --build -d
# or: npm run compose:up
docker ps --filter name=yum4less-
```

- **`db`** (`yum4less-postgres`): healthy before **`app`** starts (`depends_on` + `condition: service_healthy`).
- **`app`** (`yum4less-app`): Next.js standalone image; `DATABASE_URL` → `postgresql://postgres:postgres@db:5432/yum4less_dev` (Compose DNS). Host publish: `127.0.0.1:3000` and `127.0.0.1:5433` (loopback only — SS-1).
- Debug / public-API write flags are forced **OFF** in compose (`YUM4LESS_DEBUG_ROUTES_ENABLED=0`, `YUM4LESS_ENABLE_API_DB_WRITES=0`).

Schema is applied from `db/init/` on first **db** container start (physical SQL only — the ledger table is created but **not populated** until the first migration pass). **`schema_migrations` is the source of truth** for which init files have been applied; `npm run db:migrate` or any path that runs `ensure-test-db.mjs` reconciles the ledger (backfill on existing volumes, apply missing files such as `015`/`016` on long-lived dev DBs).

After each deploy that adds or changes files under `db/init/`, run:

```bash
docker compose up -d db
# or keep using: npm run db:up
npm run db:migrate
```

Verify ledger rows: `docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "select version, filename, applied_at from schema_migrations order by version;"`

**Decision:** This runbook assumes **Docker Compose `app` + `db`** on the same box. A standalone Postgres install works if host ingest `DATABASE_URL` points at it, but `ensure-test-db.mjs` still tries to manage the Docker container — see [Pre-go-live gaps](#pre-go-live-gaps-flag-dont-fix-in-this-pass) below.

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

| Context | `DATABASE_URL` |
|---------|----------------|
| Host ingest / `npm run dev` / Vitest | `postgresql://postgres:postgres@localhost:5433/yum4less_dev` (Compose publish) |
| Compose **`app`** container | Set by compose to `postgresql://postgres:postgres@db:5432/yum4less_dev` — do **not** point the container at `localhost` |

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

Success signature: `Scheduled pricing ingest completed.` plus a prior `[freshness] OK — …` line.  
Failure signature: non-zero exit (wrapper uses `set -e`), or lines like `Scheduled ingest failed during ...` / `[freshness] STALE — 0 fresh`.

**Alert model (single-operator, no SaaS):** cron non-zero exit + `[freshness]` log lines are the primary signal. Optional `YUM4LESS_FRESHNESS_WEBHOOK_URL` POSTs a small JSON body when the check fails (native `fetch`, no new dependency). Cron `MAILTO` still works if you configure mail on the box.

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

### 4.3 Automated heartbeat (preferred) + manual one-liner

Scheduled ingest **already** runs `npm run check:ranked-price-freshness` as the final fatal step. It fails closed when **aggregate** ranked in-stock freshness is **0 in 24h** (same SQL window as shopper ranked reads). Per-source lines are diagnostic only — a thin week for one chain does **not** fail the job while another ranked source is fresh.

Manual re-check (or mid-day sanity without re-ingesting):

```bash
cd /opt/yum4less
npm run check:ranked-price-freshness
```

Equivalent SQL one-liner:

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

Run this **after 03:30** on the day following first cron, or after a manual ingest. Emergency escape only: `YUM4LESS_SKIP_FRESHNESS_HEARTBEAT=1` (do not leave set).

### 4.4 Postgres backup / restore (Pass 6)

Logical dumps use `pg_dump` / `psql` **inside** the `yum4less-postgres` container. Dump files land under repo-local `backups/` (gitignored).

| Command | Purpose |
|---------|---------|
| `npm run db:backup` | Dump `yum4less_dev` → `backups/yum4less_dev_<timestamp>.sql` |
| `npm run db:backup -- --database=yum4less_test` | Dump another DB on the same container |
| `npm run db:restore -- --file=backups/<dump>.sql --database=yum4less_restore_scratch` | Restore into a **non-dev** target (drops/recreates that DB) |
| `npm run db:backup-restore-drill` | **Proof drill:** dump source → restore into disposable `yum4less_backup_drill` → assert store / `price_observations` / `schema_migrations` counts match → drop drill DB |

**Protected restore:** restoring into `yum4less_dev` (or `postgres` / templates) is refused unless you pass `--i-understand-destructively-restore-dev`. Prefer restore-into-scratch + cutover over in-place overwrite.

**Suggested nightly cron (same host as ingest):**

```cron
15 4 * * * cd /opt/yum4less && /usr/bin/npm run db:backup >> /var/log/yum4less/backup.log 2>&1
```

Rotate or prune `backups/` yourself (e.g. keep 14 days). After a real restore into scratch, point `DATABASE_URL` at the restored DB or rename databases only when the app is stopped.

**Verify the drill once per host** before treating unattended cron as foundation-complete:

```bash
cd /opt/yum4less
npm run db:up
npm run db:backup-restore-drill
# expect: [drill] OK — backup/restore round-trip verified
```

---

## 5. When ingest silently stops working

The scheduled wrapper ends with a **ranked-price freshness heartbeat** (`npm run check:ranked-price-freshness`). If cron “succeeds” without writing any in-stock ranked rows inside 24h, the job **exits non-zero** and logs `[freshness] STALE`. Symptoms that still overlap with a genuinely thin weekly ad week:

| What you see | Possible cause |
|--------------|----------------|
| Cron exit non-zero + `[freshness] STALE` | No ranked observations within **24h** — operations first |
| Ranked stores flip to **context only** / empty sale-ingredient list | Same SQL filter; confirm heartbeat / §4.3 |
| Same UI as a **thin sale week** (few ingredients on ad) | Cron **OK** with fresh rows, but few dinner SKUs matched |
| `ingest.log` stops growing | Cron not installed, wrong path, or permission error |
| Log shows `Live scheduled ingest requires ...` | Missing `.env.local` keys for cron user |
| Log shows `Docker is not available` | Docker down or cron user not in `docker` group |
| Log shows `Local Postgres seed looks stale` | Schema drift after `git pull`; needs one-time `npm run db:reset` or manual migration (see gaps) |
| Map catalog warnings, weekly-ad continues | OSM Overpass timeout — ranked path may still work from Flipp |
| `sync:provider-prices` wrote 0 Kroger API rows | `KROGER_API_ENV` not `production`, store mapping, or weak product match — weekly-ad may still rank |

Treat **cron exit + `[freshness]` lines + optional webhook** as the owner alert path. Keep reading §4 SQL for per-source diagnosis.

### Known product gap (UI distinction)

**Stale data vs thin data:** The shopper UI does not yet clearly distinguish “cron has not run / observations aged out” from “ingest ran but this week’s ad has few matched dinner ingredients.” Both can present as limited ranked coverage or empty sale-ingredient pickers with generic daily-refresh copy (`RANKED_PRICE_DAILY_REFRESH_USER_MESSAGE`). After cron has run successfully for a few weeks, if freshness heartbeat says OK but coverage is still thin, trust the **thin week** explanation; if heartbeat/SQL says STALE, fix **operations** first.

**Future slice candidate:** last-success timestamp surfaced in admin or `shopperNotice` when ranked reads are empty due to cache miss vs filter-empty.

---

## 6. App on the same box (Compose)

**Current path (containerized):** after `docker compose up --build -d`, the shopper UI is served by `yum4less-app` on `127.0.0.1:3000`. Confirm with:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
# Optional DB proof (coords = CI anchor):
curl -sS -X POST http://127.0.0.1:3000/api/market-search \
  -H "content-type: application/json" \
  -d '{"latitude":37.6085,"longitude":-77.3739,"radiusMiles":8}'
```

**Superseded for production-like / homelab prep:** host-side `npm run build` + `NODE_ENV=production npm run start`. That remains valid for local debugging only — not the documented deploy model.

Reverse proxy / TLS / LAN bind remain a **later** pass. Set `TRUST_PROXY_HEADERS=1` only when a trusted proxy strips client `X-Forwarded-For`. Continental US ZIP search in production requires `GEOCODIO_API_KEY` in `.env.local` (loaded into the `app` service when present).

---

## 7. Production-ranked scope reminder

As of this doc, **shopper-facing ranked meal totals** use **Kroger family, Aldi, Publix, and Food Lion** when weekly-ad (or Kroger official API) promotion gates pass. Walmart remains context-only. See [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) Decision log.

---

## 8. GHCR app image (for TrueNAS)

TrueNAS Apps “Install via YAML” **pulls** a pre-built image — it does not `docker compose build` from this repo the way local Compose does. After every successful `master` CI run (`verify` → `integration` → `e2e` → `semgrep`, then `publish-image`), GitHub Actions builds the existing `Dockerfile` and pushes:

| Reference | Image |
|-----------|--------|
| **Deploy / rollback pin (use this)** | `ghcr.io/sfh1980/yum4less-app:<git-sha7>` |
| Convenience only (do **not** pin production) | `ghcr.io/sfh1980/yum4less-app:latest` |

- **SHA tag** (first 7 chars of the commit that passed CI) is the source of truth — same discipline as tracing bugs to a real commit/`gh` run.
- **`latest`** moves on every green `master` push. Pinning TrueNAS to `latest` is silent-drift risk; always set the YAML `image:` to a SHA tag.
- **Visibility:** Actions-published packages from this **public** GitHub repo inherit **public** visibility (confirmed on first publish). That means TrueNAS can pull **without** a GitHub PAT. Making the package private later is a package-settings / unlink change if you want PAT-gated pulls — not required for the TrueNAS YAML step.

### Pull example

```bash
# Public package — no docker login required while visibility stays public
docker pull ghcr.io/sfh1980/yum4less-app:<git-sha7>
```

If the package is later flipped to **private**, TrueNAS will need a GitHub PAT with **`read:packages`** configured as `ghcr.io` registry auth.

Local Compose still **builds** from source (`build:` in `docker-compose.yml`). Switching Compose to `image: ghcr.io/sfh1980/yum4less-app:<sha>` is optional for day-to-day dev; required for TrueNAS YAML.

---

## Pre-go-live gaps (flag — don’t fix in this pass)

Issues to resolve **before** relying on unattended cron:

| Gap | Risk under cron | Mitigation until code changes |
|-----|-----------------|-------------------------------|
| **`ensure-test-db.mjs` requires Docker** | Cron fails if Docker stopped or user lacks permission | `restart: unless-stopped` on compose; add cron user to `docker` group; consider a second cron line `*/5 * * * * cd /opt/yum4less && docker compose up -d db` |
| **Stale schema detection throws** (no auto-reset without `YUM4LESS_ALLOW_DB_RESET=1`) | After pulling migrations, cron may exit until manual `db:reset` or migrate | After each deploy with `db/init` changes, run `npm run db:up` && `npm run db:migrate` and verify `schema_migrations` |
| **`assert-live-ingest-env` does not require `KROGER_API_ENV=production`** | Cron exits 0 but Kroger official API sync no-ops | Set `KROGER_API_ENV=production` explicitly in `.env.local` |
| **`YUM4LESS_INGEST_ZIPS` defaults to 23111** | Ingest warms wrong market silently | Set real ZIPs in `.env.local`; verify stores in §4.2 SQL |
| **Map catalog failure is non-fatal** | Cron exit 0 with degraded OSM/catalog | Read warnings in log; rerun `npm run ingest:map-catalog` manually |
| **Partial weekly-ad chain failure** | Exit **non-zero** if **any** chain errors or any persist failure (code is fail-loud; other chains may still have written) | Scan per-chain `[kroger]` / `[aldi]` lines in log; fix the failed chain |
| **Playwright / headless deps on Linux** | Kroger scrape fallback fails with browser launch errors | Run `playwright install-deps` once; test manual ingest |
| **No interactive prompts in scheduled path** | ✅ None found — safe for no-TTY cron | — |
| **Parent wrapper does not load `.env.local` before `ensure-test-db`** | ✅ Child TS scripts load it; DB URL defaults match compose | Set `DATABASE_URL` in `.env.local` anyway |
| **M128 automated per-chain kill switches** | Not implemented — manual pause only | Watch for 403/WAF strings in logs; pause chains operationally |
| **README step order was wrong** | Confusion only | Fixed — see README link to this doc |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-20 | CI `publish-image` job: after verify/integration/e2e/semgrep on `master`, push `ghcr.io/sfh1980/yum4less-app:<sha7>` + `:latest` (**public** — inherits public repo); SHA pin for TrueNAS, `latest` convenience-only |
| 2026-07-20 | App containerized: multi-stage `Dockerfile` + Compose `app` service (`depends_on` db healthy); host `next start` superseded for deploy path; TrueNAS still out of scope |
| 2026-07-15 | Pass 6: Postgres backup/restore runbook + `db:backup` / `db:restore` / `db:backup-restore-drill` (disposable drill DB) |
| 2026-07-15 | Pass 1 ops truth: ranked-price freshness heartbeat (fail closed on 0-in-24h) + exit-policy doc aligned with any-chain fail-loud |
| 2026-06-29 | Initial homelab scheduled-ingest runbook |
