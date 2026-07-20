# Yum4Less — Tier 2 Comprehensive Audit

**Started / completed:** 2026-07-16  
**Branch:** `master` @ `659013dbeefa96d7bf1994b7cce9af4b5a109512`  
**Protocol:** Audit-first — **no product/code fixes** in this pass. Deliverable limited to this report (+ Continuity pointer).  
**Prior baselines:** [`tier1-foundation-hardening-report.md`](tier1-foundation-hardening-report.md) · [`full-system-run-report.md`](full-system-run-report.md)  
**Scope:** Security · Data integrity/resilience · Efficiency/code health · Playwright edge-case coverage map  
**Checkpoint:** Do **not** implement fixes until Sean reviews and prioritizes this list.

---

## STOP-SHIP (discuss before any other remediation)

### SS-1 — Postgres published on all host interfaces with default credentials

| Field | Detail |
|-------|--------|
| **Severity** | **STOP-SHIP** for any host reachable beyond a locked-down loopback (LAN/homelab/WAN) |
| **New vs known** | **New** (contradicts shipped homelab docs) |
| **Evidence** | `docker-compose.yml:7-11` — `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, ports `"5433:5432"` with **no** `127.0.0.1:` bind. Live host proof this session: `netstat` shows `0.0.0.0:5433` LISTENING; `docker port yum4less-postgres` → `5432/tcp -> 0.0.0.0:5433` and `[::]:5433`. |
| **Doc contradiction** | `docs/homelab-deploy.md:55` states Postgres default is “localhost-only unless you expose it deliberately.” That claim is **false** for the current Compose file. |
| **Reproduction** | 1) `npm run db:up`. 2) From another machine on the same network (or any host that can reach this one’s IP), connect `postgresql://postgres:postgres@<host-ip>:5433/yum4less_dev`. 3) Full read/write/drop of stores, `price_observations`, feedback, analytics, identity graph. |
| **Mechanism** | Docker unqualified host-port publish binds **all** interfaces. Default password is also committed in `.env.example` as the local-dev convention — acceptable on loopback, catastrophic when combined with `0.0.0.0`. |
| **Impact** | Unauthenticated remote DB ownership if host firewall does not block 5433. Highest blast radius of anything found this pass. |
| **Action** | Owner decision before fixes: bind `127.0.0.1:5433:5432` (or firewall), rotate password for any non-loopback deploy, fix homelab doc. **Await explicit go-ahead.** |

---

## Executive summary

Tier 1 closed most foundation P1s (admin key on debug/feedback, Settings gate, backup drill, 022/023 structural probes, identity wiring). Tier 2 finds the codebase **still not ready for scheduled cron / unattended homelab migration** as the next stated goal.

**Strong this session:** typecheck **0**; identity-SSOT gate OK; Semgrep **0** on scanned security set; `npm audit` still **2 moderate / 0 high / 0 critical** (postcss via next — accepted class); live identity graph on `yum4less_dev` clean (0 orphans / 0 bad self / 0 display-cache mismatch); Kroger+Aldi seed pairs confirmed; backup/restore drill **OK** (281 stores / 308 PO / 23 migrations); public APIs stay read-only by default; no CORS wildcard; parameterized app SQL.

**Blocking / high:** Compose Postgres exposure (STOP-SHIP); ops freshness still **0** rows in 24h on `yum4less_dev` (newest 2026-07-12); mid-request DB failures on recommendations can still surface as generic **500** (`assertMarketDataAvailable` not built — known Scale risk B); deep Playwright edge matrix largely **uncovered**; one proven false-completion e2e (`pantry-step`).

**Not reopened as P1 (intentionally deferred / already closed):** in-memory rate limits; SNAP merge exclusion; Kroger-only Settings known-pair; Walmart/BJ's/Lidl/Spoonacular/user-accounts; Slice D; Settings-first gate bypass (CLOSED Pass 5 — re-verified); Home Ingredients silent market error (CLOSED Wave 0 — re-verified); admin-key non-timing-safe compare (known Tier 1 S7 / P2); freshness heartbeat `freshTotal === 0` design (accepted availability signal, not per-chain SLO).

---

## Commands / evidence run this session

| Check | Result |
|-------|--------|
| `git rev-parse HEAD` | `659013d…` on `master` |
| `npm run typecheck` | **0 errors** |
| `node scripts/check-identity-ssot.mjs` | OK |
| `npm audit` | **2 moderate**, 0 high, 0 critical |
| Semgrep MCP (`semgrep_scan` on admin/API/backup/compose) | **0 findings** |
| Postgres MCP identity consistency | orphans/bad-self/display-mismatch **0**; identities **274**; aliases **276** (all confirmed) |
| Postgres MCP freshness | `fresh_24h=0`, `total_po=308`, newest `2026-07-12T04:34:35Z`; migrations **23** incl. 005/019/021/022/023 |
| Seed-pair aliases | Kroger 022 + Aldi 023 both canonical+alias `seeded`/`confirmed` |
| `npm run db:backup-restore-drill` | **OK** — 281 / 308 / 23 round-trip; disposable DB dropped |
| Docker port bind | `0.0.0.0:5433` (see STOP-SHIP) |
| Docker Scout / Trivy on `postgres:17` | **Not completed** — Scout requires login; Trivy not installed |
| Full `npm test` / `test:integration` / `test:e2e:ci` / remote CI | **Not re-run** this audit pass (audit-first; no claim of local-green ≡ CI-green) |

---

## Domain 1 — Security

### Solid (re-verified)

- Admin HTTP surfaces limited to `GET /api/debug/pipeline` and `GET /api/feedback`; both require `isRequestAuthorizedWithAdminKey` when enabled (`debug-admin-auth.ts`, `feedback-admin-auth.ts` → `admin-key-auth.ts`).
- No other admin/destructive HTTP routes among the eight `src/app/api/**/route.ts` files. Backup/restore is CLI-only.
- Shared 64 KiB body limit via `parseJsonBody` on enabled JSON POST paths (`api-request.ts`).
- ZIP / coordinate / store-id / shopping-route validation present and substantive.
- No `Access-Control-Allow-Origin` / CORS middleware in app sources.
- No hardcoded production tokens found in `src/`, `scripts/`, `.env.example` (local `postgres:postgres` is intentional for loopback).
- GitHub MCP hook (`.cursor/hooks/github-mcp.ps1`) passes token via env var name into Docker — does not log the token value.
- Public routes remain unauthenticated by design (household product); rate-limited.

### Findings

| ID | Sev | Title | Reproduction / proof | Mechanism | New vs deferred |
|----|-----|-------|----------------------|-----------|-----------------|
| **SS-1** | STOP-SHIP | Postgres on `0.0.0.0:5433` + default password | See STOP-SHIP block | Compose port publish | **New** |
| S1 | P2 | Admin key uses `===` not `timingSafeEqual` | Read `admin-key-auth.ts:5-26`; measure response timing on progressive Bearer prefixes | Documented intentional deferral | Known (Tier 1 S7) |
| S2 | P2 | Debug dumps rich PII/IDs when `NODE_ENV≠production` + `YUM4LESS_DEBUG_ROUTES_ENABLED=1` | Enable flag, `GET /api/debug/pipeline?lat=…&lng=…` with admin key | Policy gates on NODE_ENV only (`debug-routes-policy.ts`) | Known / ops |
| S3 | P3 | Disabled analytics bypasses 64 KB parse | `POST /api/analytics/events` with analytics **off** and body >64KB → `200 {ok:true}` before `parseJsonBody` (`analytics/events/route.ts:15-17`) | Early return skips shared size enforcement | **New** (low impact: no parse/persist) |
| S4 | P3 | Exact browser coordinates persist indefinitely in `localStorage` | Use geolocation; inspect `yum4less.settings-preferences.v1` → `latitude`/`longitude` | Preferences write path (`use-meal-planner.ts` + `settings-preferences.ts`); analytics explicitly forbid exact coords but prefs do not expire | **New** privacy gap vs stated retention ethos |
| S5 | P2 | No CSP / HSTS | `next.config.ts` headers inventory | Headers incomplete for HTTPS deploy | Known (Tier 1) |
| S6 | Note | Homelab without TLS termination | If Next is WAN/LAN-reachable over HTTP: prefs/coords/ZIP/admin headers readable in transit; all public APIs callable | Open HTTPS item; exposure now concrete | Known open — **documented** |
| S7 | Note | `npm audit` unchanged | 2 moderate postcss/next | No new high/critical | Accepted |
| S8 | Note | Docker base image CVEs | Scout/Trivy unavailable this session | Cannot claim clean/unclean | Gap in audit tooling |

### Injection / secrets

- App SQL reviewed paths use `$1` placeholders (e.g. feedback repo, TheMealDB import query).
- Migration/backup tooling interpolates only identifier-validated names (`spawn-safe.mjs` `/^[a-zA-Z_][a-zA-Z0-9_]*$/`) or escaped literals — no proven user-input SQL injection.
- Full git-history secret sweep was **not** completed this session (spot-check of working tree only). Flag as residual audit gap, not a finding.

---

## Domain 2 — Data integrity & resilience

### Migration ledger

| Check | Result |
|-------|--------|
| 022 / 023 probes | **Structural** — require both members, one matching canonical identity, exactly two aliases, roles/status/`seeded` (`apply-migrations.mjs` identity seed helpers + cases 022/023). Vacuous no-op only when &lt;2 members exist (tested). |
| Older probes (spot-check) | **Weak / existence-class gaps remain** |

| ID | Sev | Title | Proof | Mechanism | Status |
|----|-----|-------|-------|-----------|--------|
| D1 | P2 | Pre-022 ledger probes still existence-only | `apply-migrations.mjs:91-157`: 001/003/004/006/007/010/011 table-only; 012 one column; **021** tables-only despite FKs/indexes in `021_store_identities.sql`; **005** columns-only despite backfill+indexes in SQL; **019** “aldi-23111 absent” and treats missing `stores` table as success | Backfill path records ledger without re-applying missing structural effects if row deleted | **New** (022/023 class fixed; older siblings remain) |

**Reproduction (D1):** On a disposable DB, drop a 021 uniqueness index while leaving tables, delete ledger row `021`, re-run `applyPendingMigrations` — expect ledger backfill without recreating the index (same vacuous-probe class as pre-fix 022).

### Identity graph (`yum4less_dev`, live)

| Check | n |
|-------|---|
| orphan alias → missing identity | 0 |
| orphan alias → missing store | 0 |
| null entity alias | 0 |
| bad self shape | 0 |
| display_cache ≠ canonical store | 0 |
| identities / aliases | 274 / 276 (all confirmed; 0 rejected/provisional) |
| Kroger 022 + Aldi 023 pairs | confirmed/seeded as expected |

| ID | Sev | Title | Proof | Mechanism | Status |
|----|-----|-------|-------|-----------|--------|
| D2 | P3 | No scheduled global identity consistency job | Live sweep this session was manual MCP SQL; only seed-pair probes + FKs exist | Constraints catch FK orphans under normal writes; won’t catch display-cache drift or policy violations after manual SQL | **New** (ops hygiene) |
| D3 | Note | Official-wins is pair/seed policy, not a generic reconciler | Settings hardcodes Kroger official canonical (`store-identity-settings-lookup.ts`); 022 SQL chooses API fields | Known Kroger-only known-pair + Slice D not started | Deferred — **note only** |

### Freshness heartbeat

| ID | Sev | Title | Proof | Decision |
|----|-----|-------|-------|----------|
| D4 | Note / accepted gap | `freshTotal === 0` only | `ingest-freshness-heartbeat.ts:2-8,27-32`; test accepts thin multi-source mix | **Accepted** availability heartbeat, **not** a per-chain SLO. One fresh row among 10k stale **passes by design**. |
| D5 | P1 (ops) | Live `yum4less_dev` has **0** fresh ranked prices in 24h | MCP: `fresh_24h=0`, newest 2026-07-12 | Heartbeat **would fail** if run — good. Unattended cron still unsafe until ingest is regularly green. Rediscovery of Tier 1 ops P1. |

`YUM4LESS_SKIP_FRESHNESS_HEARTBEAT=1` emergency bypass still exists (`scripts/check-ranked-price-freshness.ts`) — operator footgun, not a silent default.

### Backup / restore

| Check | Result |
|-------|--------|
| Drill re-run | **OK** — stores=281, price_observations=308, schema_migrations=23 |
| Guard | Protected DBs (`yum4less_dev`, `postgres`, templates) refuse restore unless `allowProtectedRestore` / CLI `--i-understand-destructively-restore-dev` (`db-backup-restore.mjs:139-146`) |
| Env bypass | **No** env-var bypass found — only explicit option/flag |
| CI auto-bypass | **None** found |

| ID | Sev | Title | Notes |
|----|-----|-------|-------|
| D6 | Note | Guard is explicit-confirm, not authz | Any scripted caller that passes the flag can wipe `yum4less_dev`. Expected for household CLI; not a CI hole. |

### DB-outage honesty (Scale risk B)

`assertMarketDataAvailable()` — **still not built** (Continuity deferred). Current behavior:

| Route | Postgres unreachable at snapshot | Mid-request after snapshot |
|-------|----------------------------------|----------------------------|
| `/api/market-search` | `getMarketDataSnapshot` → `unavailable` → `RecommendationDependencyUnavailableError` → **503** | N/A (snapshot-gated) |
| `/api/recommendations` | Same unavailable check → **503** | `getLatestThemealdbImportAt()` (`recommendation-service.ts:208`) can throw raw pool error → route generic handler → **500** (`recommendations/route.ts:127-131`) |
| `/api/pantry-coverage` | Unavailable → **503** | Same pattern as rank for snapshot gate |
| `/api/shopping-route` | Does not use Postgres | OSRM failure falls back to distance math |

| ID | Sev | Title | Reproduction | Mechanism | Status |
|----|-----|-------|--------------|-----------|--------|
| D7 | P2 | Late recommendation DB failure → 500 not 503 | With market pass-through ready, kill DB (or mock `getLatestThemealdbImportAt` reject) during TheMealDB freshness branch when `market.dataSource === "database"` | Availability asserted once; later query not wrapped | Known Scale risk B — **exact behavior confirmed** |
| D8 | Note | No silent empty success on core two routes for snapshot outage | Code path throws typed unavailable | Better than “empty ok” | Positive |

---

## Domain 3 — Efficiency / codebase health

### N+1 / expand path

| ID | Sev | Title | Proof | Verdict |
|----|-----|-------|-------|---------|
| E1 | — | Alias expand N+1 | `createPostgresStoreIdentityLookup` = **2 queries** (identities + confirmed aliases); market/rank/pantry call once and pass lookup; per-store `expandStoreIdsForRead` is in-memory | **Eliminated**, not relocated to SQL N+1 |

### Duplicate logic / SSOT gate

| ID | Sev | Title | Proof | Status |
|----|-----|-------|-------|--------|
| E2 | P3 | Settings known-pair is a second identity graph | `store-identity-settings-lookup.ts` embeds Kroger ids + `createMemoryStoreIdentityLookup`; `check-identity-ssot.mjs` **allowlists** it and documents per-file co-occurrence gap | Known intentional; gate does **not** catch a deliberately split pair across two new files | Accepted gap — real duplicate found |
| E3 | — | Admin auth | Feedback + debug wrappers both call shared `isRequestAuthorizedWithAdminKey` | No second implementation |

### Dead code

| ID | Sev | Title | Proof |
|----|-----|-------|-------|
| E4 | P3 | Legacy e2e helper wrappers unused | `e2e/helpers.ts` still exports deprecated `goToRankStep` / `completePantryStepAndContinue` / `pickAllIngredientsAndContinue` (superseded by response-backed waiters) |
| E5 | — | `createMapPinIdentityLookup` | No remaining production references (5b revert clean) |

### Bundle / types

| Check | Result |
|-------|--------|
| `tsc --noEmit` | **0** — no regression of 102→0 gate |
| `as any` / `as unknown as` in identity/rank production paths | None found; casts concentrated in tests/mocks |

### False-completion tests

| ID | Sev | Title | Reproduction | Mechanism | Status |
|----|-----|-------|--------------|-----------|--------|
| E6 | P2 | `pantry-step` asserts unconditional heading | `e2e/pantry-step.spec.ts:44-47` clicks Suggest then only waits for “Dinner recommendations”. `handleSuggestRecipesFromPantry` sets `flowStep="results"` **before** rank fetch (`use-meal-planner.ts:931-935`). `MealResultsPanel` **always** renders `<h2>Dinner recommendations</h2>` (`meal-results-panel.tsx:82`) even while loading/error/empty. | Same bug class as fixed overlay flake | **New proven** |
| E7 | Note | Overlay / mvp-flow | `waitForRecommendationsAfterSuggest` + `assertRecommendationsHttpOk` / `assertRecommendationsHaveMeals` | Fixed pattern exists — pantry-step did not adopt it | Contrast |

---

## Domain 4 — Deep Playwright edge-case coverage

**Audit-only:** no new e2e specs written this pass. Matrix below is current coverage vs gap. Each gap is a finding to prioritize for a follow-up implementation sprint (with loud assert-after-status pattern from Wave 1a).

### Coverage matrix

| Scenario | Current | Gap / current behavior |
|----------|---------|------------------------|
| First-visit geo denial | Unit only (`use-meal-planner.test.ts`) | **No e2e** |
| Return-visit denial | Unit only | **No e2e** |
| Granted → revoked mid-session | None | **Full gap** |
| No `navigator.geolocation` | None | **Full gap** |
| Invalid ZIP | `settings-stores.spec.ts` (`abc`) | No provider-invalid / out-of-range semantic path beyond client five-digit check |
| Geocodio quota exhausted | Route/unit only | **No e2e** shopper copy |
| Recommendations 429 | Helper fails loud on *unexpected* 429 | **No** intentional 429 mock + UI assert |
| Market-search 429 | None | **Gap** |
| Recommendations 500 | `api-errors.spec.ts` | Shows error heading; does **not** assert spinner clear / retry |
| Market-search 500 | `api-errors.spec.ts` | Same |
| Timeout both routes | None | **Gap** |
| Rapid double-submit | None | Unit has request-id discard; **no e2e** |
| Settings / store change mid-rank | Unit clears stale results | **No e2e** race |
| Settings gate / bottom-nav bypass | `navigation-theme.spec.ts` disables Home/Deals/Saved until setup; `isAppTabEnabled` + `handleTabChange` guard | **CLOSED** (Pass 5) — open item **stale**. Residual: no e2e for programmatic tab change beyond disabled buttons |
| Zero aliases / rejected-only / confirmThreshold | Integration/unit only | **No e2e** |
| Mobile critical path | `mobile-smoke.spec.ts` = nav visibility only | **Not** search→rank→cook. Production `getCurrentPosition` called **without** options (`use-meal-planner.ts:389,659`) → browser default `enableHighAccuracy: false` already |
| Weekly-ad malformed silent-skip | Unit fixtures + per-chain fallbacks | Kroger+Publix share `catch { // Ignore malformed script payloads }` (`parse-kroger-weekly-ad.ts:127-128`, `parse-publix-weekly-ad.ts` same). Empty-offer path can look like “quiet week” if **all** scripts fail — **P3** sweep candidate |
| DB-outage mid-flow UI | Generic 500 mocks | **No** controlled kill-DB mid-flow e2e |

### Domain 4 findings summary

| ID | Sev | Title | Status |
|----|-----|-------|--------|
| P4-1 | P2 | Pantry-step false-completion (see E6) | Proven |
| P4-2 | P2 | No e2e for geo denial / missing API / mid-session revoke | Coverage gap |
| P4-3 | P2 | No e2e for 429 / timeout / double-submit / mid-flight store change | Coverage gap |
| P4-4 | P2 | Mobile smoke ≠ mobile critical path | Coverage gap |
| P4-5 | P3 | Malformed weekly-ad JSON swallow without parse-error metric | Same shape family as Publix silent-skip (not proven live regression) |
| P4-6 | Note | Settings gate bypass | **Not a finding** — CLOSED; Continuity row accurate |

---

## Intentionally deferred (not reopened)

| Item | Audit treatment |
|------|-----------------|
| In-memory rate limits | Note only — holds single-process; no shared store |
| SNAP merge exclusion / SNAP matching flag OFF | Note |
| Kroger-only Settings known-pair | Note (E2) |
| Walmart / BJ's / Lidl ranked / Spoonacular / accounts | Out of v1 |
| Slice D batch matcher | Not started |
| `enableHighAccuracy` explicit PositionOptions | Open backlog — current call sites omit options (default false) |
| HTTPS / reverse-proxy TLS | Open — exposure documented under S6 + SS-1 |
| Heartbeat thin-fresh pass | Accepted (D4) |

---

## Closing verdict

**Not yet Tier-2 / unattended-homelab ready.**

Local type/identity/backup foundations are stronger than at Tier 1 close, and several former P1s (Settings gate, admin-keyed debug, 022/023 probes, backup drill, Home Ingredients blank) **re-verify as closed**. But STOP-SHIP Compose Postgres exposure, ongoing **0-in-24h** ranked freshness on the live dev DB, incomplete DB-outage status semantics, and a large unproven Playwright edge matrix mean this codebase is **not** ready to treat scheduled cron / homelab migration as the next safe goal.

**Next checkpoint:** Sean prioritizes STOP-SHIP + the P1/P2 list. No fixes in this pass. Follow-up implementation slices should keep proof-of-catch (revert → fail → re-apply → pass) and close items only with a real GitHub Actions run link when claiming CI-green.

---

## Suggested fix priority (for owner triage — not started)

1. **SS-1** — bind Postgres to loopback (or firewall) + correct `homelab-deploy.md`  
2. **D5** — restore daily ingest / confirm heartbeat fails loud on this host until fresh  
3. **E6 / P4-1** — fix pantry-step assertion (reuse Wave 1a waiter)  
4. **D7** — wrap late DB reads as unavailable/503 (or build `assertMarketDataAvailable`)  
5. **D1** — harden 005/019/021-class probes when touching ledger next  
6. **Domain 4 matrix** — implement high-value e2e gaps with loud status asserts  
7. **S1 / S3 / S4 / S5** — timing-safe admin key, analytics body limit, prefs retention, CSP/HSTS when TLS lands  

---

*Agents consulted (explore): security, data-integrity, efficiency/e2e. Postgres MCP + Semgrep MCP used. No product code modified.*
