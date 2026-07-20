# Yum4Less — Tier 1 Foundation Hardening Audit

**Started:** 2026-07-15 (session resume from interrupted 2026-07-12 attempt)  
**Completed:** 2026-07-15  
**Branch:** `master` @ `812d6b7c6dba551ace9740ca3962ff59d5dd8ddd`  
**Prior baseline:** [`docs/audits/full-system-run-report.md`](full-system-run-report.md) @ 2026-07-11 / `812d6b7`  
**Protocol:** Read-only hardening audit — product/schema edits not applied; deliverable limited to `docs/audits/` (+ Continuity pointer).  
**Scope decision (confirmed):** self-hosted, privacy-first, household — SEO out of scope; mobile = responsive web only (no PWA/native).

---

## 1. Executive summary + P0/P1/P2 table

Foundation is **not** solid enough to treat as “resilient-to-real-world-failure” for unattended homelab migration. Local unit/type/build gates remain strong (**978/978**, typecheck **0**, build OK), but this session **failed** integration (migration-ledger timeout ×2) and e2e (**Publix missing** from Settings store select — regression vs prior 25-pass), while ops still have **0 fresh price_observations in 24h** with **no automated alert**.

Carry-forward backlog + all four addendum-tier items were **CONFIRMED** in this session (code/DB/trace), not merely inherited.

| # | Severity | Finding |
|---|----------|---------|
| 1 | **P1 (ops → P0 if unattended)** | **No ingest freshness alerting** — 0 prices in 24h recurred (newest 2026-07-12; audit day 2026-07-15); only discoverable by manual SQL/audit |
| 2 | **P1** | **e2e: Publix absent from Settings ranked-store select** — `settings-stores.spec.ts` failed with trace; Kroger/Aldi/Food Lion only |
| 3 | **P1** | **Integration flake/hang:** `migration-ledger.integration.test.ts` “applies missing 015/016…” timed out @ 60s **twice** this session (45/46 pass) |
| 4 | **P1** | **022/023 ledger ≠ Kroger twin merge** — files + ledger applied; Kroger API/slug remain separate self-aliases (vacuous probe) |
| 5 | **P1** | **Settings-first gate bypass** — only Cook blocked; Home/Deals/Saved reachable pre-`setupComplete` |
| 6 | **P1** | **Modal `inert` selector mismatch** — live `.meal-planner-grid` vs hook `.meal-planner-grid-col`; unit tests plant fake class |
| 7 | **P1** | **Rank/pantry omit Postgres identity lookup when expand ON** — market-search wires it; rank/pantry default empty lookup |
| 8 | **P1** | **Homelab exit-policy doc drift** — docs say exit 0 if any chain succeeds; code fail-loud on any chain error |
| 9 | **P1** | **No backup/restore procedure** tested or documented |
| 10 | **P1** | **GitHub MCP recurring infrastructure failure** — investigated (not treated as fluke); CI evidence via `gh` |
| 11 | **P1** | **In-memory rate limits** — hold under probe, but no shared/multi-instance story; README already warns |
| 11a | **P1** | **`/api/debug/pipeline` env-gated only** — no shared secret; dumps store IDs + raw observations when enabled outside `NODE_ENV=production` |
| 12 | **P2** | Security headers: **no CSP, no HSTS** (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present) |
| 13 | **P2** | npm audit **2 moderate** (postcss via next) — no high/critical |
| 14 | **P2** | Geo denial copy undifferentiated across TIMEOUT / POSITION_UNAVAILABLE |
| 15 | **P2** | Mid-request post-snapshot DB errors may surface as generic **500** vs typed **503** |
| 16 | **P2** | Carry-forward: remote overlay flake; Cook-tab intermittent timeout; Home silent market-search error |

**P0 product crashes:** none newly proven. Closest operational P0-class risk is **silent stale ranked prices** without alerting before homelab cron goes unattended.

**Verdict:** **partially hardened / not Tier-2-ready for homelab planning.** Proceed to Tier 2 (performance/cross-browser polish) only after clearing or explicitly accepting the P1 ops + gate + e2e regression items. See §10.

---

## 2. Phase status matrix (Phases 0–7)

| Phase | Status | Outcome |
|-------|--------|---------|
| 0 Preflight | **done** | HEAD `812d6b7`, dirty audit/scripts only; Node 22.18.0, npm 10.9.3, Playwright 1.60.0; `db:up` healthy; ingest multi-chain present but stale >24h |
| 1 Security | **done** | OWASP-style code + Semgrep (0 findings on scanned set) + `npm audit`; no wide-open CORS; CSRF low risk for same-origin household API; SSRF low on fixed-URL providers |
| 2 Resilience | **done (code + unit)** | DB→503 pattern; per-chain ingest continue + fail-loud exit; body 64KB structural fix confirmed; live DB drop mid-request **not** chaos-executed this session |
| 3 Data integrity | **done** | Orphan PO=0; 022/023 ledger present; Kroger unmerged; **backup/restore untested** |
| 4 Trust/privacy | **done** | First-party analytics only (off by default); no Google fonts/CDN in layout; freshness SQL would suppress ranked stale rows — UI honesty depends on empty/unavailable path, not silent “fresh” lies |
| 5 Playwright deep | **partial / degraded** | `test:e2e:ci` **24 pass / 1 fail / 1 skip**; Playwright MCP first navigate blocked (chrome-for-testing); browser installed mid-session; addendum items #1–4 **CONFIRMED by code**; inert live DOM proof + 3G/a11y full walk **not** completed |
| 6 Observability | **done** | Structured `logServerError` exists; **no** 0-in-24h alert → **P1** gap |
| 7 Gates + MCP | **done** | Lint/unit/build/typecheck green; integration **fail**; e2e **fail**; Postgres MCP used; Semgrep used; GitHub MCP **error** (root-caused); `gh` for CI |

---

## 3. Commands run + exact counts

| Command | Exit | Result (this session) |
|---------|------|------------------------|
| `git rev-parse HEAD` / branch | 0 | `812d6b7…` on `master` |
| `npm run db:up` | 0 | Container healthy (Up 3 days) |
| `npm run lint` | 0 | OK |
| `npm test` | 0 | **978 passed**, 175 files |
| `npm run typecheck` | 0 | **0 errors** |
| `npm run build` | 0 | Next.js 15.5.19 compiled; 13 routes |
| `npm run test:integration` (1st) | 1 | **45 passed / 1 failed** (ledger timeout) |
| `npm run test:integration` (2nd) | 1 | **45 passed / 1 failed** (same) |
| `npm run test:e2e:ci` | 1 | **24 passed / 1 failed / 1 skipped** |
| Rate-limit probe (`tsx`) | 0 | recommendations limit 20 holds; XFF spoof ignored when proxy trust off |
| Scoped rate/body/route vitest | 0 | **37 passed** |
| `npm audit` | 1\* | **2 moderate**, 0 high, 0 critical |
| Semgrep MCP (`semgrep_scan`) | 0 findings | scanned security-sensitive set |
| `gh run view 29173497984` | 0 | Remote CI **success** on `812d6b7` ([run](https://github.com/sfh1980/Yum4Less/actions/runs/29173497984)) |

\*advisory exit; CI gates `--audit-level=high`.

---

## 4. Security findings (Phase 1)

### Solid

- Public APIs read-only by default; `YUM4LESS_ENABLE_API_DB_WRITES` ignored when `NODE_ENV=production` (`public-api-db-write-policy.ts`).
- Debug pipeline 404 unless policy enabled (`debug/pipeline/route.ts`).
- Parameterized SQL / Zod request parsing; invalid JSON → 400; body size enforced Content-Length **and** UTF-8 bytes (`api-request.ts`, 64 KiB).
- Rate limits documented + unit-tested; forwarded headers ignored unless `TRUST_PROXY_HEADERS=1`.
- Response sanitization path present for public market payloads.
- No third-party analytics scripts in `layout.tsx`; first-party `/api/analytics/events` allowlisted and off by default.
- No `Access-Control-Allow-Origin: *` found in app config/routes (same-origin fetch pattern).
- Semgrep scan: **0 findings** on selected security files.

### Findings

| ID | Sev | Title | Evidence | Household exploitability | Fix direction |
|----|-----|-------|----------|--------------------------|---------------|
| S1 | P2 | Missing CSP / HSTS | `next.config.ts` headers: XFO/nosniff/Referrer/Permissions only | Low on LAN; medium if ever reverse-proxied to WAN | Add CSP + HSTS at proxy or Next headers when TLS terminates |
| S2 | P1 | In-memory RL only | `rate-limit.ts`; probe holds at 20/min key | Multi-instance or restart resets; spoof risk if `TRUST_PROXY_HEADERS=1` without verified proxy | Edge/Redis before multi-instance; keep verified-proxy gate |
| S3 | P2 | No CSRF tokens | State-changing POSTs are first-party JSON APIs without cookies/session auth | Low without auth cookies; rises if shared cookies/auth added | Origin checks / CSRF if auth introduced |
| S4 | P2 | SSRF surface limited | Geocode/Kroger/OSM/Flipp use fixed vendor URLs; ZIP is query param not open URL | Low for household | Keep deny-list if user-controlled URLs ever added |
| S5 | P1 | Settings gate is UI-only | `handleTabChange` / `bottom-nav` — not authz | N/A (product gate, not attacker auth) | Enforce Settings-first in tab state machine |
| S6 | P1 | Debug pipeline no shared secret | `debug-routes-policy.ts`; `debug/pipeline/route.ts` — enabled via env outside production; returns raw PO / store ids | High if LAN-exposed with flag on / non-prod `NODE_ENV` | Require admin secret (feedback pattern) + loopback bind |
| S7 | P2 | Feedback admin key `===` compare | `feedback-admin-auth.ts` | Low on LAN | `timingSafeEqual` |
| S8 | P2 | Overpass URL env footgun | `YUM4LESS_OSM_OVERPASS_URL` fetched without host allowlist | Misconfig SSRF, not user URL | Allowlist known Overpass hosts |
| S9 | P2 | npm audit moderate postcss via next | GHSA-qx2v-qp2m-jg93 | XSS in CSS stringify via vulnerable postcss — constrained by Next’s usage | Wait for Next bump; avoid `--force` to old Next |

Source: late-returning `@senior-auditor` Phase 1 pass (folded after parent draft).

**Auth/authz:** No user accounts in v1. “Admin” surfaces = debug/feedback admin key paths + UI prefs. Debug fail-closed. Feedback admin is key-gated when enabled (prior coverage). No secrets committed in tree this audit.

---

## 5. Resilience findings (Phase 2)

| Scenario | Graceful? | Evidence |
|----------|-----------|----------|
| DB unavailable at snapshot | **Yes** → `source: unavailable` → **503** | `market-repository.ts`, recommendations/market-search routes |
| DB fail after snapshot load | **Partial** — may **500** | recommendation-service later throws |
| One weekly-ad chain scrape error | **Continues other chains**; exit **non-zero** if any error | `weekly-ad-ingestion-service.ts`, `ingest-script-exit-policy.ts` |
| Pre-chain purge throw | **Aborts whole ingest** | purge before loop |
| Geo denied | **ZIP fallback** | `use-meal-planner.ts` |
| Concurrent client requests | **Stale discard via generation tokens** | use-meal-planner |
| Oversized body (105KB class) | **Structurally prevented** | trim + 64KB enforce + tests + e2e api-errors |
| Empty/malformed JSON | **400** | `parseJsonBody` |
| Live Postgres kill mid-request | **Not executed** this session | Degraded — code path only |

---

## 6. Data integrity findings (Phase 3)

### Orphans / referential integrity (Postgres MCP, `yum4less_dev`)

| Check | Result |
|-------|--------|
| `price_observations` orphan `store_id` | **0** |
| FKs | PO→stores CASCADE; identities/aliases constrained (`001`/`021`) |
| Ledger | **000–013, 015–023** present (**022/023 applied_at 2026-07-12**) |
| Aldi↔OSM | Cross-linked under `aldi-mechanicsville` |
| Kroger API↔slug | **Still two identities** (`kroger-02900529`, `kroger-mechanicsville`) — self only |

### Migration 022/023 — definitive resolution

**Not “SQL files missing.”** Seeds exist under `db/init/022_*.sql` / `023_*.sql` and are listed by `apply-migrations`.

**Ledger-only / vacuous-effect defect:** `migrationEffectPresent("022")` returns true if identity `kroger-02900529` exists **or** fewer than 2 member stores exist. Self-alias ingest creates that identity without cross-linking slug, so ledger can record 022 applied while unify intent fails. **Confirmed live.**

### Backup / restore

**No** `pg_dump`/`restore` runbook or drill found for Postgres volumes. Homelab docs cover cron + freshness SQL only. **P1 ops gap** — backup existence was not proven.

### Ingest freshness (Phase 0)

Manual multi-chain ingest **did** land after prior audit (2026-07-12 ~04:27–04:34Z):

| source_name | n | fresh_24h (as of 2026-07-15) |
|-------------|---|------------------------------|
| kroger-official-api | 96 | 0 |
| food-lion-weekly-ad-scrape | 96 | 0 |
| aldi-weekly-ad-scrape | 39 | 0 |
| publix-weekly-ad-scrape | 29 | 0 |
| kroger-weekly-ad-scrape | 28 | 0 |
| lidl-weekly-ad-scrape | 11 | 0 |
| walmart-weekly-ad-scrape | 9 | 0 |
| **total** | **308** | **0** |

Not Kroger-only — but **fully outside 24h ranked window** again.

---

## 7. Trust / privacy audit (Phase 4)

| Claim | Enforced? | Notes |
|-------|-----------|-------|
| Anonymous/first-party analytics only | **Yes (code)** | `track-client-event` → `/api/analytics/events`; allowlist; off by default |
| No third-party fonts/CDN/telemetry scripts | **Yes (layout scan)** | Local CSS tokens; no `googleapis`/`gtag`/Sentry |
| Rate limits in README | **Mostly** | In-memory per-process honesty matches code; probe holds |
| Freshness / Tier C honesty | **Mechanism yes** | `RANKED_PRICE_CACHE_TTL_HOURS=24` SQL filter excludes stale PO; with 0 fresh rows ranked path should empty/unavailable — **not** silently label stale as fresh. Live UI label walk under current data **not** Playwright-completed this session |
| Privacy self-host stance vs analytics | **OK when flags off** | `.env.example` documents opt-in |

---

## 8. Playwright proof-of-catch — four addendum items

| Item | Verdict | Proof this session |
|------|---------|-------------------|
| 1. Modal `inert` DOM mismatch | **CONFIRMED** | Live `meal-planner-grid` (`index.tsx:46`) vs selector `.meal-planner-grid-col` (`use-modal-dialog.ts:35–39`); tests plant fake class (`modal-overlay-focus-trap.test.tsx`). **Live browser inert assert degraded** (MCP chrome missing initially; e2e did not cover this). |
| 2. Rank/pantry identity under expand-ON | **CONFIRMED** | market-search: `createPostgresStoreIdentityLookupSafe` when expand ON; rank/pantry: `createDefaultStoreIdentityLookup()` only; routes do not inject Postgres |
| 3. Vacuous 022/023 probes | **CONFIRMED** | `apply-migrations.mjs:158–185` + live ledger 022/023 with Kroger twins unmerged |
| 4. `homelab-deploy.md` exit-policy drift | **CONFIRMED** | Doc L20/L366 vs `ingest-script-exit-policy.ts:7–16` |

### Additional e2e evidence (new this session)

- **Failed:** `e2e/settings-stores.spec.ts` — expected Publix in Settings store combobox; received Kroger / Aldi / Food Lion only.  
  Trace: `test-results/settings-stores-Settings-s-7fad6-ettings-after-market-search-chromium-retry1/trace.zip`  
  Screenshot/video in same folder.
- Carry-forward Settings gate / Cook timeout / overlay flake: Settings gate **CONFIRMED in code**; Cook/overlay **not re-flaked locally** this run (suite died on Publix first).

### Deep pass not completed

Slow-3G, JS-disabled, breakpoint-boundary walk, keyboard/a11y full shell — **degraded**. Codify addendum #1 into e2e before claiming Tier 5 complete.

---

## 9. Observability gap assessment (Phase 6)

| Capability | Present? | Gap |
|------------|----------|-----|
| Structured JSON errors | **Yes** | `logServerError` / public API error wrapper |
| Per-row ingest persist failures | **Yes** | chain/store/ingredient ids logged |
| Chain scrape console status | **Yes** | human-grepable `[kroger]` / `[aldi]` lines |
| Heartbeat / alert if 0 prices in 24h | **No** | Homelab doc explicitly lists no in-app heartbeat |
| Would 0-in-24h have been caught before manual audit? | **No** | **P1** (P0 for unattended cron) — **root cause of undetected staleness** |

**Required before unattended scheduling:** freshness probe exit non-zero + optional cron email/webhook when `fresh_24h=0` across ranked chains.

---

## 10. Verdict — proceed to Tier 2 / homelab?

**No — not yet as “foundation solid.”**

Safe to plan Tier 2 **only if** owner explicitly accepts residual risk and treats the following as hard precursors (or scoped exceptions):

1. Fix or quarantine e2e Publix Settings regression + restore green `test:e2e:ci`.  
2. Fix migration-ledger integration timeout flake (or raise/diagnose hang).  
3. Add freshness heartbeat / non-zero exit for 0-in-24h.  
4. Close or accept with ticket: Settings gate, inert selector, expand-ON rank/pantry wiring, 022 probe correctness, homelab exit doc, backup restore drill.  
5. Fix GitHub MCP config/env so audits do not rely solely on `gh`.

Unit/build/typecheck alone are **insufficient** for Tier 1 exit under this protocol.

---

## 11. Explicit non-claims

- Not **verified**, **production-ready**, **deploy-ready**, **homelab-ready**, or **beta v1 demo-complete**.  
- Not claiming integration or e2e green this session.  
- Not claiming Playwright MCP exploratory trust/a11y pass.  
- Not claiming GitHub MCP operational.  
- Not claiming live chaos kill of Postgres mid-request.  
- Not claiming Option A expand is live (flags remain OFF — correct).  
- Not claiming Dependabot PRs green.  
- SEO/PWA/native **out of scope** by decision; not audited.

---

## Phase 0 carry-forward re-verification

| Prior item | Status this session |
|------------|---------------------|
| Settings gate bypass | **CONFIRMED** (code) |
| Remote overlay flake | **UNVERIFIED locally** (suite failed earlier; remote prior still noted) |
| Cook-tab timeout | **UNVERIFIED locally** (not hit this run) |
| Modal inert mismatch | **CONFIRMED** |
| Rank/pantry expand-ON identity | **CONFIRMED** |
| Vacuous 022/023 | **CONFIRMED** (mechanism + live) |
| homelab-deploy exit drift | **CONFIRMED** |

---

## GitHub MCP — infrastructure finding (recurring)

**Symptom:** `serverStatus: error` / tools unavailable (same class as 2026-07-11 audit).

**Investigation this session:**

1. `.cursor/mcp.json` runs `docker run … ghcr.io/github/github-mcp-server` with `-e GITHUB_PERSONAL_ACCESS_TOKEN` but **no env value injected in agent shell** (`TOKEN_NOT_IN_SHELL`).  
2. Image help shows required `stdio` / `http` subcommands; bare image entry still attempted stdio in v1.0.4 smoke, so missing `stdio` arg is secondary.  
3. Primary likely cause: **PAT not present in Cursor MCP process environment on Windows**, causing discovery failure → recurring pattern, not a one-off RPC flake.  
4. Mitigated for this audit via `gh` (remote CI success on HEAD).

**Fix direction (owner):** export `GITHUB_PERSONAL_ACCESS_TOKEN` for Cursor Desktop; optionally add `stdio` to args; verify MCP green before next release claim.

---

## MCP evidence matrix

| Server | Status | Use |
|--------|--------|-----|
| postgres | **used** | freshness, ledger, orphans, identities, Publix rows |
| semgrep | **used** | 0 findings on scanned set |
| github | **error (investigated)** | fell back to `gh` |
| playwright | **partial** | navigate blocked then chrome installed; deep pass incomplete |
| context7 | **not required** | skipped |

---

## Agents invoked

- Task explore (Phases 2/3/6 evidence)  
- Task `@qa-engineer` (addendum proof)  
- Task `@senior-auditor` (launched; parent completed OWASP with parallel code review)  
- Parent applied `@verifier`-style non-claims discipline  

---

## Scale check

- **Small scale:** Session recorded live gate outcomes; multi-chain ingest history confirmed; addendum four items proof-caught; new e2e Publix miss + ledger timeout surfaced.  
- **Large scale:** Recurring themes — **ops without heartbeat**, **ledger probes vs semantic effect**, **UI gates without state-machine enforcement**, **test planted selectors vs live DOM**, **MCP/env infra assumed available**. Homelab migration without freshness alerts will repeat the 0-in-24h silent failure class.

---

## Next owner steps (suggested)

```
Restore e2e Publix in Settings select (or update fixture expectations with honesty); fix migration-ledger timeout; add 24h freshness cron probe.
```

```
@web-frontend-standards Settings gate + inert selector on .meal-planner-grid
```

```
@web-backend-standards expand-ON Postgres lookup on rank/pantry parity with market-search
```

```
@database-codegen-standards tighten 022/023 effect probes to require cross-link / seeded method
```

```
@ingest-standards fix homelab-deploy.md exit policy + design freshness alert
```

---

*Checkpoint: 2026-07-15 — Tier 1 protocol complete with honest degradations noted; supersedes reliance on “tests pass” alone for foundation claims.*
