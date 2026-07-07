# Yum4Less — Full-System Verification Run Report

> **Superseded:** Counts below predate pantry-check v2 (**848** unit tests as of `97d9ed0`); see [`PROJECT_CONTINUITY.md`](../../PROJECT_CONTINUITY.md) for current state.

**Started:** 2026-07-06  
**Completed:** 2026-07-06  
**Branch:** `master` @ `759eee1` (synced with `origin/master`)  
**Working tree:** `M PROJECT_CONTINUITY.md` only  
**Protocol:** Read-only audit — edits limited to `docs/audits/`

---

## Executive summary

Full-repo verification ran all eight project agents (waves A–C), Bugbot + Security Review (diff-supplemental), local gates, and five MCP servers. **All local runtime gates pass this session:** lint, **809/809** unit, build, **27/27** integration, **22/1/0** e2e. **Remote `master` CI was green** on 2026-07-05 ([run 28759320503](https://github.com/sfh1980/Yum4Less/actions/runs/28759320503)).

**Highest-risk items (fix first):**

| # | Severity | Finding |
|---|----------|---------|
| 1 | **P0 (trust)** | Weekly-ad **24h ranked reads vs 14-day promotion gate** mismatch — can suppress ranked pricing while ingest health looks fine |
| 2 | **P1** | **Settings-first gate bypassable** via bottom nav (Home/Deals/Saved before setup complete) |
| 3 | **P1** | **Home tab silent market-search failure** — Ingredients step renders nothing; errors only on Deals/Settings |
| 4 | **P1** | **M128/M151 scrape automation not shipped**; `.cursor/agents/ingest-standards.md` still claims robots.txt / kill switches |
| 5 | **P1** | **Homelab misconfig risk** — debug routes + API writes gated only on `NODE_ENV=production` |
| 6 | **P1** | **Any weekly-ad chain `error` blocks entire cron** (provider-sync + TheMealDB skipped) |
| 7 | **P1** | **Migration drift** — `015`/`016` not applied on existing DB volumes without reset |
| 8 | **P2** | **`npx tsc --noEmit` — 64 errors** — not a CI merge gate |
| 9 | **P2** | **Verification snapshot stale** — Resume still cites 808 unit / 24 integration; remote CI “not green” outdated |

**Not claimed:** verified, production-ready, deploy-ready, beta v1 demo-complete, homelab deploy-ready.

**Diff-supplemental (uncommitted):** Only `PROJECT_CONTINUITY.md` + this report changed. Bugbot: **no bugs**. Security Review: **no medium+** in diff.

---

## Phase status

| Phase | Status | Outcome |
|-------|--------|---------|
| 0 Preflight | **done** | Node 22.18, npm 10.9.3, Docker 29.6.1, Semgrep 1.165.0, gh OK |
| 1 Wave A | **done** | explore + senior-auditor + verifier; explore handoff via Task return |
| 2 Wave B | **done** | frontend, backend, database, ingest |
| 3 Wave C | **done** | qa-engineer, testing-cicd, Bugbot (no findings), security-review (diff clean) |
| 4 Parent review | **done** | Architecture pass below |
| 5 Local gates | **done** | lint OK; **809/809** unit; build OK; **27/27** integration; **22/1/0** e2e |
| 6 MCP | **done** | Postgres partial; Semgrep 0 findings; Context7 OK; GitHub via `gh`; Playwright **degraded** |
| 7 Deliverables | **done** | This report |

---

## Commands run (Phase 5)

| Command | Exit | Result |
|---------|------|--------|
| `npm run lint` | 0 | OK |
| `npm test` | 0 | **809 passed**, 152 files |
| `npm run build` | 0 | Next.js **15.5.19** OK |
| `npm run db:up` | 0 | Postgres container running |
| `npm run test:integration` | 0 | **27 passed**, 8 files |
| `npm run test:e2e:ci` | 0 | **22 passed**, **1 skipped** (H12), **0 failed** (~3.6m) |

**Not run:** `npx tsc --noEmit` (continuity baseline 64 errors documented).

---

## MCP evidence and gaps

| Server | Status | Evidence |
|--------|--------|----------|
| **postgres** | **partial** | `price_observations`: **263** rows on `yum4less_dev` (single-query success; multi-statement query failed MCP schema once) |
| **semgrep** | **used** | `semgrep_scan` on 5 API routes — **0 findings** (v1.165.0) |
| **context7** | **used** | `/vercel/next.js/v15.1.11` route handler validation docs retrieved |
| **github** | **used** | `gh run list/view` — master CI **success** 2026-07-05; dependabot PR CI failed at `npm ci` |
| **playwright** | **degraded** | `localhost:3000` — HTTP **500**, empty snapshot, webpack runtime error; stale `npm run dev` likely. Trust-label exploratory flow **not completed**. E2e CI on **:3100** is authoritative this session. |

**GitHub MCP:** Only `SERVER_METADATA.json` in mcps folder — used `gh` CLI instead.

---

## Hook / rule / subagent coverage

| Layer | Triggered | Evidence |
|-------|-----------|----------|
| Workspace rules | Y | orchestration, testing-gates, product-trust, security, scale-awareness, governance |
| beforeShellExecution | Y | Phase 5 npm commands |
| beforeMCPExecution | Y | Postgres, Semgrep, Context7, Playwright calls |
| afterFileEdit + Semgrep | Y | Checkpoint writes under `docs/audits/` |
| subagentStop explore handoff | Y | explore agent completed (Task return) |
| Project agents (8) | Y | All invoked via Task waves |
| Bugbot | Y | No findings (docs-only diff) |
| Security Review | Y | No medium+ in diff |
| Local gates | Y | All pass — see commands table |

---

## Severity-ordered findings (consolidated)

### P0 — trust / ranking correctness

**P0-1 — Weekly-ad freshness policy mismatch**  
Ranked reads filter to **24h** (`ranked-price-cache-policy.ts`); promotion gates allow **14 days** (`weekly-ad-coverage.ts`); ingestion status is unfiltered. Symptom: ranked pricing suppressed while ingest dashboards still look healthy (data 24h–14d old). Documented in `PROJECT_CONTINUITY.md` deferred backlog 2026-07-06. **No automated test aligns the three policies.**  
Evidence: `src/lib/ranked-price-cache-policy.ts`, `src/lib/weekly-ad-ingestion/weekly-ad-coverage.ts`, `weekly-ad-promotion-readiness.ts`.

### P1 — user-facing / operational

**P1-1 — Settings-first gate bypassable**  
`handleTabChange` allows Home/Deals/Saved before `setupComplete`. Only Cook is disabled.  
Evidence: `use-meal-planner.ts`, `bottom-nav.tsx`, `app-tab.ts`.

**P1-2 — Home silent market-search failure**  
Auto-load failure leaves `marketSearchState.status === "error"` but Home Ingredients renders nothing (no error panel). Deals tab shows errors.  
Evidence: `use-meal-planner.ts` (~495–518), `index.tsx`, contrast `deals-panel.tsx`.

**P1-3 — Geolocation denial asymmetry**  
First-visit “Use my location” denial: hard error, no ZIP fallback. Return visit auto-load falls back to saved ZIP.  
Evidence: `handleBrowserLocationSearch` vs `runMarketSearchFromSavedPreferences`.

**P1-4 — M128/M151 manual pause only; agent doc drift**  
No robots.txt, auto-pause, or `YUM4LESS_DISABLE_INGEST_*` in code. `.cursor/agents/ingest-standards.md` still describes automation as shipped.  
Evidence: security rule vs `ingest-standards.md`; grep confirms zero kill-switch env vars.

**P1-5 — Homelab `NODE_ENV` misconfig exposes debug + optional API writes**  
`isDebugRoutesEnabled()` and `isPublicApiDbWriteEnabled()` only hard-block when `NODE_ENV=production`.  
Evidence: `debug-routes-policy.ts`, `public-api-db-write-policy.ts`.

**P1-6 — Rate limits: in-memory + proxy spoof risk**  
Per-process buckets; `TRUST_PROXY_HEADERS=1` honors `X-Forwarded-For` without requiring `YUM4LESS_TRUSTED_PROXY_VERIFIED=1`.  
Evidence: `rate-limit.ts`, `api-rate-limit.ts`.

**P1-7 — Weekly-ad cron: any chain `error` fails entire run**  
Blocks provider-sync + TheMealDB even when other chains succeeded. `docs/homelab-deploy.md` incorrectly says “all chains error”.  
Evidence: `ingest-script-exit-policy.ts`, `run-scheduled-weekly-ad-ingest.mjs`.

**P1-8 — Provider-sync exits 0 when entirely skipped**  
`failedCount === 0` on configuration skips (`not-production`, mapping failures).  
Evidence: `provider-price-observation-sync.ts`, `sync-provider-prices.ts`.

**P1-9 — Migration drift on existing DB volumes**  
`applyPhaseCMigrationsIfMissing()` does not cover `015`/`016`; no `schema_migrations` ledger.  
Evidence: `scripts/ensure-test-db.mjs`, `db/init/015_*.sql`, `db/init/016_*.sql`.

**P1-10 — Cook tab blank shell (deferred backlog)**  
`activeTab === "cook" && !cookEnabled` renders empty main content.  
Evidence: `index.tsx`, `PROJECT_CONTINUITY.md` P1-8.

### P2 — hygiene / docs / CI

**P2-1 — `tsc --noEmit` 64 errors not gated in CI**  
Weekly-ad test mock drift; CI runs lint + vitest + build only.

**P2-2 — Verification snapshot stale**  
Resume claims 808 unit / 24 integration / remote CI not green — superseded by this session + 2026-07-05 green master run.

**P2-3 — M156 pattern gap: “save money” in expanded trust copy**  
`pricing-trust-heads-up-expanded.ts` uses phrase not in `FORBIDDEN_TRUST_CLAIM_PATTERNS`.

**P2-4 — Semgrep CI advisory without `SEMGREP_APP_TOKEN`**  
Exits 0 when token unset (remote master had token — Semgrep ran ~4m, no blocking findings).

**P2-5 — Q27/Q28 freshness metadata not on rank API**  
Full sanitized `experience.market` still returned; no `marketFreshAt`/`marketStale`.

**P2-6 — Map overlays lack focus trap**  
`store-map-overlay.tsx` does not reuse `use-modal-dialog.ts` pattern.

**P2-7 — H12 map mount failure skipped in e2e**  
`error-surfaces.spec.ts` — Leaflet quirk intentional skip.

**P2-8 — README Resume anchor drift**  
Link text `as-of-2026-06-25` vs Resume header 2026-07-03.

**P2-9 — `ensure-snap-context.mjs` hardcodes `yum4less_dev`**  
Ignores `DATABASE_URL` on homelab with alternate DB name.

**P2-10 — Geocodio global upstream bucket (20/min)**  
All users share one quota key; API key in query string.  
Evidence: `geocoding.ts`.

---

## Feature health matrix

| Step | Status | Notes |
|------|--------|-------|
| Location (geo/ZIP) | **degraded** | Denial asymmetry; stale ZIP on geo save; hero ZIP-first copy |
| Store discovery | **working** | E2e settings-stores pass; Settings error hints incomplete (title/hint) |
| Preferences / Settings | **degraded** | Gate bypass; save/ZIP validation edge cases |
| Rank | **working** | Unit + e2e pass; race guards solid |
| Results + trust labels | **working** | Verifier partially verified; C1 contract tested |
| Map / Tier C | **working** | E2e tier-c pass; overlay a11y gaps |
| Ingest / DB | **working** | Fixture path OK; migration upgrade path weak |
| CI remote | **green (master)** | 2026-07-05; dependabot PR failing `npm ci` |

---

## Parent code review (Phase 4)

**Architecture strengths:** Two-route public API split; Zod contracts; `chain-rollout-policy.ts` canonical lists; market pass-through rehydration + trust field recompute; fixture-ingest DB guard; C1 notice+results contract; parameterized SQL in repositories.

**God modules (recurrence risk):** `weekly-ad-ingestion-service.ts` (~4.1k LOC), `market-search-service.ts` (~3.6k), `store-catalog-sync.ts` (~3.4k), `provider-price-observation-sync.ts` (~3.3k), `recommendation-service.ts` (~2.8k), `use-meal-planner.ts` (~900+).

**Structural patterns:** Errors/recovery concentrated on Settings/Deals, not Home happy path; parallel chain config in `provider-rollout.ts` vs `chain-rollout-policy.ts`; three overlapping DB apply mechanisms without ledger.

**Vibe-coder smells:** Large `as` usage in weekly-ad test mocks (drives tsc baseline); no `dangerouslySetInnerHTML` in `src/**`.

**Doc truth:** `e2e/README.md` accurate. `PROJECT_CONTINUITY.md` Resume internally consistent on product scope but **verification snapshot and gate counts need refresh**. `ingest-standards.md` agent file contradicts shipped M128 reality.

---

## Agent summaries (one line each)

| Agent | Headline |
|-------|----------|
| explore | 7 API routes; god modules; promotion-gate mismatch; ingest agent doc drift |
| senior-auditor | Solid SQL/sanitization; highest risks operational (scrape, NODE_ENV, rate limits) |
| verifier | **Partially verified** — trust UI/API strong; freshness mismatch + M156 gap |
| web-frontend-standards | Gate bypass H1; M148 analytics missing; overlay a11y gaps |
| web-backend-standards | Core trust paths pass; Q27/Q28 drift; unbounded ID arrays |
| database-codegen-standards | Parameterized SQL sound; migration ledger + 015/016 upgrade gap |
| ingest-standards | Pipeline order sound; doc drift C1; cron exit semantics H1/H2 |
| qa-engineer | No new P0; Home silent failure + geo asymmetry + prefs desync |
| testing-cicd-standards | Master CI green; snapshot stale; tsc ungated; freshness not tested |
| Bugbot | No bugs in diff |
| security-review (diff) | Docs-only diff — no new security issues |

---

## Refactor backlog (recommended only — not implemented)

1. Align weekly-ad **24h read / 14d promotion / ingestion status** into one policy + fixture tests.
2. Enforce Settings-first gate on all tabs; surface `marketSearchState` on Home Ingredients.
3. `schema_migrations` table + apply-all-incremental on `db:up` / `ensure-test-db`.
4. Align `.cursor/agents/ingest-standards.md` with manual-pause-only reality.
5. Split `use-meal-planner.ts` into market-search, rank, settings hooks.
6. Redis/platform rate limits + `YUM4LESS_PUBLIC_DEPLOY=1` hard deny debug/API writes.
7. Add `tsc --noEmit` to CI after mock drift cleanup.
8. Reuse `useModalDialog` on map overlays + rank loading overlay.
9. M148 first-visit analytics notice component.

---

## Residual risk

- **Playwright MCP** trust-label pass incomplete — stale dev server 500 on `:3000`; use `npm run start` on `:3000` or fixture e2e for browser evidence.
- **Postgres MCP** partial — only row count captured; freshness-by-chain not queried.
- **Owner browser verify** both themes still pending per continuity.
- **Homelab deploy** precursors not met (M128 automation, TLS, multi-instance rate limits).
- **Promotion gate mismatch** can cause Tier C more often than shoppers expect — trust-sensitive, not gated by CI.

---

## Preflight snapshot

| Tool | Version / status |
|------|------------------|
| Node | v22.18.0 |
| npm | 10.9.3 |
| Docker | Client 29.6.1 |
| Semgrep | 1.165.0 |
| gh | authenticated (sfh1980) |

**Git:** `master` @ `759eee1`; only `PROJECT_CONTINUITY.md` modified.

---

## Scale check (audit-only)

- **Small scale:** This session’s gate output is recorded; diff is docs-only; e2e **22/1/0** confirms prior port-contention failures are not reproduced.
- **Large scale:** Recurring patterns are **freshness-policy fragmentation**, **Settings-orchestration error surfacing on Home**, **migration discipline without ledger**, and **agent-doc drift on ingest compliance** — fixes should target shared abstractions, not one-off copy.

---

## Next steps (owner)

```
Refresh PROJECT_CONTINUITY.md verification snapshot from this report; fix P0-1 freshness alignment first.
```

```
@web-frontend-standards Settings gate bypass + Home market-search error surfacing from full-system-run-report.md
```

---

*Checkpoint updated: 2026-07-06 — all phases done*
