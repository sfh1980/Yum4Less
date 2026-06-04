# Yum4Less agent and MCP guide

Quick index for Cursor agents, rules, hooks, and MCP servers. **Orchestration rule:** `.cursor/rules/yum4less-agent-orchestration.mdc` (always on).

## Routing (every conversation)

When you ask an implementation, debugging, verification, or MVP question **without** `@` a project agent, the agent should open with a short **Routing** section:

- **Suggested @ agent** (if any)
- **Optional rephrased prompt** you can paste next time
- **Likely tests / MCP** for that slice

The `beforeSubmitPrompt` hook and session context reinforce this. Skip Routing only for trivial acks or when you already `@` the right agent.

### Suggested prompt footer (implementation tasks)

> Follow `yum4less-agent-orchestration.mdc` and `AGENTS.md`; run the checklist and MCP for this slice before saying done.

## MVP shoring-up (any conversation)

Local MVP is **demo-complete for ZIP `23111`** on **fixture ingest + Postgres**. Live ingest gaps stay documented honestly.

| Your goal | Start chat with | Tests before done | MCP / agent |
|---|---|---|---|
| UI, map, carousel, trust copy | `@web-frontend-standards` | `npm test` | Playwright MCP after `npm run dev`; `@verifier` if trust wording changed |
| API, providers, recommendations | `@web-backend-standards` | `npm test`; `npm run build` if routes changed | — |
| Schema, seed, ingest, pricing rows | `@database-codegen-standards` | `npm test`; `npm run test:integration` | Postgres MCP after `npm run db:up` |
| CI, e2e, merge-ready | `@testing-cicd-standards` | per change | GitHub MCP or `gh` |
| Trust / verified / rollout claims | `@verifier` | tests + evidence | Playwright + Postgres as needed |
| Security / dependency audit | `@senior-auditor` | review + route tests | Semgrep Guardian when configured |
| Unknown multi-file area | normal agent + Task `explore` | then area-specific | explore first, then edit |

**Open gaps (not hidden):** Walmart ranked pricing/promotion is intentionally skipped for now even though fixture/live ingest code paths exist; Aldi/Food Lion use a stronger Flipp retry + flyer/search-term ladder before direct scrape, but live retailer pages can still block; analytics is first-party and off by default until env flags are set; deployment not started unless reprioritized. When deployment starts, move the Kroger API app from certification to production before live Kroger price claims. **Remote CI green** on https://github.com/sfh1980/Yum4Less (2026-05-27).

## Project agents (`.cursor/agents/`)

Invoke with **@agent-name** in chat or follow the agent checklist when the orchestration rule triggers.

| Agent | Use when |
|---|---|
| `@verifier` | Trust/freshness/coverage claims; before "verified" or merge-ready language |
| `@web-frontend-standards` | UI, map, forms, carousel, trust modals, accessibility |
| `@web-backend-standards` | API routes, validation, providers, recommendation services |
| `@database-codegen-standards` | PostgreSQL schema, seed, ingest, SQL |
| `@testing-cicd-standards` | CI, test strategy, release gates |
| `@senior-auditor` | Security and dependency audits |

## MCP servers (`.cursor/mcp.json`)

| Server | Use when | Setup |
|---|---|---|
| **postgres** | Schema, seed, latest `price_observations`, ingest verification | `npm run db:up`; port `5433`; read-only |
| **playwright** | UI/map/trust flows Vitest cannot prove | `npm run dev`; test ZIP `23111` |
| **github** | PR checks, workflow failures, release status | `GITHUB_PERSONAL_ACCESS_TOKEN`; Docker for official server |
| **semgrep** | Security, dependency, and secrets scanning for agent-written code and PR/release review | Semgrep CLI available locally; `semgrep login` for Guardian products |

Copy `.cursor/mcp.json.example` → `.cursor/mcp.json` locally; never commit tokens. Semgrep requires the local `semgrep` CLI before its MCP server or hooks can run; the project wrappers also check Python user-script installs.

## Scoped rules (auto when matching files are open)

| Rule | Globs |
|---|---|
| `yum4less-frontend-workflow` | `src/components/**`, `globals.css`, `e2e/**` |
| `yum4less-backend-api-workflow` | `src/app/api/**`, provider/recommendation libs |
| `yum4less-database-ingest-workflow` | `db/**`, weekly-ad ingest, market repository |

## Hooks (`.cursor/hooks.json`)

| Event | Purpose |
|---|---|
| `sessionStart` | README check + orchestration/MVP context + port 5433/3000 preflight |
| `beforeSubmitPrompt` | Route user prompts to suggested @ agent + rephrase |
| `afterFileEdit` | Nudge frontend/DB verification when matching paths edit |
| `afterFileEdit` | Run non-blocking local Semgrep security/TypeScript scan when `semgrep` is installed; otherwise remind that setup is incomplete |
| `beforeMCPExecution` | Remind agent to read MCP tool schema first |
| `subagentStop` (`explore`) | Hand off to scoped rules + orchestration after explore |
| `beforeShellExecution` | Package/MCP install guard |
| `stop` | Non-blocking Semgrep Guardian final scan plus diff-aware verification reminder (`loop_limit: 1`) |

## Production-lean refactor (owner direction)

**Keep:** current UI/UX (`recommendation-demo` is the real home-page flow), all meals/recipes/prices already in Postgres, fixture ingest for dev/CI only (honestly labeled).

**Remove over time:** runtime `mock-market-data` and misleading mock/demo naming on live paths; in-memory market fallbacks; copy that implies live store data when it is rehearsal or unavailable.

**Add later:** live retailer/recipe APIs layered on Postgres — do not wipe existing DB meal rows.

### Master prompt (paste to start a refactor chat)

```text
Yum4Less production-lean refactor: Keep the current UI/UX and every meal/recipe/price row already in Postgres. Remove runtime mock/demo code paths and rename misleading mock/demo identifiers so the live app is database-first; add external APIs later on top. Keep fixture weekly-ad ingest for dev/CI only (rehearsal data in real tables, never presented as live). Do not redesign the page. Do not delete Postgres content.

@web-backend-standards @web-frontend-standards @database-codegen-standards — follow yum4less-agent-orchestration.mdc and AGENTS.md; run npm test (+ test:integration / Postgres MCP if DB paths change) before done.
```

### Phased slices (one chat per slice)

| Phase | Prompt keywords | Agents | Gates |
|-------|-----------------|--------|-------|
| 1 — CI smoke stability | `vitest`, `recommendation-demo.test`, `CI-01`, `testTimeout` | `@testing-cicd-standards` | `npm test` |
| 2 — Rename demo UI folder | `rename recommendation-demo`, `meal planner`, no UX redesign | `@web-frontend-standards` | `npm test`; Playwright if trust copy moves |
| 3 — Retire runtime mock catalog | `mock-market-data`, `database-first`, rename Mock* types | `@web-backend-standards` `@database-codegen-standards` | `npm test`; `npm run test:integration` |
| 4 — Trust copy pass | `estimated`, `directional`, `limited coverage`, fallback banner | `@web-frontend-standards` `@verifier` | `npm test`; Playwright MCP |
| 5 — Live API rollout | `Kroger`, `Publix`, weekly-ad ingest, chain parser | `@database-codegen-standards` | ingest + Postgres MCP |

Use Task `explore` before phase 2–3 if touching many imports.

## Minimum verification (any code change)

1. `npm test`
2. `npm run build` if routes/imports/config changed
3. `npm run test:integration` if Postgres behavior changed
4. Playwright MCP if trust-sensitive UI changed
5. Postgres MCP if DB/ingest truth claims are made
6. Semgrep Guardian for security-sensitive, dependency, secrets, PR, or release-readiness claims
