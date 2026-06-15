# Yum4Less agent and MCP guide

Index for Cursor **agents**, **MCP servers**, **hooks**, and **verification gates**.

**Mandatory on every slice:** [`.cursor/rules/yum4less-agent-orchestration.mdc`](.cursor/rules/yum4less-agent-orchestration.mdc) (routing, trigger table, before-done checklist).

> **Also:** [`README.md`](README.md) — setup and commands · [`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md) — history, decisions, verification snapshot

---

## Routing

When you ask an implementation, debugging, or verification question **without** `@` a project agent, the agent opens with a short **Routing** section: suggested `@` agent, optional rephrased prompt, likely tests/MCP. Skip for trivial acks or when you already `@` the right agent.

**Implementation footer:**

> Follow `yum4less-agent-orchestration.mdc` and `AGENTS.md`; run the checklist and MCP for this slice before saying done.

---

## Slice router

| Your goal | Start with | Tests before done | MCP / agent |
|---|---|---|---|
| UI, map, carousel, trust copy | `@web-frontend-standards` | `npm test` | Playwright MCP after `npm run dev`; `@verifier` if trust wording changed |
| API, providers, recommendations | `@web-backend-standards` | `npm test`; `npm run build` if routes changed | — |
| Schema, seed, ingest, pricing rows | `@database-codegen-standards` | `npm test`; `npm run test:integration` | Postgres MCP after `npm run db:up` |
| CI, e2e, merge-ready | `@testing-cicd-standards` | per change | GitHub MCP or `gh` |
| Trust / verified / rollout claims | `@verifier` | tests + evidence | Playwright + Postgres as needed |
| Security / dependency audit | `@senior-auditor` | review + route tests | Semgrep when configured |
| Unknown multi-file area | Task `explore` | then row above | explore first |

**Trust boundaries:** ranked totals are **estimates**; v1 ranked chains are **Kroger family + Aldi** only; Walmart ranked pricing is deferred; Tier C map/context is normal outside gate coverage; do not claim beta v1 demo-complete, deploy-ready, CI green, or verified without evidence. Current snapshot → [`PROJECT_CONTINUITY.md` → Resume](PROJECT_CONTINUITY.md#resume-as-of-2026-06-08).

---

## Project agents (`.cursor/agents/`)

Invoke with **@agent-name** or apply the agent checklist yourself when the orchestration trigger table applies.

| Agent | Use when |
|---|---|
| `@verifier` | Trust/freshness/coverage claims; before "verified" or merge-ready language |
| `@web-frontend-standards` | UI, map, forms, carousel, trust modals, accessibility |
| `@web-backend-standards` | API routes, validation, providers, recommendation services |
| `@database-codegen-standards` | PostgreSQL schema, seed, ingest, SQL |
| `@testing-cicd-standards` | CI, test strategy, release gates |
| `@senior-auditor` | Security and dependency audits |

---

## MCP servers

Copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) → `.cursor/mcp.json` locally. **Never commit tokens.**

| Server | Use when | Prerequisite |
|---|---|---|
| **postgres** | Schema, seed, latest `price_observations`, ingest verification | `npm run db:up`; port **5433**; read-only |
| **playwright** | UI/map/trust flows Vitest cannot prove | `npm run dev`; ZIP **23111**; fixture data |
| **github** | PR checks, workflow failures, release status | Docker + `GITHUB_PERSONAL_ACCESS_TOKEN` |
| **semgrep** | Security, dependency, secrets scan (agent code, PR review) | Local `semgrep` CLI; hooks are advisory if missing |
| **context7** | Current library/framework docs | `npx @upstash/context7-mcp`; optional `CONTEXT7_API_KEY` |

Read each tool schema under `mcps/<server>/tools/` before calling MCP tools.

### One-time setup

1. Copy `.cursor/mcp.json.example` → `.cursor/mcp.json`.
2. **Restart Cursor** so MCP servers load.
3. **Postgres:** `npm run db:up` before DB tools.
4. **GitHub:** fine-grained PAT with repo read → user env `GITHUB_PERSONAL_ACCESS_TOKEN` (never commit). First run: `docker pull ghcr.io/github/github-mcp-server`.
5. **Playwright:** optional `npx playwright install chromium`.
6. **Semgrep (Windows):** `pipx install semgrep` → `semgrep login` for Guardian products; hooks prepend `%USERPROFILE%\.local\bin`.
7. **Context7:** optional `CONTEXT7_API_KEY` for higher rate limits.

**Semgrep CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs an advisory job that skips until repo secret `SEMGREP_APP_TOKEN` is set. Lint, unit, build, integration, and E2E remain merge gates.

**Do not add MCP servers** without explicit owner approval (governance rule).

---

## Playwright MCP checklist (ZIP `23111`)

Agent-driven browser checks when Vitest cannot prove visible trust copy. **Not** the CI merge gate — that is `npm run test:e2e:ci` (`e2e/mvp-flow.spec.ts`).

**Prerequisites:** `npm run db:up`, `npm run ingest:weekly-ads:fixture` (if prices empty), `npm run dev` on port **3000** (or another port — see below).

**Port in use?** If something already listens on 3000, run `npm run dev -- -p 3001` (or any free port), then set `PLAYWRIGHT_SKIP_WEBSERVER=1` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` before `npm run test:e2e`. Playwright config reads `PORT` and `PLAYWRIGHT_BASE_URL` automatically when reusing an existing server.

1. Open the app (default `http://localhost:3000`, or your chosen port).
2. Assert hero eyebrow: **Yum4Less · Beta v1**.
3. Assert footer link: `Send feedback or report a wrong price` → `/feedback`.
4. ZIP **23111** → **Find nearby stores** → map shows nearby chains (Kroger-family / Aldi context expected with fixture data).
5. **Suggest recipes** from sale ingredients → dismiss trust explainer modal.
6. Assert **Est.** totals on meal cards.
7. Assert directional trust copy (`directional`, `Treat totals as estimates`, weekly-ad labels where applicable).
8. Assert results-panel warning: **Beta v1: totals are estimates**.
9. When multiple meals rank: carousel dots are buttons (`Show recommendation 1`, …); click updates `N of M` hint.

Use fixture/seed data only — do not hit live retailer sites.

---

## Scoped rules (auto when matching paths are open)

| Rule | Globs |
|---|---|
| `yum4less-continuity-journal` | `PROJECT_CONTINUITY.md` |
| `yum4less-frontend-workflow` | `src/components/**`, `globals.css`, `e2e/**` |
| `yum4less-backend-api-workflow` | `src/app/api/**`, provider/recommendation libs |
| `yum4less-database-ingest-workflow` | `db/**`, weekly-ad ingest, market repository |

Always-on: `yum4less-agent-orchestration`, `yum4less-governance-and-doc-sync`, trust/testing/security/product rules in `.cursor/rules/`.

---

## Hooks (`.cursor/hooks.json`)

| Event | Purpose |
|---|---|
| `sessionStart` | Orchestration context + ports 5433/3000 preflight |
| `beforeSubmitPrompt` | Route to suggested @ agent |
| `afterFileEdit` | Path-based verification nudge; advisory Semgrep scan |
| `beforeMCPExecution` | Read MCP tool schema first |
| `subagentStop` (`explore`) | Hand off to scoped rules + orchestration |
| `beforeShellExecution` | Package/MCP install guard |
| `stop` | Advisory Semgrep + diff-aware verification reminder |

---

## Verification gates

**Any code change:** `npm test`.

**Also when triggered** (full table in orchestration rule):

| Change | Extra gates |
|---|---|
| Routes / imports / config | `npm run build` |
| Postgres merge behavior | `npm run test:integration` |
| Trust-sensitive UI | Playwright MCP after `npm run dev` |
| DB/ingest truth claims | Postgres MCP after `npm run db:up` |
| Security / deps / secrets | Semgrep when configured; `@senior-auditor` for audits |
| CI / merge-ready claims | GitHub MCP or `gh` |
| Material slice | Update [`PROJECT_CONTINUITY.md`](PROJECT_CONTINUITY.md) per [continuity journal rule](.cursor/rules/yum4less-continuity-journal.mdc) |

State what you ran and what you did **not** run before saying done.
