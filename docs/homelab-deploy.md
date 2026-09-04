# Homelab deploy — scheduled ingest + TrueNAS Apps runbook

Copy-paste guide for a **dedicated Linux / TrueNAS SCALE box** running Postgres, the Yum4Less app, and **daily live ingest** via cron. Local proof uses **Docker Compose**; the production-like host path on this project is **TrueNAS Apps “Custom App” YAML** (see [§9](#9-truenas-apps-custom-app--working-deploy)).

**Scope:** (1) App + Postgres on the box, (2) unattended `npm run ingest:weekly-ads:scheduled` via a **dedicated ingest container** ([§10](#10-ingest-cron-container-truenas)), (3) Watchtower auto-update for labeled app/ingest images ([§11](#11-watchtower-auto-update)), (4) public HTTPS via **Cloudflare Tunnel** ([§12](#12-cloudflare-tunnel-wan--live)). CI publishes SHA-pinned **app** and **ingest** images to GHCR ([§8](#8-ghcr-app-image-for-truenas)). **§10 ingest + §11 Watchtower + §12 Tunnel are deployed** on TrueNAS (see those sections). **Unattended 3am two-night proof closed** (owner paste-back 2026-08-29). **Unattended ingest-worker night closed** (owner paste-back 2026-08-31). **Backup/restore drill closed** (2026-08-31). Remaining open ops: TheMealDB **dev test key**. Watchtower pull and extra ZIP **`23220`** first ingest **closed** (owner paste 2026-09-01).

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
| **Node.js 22.x** (`package.json` `engines`: `>=22 <23`) | Required on the **host** only for the legacy host-cron path (§3). **TrueNAS path:** Node lives inside `yum4less-app` / `yum4less-ingest` images (`node:22-bookworm` / slim). |
| **npm** | Bundled with Node (host ingest path only). |
| **Docker Engine + Compose plugin** | Local: `app` + `db` from `docker-compose.yml`. TrueNAS: Custom App YAML (§9–§11). Host `ensure-test-db` still expects container `yum4less-postgres` unless `YUM4LESS_EXTERNAL_POSTGRES=1`. |
| **Git** | Clone under `appPool/yum4less/repo` for `db/init` mounts; ingest image does **not** need a host `npm ci`. |
| **Playwright Chromium** | Host path: `npx playwright install chromium` (+ Linux deps). **Ingest image:** Chromium + deps are baked into `Dockerfile.ingest`. |

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

### 2.1 Clone and install (host Node — optional)

**Preferred on TrueNAS:** use the **ingest container** ([§10](#10-ingest-cron-container-truenas)) — no host `npm ci` / Playwright. Host Node/npm remain valid for local Compose debugging and the legacy cron wrapper in §3. The **shopper app** does not need a host `next start` process.

```bash
git clone <your-repo-url> /opt/yum4less   # choose your path
cd /opt/yum4less
npm ci
npx playwright install chromium
# Linux only — system libraries for headless Chromium:
npx playwright install-deps chromium
```

### 2.2 Start app + Postgres (Compose)

**Supersedes** the older “`npm run db:up` then host `next start`” app path. For local/dev, both services are Compose containers. For the dedicated TrueNAS box, use Custom App YAML — [§9](#9-truenas-apps-custom-app--working-deploy).

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

After each deploy that adds or changes files under `db/init/` (including **`025_active_markets_and_zip_geocode_cache.sql`** for ingest markets + ZIP cache and **`026_chain_registry_and_store_coverage.sql`** for the `/owner` Coverage tab), run migrate from the ingest container. **TrueNAS already applied `025` and `026` (2026-08-27 00:04Z).** Future init files still need an operator migrate — Watchtower does not.

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
| `YUM4LESS_INGEST_ZIPS` | Optional **debug overlay** of comma-separated **5-digit ZIPs**. If unset, scheduled ingest reads `active_markets`. |

> **Markets:** TrueNAS has `025` (2026-08-27 00:04Z). Insert at least one active ZIP from `/owner` **Markets** (same admin key as Coverage) or `npm run markets:activate -- <ZIP>` before dropping the overlay. If `active_markets` is empty **and** `YUM4LESS_INGEST_ZIPS` is unset, ingest **exits non-zero**. There is no fallback to `23111`. Existing TrueNAS `YUM4LESS_INGEST_ZIPS` overlay still works until you switch to table rows. `YUM4LESS_PROVIDER_SYNC_ZIP` is an optional single-ZIP overlay alias only when the multi-ZIP list is blank.

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

**Logical dumps on TrueNAS** use `pg_dump` **inside** `yum4less-postgres` from the **NAS host** (the ingest container has no Docker socket). Owner proof **2026-08-31:** dump → restore `yum4less_backup_drill` → **276** stores / **324** observations / **29** migrations matched → drop drill DB.

Do not restore into `yum4less_dev`. Host paste:

```bash
sudo docker exec yum4less-postgres pg_dump -U postgres -d yum4less_dev --no-owner --no-acl > /tmp/yum4less_backup_drill.sql
sudo docker exec yum4less-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS yum4less_backup_drill;"
sudo docker exec yum4less-postgres psql -U postgres -d postgres -c "CREATE DATABASE yum4less_backup_drill;"
sudo docker exec -i yum4less-postgres psql -U postgres -d yum4less_backup_drill -v ON_ERROR_STOP=1 < /tmp/yum4less_backup_drill.sql
# compare count(*) on stores / price_observations / schema_migrations, then:
sudo docker exec yum4less-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS yum4less_backup_drill;"
rm -f /tmp/yum4less_backup_drill.sql
```

**Protected restore:** restoring into `yum4less_dev` (or `postgres` / templates) is refused unless you pass `--i-understand-destructively-restore-dev`. Prefer restore-into-scratch + cutover over in-place overwrite.

**Suggested nightly cron (same host as ingest):**

```cron
15 4 * * * cd /opt/yum4less && /usr/bin/npm run db:backup >> /var/log/yum4less/backup.log 2>&1
```

Rotate or prune `backups/` yourself (e.g. keep 14 days). After a real restore into scratch, point `DATABASE_URL` at the restored DB or rename databases only when the app is stopped.

### 4.5 Owner paste-back snapshot (local ≠ live)

Local Docker `yum4less_dev` (Cursor Postgres MCP on **5433**) is **not** the TrueNAS volume behind `https://yum4less.com/`. When an agent needs live catalog / ingest / migration truth, it should give these **read-only** commands; paste the output back; then docs may be updated. Watchtower does **not** migrate new `db/init` files by itself; scheduled ingest Postgres prep can apply them. Live ledger includes **`024`** (`applied_at` 2026-08-24 07:00:02Z), **`025` + `026`** (`applied_at` **2026-08-27 00:04:01Z**), and **`027` + `028`** (`applied_at` **2026-08-28 07:00:02–03Z**, owner paste-back **2026-08-29**). If a later migration is missing from `schema_migrations`, skip queries that need those tables.

On the NAS (TrueNAS Custom App names from §9):

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'yum4less|NAMES'

sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select version, filename, applied_at
from schema_migrations
order by version;
"

sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select source_name, count(*)::int as n
from ingredients
group by source_name
order by n desc;
"

sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select
  count(*)::int as recipes,
  count(*) filter (where source_name = 'themealdb')::int as themealdb
from recipes;
"
```

Only after `024` is in `schema_migrations`:

```bash
sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select
  (select count(*)::int from ingredient_match_reviews where status = 'pending') as pending_reviews,
  (select count(*)::int from ingredient_aliases where source_name = 'weekly-ad') as weekly_ad_aliases,
  (select count(*)::int from ingredient_match_skips) as skip_rows;
"
```

Only after `025` is in `schema_migrations`:

```bash
sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select zip_code, status, source, priority
from active_markets
order by priority, zip_code;
"
```

Only after `026` is in `schema_migrations`:

```bash
sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select count(*)::int as banners from chain_registry;
select count(*)::int as coverage_rows from store_coverage;
"
```

Freshness (same idea as §4.2):

```bash
sudo docker exec yum4less-postgres psql -U postgres -d yum4less_dev -c "
select source_name,
  count(*)::int as obs_rows,
  count(distinct ingredient_id)::int as unique_ingredients,
  max(observed_at) as newest,
  round(extract(epoch from (now() - max(observed_at))) / 3600, 1) as hours_ago
from price_observations
where in_stock = true
  and (source_name like '%weekly-ad-scrape' or source_name = 'kroger-official-api')
group by source_name
order by newest desc;
"
```

Do not dump secrets, `.env`, or admin keys. If a table is missing, paste the error — that is useful (usually means a migration after `024` is not applied).

**2026-08-26 snapshot (this volume):** ingredients 438; pending reviews 704; weekly-ad aliases 90; skips 675. Freshness ~10.4h: Kroger API 97/97, Publix 102, Food Lion 62, Kroger weekly-ad 35, Aldi 30, Walmart 14 (newest 07:00–07:06 UTC). See `PROJECT_CONTINUITY.md` Resume.

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

## 6. App on the same box (Compose vs TrueNAS)

**Local Compose path:** after `docker compose up --build -d`, the shopper UI is served by `yum4less-app` on **`127.0.0.1:3000`** (loopback only — same discipline as Postgres SS-1). Confirm with:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
# Optional DB proof (coords = CI anchor):
curl -sS -X POST http://127.0.0.1:3000/api/market-search \
  -H "content-type: application/json" \
  -d '{"latitude":37.6085,"longitude":-77.3739,"radiusMiles":8}'
```

**TrueNAS Apps path (working):** see [§9](#9-truenas-apps-custom-app--working-deploy). App is published as **`3000:3000`** on the LAN **and** reached publicly as **`https://yum4less.com/`** via Cloudflare Tunnel ([§12](#12-cloudflare-tunnel-wan--live)). Keep Postgres unpublished on the host.

**Superseded for production-like / homelab:** host-side `npm run build` + `NODE_ENV=production npm run start`. That remains valid for local debugging only — not the documented deploy model.

Set `TRUST_PROXY_HEADERS=1` only when a trusted proxy strips client `X-Forwarded-For`. Continental US ZIP search in production requires `GEOCODIO_API_KEY` (Compose: `.env.local`; TrueNAS: app env / secret as configured in the Custom App).

---

## 7. Production-ranked scope reminder

As of this doc, **shopper-facing ranked meal totals** use **Kroger-family banners, Aldi, Publix, Food Lion, and Walmart** when weekly-ad (or Kroger official API) promotion gates pass. Same floors for every ranked banner. Lidl stays map context until a store-bound sale feed exists. Missing estimates stay map context with an honest reason. See [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) Decision log.

---

## 8. GHCR images (app + ingest) for TrueNAS

TrueNAS Apps “Install via YAML” **pulls** pre-built images — it does not `docker compose build` from this repo the way local Compose does. After every successful `master` CI run (`verify` → `integration` → `e2e` → `semgrep`), GitHub Actions publishes:

| Package | Dockerfile | Jobs |
|---------|------------|------|
| `yum4less-app` | `Dockerfile` (Next.js standalone) | `publish-image` |
| `yum4less-ingest` | `Dockerfile.ingest` (Node 22 + Playwright + cron) | `publish-ingest-image` |

| Tag | Purpose |
|-----|---------|
| **`<git-sha7>`** | **Rollback / audit pin** — immutable digest for that green commit |
| **`:homelab`** | **Watchtower float** — moved to the same digest as that commit’s SHA on every green `master` publish |
| **`:latest`** | Convenience only — same float as `:homelab`; do not use for rollback pins |

**Important (Watchtower):** Immutable SHA tags never “update.” Auto-update only works on a **mutable** tag (`:homelab` or `:latest`). Prefer `:homelab` on labeled app/ingest services; keep the SHA handy for manual rollback.

- **Visibility:** Actions-published packages from this **public** GitHub repo inherit **public** visibility. TrueNAS can pull **without** a GitHub PAT while that stays true.
- Ingest is **never** baked into the app image — separate package on purpose.

### Pull examples

```bash
docker pull ghcr.io/sfh1980/yum4less-app:<git-sha7>
docker pull ghcr.io/sfh1980/yum4less-ingest:<git-sha7>
# Watchtower-managed float:
docker pull ghcr.io/sfh1980/yum4less-app:homelab
docker pull ghcr.io/sfh1980/yum4less-ingest:homelab
```

If a package is later flipped to **private**, TrueNAS will need a GitHub PAT with **`read:packages`**.

Local Compose still **builds** the app from source. The ingest image is TrueNAS/homelab-oriented; local scheduled ingest can stay on host Node (§2–§3).

**Working TrueNAS image pins (2026-08-10):** rollback SHA **`800c450`** for app + ingest (owner `/owner` pagination + session grouping; CI [31426780947](https://github.com/sfh1980/Yum4Less/actions/runs/31426780947)); Watchtower float `:homelab` on both — see §10–§11. Prior pins `f337317` / `eaee42a` / `732cd22` / `54e7b60` remain pullable.
---

## 9. TrueNAS Apps Custom App — working deploy

**Status (2026-07-22; ingest/Watchtower 2026-07-26; Cloudflare Tunnel 2026-08-03/04; backup drill 2026-08-31):** App + Postgres Custom App stack is **up and healthy**. **Ingest** ([§10](#10-ingest-cron-container-truenas)) is in the **same** `yum4less` Custom App; **Watchtower** ([§11](#11-watchtower-auto-update)) is a **sibling** Custom App. **Cloudflare Tunnel** ([§12](#12-cloudflare-tunnel-wan--live)) publishes **`https://yum4less.com/`**. Backup/restore drill **closed**. App image runs `:homelab` with the Watchtower enable label.
### 9.1 Datasets (real paths used)

| Dataset | Role |
|---------|------|
| `appPool/yum4less` | Parent dataset |
| `appPool/yum4less/repo` | Git clone of this repository (provides `db/init` for first Postgres start) |
| `appPool/yum4less/postgres-data` | Postgres data directory (`/var/lib/postgresql/data` in the db container) |

Host mount paths (SCALE default): `/mnt/appPool/yum4less/...`.

### 9.2 Required setup steps / permissions (do before first deploy)

Two real root causes blocked multiple deploy attempts. Fix both **before** Install / Update — top-level dataset ACLs looking “fine” is not enough.

#### A. `postgres-data` ownership (Postgres UID 999)

Postgres Official image runs as **UID 999** (GID 999). The data dir must be owned accordingly and mode **700** before first start:

```bash
sudo chown -R 999:999 /mnt/appPool/yum4less/postgres-data
sudo chmod 700 /mnt/appPool/yum4less/postgres-data
```

If ownership is wrong, the db container fails init / stays unhealthy.

#### B. `repo/db/init` world-readable / traversable (actual “postgres unhealthy” root cause)

Even when `postgres-data` ownership is correct, **UID 999 cannot read init scripts** if `db/init` (or parents) deny other-read / other-execute. That produced repeated **`container yum4less-postgres is unhealthy`** failures across deploy attempts.

```bash
# Make init tree readable/traversable by the Postgres container user
sudo chmod -R a+rX /mnt/appPool/yum4less/repo/db/init
# If parents block traversal, also ensure execute on the path:
# sudo chmod a+rx /mnt/appPool/yum4less /mnt/appPool/yum4less/repo /mnt/appPool/yum4less/repo/db
```

Confirm from a throwaway check after deploy (or before, as root):

```bash
sudo docker exec yum4less-postgres ls -la /docker-entrypoint-initdb.d
```

#### C. Docker CLI on this TrueNAS box

`truenas_admin` does **not** have direct Docker socket access. Plain `docker …` returns **permission denied**. Use **`sudo docker …`** (or root) for `ps`, `logs`, `exec`, and any other CLI against Apps-managed containers.

```bash
sudo docker ps --filter name=yum4less-
sudo docker logs yum4less-postgres --tail 100
sudo docker logs yum4less-app --tail 100
```

### 9.3 Port / exposure decisions

| Service | Host publish | Intent |
|---------|--------------|--------|
| **db** | **None** | Postgres stays on the Compose/Apps network only (`db:5432` from the app). Do not publish `5432`/`5433` on the host for this deploy. |
| **app** | **`3000:3000`** (no `127.0.0.1` restriction) | Deliberately **LAN-reachable** for household testers. **Not** public/WAN. |

**Before any public exposure:** put a reverse proxy (Caddy/nginx/Traefik) + **TLS** in front; set `TRUST_PROXY_HEADERS=1` only behind that trusted proxy. That proxy/TLS layer has **not** been set up yet.

### 9.4 Image pin

| Use | Image |
|-----|--------|
| **Baseline working deploy (2026-07-22)** | `ghcr.io/sfh1980/yum4less-app:f38ce73` |
| **Watchtower float (after §11)** | `ghcr.io/sfh1980/yum4less-app:homelab` |
| Rollback | `ghcr.io/sfh1980/yum4less-app:<sha7>` from a green `publish-image` job |
| Do **not** use for rollback | `:latest` alone (no audit trail) |

### 9.5 Final working Custom App YAML

Paste into TrueNAS Apps → Custom App → YAML (adjust absolute host paths only if your pool/dataset names differ). **db** healthcheck stays `pg_isready`. **app** healthcheck uses Node `fetch` — **not** `wget`/`curl` (those binaries are **not** in the slim app image; a wget-based check marked the app unhealthy even while HTTP was serving correctly).

```yaml
services:
  db:
    image: postgres:17
    container_name: yum4less-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: yum4less_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    # No host ports — Postgres is internal to the app stack only.
    volumes:
      - /mnt/appPool/yum4less/postgres-data:/var/lib/postgresql/data
      - /mnt/appPool/yum4less/repo/db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d yum4less_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/sfh1980/yum4less-app:f38ce73
    container_name: yum4less-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      # LAN-reachable (not loopback-restricted). Not equivalent to public/WAN.
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: postgresql://postgres:postgres@db:5432/yum4less_dev
      YUM4LESS_DEBUG_ROUTES_ENABLED: "0"
      YUM4LESS_ENABLE_API_DB_WRITES: "0"
    # Required for Watchtower (§11). Do NOT put this label on `db`.
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/').then(()=>process.exit(0)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 45s
```

**Notes:**

- Rotate away from `postgres:postgres` before any non-LAN or multi-tenant exposure; keep secrets out of git.
- Add `GEOCODIO_API_KEY` / Kroger keys to the **ingest** service env (§10) when you need live scheduled ingest — not required for a bare “containers healthy” smoke. ZIP geocode on the app still needs `GEOCODIO_API_KEY` on **app** when `NODE_ENV=production`.
- After first successful init, `db/init` is only needed again for **new empty** data dirs; long-lived volumes use `schema_migrations` + migrate from the ingest container (`YUM4LESS_EXTERNAL_POSTGRES=1`) when SQL files change.
- When enabling Watchtower (§11), switch `app.image` (and ingest) to `:homelab` so the float can move; keep `f38ce73` / SHA tags for rollback.
### 9.6 Troubleshooting — orchestration log vs container logs

`/var/log/app_lifecycle.log` only shows **orchestration-level** errors (e.g. `dependency failed to start`). It does **not** include the failing container’s stdout/stderr.

To see the real error:

```bash
sudo docker logs yum4less-postgres --tail 200
sudo docker logs yum4less-app --tail 200
```

If Apps tears the container down quickly on failure, poll while retrying Install/Update:

```bash
# Example polling loop (Ctrl+C when done)
while true; do
  sudo docker logs yum4less-postgres --tail 50 2>&1 | tail -n 50
  sleep 2
done
```

Common signatures seen during this deploy:

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `yum4less-postgres` unhealthy; lifecycle says dependency failed | Init scripts unreadable by UID 999 | §9.2 B — `chmod -R a+rX` on `repo/db/init` (+ path traverse) |
| Postgres permission / data dir errors | Wrong ownership on `postgres-data` | §9.2 A — `chown 999:999` + mode `700` |
| App serving HTTP but marked unhealthy | Healthcheck used `wget`/`curl` missing from image | Use Node `fetch` healthcheck in §9.5 |
| `docker: permission denied` as `truenas_admin` | No socket access for that user | Prefix with `sudo docker` (§9.2 C) |

### 9.7 Smoke check after healthy deploy

From a LAN machine (or the NAS itself):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://<truenas-lan-ip>:3000/
```

Expect `200`. Then proceed to the ingest container (§10) and freshness checks (§4 / §10.4) when ready for ranked dinners.

---

## 10. Ingest cron container (TrueNAS)

**Status (2026-08-31 owner paste-back):** Unattended 3am cron two-night proof closed. Unattended ingest-worker night closed (enqueue 07:00:01Z; drain 07:01–07:09Z; 6/6 `succeeded`). Backup/restore drill closed (276/324/29 round-trip). Ingest runs in the **same** `yum4less` Custom App stack as `db` / `app`. Overlay unset; `active_markets` ZIP `23111` only until `/owner` Activate of `23220`.

**Evidence (owner TrueNAS session, ZIP `23111`):**
- One-shot dry-run (`YUM4LESS_INGEST_ONCE=1`) completed against production data.
- Live scrapes observed for **Kroger**, **Aldi**, **Publix**, **Food Lion**, and **Walmart**.
- Synced **33** Publix price observations to PostgreSQL; imported **15** TheMealDB meals.
- `check:ranked-price-freshness` passed clean at **246/246** fresh observations across all six sources.
- Run ended with the success line: `Scheduled pricing ingest completed.`

**Goal:** Run `npm run ingest:weekly-ads:scheduled` daily at **`0 3 * * *`** without baking ingest into `yum4less-app`, and without requiring host Node/Playwright on the NAS.

**Image:** `ghcr.io/sfh1980/yum4less-ingest:<sha7>` (rollback) or `:homelab` (Watchtower float). Built from `Dockerfile.ingest` (Node 22 bookworm, Playwright Chromium, `cron`, `postgresql-client`).

**Local build only (not TrueNAS):** CI copies `.dockerignore.ingest` → `.dockerignore` before build so `scripts/` and `db/` stay in the context. Root `.dockerignore` strips those for the app image — a bare `docker build -f Dockerfile.ingest .` without that swap produces a dead ingest image. Prefer pulling from GHCR on the NAS.

**Why a separate image:** Shopper runtime stays small (Next standalone). Ingest needs browsers, `tsx` scripts, `db/init` for migration reconcile, and a scheduler.

### 10.1 Scheduler choice

| Approach | Recommendation |
|----------|----------------|
| **In-container cron (default)** | More portable — schedule travels with the image. Entrypoint runs `cron -f`; job in `/etc/cron.d/yum4less-ingest` at `0 3 * * *`. Set `TZ` to your market (e.g. `America/New_York`). Entrypoint dumps Docker `environment:` into `/etc/yum4less/ingest.env` so the cron job sees `DATABASE_URL` / API keys (cron does not inherit container env by default). |
| **TrueNAS / host `docker exec`** | Slightly more visible in host crontab; set `YUM4LESS_INGEST_CRON=0` so the container only stays up (`tail -F` log). Then schedule: `0 3 * * * sudo docker exec yum4less-ingest npm run ingest:weekly-ads:scheduled`. |

Default = in-container cron. Use host exec if you prefer all schedules in one TrueNAS place.

### 10.2 Required environment (explicit — do not rely on defaults)

Set these on the **ingest** service (Custom App env). **`YUM4LESS_INGEST_ZIPS` is optional overlay** — if unset, cron reads `active_markets` (must have ≥1 `active` row after `025` migrate). Unset overlay + empty table fails the job (no `23111` default).

| Variable | Required | Notes |
|----------|----------|-------|
| `YUM4LESS_EXTERNAL_POSTGRES` | **Yes** (`1`) | Baked into the image; keeps ensure/migrate on TCP `psql` (no Docker socket). |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:postgres@db:5432/yum4less_dev` — host **`db`**, port **5432** (Apps network). Not `localhost:5433`. |
| `YUM4LESS_INGEST_ZIPS` | Overlay | Debug/probe ZIP list. Prefer `/owner` Markets or `npm run markets:activate`, then unset this overlay. |
| `GEOCODIO_API_KEY` | **Yes** (live) | Enforced by `assert-live-ingest-env`. |
| `KROGER_CLIENT_ID` | **Yes** (live) | OAuth |
| `KROGER_CLIENT_SECRET` | **Yes** (live) | OAuth |
| `KROGER_API_ENV` | **Strongly yes** | Set `production` or official Kroger sync no-ops. |
| `TZ` | Recommended | Container-local cron timezone. |
| `YUM4LESS_FRESHNESS_WEBHOOK_URL` | Optional | POST on freshness fail (native fetch). |
| `YUM4LESS_INGEST_ONCE` | Dry-run only | `1` = run once and exit (see §10.3). |
| `YUM4LESS_INGEST_CRON` | Optional | `0` = disable in-container cron (host `docker exec` path). |

Also recommended (same as host `.env.local`): `YUM4LESS_PROVIDER_SYNC_RADIUS_MILES`, `YUM4LESS_MAP_CATALOG_RADIUS_MILES`, `THEMEALDB_API_KEY` as needed. Full list → [`.env.example`](../.env.example).

### 10.2.1 Market admission worker (after `029`)

`db/init/029_market_admission_density.sql` adds density class, cached ZIP outlines, `ingest_jobs`, and flyer hashes. **Watchtower does not migrate** and does **not** create this worker.

**Do not pull a `:homelab` image that expects the worker onto yum4less.com until this job exists.** Default 3am still runs the full pipeline inline unless `YUM4LESS_INGEST_QUEUE_WORKER=1`.

After local tests pass:

1. `sudo docker exec yum4less-ingest npm run db:migrate` (applies `029`).
2. Add a second ingest schedule (every minute, or a long-running loop) that runs `npm run ingest:worker`.
3. Set `YUM4LESS_INGEST_QUEUE_WORKER=1` on the **3am** ingest service so that job only enqueues.
4. Then allow Watchtower to pull the new image.

Until step 2–3, leave `YUM4LESS_INGEST_QUEUE_WORKER` unset so 3am still runs map-catalog → weekly-ad → … inline (same as today).

Unattended worker night **closed 2026-08-31**. Extra ZIP **23220** is Activated; first ingest is the 3am worker. Keep the host Cron Job Enabled.

**Network:** `ingest` **must** share the Custom App compose network with `db` (same YAML stack). Do not publish ingest ports.

**Troubleshooting (zsh / TrueNAS shell):** If `DATABASE_URL` contains `!` (common in passwords), wrap the whole URL in **single quotes**, not double quotes. On zsh, history expansion mangles `!` inside double-quoted strings and can silently corrupt the command.

### 10.3 Manual dry-run (before enabling daily cron)

**Option A — one-shot container (preferred first proof):**

```bash
# From the NAS (sudo docker). Use the Apps network name if running outside the stack:
#   sudo docker network ls | grep yum4less
sudo docker run --rm \
  --network <yum4less_app_network> \
  -e YUM4LESS_EXTERNAL_POSTGRES=1 \
  -e YUM4LESS_INGEST_ONCE=1 \
  -e DATABASE_URL=postgresql://postgres:postgres@db:5432/yum4less_dev \
  -e YUM4LESS_INGEST_ZIPS=REPLACE_WITH_REAL_ZIPS \
  -e GEOCODIO_API_KEY=... \
  -e KROGER_CLIENT_ID=... \
  -e KROGER_CLIENT_SECRET=... \
  -e KROGER_API_ENV=production \
  ghcr.io/sfh1980/yum4less-ingest:homelab
echo "Exit code: $?"
```

Expect trailing `Scheduled pricing ingest completed.` and exit **0**. Investigate non-zero before leaving cron enabled.

**Option B — exec into a deployed ingest service** (cron temporarily disabled or before 03:00):

```bash
sudo docker exec yum4less-ingest npm run ingest:weekly-ads:scheduled
echo "Exit code: $?"
```

### 10.4 Freshness check after first scheduled run

Scheduled ingest already ends with fatal `npm run check:ranked-price-freshness`. Mid-day re-check without re-ingesting:

```bash
sudo docker exec yum4less-ingest npm run check:ranked-price-freshness
```

Also use §4.2 SQL via `sudo docker exec yum4less-postgres psql ...`.

### 10.5 Custom App YAML block (`ingest`)

Add to the **same** Custom App as `db` / `app` (after `app:`). Replace secrets and ZIPs. Fragments also live in [`docker/truenas/custom-app-fragments.yml`](../docker/truenas/custom-app-fragments.yml).

```yaml
  ingest:
    image: ghcr.io/sfh1980/yum4less-ingest:homelab
    container_name: yum4less-ingest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      YUM4LESS_EXTERNAL_POSTGRES: "1"
      DATABASE_URL: postgresql://postgres:postgres@db:5432/yum4less_dev
      YUM4LESS_INGEST_ZIPS: "REPLACE_WITH_REAL_ZIPS"
      GEOCODIO_API_KEY: "REPLACE"
      KROGER_CLIENT_ID: "REPLACE"
      KROGER_CLIENT_SECRET: "REPLACE"
      KROGER_API_ENV: production
      TZ: America/New_York
      # YUM4LESS_FRESHNESS_WEBHOOK_URL: "https://hooks.example.local/yum4less-freshness"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

Logs: `sudo docker logs yum4less-ingest` (cron stdout is limited; job appends `/var/log/yum4less/ingest.log` inside the container — `sudo docker exec yum4less-ingest tail -n 80 /var/log/yum4less/ingest.log`).

---

## 11. Watchtower auto-update

**Status (recorded 2026-07-26): Deployed and verified (startup logs).** Watchtower runs as its **own sibling Custom App** (not part of the `yum4less` stack — it only needs `docker.sock`). **Not yet confirmed:** Watchtower’s first scheduled scan (~1 hour after deploy) running clean.

**Evidence (owner TrueNAS session — `sudo docker logs yum4less-watchtower`):**
- `Using notifications: discord`
- `Only checking containers using enable label`
- Scoped correctly to **app + ingest** only; **db** unlabeled and excluded by design (Postgres updates stay manual).

**Goal:** Hourly poll of GHCR; **only** recreate containers labeled for Watchtower (`app` + `ingest`). **Never** touch `db` (Postgres updates stay manual — no label).

### 11.1 Tag model (required reading)

Watchtower updates when the **configured tag’s digest** changes. SHA tags are immutable → **no auto-update**. Use:

- **Running image tag:** `:homelab` on labeled `app` and `ingest`
- **Rollback:** retag YAML to `:<sha7>` and redeploy

CI moves `:homelab` (and `:latest`) to each green `master` publish digest.

### 11.2 Label scoping

```yaml
# On app + ingest only:
labels:
  - "com.centurylinklabs.watchtower.enable=true"

# On db: omit the label entirely (WATCHTOWER_LABEL_ENABLE=true means unlabeled = ignored)
```

### 11.3 Custom App YAML block (`watchtower`)

May live in the **same** stack or a sibling Custom App. Needs the Docker socket.

```yaml
  watchtower:
    image: containrrr/watchtower:1.7.1
    container_name: yum4less-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_POLL_INTERVAL: "3600"
      WATCHTOWER_CLEANUP: "true"
      WATCHTOWER_NOTIFICATION_REPORT: "true"
      # Full auto-update (no approval gate) — default Watchtower behavior.
      # Notifications via Shoutrrr (pick one; replace placeholders):
      #   Discord:  discord://TOKEN@WEBHOOK_ID
      #   Slack:    slack://TOKEN@CHANNEL
      #   Generic:  generic+https://example.com/hooks/yum4less-watchtower
      WATCHTOWER_NOTIFICATION_URL: "REPLACE_WITH_SHOUTRRR_URL"
```

No Watchtower label on the watchtower service itself (optional self-update is out of scope).

### 11.4 TrueNAS Apps caveat

TrueNAS SCALE Apps middleware also owns container lifecycle. Watchtower recreating labeled containers **can** desync Apps UI state. If that happens: fall back to manual SHA / `:homelab` bumps in Custom App YAML, or run Watchtower only against compose-managed stacks outside Apps. This runbook still ships the YAML because it matches the requested ops model — validate on your SCALE version after first update.

### 11.5 Punch-list honesty (§4 leftovers)

Ingest + Watchtower are **deployed** on TrueNAS. Manual one-shot dry-run closed the “first successful ingest” proof for ZIP `23111`. The following remain **open** — do not fold them into the closed deploy:

| §4 / ops item | Status |
|---------------|--------|
| 1. Confirm Postgres listens `127.0.0.1:5433` only (Compose) / no host publish (TrueNAS) | Ops confirm on box — TrueNAS db already unpublished |
| 2. Wire scheduled ingest + freshness path | **Closed** — unattended 3am two-night proof (2026-08-28 and 2026-08-29) plus ingest-worker Cron Job drain (2026-08-31 07:01–07:09Z, 6/6 `succeeded`) |
| 3. One successful ingest (non-empty ranked window) | **Closed (manual dry-run)** — 246/246 fresh @ ZIP `23111`; see §10 Status |
| 4. `db:backup-restore-drill` on TrueNAS target | **Closed (2026-08-31)** — host dump/restore into `yum4less_backup_drill`; counts **276/324/29** matched; drill DB dropped |
| 5. Public/WAN exposure | **Closed (2026-08-03/04)** — Cloudflare Tunnel → `https://yum4less.com/` ([§12](#12-cloudflare-tunnel-wan--live)) |
| 6. Prod env flags on app | Confirm after each Watchtower recreate: `TRUST_PROXY_HEADERS=1`, `YUM4LESS_TRUSTED_PROXY_VERIFIED=1`, feedback/analytics as desired |
| Watchtower first hourly scan | **Closed** (owner 2026-09-01 paste) — 2026-08-31 22:55Z `Updated=2` (`72c6591` / `bfe5bf4`); later hourly sessions `Updated=0`. **2026-09-03 23:55Z** `Updated=2` again — app `73645334fbd8`, ingest `1aa2eb2dec54` (owner migrate `030`/`031` after pull). |

---

## 12. Cloudflare Tunnel (WAN) — live

**Status (2026-08-03/04):** Public HTTPS for the shopper app is **live**.

| Piece | Choice |
|-------|--------|
| Domain | `yum4less.com` (Cloudflare registrar / DNS) |
| Tunnel name | `truenas-homelab` |
| Connector | `cloudflare/cloudflared` as a **TrueNAS Custom App** (Docker) — **not** a laptop/`cloudflared.exe service install` |
| Public hostname | `yum4less.com` → HTTP origin `http://192.168.1.246:3000` (LAN app publish) |
| Proof | Off-network browser OK; `curl` HTTPS `200`; `POST /api/market-search` `ok: true`; feedback POST + admin GET OK |

### 12.1 App env required behind Tunnel

```yaml
TRUST_PROXY_HEADERS: "1"
YUM4LESS_TRUSTED_PROXY_VERIFIED: "1"
```

Without these, all clients share the `"unknown"` rate-limit bucket.

Optional (enabled on live box as of 2026-08-04):

```yaml
YUM4LESS_FEEDBACK_ENABLED: "1"
YUM4LESS_FEEDBACK_ADMIN_KEY: "<secret>"
YUM4LESS_ENABLE_ANALYTICS: "1"
YUM4LESS_ANALYTICS_SINK: "postgres"
# NEXT_PUBLIC_YUM4LESS_ANALYTICS is baked at image *build* time (CI passes =1) — runtime alone is not enough
```

**Owner console (2026-08-06; ingredient review 2026-08-22; create-id 2026-08-24; tabs 2026-08-25; junk heal 2026-08-25; Coverage 2026-08-26):** after Watchtower pulls an image that includes `/owner`, open `https://yum4less.com/owner` and paste `YUM4LESS_FEEDBACK_ADMIN_KEY`. Tabs: **Ingredient review**, **User feedback**, **Analytics**, **Coverage**. Coverage is read-only (search name, city/state, usable-in-app) over `store_coverage`. TrueNAS has **`024`**, **`025`**, and **`026`** (`025`/`026` applied **2026-08-27 00:04Z**). Missing `026` on other volumes shows a notice on that tab only. Yes can map a flyer line to an existing food id or **create** a kebab-case id with name + category (see [`docs/feedback-path.md`](feedback-path.md)). Live ingest skips junk and heals matching pending rows; `npm run owner:reject-pending-junk-reviews` is the one-shot for existing queues. Not linked from shopper nav. Curl still works for `GET /api/feedback` and `GET /api/analytics/events` with the same key. Image pull alone does **not** run migrations. Future `db/init` files still need an operator migrate.

### 12.2 `cloudflared` Custom App shape

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: "<from Zero Trust tunnel install UI — keep secret>"
```

No host ports. Connector dials **out** to Cloudflare.

### 12.3 Free-tier note

Advanced Cloudflare WAF / custom rate-limit rules may be unavailable on Free. Rely on in-app rate limits + Bot Fight / Security Level as available. Edge rate limiting remains a nice-to-have, not a hard dependency for household beta.

### 12.4 GYAM sequencing

Add GYAM as another public hostname on the **same** tunnel after Yum4Less path is stable — see vault Homelab / GYAM notes.

---

## Pre-go-live gaps (flag — don’t fix in this pass)

Issues to resolve **before** relying on unattended cron:

| Gap | Risk under cron | Mitigation until code changes |
|-----|-----------------|-------------------------------|
| **`ensure-test-db.mjs` requires Docker** (host path) | Cron fails if Docker stopped or user lacks permission | Host path: `restart: unless-stopped`; docker group. **Ingest container:** set `YUM4LESS_EXTERNAL_POSTGRES=1` (image default) — TCP `psql`, no socket |
| **Stale schema detection throws** (no auto-reset without `YUM4LESS_ALLOW_DB_RESET=1`) | After pulling migrations, cron may exit until manual migrate | After each deploy with `db/init` changes, run migrate via ingest once-shot or `npm run db:migrate`; never enable auto-reset on shared homelab `yum4less_dev` |
| **`assert-live-ingest-env` does not require `KROGER_API_ENV=production`** | Cron exits 0 but Kroger official API sync no-ops | Set `KROGER_API_ENV=production` explicitly on ingest env |
| **`YUM4LESS_INGEST_ZIPS` unset and `active_markets` empty** | Ingest exits non-zero (no `23111` default) | Activate a ZIP in `/owner` Markets (or `npm run markets:activate -- <ZIP>`), or set overlay ZIPs; verify stores in §4.2 SQL |
| **Map catalog failure is non-fatal** | Cron exit 0 with degraded OSM/catalog | Read warnings in log; rerun `ingest:map-catalog` manually |
| **Partial weekly-ad chain failure** | Exit **non-zero** if **Kroger / Aldi / Publix / Food Lion / Walmart / Dollar General** error or persist-fail. Lidl flyer errors warn and do **not** fail the job | Scan ranked `[kroger]` / `[aldi]` / `[publix]` / `[food-lion]` / `[walmart]` / `[dollar-general]` lines first; Lidl issues are expected-degraded |
| **Playwright / headless deps on Linux** | Kroger scrape fallback fails with browser launch errors | Host: `playwright install-deps`. **Ingest image:** deps baked in |
| **No interactive prompts in scheduled path** | ✅ None found — safe for no-TTY cron | — |
| **Parent wrapper does not load `.env.local` before `ensure-test-db`** | ✅ Child TS scripts load it; DB URL defaults match compose | Ingest container: pass env explicitly in Custom App YAML |
| **M128 automated per-chain kill switches** | Not implemented — manual pause only | Watch for 403/WAF strings in logs; pause chains operationally |
| **Watchtower vs TrueNAS Apps ownership** | Apps UI may desync after Watchtower recreate | §11.4 — validate; fall back to manual YAML pin bumps |
| **README step order was wrong** | Confusion only | Fixed — see README link to this doc |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-03 | Dollar General live Flipp ingest + food-desert dinners (`031`). Same floors as other ranked banners. Sale list can show DG weekly-ad rows without ranking. Lidl stays fail-soft. |
| 2026-08-04 | §12 Cloudflare Tunnel **live** (`yum4less.com`); TRUST_PROXY + feedback/analytics ops notes; CI/Dockerfile bake `NEXT_PUBLIC_YUM4LESS_ANALYTICS=1` for published app images; shopper UI copy trim cross-ref |
| 2026-07-26 | §10 / §11 marked **deployed and verified** on TrueNAS (same-stack ingest; sibling Watchtower Custom App; `:homelab` + enable label on app; one-shot dry-run 246/246 @ ZIP `23111`; Watchtower Discord + label-scope logs). Still open: 3am cron, Watchtower first hourly scan, backup drill, Cloudflare Tunnel WAN. Added zsh `!` / single-quote `DATABASE_URL` troubleshooting note. |
| 2026-07-23 | §10 ingest container (`Dockerfile.ingest`, GHCR `yum4less-ingest`, `YUM4LESS_EXTERNAL_POSTGRES` TCP path); §11 Watchtower label-scoped hourly updates + Shoutrrr notifications; §8 adds `:homelab` float tag for app+ingest; §9.5 app Watchtower label; §4 leftovers explicitly flagged |
| 2026-07-22 | §9 TrueNAS Apps Custom App: working YAML (`ghcr.io/sfh1980/yum4less-app:f38ce73`), datasets under `appPool/yum4less`, Node `fetch` app healthcheck (no wget), LAN `3000:3000` / no db host port, permissions root causes (999:999 + `chmod -R a+rX` on `db/init`), `sudo docker` + `app_lifecycle.log` troubleshooting |
| 2026-07-20 | CI `publish-image` job: after verify/integration/e2e/semgrep on `master`, push `ghcr.io/sfh1980/yum4less-app:<sha7>` + `:latest` (**public** — inherits public repo); SHA pin for TrueNAS, `latest` convenience-only |
| 2026-07-20 | App containerized: multi-stage `Dockerfile` + Compose `app` service (`depends_on` db healthy); host `next start` superseded for deploy path; TrueNAS YAML later |
| 2026-07-15 | Pass 6: Postgres backup/restore runbook + `db:backup` / `db:restore` / `db:backup-restore-drill` (disposable drill DB) |
| 2026-07-15 | Pass 1 ops truth: ranked-price freshness heartbeat (fail closed on 0-in-24h) + exit-policy doc aligned with any-chain fail-loud |
| 2026-06-29 | Initial homelab scheduled-ingest runbook |
