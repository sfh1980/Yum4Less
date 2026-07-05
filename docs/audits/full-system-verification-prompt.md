# Yum4Less — full-system verification prompt (v2)

Use this prompt in a **new Agent chat** (fresh session so `sessionStart` hooks run). It exercises workspace rules, hooks, MCP servers, project agents, Bugbot, Security Review, and local test gates — **read-only** on application code.

**Supersedes:** [`full-repo-audit-prompt.md`](full-repo-audit-prompt.md) (kept for history; prefer this file).

---

## How to run

1. Open a **new** Agent chat (not Ask mode).
2. Paste **only** the fenced block below (optionally add one line after it: `Run as a checkpointed audit; resume from the latest phase if interrupted.`).
3. Keep the machine awake for local shell, Docker, and e2e steps.
4. When the run finishes, use a **follow-up chat** for fixes: `Fix only P0/P1 from docs/audits/full-system-run-report.md; smallest safe fix only.`

**Do not `@` agents when pasting** — let `beforeSubmitPrompt` routing fire from audit/security/test keywords, then invoke agents via Task as directed inside the prompt.

---

## What this version fixes

| Problem pattern | v2 approach |
|---|---|
| Too many parallel subagents timing out | **Waves** of 3–4 agents max; parent orchestrates between waves |
| Lost progress on long runs | **Checkpoint file** updated after every phase; explicit resume protocol |
| qa-engineer treated as background | **Explicit Task invocation** per agent definition (not auto-background) |
| PR/commit noise when not ready | **No commits, pushes, or PR creation** — local git read-only + audit artifacts only |
| MCP/hook coverage unclear | **Orchestration manifest** — agent must record what ran vs gap |
| Bugbot/Security Review mistaken for whole-repo | Labeled **diff-supplemental**; explore + domain agents own full-repo |

---

## Orchestration manifest (agent must verify)

| Layer | How this run triggers it | Evidence to record |
|---|---|---|
| Workspace rules (`.cursor/rules/*.mdc`) | Always active in Agent mode | List rules that governed findings |
| `sessionStart` hooks | New chat session | Note session context injected |
| `beforeSubmitPrompt` | Paste without `@` agents; prompt contains audit/security/test keywords | Note routing section appeared |
| `beforeShellExecution` | Every `npm` / `npx` command in Phase 4 | Command list + outcomes |
| `beforeMCPExecution` | Every MCP call in Phase 5 | MCP tool names used |
| `afterFileEdit` + Semgrep advisory | Each checkpoint write under `docs/audits/` | File edit count / Semgrep note |
| `subagentStop` (explore handoff) | Phase 1 `explore` subagent | Handoff received Y/N |
| `stop` hooks | End of parent turn | Semgrep stop scan + verification reminder noted |
| Project agents (8) | Task tool per Phase 2–3 waves | Agent + summary per lane |
| Bugbot + Security Review | Phase 3 supplemental | Diff scope + findings count |
| Local gates | Phase 4 | Exact pass/fail per command |
| MCP servers (5) | Phase 5 | Per-server result or gap |

---

## Copy from here

```text
# Yum4Less — full-system verification, security scan, and audit (read-only)

## Run intent
Perform a **read-only** full-repo verification sweep that exercises:
- all applicable workspace rules in `.cursor/rules/`
- automatic Cursor hooks (shell, MCP, file-edit, stop)
- every Yum4Less project agent (via Task, in waves)
- Bugbot and Security Review (diff-supplemental)
- local lint / unit / build / integration / e2e gates
- every repo-installed MCP server that is available in this environment

This is an **audit and evidence collection** run — not an implementation slice.

## Hard constraints
- Do NOT refactor or fix application code, tests, workflows, or package files.
- Allowed edits: **only** audit artifacts under `docs/audits/`.
- Do NOT edit `.cursor/rules/`, `.cursor/agents/`, `.cursor/hooks/`, `src/**`, `db/**`, `e2e/**`, `.github/**`, or `package.json`.
- Do NOT create git commits, push, or open/update PRs — owner is not ready for GitHub commit yet.
- Do NOT hide failures: record exact command output and continue remaining phases when sensible.
- Put refactor ideas in the final report under `Refactor backlog` — do not implement them.

## Approval behavior (this run only)
If Smart Mode or another gate blocks a required npm command, MCP call, or Docker step, request the narrowest approval needed and continue once granted.

## Checkpoint and resume protocol
- Primary checkpoint: `docs/audits/full-system-run-report.md`
- Update it **after every phase** with: timestamp, phase status (`pending` / `running` / `done` / `blocked` / `skipped`), commands run, and one-line outcome.
- If interrupted, read the checkpoint and resume at the first non-`done` phase — do not restart from Phase 0 unless preflight evidence is missing.

## Scope (whole repository)
Audit repository truth, not only the dirty diff:
- `src/app/**`, `src/components/**`, `src/lib/**`
- `db/init/**`, `scripts/**`, `e2e/**`
- `**/*.test.ts`, `**/*.test.tsx`
- `.github/workflows/**`
- `README.md`, `PROJECT_CONTINUITY.md`, `.env.example`
- `.cursor/agents/**`, `.cursor/rules/**` (governance/truthfulness review only)

Treat `.next/**` and other generated artifacts as noise unless they indicate hygiene or accidental-tracking problems.

---

## Phase 0 — Preflight and orient
1. Read `PROJECT_CONTINUITY.md` → Resume, Decision log, Verification snapshot.
2. Read `AGENTS.md` and `e2e/README.md`.
3. Record repo state (read-only git):
   - `git status --short`
   - `git branch --show-current`
   - `git log --oneline --decorate --max-count=15`
4. Preflight environment (record available / missing / blocked):
   - Node + npm (`node -v`, `npm -v`)
   - Docker (`docker info` or `docker compose ps`)
   - Semgrep CLI (`semgrep --version`) if on PATH
   - `gh auth status` (optional — do not require GitHub for this run)
5. Create `docs/audits/full-system-run-report.md` with preflight table + planned phases.

---

## Phase 1 — Wave A: discovery and top-risk reviews
Launch **in parallel** (max 3 Task subagents):

| Lane | Task | Focus |
|---|---|---|
| Repo map | `explore` — **very thorough** | API routes, DB/SQL paths, ingest/scrape, trust UI, test layout, CI workflows |
| Security | `senior-auditor` | secrets, deps, auth/privacy, scrape boundaries, misleading claims |
| Trust | `verifier` | estimated/directional honesty, Tier C labeling, coverage truthfulness, forbidden claims |

When `explore` completes, note whether `subagentStop` explore handoff appeared.

Update checkpoint.

---

## Phase 2 — Wave B: domain standards (batch 1)
Launch **in parallel** (max 4 Task subagents):

| Lane | Agent | Focus |
|---|---|---|
| Frontend | `web-frontend-standards` | UX, trust surfaces, a11y, loading/errors, map/tab flows, coordinate-first |
| Backend | `web-backend-standards` | route validation, rate limits, sanitization, read-only public API |
| Database | `database-codegen-standards` | schema/SQL quality, parameterization, seed/fixture, `price_observations` |
| Ingest | `ingest-standards` | fixture vs live, manual pause reality (M128/M151), per-chain behavior |

Update checkpoint.

---

## Phase 3 — Wave C: QA, CI, and diff-supplemental reviews
Launch **in parallel** where supported:

| Lane | Agent / subagent | Focus |
|---|---|---|
| Exploratory QA | `qa-engineer` — **explicit invocation, readonly, not background** | confused-user paths, races, mobile/tab breaks, bad inputs |
| Test & CI | `testing-cicd-standards` | test gaps, flaky risk, workflow gates, release-readiness |
| Bugbot | `bugbot` subagent | **diff-supplemental only** — see prompt below |
| Security Review | `security-review` subagent | **diff-supplemental only** — see prompt below |

Bugbot prompt:
Full Repository Path: c:\Users\sfh19\PROJECTS\Yum4Less
Diff: uncommitted changes
Custom Instructions: Supplemental diff review only — not whole-repo coverage. Prioritize trust-sensitive pricing, location handling, API routes, ingest paths, validation gaps, silent catches, and race-prone async. Parent + explore own untouched-repo coverage.

Security Review prompt:
Full Repository Path: c:\Users\sfh19\PROJECTS\Yum4Less
Diff: uncommitted changes
Custom Instructions: Supplemental diff security only. Check SQL injection, SSRF, unsafe HTML, secrets exposure, debug routes, rate-limit bypass, trust-proxy misconfig, client-controlled IDs, public API write-path violations, scrape credential handling. Parent + explore own untouched-repo coverage.

Update checkpoint.

---

## Phase 4 — Parent code review (while subagents may still finish)
Perform your own readonly architecture pass. Check:
- DRY violations, god components/services, weak layering
- duplicated validation or parallel schema definitions
- swallowed errors, silent fallbacks, fixture/live confusion
- forbidden trust language without evidence (M156 list)
- public routes bounded; `YUM4LESS_ENABLE_API_DB_WRITES` honored
- vibe-coder smells: `any`, risky `as`, hardcoded prod coords outside tests, dead exports
- doc claims ahead of implementation (`README`, `PROJECT_CONTINUITY`, `.env.example`)

Append findings to checkpoint continuously.

---

## Phase 5 — Local verification commands
Run from `c:\Users\sfh19\PROJECTS\Yum4Less`. Record **exact** stdout/stderr summaries and exit codes. Continue after failures.

```powershell
npm run lint
npm test
npm run build
npm run db:up
npm run test:integration
npm run test:e2e:ci
```

If `test:e2e:ci` is blocked, run the strongest defensible fallback (e.g. `npm run test:e2e` against an existing dev server) and state the gap — do not overclaim.

Update checkpoint.

---

## Phase 6 — MCP verification
Before **each** MCP call, read that tool's schema under `mcps/<server>/tools/`.

| Server | Minimum required action | Prerequisites |
|---|---|---|
| `project-0-Yum4Less-semgrep` | `semgrep_scan` (or nearest equivalent) on `src/` | Semgrep MCP available |
| `project-0-Yum4Less-postgres` | Read-only queries: stores near CI anchor, `price_observations` freshness sample, recipe/ingredient counts | `npm run db:up` succeeded |
| `project-0-Yum4Less-playwright` | Exploratory flows beyond committed e2e: Settings → rank, trust labels, Tier C honesty | `npm run dev` on `localhost:3000`; coords **37.6085, -77.3739** primary; ZIP **23111** fallback-path only |
| `project-0-Yum4Less-context7` | One doc lookup for a framework/API used in this repo (e.g. Next.js 15 or Playwright) | optional key |
| `project-0-Yum4Less-github` | **Optional** — skip if owner not ready for GitHub; if `gh` auth works, read-only workflow file list or default-branch check status only — **no PR mutations** |

Playwright MCP must assert visible trust wording: `estimated`, `directional`, `limited coverage`, `context only`, `coming soon`.

Record per-server: **used / unavailable / blocked / skipped** with reason.

Update checkpoint.

---

## Phase 7 — Final deliverables
Ensure `docs/audits/full-system-run-report.md` is complete. Optionally add `docs/audits/full-system-findings-summary.md` if the main report exceeds ~400 lines (short executive digest only).

### Required report sections
1. **Executive summary** — highest-risk items first
2. **Severity-ordered findings** — file evidence for each
3. **Commands run** — exact pass/fail counts (e.g. Vitest: N passed)
4. **MCP evidence and gaps**
5. **Hook / rule / subagent coverage** — orchestration manifest table filled in
6. **Feature health matrix** — location → stores → preferences → rank → results → map/trust (working / degraded / broken / untested)
7. **Code-review findings** separate from test failures
8. **Refactor backlog** — recommended only, no implementation
9. **Residual risk** — what still needs human or CI proof

### Forbidden claims unless this session's evidence supports them
`verified`, `production-ready`, `deploy-ready`, `CI green`, `beta v1 demo-complete`, `cheapest`, `best deal`, `guaranteed`, `save money`, `high confidence`, `fresh`, `live prices on search`, `stable`, `reliable`.

### End-of-turn checklist (triggers `stop` hooks)
- State explicitly what you ran vs did not run and why
- Do not update `PROJECT_CONTINUITY.md` in this run (audit-only artifacts)
- No application code changes
```

## Copy to here

---

## After the audit

| Next step | Prompt |
|---|---|
| Fix critical issues | `Fix only P0/P1 from docs/audits/full-system-run-report.md; smallest safe fix; run npm test.` |
| Add tests for QA findings | `@testing-cicd-standards Convert [finding] from full-system run report into deterministic Vitest or e2e coverage.` |
| Trust re-check | `@verifier Re-read trust labels against full-system run report evidence.` |
| Resume interrupted run | Paste the fenced block again and add: `Resume from docs/audits/full-system-run-report.md checkpoint.` |

---

## Hook reference (for maintainers)

| Hook | Script | Triggered by this prompt |
|---|---|---|
| `sessionStart` | `check-readme.ps1`, `inject-orchestration-session-context.ps1` | New Agent chat |
| `beforeSubmitPrompt` | `route-user-prompt.ps1` | Paste without `@` agents |
| `beforeShellExecution` | `check-package-command.ps1` | Phase 5 npm commands |
| `beforeMCPExecution` | `remind-mcp-schema.ps1` | Phase 6 MCP calls |
| `afterFileEdit` | `nudge-after-file-edit.ps1`, `semgrep-guardian.ps1` | Checkpoint file writes |
| `subagentStop` | `subagent-explore-handoff.ps1` | Phase 1 explore completes |
| `stop` | `semgrep-guardian.ps1`, `stop-verification-reminder.ps1` | Parent agent ends turn |

**Note:** `stop-verification-reminder` is diff-aware — a read-only audit that only touches `docs/audits/` may get a lighter reminder. That is expected.
