# Yum4Less agent and MCP guide

Index for Cursor **project agents**, **MCP servers**, and the **verification floor**. Detail lives in agent files (`.cursor/agents/`), orchestration rules, and scoped workflow rules — not here.

**Mandatory on every slice:** [`.cursor/rules/yum4less-agent-orchestration.mdc`](.cursor/rules/yum4less-agent-orchestration.mdc) (routing, trigger table, before-done checklist). **Every fix response** also includes the Scale check block from [`.cursor/rules/yum4less-scale-awareness.mdc`](.cursor/rules/yum4less-scale-awareness.mdc).

> **Also:** [`README.md`](README.md) · [`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md) (decisions + redesign plan)

---

## Project agents (`.cursor/agents/`)

Invoke with **@agent-name** or apply that agent’s checklist when the orchestration trigger table applies.

| Agent | One-line role |
|---|---|
| `@verifier` | Readonly trust/freshness/coverage verification before “verified” or merge-ready language |
| `@web-frontend-standards` | UI, map, forms, results accordion, trust modals, accessibility, coordinate-first flows, 5-tab shell |
| `@web-backend-standards` | API routes, validation, providers, recommendation services, cache-first read paths |
| `@database-codegen-standards` | PostgreSQL schema, seed, migrations, SQL, ingest persistence |
| `@ingest-standards` | Scheduled ingest pipeline, weekly-ad/scrape, map-catalog, fixture vs live policy, `probe:*` |
| `@testing-cicd-standards` | CI gates, test strategy, release readiness, GitHub workflow inspection |
| `@qa-engineer` | Readonly exploratory QA on flows and edge cases; prioritized findings upstream of automated tests and verification |
| `@senior-auditor` | Readonly security, dependency, and misleading-claims audit |

**Routing:** When you ask without `@` an agent, the response opens with a short **Routing** section (suggested agent, rephrased prompt, likely gates). The `beforeSubmitPrompt` hook may inject hints.

---

## Verification floor (Q56)

Before **verified**, **merge-ready**, **CI green**, **deploy-ready**, or **beta v1 demo-complete** language:

| Always | Requirement |
|---|---|
| Unit tests | `npm test` actually run; **pass count stated explicitly** — not assumed |

| If the change touched… | Also mandatory |
|---|---|
| DB schema, migration, seed, ingest persist semantics | `npm run test:integration` (`npm run db:up` first) |
| UI trust copy, search flow, map, results accordion, modals | `npm run test:e2e:ci` when specs or flow wiring changed; Playwright MCP for gaps committed e2e does not cover (coordinates **`37.6085`, `-77.3739`** primary; ZIP **`23111`** fallback-path only) |
| Persisted data / freshness / store lineup / `price_observations` claims | Postgres MCP after `npm run db:up` (read-only) |
| Routes, imports, Next.js config | `npm run build` |
| Security-sensitive code, deps, secrets surfaces | Semgrep when configured; `@senior-auditor` for audits |
| CI / release-readiness claims | GitHub MCP or `gh` — inspect workflow outcomes |
| Trust-sensitive pricing / rollout logic | `@verifier` or its readonly checklist |
| `PROJECT_CONTINUITY.md` verification snapshot or Resume status claims | Must cite **actual command output run in this session** — not a prior session's number, not an agent's stated prediction of what a result "should" be |

**Never sufficient alone:** “tests pass” without naming which suites, “logic looks correct,” or assuming owner manual spot-check.

**Downgrade** to **partially verified** when the floor for the touched category is not met.

**Owner probes (`probe:*`):** never part of this floor; never CI merge gates.

**Continuity:** Material test changes → update `PROJECT_CONTINUITY.md` verification snapshot in the same slice.

Full trigger table and MCP detail → **`.cursor/rules/yum4less-agent-orchestration.mdc`** and **`.cursor/rules/yum4less-testing-and-release-gates.mdc`**.

---

## MCP servers

Copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) → `.cursor/mcp.json` locally. **Never commit tokens.**

| MCP | Required when | Prerequisites |
|---|---|---|
| **postgres** | Schema/seed/`price_observations`/ingest state; DB truth claims integration tests do not settle | `npm run db:up`; port **5433**; read-only |
| **playwright** | Exploratory UI beyond committed `e2e/` specs; codify recurring findings into `e2e/*.spec.ts` | `npm run dev`; fixture/seed data; see `e2e/README.md` |
| **github** | PR checks, workflow failures, release-status claims | Docker + [`.cursor/hooks/github-mcp.ps1`](.cursor/hooks/github-mcp.ps1): uses `GITHUB_PERSONAL_ACCESS_TOKEN` if set, else `gh auth token`; prefer `gh` for writes |
| **semgrep** | Security/dependency/secrets review; agent-written code scan | Local `semgrep` CLI; hooks advisory if missing |
| **context7** | Current library/framework docs when API uncertainty | Optional `CONTEXT7_API_KEY` |

Read each tool schema under `mcps/<server>/tools/` before calling MCP tools.

**Do not add MCP servers** without explicit owner approval (governance rule).
