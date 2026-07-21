# Yum4Less — Homelab readiness verdict (convergence)

**Started / completed:** 2026-07-20  
**Branch / SHA:** `master` @ `1b23b0c70d4eca3caa92eff43d17d2e7db3b027b`  
**Protocol:** Consolidate + re-verify known items. **No product fixes.** Deliverable = this file + Continuity pointer.  
**Agents:** `@senior-auditor` + `@verifier` (Task, this session).  
**Prior sources:** [`tier1-foundation-hardening-report.md`](tier1-foundation-hardening-report.md) · [`tier2-comprehensive-audit-report.md`](tier2-comprehensive-audit-report.md) · [`vision-gap-and-ui-stub-report.md`](vision-gap-and-ui-stub-report.md) · `PROJECT_CONTINUITY.md` Resume / Decision log / Deferred backlog.

**CI (current HEAD, not assumed):** [GitHub Actions run 29771363076](https://github.com/sfh1980/Yum4Less/actions/runs/29771363076) — `conclusion: success`, `headSha: 1b23b0c…` (docs/continuity commit that matches this tree).

**Explicit non-claims:** Not `verified` (full product), not `production-ready`, not `deploy-ready`, not `beta v1 demo-complete`, not “unattended cron proven on hardware.” Docker Desktop was **down** this session — live `docker port` / Postgres MCP freshness **not** re-proven on this machine (compose file + bind gate were).

---

## Explicit verdict

### **READY WITH CONDITIONS**

The codebase is **ready to migrate to the homelab and let real users test**, provided the short ops punch list in §4 is done (or accepted as day-one parallel work). Under the strict “blocks migration” bar, the **OPEN — BLOCKS** list is **empty**. Most prior audit P1s are **CLOSED — re-verified**. Remaining gaps are incomplete-but-honest, intentional deferrals, or host ops that do not corrupt data or lie about prices.

---

## 1. Consolidated inventory

### 1.1 CLOSED — re-verified (one line each)

| Item | Evidence this session |
|------|------------------------|
| **SS-1 Postgres loopback bind** | `docker-compose.yml` → `127.0.0.1:5433:5432`; `npm run check:compose-db-bind` **OK**; CI gate present. Live `docker port` **not** re-run (daemon down). |
| **Debug / feedback admin-key gates** | Debug fail-closed in production; non-prod needs flag + admin key. Feedback list key-gated when enabled. |
| **Public API DB writes blocked in production** | `isPublicApiDbWriteEnabled()` hard-false when `NODE_ENV=production`. |
| **No CORS wildcard** | No `Access-Control-Allow-Origin` in `src` / Next config. |
| **Settings-first gate** | `isAppTabEnabled` + BottomNav + `handleTabChange`; unit tests still assert. |
| **Home Ingredients market-search errors** | `IngredientsMarketUnavailable` wired (Wave 0). |
| **Tier C / stale ≠ silent fresh** | Ranked SQL uses 24h `RANKED_PRICE_CACHE_AGE_SQL_FILTER`; miss copy is daily-refresh honesty. |
| **Saved tab honest placeholder** | “Coming soon — no saved data is stored yet.” |
| **Cook blank after rank invalidation (vision B5)** | Cook always mounts `MealResultsPanel` + idle “Suggest recipes on Home first”; `invalidateRankedResults` on store-scope change (2026-07-20 sprint). |
| **App containerized (Compose `app`+`db`)** | Multi-stage Dockerfile + `depends_on` db healthy; local proof 2026-07-20 (`GET /` + market-search `dataSource=database`). TrueNAS Apps translation still next. |
| **Exact coords not persisted in prefs** | `stripExactCoordinates` on read/write; Decision log Active. |
| **Geo-only Settings completion** | Decision + sprint CLOSED; ZIP required only on ZIP path. |
| **Snapshot DB outage → 503** | Market/rank unavailable → `RecommendationDependencyUnavailableError` → **503** (not empty 200). |
| **022/023 structural probes + live heals** | Continuity CLOSED; not re-litigated. |
| **Freshness heartbeat + exit-policy doc (code)** | `check:ranked-price-freshness` + scheduled ingest fatal step; doc aligned fail-loud. |
| **Backup/restore drill (tooling)** | `db:backup-restore-drill` shipped; prior OK evidence in Continuity (281/308/23). |
| **FRESH-1 shared 24h promotion window** | Still shared with ranked cache TTL. |
| **Tier 1 Passes 1–7 / Wave 0–2 / SS-1 / vision sprint 1–6** | Remain CLOSED per Continuity; spot-checks above did not reopen. |

### 1.2 OPEN — BLOCKS HOMELAB MIGRATION

**None.**

No item from the consolidated sources meets the bar (data exposure, data corruption/loss, dishonest/silent-wrong results, or core-flow break) as a **code** blocker for household/LAN real-user testing on a correctly configured loopback Postgres host.

### 1.3 OPEN — DOES NOT BLOCK

| Item | Why not blocking | Notes |
|------|------------------|-------|
| **P1-ops `fresh_24h=0` on `yum4less_dev`** | Stale rows are filtered; users get empty/Tier C, not fake-fresh prices | Ops: run ingest on target before expecting ranked dinners |
| **Heartbeat / cron not live on dedicated hardware** | Code + runbook exist; gap is scheduling on the box | Same class as prior “heartbeat exists in code” — must wire on host (punch list) |
| **Backup/restore drill not yet run on homelab target** | Tooling exists; only prior local drill proven | Re-run once on target (punch list) |
| **TLS / HTTPS not in-repo** | Documented reverse-proxy only | Fine for LAN; required before WAN (condition) |
| **Mid-request TheMealDB DB fail → 500** (Scale risk B remnant) | Fail-loud `ok: false`, not empty success | Shared `assertMarketDataAvailable` still deferred |
| **`e2e/pantry-step` heading-only assert (E6 / vision B1)** | Test can false-complete; shopper UI not shown dishonest by this alone | Adopt Wave 1a waiter when convenient |
| **ZIP-first Settings layout/copy** | Flagged twice; geo-only completion works; visual lead still ZIP | Copy/layout polish — not a flow break |
| **Chain-neutral data-source research** | Scoped, not started | Architecture research — not user-blocking |
| **C6 lightweight start-over** | Parked; no preference | Does not break core flow |
| **Deeper Tier C confidence-logic rework (beyond wording)** | Wording sprint CLOSED; larger Q4 scope open | Honesty floor already met for beta labels |
| **Name-join map overlay (vision B4)** | Can miss pin / wrong twin | Peripheral; not ranking honesty |
| **Older migration probes existence-class (D1)** | 022/023 class fixed; older siblings weak | Ledger hygiene |
| **Deep Playwright edge matrix gaps** | Coverage debt | Does not block real users |
| **CSP / HSTS / timingSafeEqual / in-memory RL / npm moderate postcss** | Known P2 / accepted | LAN-appropriate deferrals |
| **Q1 Publix map-merge align** | Decision locked; code not started | Map display drift — not STOP-SHIP |
| **Identity expand flags OFF / Slice D** | Intentional beta boundary | Cross-source expand opt-in |

### 1.4 DEFERRED / INTENTIONAL (still intentional — not silently rotten)

| Item | Status |
|------|--------|
| SNAP matching OFF / SNAP merge exclusion | Intentional |
| Walmart / BJ's / Lidl meal pricing | Context-only / coming later |
| User accounts | Out of v1 |
| Saved persistence / cuisine R11 | Deferred; Saved already honest |
| Slice D batch matcher | Not started; flags OFF |
| M128/M151 scrape automation | Manual pause only; Decision log Active |
| OSRM driving distance on discovery | Straight-line labeled |
| “Two API routes forever” | **Superseded** by External API Integration Standard (2026-07-17) |
| Homelab DNS/TLS as product feature | Decision: host/ops until owner satisfied |
| Thin-fresh heartbeat design (`freshTotal === 0`) | Accepted availability signal, not per-chain SLO |
| Local-dev `postgres:postgres` on loopback | Intentional; rotate if ever non-loopback |

---

## 2. Homelab-specific readiness check

| Check | Result | Notes |
|-------|--------|-------|
| Compose on target matches SS-1 loopback | **Code YES / live host unproven** | Same `docker-compose.yml` (no separate override). Doc forbids unqualified publish. After `db:up` on target, confirm `127.0.0.1:5433` only. |
| Credentials rotated if non-loopback | **N/A if loopback kept** | Doc requires rotate-away from `postgres:postgres` for any non-loopback. |
| TLS/HTTPS for beyond-localhost | **OPEN (ops)** | `homelab-deploy.md` §6: Caddy/nginx. Not shipped in app. LAN OK; WAN needs proxy. |
| Freshness heartbeat alerting on host | **Code YES / host wiring NO** | Fatal step + optional webhook exist. Cron/`MAILTO`/webhook **not** proven on dedicated hardware (Continuity: not owner-run yet). |
| Backup/restore drill on target | **Tooling YES / target drill NO** | Re-run `npm run db:backup-restore-drill` once on the box. |
| `assertMarketDataAvailable` / Scale risk B | **Still deferred; honesty floor OK** | Snapshot outage → **503**. Mid-request TheMealDB path can still **500** (fail-loud). |

---

## 3. Verdict summary

| Dimension | Call |
|-----------|------|
| Security (LAN / loopback Postgres) | Ready with conditions (keep bind; no debug/write flags in prod) |
| Trust / honesty for real users | Ready with conditions (ingest for ranked meals; accept rare 500) |
| Unattended cron / “set and forget” | **Not** claimed — needs host wiring |
| **Overall** | **READY WITH CONDITIONS** |

---

## 4. Minimum punch list (to clear CONDITIONS)

Not a wishlist — only what stands between “migrate + let testers in” and a clean READY:

1. **On the homelab box:** `docker compose up` → confirm Postgres listens on **`127.0.0.1:5433` only** (not `0.0.0.0`). ~15–30 min.  
2. **Wire scheduled ingest + freshness fail** (`ingest:weekly-ads:scheduled` cron + log/`MAILTO` or `YUM4LESS_FRESHNESS_WEBHOOK_URL`). ~2–4 hours first time.  
3. **One successful ingest** so ranked window is non-empty before promising dinner estimates (keys + ZIPs per runbook). ~1–3 hours (depends on providers).  
4. **Run `npm run db:backup-restore-drill` once on the target** (or equivalent dump→scratch restore). ~30–60 min.  
5. **If testers are outside the LAN:** put **TLS** on a reverse proxy before they touch the endpoint. ~half-day to one small ops slice.  
6. **Homelab app env:** `NODE_ENV=production`; do **not** enable `YUM4LESS_DEBUG_ROUTES_ENABLED` or `YUM4LESS_ENABLE_API_DB_WRITES`. ~minutes.

Optional parallel (do **not** delay migration): pantry-step waiter; ZIP-first Settings copy; Scale risk B 503 wrap; CSP/HSTS when TLS lands.

---

## 5. Continuity / changelog pointer

- Continuity changelog entry for this pass: **`PROJECT_CONTINUITY.md`** (newest) → this file.  
- Resume should cite this verdict as the homelab migration convergence deliverable.  
- Checkpoint: **Sean decides** what (if anything) from §4 is required before copy-to-hardware vs ships in parallel with first testers.

---

## Scale check

```
Scale check:
- Small scale: Y — consolidated four audits + Continuity; re-verified closed security/trust items; empty OPEN-BLOCKS under stated bar; CI link at current HEAD.
- Large scale: Y (flagged, not blocking) — remaining risk is ops on the host (cron/TLS/backup drill), not a new product honesty hole; do not reopen discovery audits until punch-list items fail in the field.
```

---

*Agents: [@senior-auditor](1086ce49-aeb0-474c-b1cf-efa4cbb44f1c) · [@verifier](4eea4da4-2249-4c94-b4f9-c004dd399951). Both independently: READY WITH CONDITIONS; OPEN-BLOCKS empty.*
