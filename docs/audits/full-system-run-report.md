# Yum4Less — Full-System Verification Run Report

> **Correction (2026-07-04, post-run):** The **5 e2e failures** reported in this document's original run were caused by **port contention from a concurrent `npm run dev` on port 3000**, not application regressions. An isolated rerun with **no other dev server running** produced **22 passed / 1 skipped / 0 failed**. **P1-1 ("E2e CI regression this session")** should be considered **resolved / non-issue**, not an open finding. The original report text below is preserved for history — do not read it as current truth without this correction.

**Started:** 2026-07-04  
**Completed:** 2026-07-04  
**Branch:** `master` (large uncommitted working tree)  
**Protocol:** Read-only audit — no application code changes

---

## Executive summary

This session ran the v2 full-system verification prompt across all eight project agents (waves A–C), local gates, and five MCP servers. **Unit, build, and integration gates pass** in this session. **`npm run test:e2e:ci` failed** (17 passed / 5 failed / 1 skipped, exit 1) — materially worse than the 2026-07-03 continuity snapshot (21/1/1). Failures cluster on **Settings market-search → store picker** (`combobox` never appears) and **Tier C** copy assertion — consistent with the P0 finding that Settings does not surface market-search errors and Home can go blank.

**Highest-risk items (fix first):**

| # | Severity | Finding |
|---|----------|---------|
| 1 | **P0** | Settings does not render `marketSearchState` errors — failed ZIP/geolocation invisible on default tab; Home Ingredients can go blank |
| 2 | **P0** | Multi-store “uncheck all” shows **unscoped** stores (violates store-selection contract) |
| 3 | **P1** | E2e regression: 5 failures this session vs documented 21 pass |
| 4 | **P1** | Debug pipeline unauthenticated, no rate limit in non-production |
| 5 | **P1** | In-memory rate limits + `TRUST_PROXY_HEADERS` spoof risk at homelab scale |
| 6 | **P1** | M128/M151 automation not shipped; `ingest-standards.md` agent doc drifts |
| 7 | **P1** | Provider-sync persist failures do not fail cron exit code |
| 8 | **P2** | README D7/theme status stale vs `PROJECT_CONTINUITY.md` |
| 9 | **P2** | CI e2e job does not depend on integration job |

**Not claimed:** verified, production-ready, deploy-ready, CI green, beta v1 demo-complete.

---

## Phase status

| Phase | Status | Outcome |
|-------|--------|---------|
| 0 Preflight | **done** | Node 22.18, npm 10.9.3, Docker 29.6.1, Semgrep 1.165.0, gh authenticated |
| 1 Wave A | **done** | explore + senior-auditor + verifier |
| 2 Wave B | **done** | frontend, backend, database, ingest agents |
| 3 Wave C | **done** | qa-engineer, testing-cicd, Bugbot (retry), security-review |
| 4 Parent review | **done** | Architecture pass appended below |
| 5 Local gates | **done** | lint OK; test 785/785; build OK; integration 24/24; **e2e 17/5/1 FAIL** |
| 6 MCP | **done** | Postgres, Semgrep, Context7, GitHub partial; Playwright **blocked** (Internal Server Error on :3000) |
| 7 Deliverables | **done** | This report |

---

## Commands run (Phase 5)

| Command | Exit | Result |
|---------|------|--------|
| `npm run lint` | 0 | OK |
| `npm test` | 0 | **785 passed**, 148 files |
| `npm run build` | 0 | Next.js **15.5.19** OK |
| `npm run db:up` | 0 | Postgres container running |
| `npm run test:integration` | 0 | **24 passed**, 7 files |
| `npm run test:e2e:ci` | **1** | **17 passed, 5 failed, 1 skipped** (12.9m) |

### E2e failures (this session)

1. `settings-stores.spec.ts` — store combobox not visible after Find stores
2. `settings-stores.spec.ts` — ZIP validation error not visible
3. `single-store-map-overlay.spec.ts` (×2) — store combobox / market-search timeout
4. `tier-c.spec.ts` — limited-coverage copy assertion failed

**Note:** Concurrent `npm run dev` on port 3000 showed Internal Server Error during Playwright MCP — possible port/resource contention during e2e (server on 3100). E2e failures appear substantive (Settings error surfacing), not only contention.

---

## MCP evidence and gaps

| Server | Status | Evidence |
|--------|--------|----------|
| **postgres** | **used** | 336 `price_observations`, 291 stores, 36 recipes, 155 ingredients; freshness newest 2026-07-03; sources: kroger-official-api (91), food-lion/publix/aldi weekly-ad |
| **semgrep** | **used** | `semgrep_scan` on 5 API routes — **0 findings** (v1.165.0) |
| **context7** | **used** | `/vercel/next.js/v15.1.11` route handler validation docs retrieved |
| **github** | **partial** | `gh workflow list` — CI workflow active; remote run status not inspected (unpushed local changes per continuity) |
| **playwright** | **blocked** | `localhost:3000` returned Internal Server Error; trust-label exploratory flow not completed |

---

## Hook / rule / subagent coverage

| Layer | Triggered | Evidence |
|-------|-----------|----------|
| Workspace rules | Y | orchestration, testing-gates, product-trust, security, scale-awareness, governance |
| sessionStart | Y | New Agent chat |
| beforeSubmitPrompt | Y | Routing section in parent response |
| beforeShellExecution | Y | Phase 5 npm commands |
| beforeMCPExecution | Y | Phase 6 MCP calls |
| afterFileEdit + Semgrep | Y | Checkpoint writes under `docs/audits/` |
| subagentStop explore handoff | Y | explore agent completed (handoff via Task return) |
| stop hooks | pending | End of parent turn |
| Project agents (8) | Y | All invoked via Task waves |
| Bugbot | Y (retry) | 1 medium diff finding: CI bootstrap upsert metadata |
| Security Review | Y | No medium+ in diff; hardening noted |
| Local gates | Y | See commands table |
| MCP servers (5) | 4/5 | Playwright blocked |

### Agent summaries

- **explore:** 7 API routes mapped; god modules `use-meal-planner.ts` (~912 LOC), `store-catalog-sync.ts` (~1082 LOC)
- **senior-auditor:** Debug route, rate limits, feedback GET, M128 doc drift
- **verifier:** Trust implementation sound; README D7 drift; stale TheMealDB opt-in help copy
- **web-frontend-standards:** P0 Settings error hiding; coordinate-first copy inversion
- **web-backend-standards:** Strong validation/sanitization; Q27/Q28 freshness metadata drift
- **database-codegen-standards:** No migration ledger; ranked-price uniqueness app-only
- **ingest-standards:** Partial chain failure exit 0; provider-sync persist not fatal
- **qa-engineer:** P0 blank Home + uncheck-all scoping
- **testing-cicd-standards:** E2e not gated on integration; Semgrep advisory

---

## Severity-ordered findings

### P0

**P0-1 — Settings hides market-search failures (frontend + QA)**  
`SettingsPanel` receives `marketSearchLoading` but not `marketSearchState`. Errors only visible on Deals tab. Home Ingredients step can render nothing.  
Evidence: `src/components/meal-planner/index.tsx`, `settings-panel.tsx`; e2e `settings-stores.spec.ts` failures.

**P0-2 — Multi-store uncheck-all shows all stores**  
`filterNearbyStoresBySelection` / `scopeMarketSummaryToSelectedStores` return unfiltered market when `selectedStoreIds.length === 0`.  
Evidence: `src/lib/store-scope.ts` (per qa-engineer); violates redesign store-scoping contract.

### P1

**P1-1 — E2e CI regression this session**  
17/5/1 vs continuity 21/1/1. Settings and Tier C specs failed.

**P1-2 — Debug pipeline exposure**  
`GET /api/debug/pipeline` — no rate limit; rich internals when `NODE_ENV !== production`.  
Evidence: `src/app/api/debug/pipeline/route.ts`.

**P1-3 — Rate limiting not production-safe**  
In-memory per-process buckets; `TRUST_PROXY_HEADERS=1` without trusted proxy enables bypass.  
Evidence: `src/lib/rate-limit.ts`.

**P1-4 — Unauthenticated feedback GET**  
When `YUM4LESS_FEEDBACK_ENABLED=1`, lists 20 recent submissions including notes.  
Evidence: `src/app/api/feedback/route.ts`.

**P1-5 — M128/M151 manual pause only; agent doc drift**  
`.cursor/agents/ingest-standards.md` claims robots.txt, auto-pause, `YUM4LESS_DISABLE_INGEST_*` — **not in code**.

**P1-6 — Provider-sync persist failures exit 0**  
`sync-provider-prices.ts` logs `failedCount` but does not `process.exit(1)`.  
Evidence: `scripts/sync-provider-prices.ts`, `provider-price-observation-sync.ts`.

**P1-7 — Partial weekly-ad chain failure exits 0**  
Only all-chain error triggers non-zero exit.  
Evidence: `scripts/ingest-weekly-ads.ts`.

**P1-8 — Cook tab vs marketBlocked**  
`marketBlocked` can hide valid session results on Cook after store scope change.  
Evidence: `meal-results-panel.tsx`, `use-meal-planner.ts`.

**P1-9 — Store selection changes do not invalidate rank state**  
Stale recommendations after Settings store change without re-rank.

**P1-10 — No DB migration ledger**  
Long-lived dev DBs can miss 005–009 tables; `applyPhaseCMigrationsIfMissing` partial.  
Evidence: `scripts/ensure-test-db.mjs`, database-codegen agent.

### P2

**P2-1 — README D7 “not shipped” vs continuity “done”**  
`README.md` vs `PROJECT_CONTINUITY.md` Resume.

**P2-2 — Stale TheMealDB “opt-in” help copy**  
`src/lib/help-hint-content.ts` `recipeSourceHelp`.

**P2-3 — CI e2e does not `need` integration**  
`.github/workflows/ci.yml`.

**P2-4 — Semgrep CI advisory**  
Exits 0 without `SEMGREP_APP_TOKEN`.

**P2-5 — H12 map mount failure skipped in e2e**  
`e2e/error-surfaces.spec.ts`.

**P2-6 — CI bootstrap upsert metadata (Bugbot diff)**  
`db/ci/014_ci_bootstrap_stores.sql` ON CONFLICT updates coords only — stale name/city on re-apply.

**P2-7 — `e2e/README.md` drift**  
Missing `coordinate-first-cold`, `single-store-map-overlay`; wrong DB name (`yum4less_dev` vs `yum4less_test`).

**P2-8 — M148 analytics notice missing**  
No first-visit analytics transparency in app shell.

**P2-9 — Map overlay joins by store name**  
`src/lib/meal-presentation.ts` TODO.

**P2-10 — Q27/Q28 market freshness metadata not in rank API response**  
Full `experience.market` still returned.

---

## Feature health matrix

| Step | Status | Notes |
|------|--------|-------|
| Location (geo/ZIP) | **degraded** | Geolocation denial paths inconsistent; hero ZIP-first copy |
| Store discovery | **degraded** | Settings errors hidden; e2e Find stores → no store picker |
| Preferences / Settings | **working** | Unit tests pass; e2e Settings flows fail |
| Rank | **working** | Unit + most e2e pass |
| Results + trust labels | **working** | Vitest + mvp-flow e2e; verifier pass on code |
| Map / Tier C | **degraded** | Tier C e2e failed this session; map overlays lack focus trap |
| Ingest / DB | **working** | Fixture path OK; Postgres MCP shows 336 observations |
| CI remote | **untested** | Local changes not pushed; last remote green 2026-06-11 per continuity |

---

## Parent code review (Phase 4)

**Architecture strengths:** Two-route public API split; Zod contracts; `chain-rollout-policy.ts` canonical lists; market pass-through rehydration + trust field recompute; fixture-ingest DB guard; C1 notice+results contract tested.

**Recurrence risks:** `use-meal-planner.ts` god hook; `store-catalog-sync.ts` god module; parallel chain config in `provider-rollout.ts`; duplicated SQL filter constants; type re-export indirection via `recommendation-service.ts`.

**Vibe-coder smells:** Large uncommitted tree includes many root-level PNG screenshots and `tsconfig.tsbuildinfo` — hygiene risk if accidentally committed.

**Doc truth:** `PROJECT_CONTINUITY.md` Resume is internally consistent; `README.md` lags on D7 and theme status.

---

## Refactor backlog (recommended only)

1. Split `use-meal-planner.ts` into market-search, rank, and settings hooks with shared generation tokens.
2. Extract ingest map-catalog vs ranked-chain concerns from `store-catalog-sync.ts`.
3. Redis/platform rate limits before homelab multi-instance.
4. `schema_migrations` table + full stale-DB detection.
5. Partial unique index on `price_observations (store_id, ingredient_id)` for ranked sources.
6. Unify `source_kind` vs `source_name` in read path.
7. Slim rank API response (Q27/Q28 freshness metadata).
8. Implement M128 homelab kill-switch env vars when deploy slice ships.

---

## Residual risk

- **Remote CI** not re-run after local e2e regression — cannot claim CI green.
- **Playwright MCP** trust-label browser pass incomplete (server error on :3000).
- **Owner browser verify** both themes still pending per continuity.
- **Homelab deploy** precursors not met.
- **Live ingest** scrape compliance manual-only.
- **5 e2e failures** need root-cause before merge-ready browser claims.

---

## Preflight snapshot

**Git:** `master` @ `d2b54d6`; massive uncommitted diff (redesign slices, e2e, agents, rules).  
**Prior continuity gates (2026-07-03):** 785 unit, 24 integration, 21 e2e — **superseded for e2e by this session**.

---

## Scale check (audit-only)

- **Small scale:** Symptom-level risks documented with file evidence and this session's gate output.
- **Large scale:** Recurring patterns are god modules, Settings-orchestration error surfacing, and store-scoping edge cases — fixes should target shared abstractions (`marketSearchState` wiring, `store-scope` empty-selection semantics), not one-off copy patches.

---

## Next steps (owner)

```
Fix only P0/P1 from docs/audits/full-system-run-report.md; smallest safe fix only; run npm test.
```

For e2e-specific regression:
```
@testing-cicd-standards Investigate settings-stores + tier-c e2e failures from full-system-run-report.md
```
