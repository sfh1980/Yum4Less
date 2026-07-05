# Yum4Less — full-system test, audit, PR, and code-review prompt

> **Deprecated:** Prefer [`full-system-verification-prompt.md`](full-system-verification-prompt.md) (v2) — wave-based subagents, preflight, no PR/commit steps, clearer hook/MCP manifest, and explicit resume checkpoints.

Copy everything inside the fenced block below into a **new Agent chat**. It is designed to trigger the repo's rules, hooks, MCP servers, project agents, and review subagents while running a full verification and PR-readiness sweep **without refactoring app code**.

**Suggested `@` mentions when pasting:** `@senior-auditor` `@verifier` `@qa-engineer` `@web-frontend-standards` `@web-backend-standards` `@database-codegen-standards` `@ingest-standards` `@testing-cicd-standards`

**Main gates this exercises:** `npm run lint`, `npm test`, `npm run build`, `npm run db:up` -> `npm run test:integration`, `npm run test:e2e:ci`, GitHub PR/check inspection, PR-packet drafting, Semgrep MCP, Postgres MCP, Playwright MCP, GitHub MCP, Context7 MCP.

**Sleep/background reality:** background subagents can keep working when supported, but local shell/MCP steps depend on the machine staying awake. This prompt therefore requires checkpoint files so the run can resume from the last completed phase instead of starting over.

---

## Copy from here

```text
# Yum4Less — full system verification, audit, PR-readiness, and code review

## Run intent
Run the full repo through a no-refactor verification sweep that triggers:
- workspace rules from `.cursor/rules/`
- automatic hooks
- all repo-relevant MCP servers
- all Yum4Less project agents
- Bugbot and Security Review
- local test/build gates
- PR-readiness and code-review analysis
- a draft PR only if the run request explicitly authorizes creating one

## Hard constraints
- Do NOT refactor application code.
- Do NOT make code fixes unless I explicitly ask in a follow-up.
- Allowed edits for this run: audit artifacts only under `docs/audits/`.
- Do NOT change `.cursor/rules/`, `.cursor/agents/`, `.cursor/hooks/`, app source, tests, workflows, or package files.
- Do NOT hide problems by skipping failing steps.
- If refactors or cleanup seem needed, put them in the end report under `Refactor backlog`; do not implement them.

## Approval behavior for this run only
- If an approval gate blocks a required test, MCP call, GitHub inspection, or PR-readiness step, immediately request the approval needed to continue and proceed once granted.
- Keep the approval scope as narrow as possible and only for this run.

## Background / interruption behavior
- Launch long-running review subagents in background when supported so the parent agent can keep orchestrating.
- Create and keep updating `docs/audits/full-system-run-report.md` after each major phase so progress is checkpointed and the `afterFileEdit` hook fires.
- Also create/update `docs/audits/full-system-pr-review.md` for the PR packet and code-review summary.
- If the machine sleeps or local execution is interrupted, resume from the latest checkpoint instead of restarting the whole run.
- Be explicit in the report about which phases completed before any interruption.

## Scope
Audit the whole repository, not just the dirty diff:
- `src/app/**`
- `src/components/**`
- `src/lib/**`
- `db/init/**`
- `scripts/**`
- `e2e/**`
- `**/*.test.ts`
- `**/*.test.tsx`
- `.github/workflows/**`
- `README.md`
- `PROJECT_CONTINUITY.md`
- `.env.example`
- `.cursor/agents/**` and `.cursor/rules/**` for governance/truthfulness review only

Treat generated artifacts like `.next/**` as noise unless they reveal repo hygiene, accidental tracking, or build reproducibility issues.

## Phase 0 — orient and checkpoint
1. Read `PROJECT_CONTINUITY.md` (Resume, Decision log, verification snapshot).
2. Read `AGENTS.md`.
3. Read `docs/application-overview.md` if present.
4. Use Task `explore` with thorough repo mapping for:
   - API routes
   - DB access and SQL paths
   - ingest/scrape paths
   - trust/freshness UI surfaces
   - test coverage layout
   - workflow/CI files
5. Create `docs/audits/full-system-run-report.md` with:
   - timestamp
   - current branch / repo state summary
   - planned phases
   - checkpoint table with `pending / running / done / blocked`

## Phase 1 — launch parallel review subagents
Launch these in parallel. Keep them readonly unless a tool requires otherwise for reporting only.

| Review lane | Required agent/subagent | Focus |
|---|---|---|
| Security and dependency audit | `@senior-auditor` | secrets, dependency risk, auth/privacy issues, trust-sensitive claims, scrape boundaries |
| Trust and coverage audit | `@verifier` | freshness wording, estimated/directional honesty, Tier C labeling, coverage truthfulness |
| Exploratory QA | `@qa-engineer` | confused-user flows, edge cases, race conditions, mobile/tab flow breaks |
| Frontend review | `@web-frontend-standards` | UX, trust surfaces, accessibility, loading/error states, map/tab flows |
| Backend review | `@web-backend-standards` | route validation, rate limiting, sanitization, read-only public API guarantees |
| Database review | `@database-codegen-standards` | schema/query quality, parameterization, seed/fixture discipline, `price_observations` sanity |
| Ingest review | `@ingest-standards` | fixture vs live clarity, scrape compliance guard reality, per-chain pause/kill-switch behavior |
| Test and CI review | `@testing-cicd-standards` | test gaps, flaky-risk, workflow gate coverage, release-readiness gaps |

Also launch:
- one `explore` subagent for broad readonly repo discovery and code-map synthesis
- one Bugbot review as a branch-diff supplemental lane
- one Security Review as a branch-diff supplemental lane

Use these Bugbot / Security Review prompts:

Bugbot:
Full Repository Path: c:\Users\sfh19\PROJECTS\Yum4Less
Diff: branch changes
Custom Instructions: Branch-diff supplemental code review only, not a whole-repo substitute and not a refactor pass. Prioritize correctness, regressions, dead code, trust-sensitive pricing, location handling, API routes, ingest paths, workflow gaps, and vibe-coder smells such as duplicated handlers, magic strings, silent catches, and weak validation. The parent agent and explore lane own untouched-repo coverage.

Security Review:
Full Repository Path: c:\Users\sfh19\PROJECTS\Yum4Less
Diff: branch changes
Custom Instructions: Branch-diff supplemental security review only, not a whole-repo substitute. Check SQL injection, SSRF, path traversal, unsafe HTML, secrets exposure, debug route exposure, rate-limit bypass, trust-proxy misconfiguration, client-controlled IDs reaching DB, public API write-path violations, scrape credential handling, and dependency/security hygiene. The parent agent and explore lane own untouched-repo coverage.

After launching them, update `docs/audits/full-system-run-report.md` with agent IDs or labels, current status, and a note that Bugbot and Security Review are diff-based supplemental lanes rather than whole-repo coverage.

## Phase 2 — parent-agent code review and architecture pass
Perform your own top-level review in parallel with the subagents.

Check for:

Clean code and design:
- DRY violations
- giant components, god services, or weak layering
- inconsistent naming or import boundaries
- swallowed errors or silent fallbacks
- duplicated validation or parallel schema/type definitions

Trust and product honesty:
- forbidden trust language without evidence
- stale or degraded data presented too strongly
- fixture/live confusion
- unsupported chains presented as stronger than context-only or coming soon

Validation and safety:
- all public routes bounded and sanitized
- `YUM4LESS_ENABLE_API_DB_WRITES` guard honored
- SQL parameterization only
- external HTML/JSON treated as untrusted

Vibe-coder smells:
- `any`, risky `as`, `@ts-ignore`
- hardcoded production coords/ZIPs outside tests/fixtures
- `console.log` in production paths
- dead exports, unreachable branches, orphan fixtures
- tests that only assert happy-path truthiness
- doc claims ahead of implementation

PR hygiene:
- accidental generated-file noise
- branch contains unrelated churn
- missing or weak test-plan narrative
- missing reviewer guidance for risky areas

Record findings continuously in `docs/audits/full-system-run-report.md`.

## Phase 3 — local verification commands
Run and record exact results. Stop and note failures, but continue with the remaining phases when sensible.

```powershell
cd c:\Users\sfh19\PROJECTS\Yum4Less
git status --short
git branch --show-current
git log --oneline --decorate --graph --max-count=20
git diff --stat
npm run lint
npm test
npm run build
npm run db:up
npm run test:integration
npm run test:e2e:ci
```

If `test:e2e:ci` is blocked by environment limits, run the strongest fallback you can justify, state the gap clearly, and do not overclaim.

## Phase 4 — PR and GitHub review
Treat the current branch as a PR candidate.

1. Inspect:
   - branch divergence vs base
   - whether a remote tracking branch exists
   - `gh pr status`
   - existing PR comments/reviews/checks if a PR already exists
2. If a PR already exists:
   - review comments, review threads, and failing checks
   - fold that into `docs/audits/full-system-pr-review.md`
3. If no PR exists:
   - do NOT create commits
   - do NOT push generated files or unrelated noise
   - default behavior: prepare a PR-ready packet in `docs/audits/full-system-pr-review.md`; do not create a PR as part of the default audit path
   - create a **draft PR** only if the run request explicitly authorizes PR creation, the branch is already pushed, GitHub auth is available, and doing so does not require commits, pushes, generated-file churn, or unrelated cleanup
   - the PR-ready packet must include:
     - proposed PR title
     - summary
     - test plan
     - risk notes
     - reviewer checklist

The PR review must include code-review findings, not just CI status.

## Phase 5 — MCP verification
Before each MCP call, read that MCP tool schema from `mcps/<server>/tools/`.

Attempt every repo-installed MCP server that is relevant and available in the current environment. If a server is unavailable, unauthenticated, blocked, or lacks prerequisites, record that as an evidence gap instead of treating it as an audit failure by itself.

| MCP | Required use in this run |
|---|---|
| `project-0-Yum4Less-semgrep` | if configured and available, run a security/static-analysis scan or nearest equivalent configured tool |
| `project-0-Yum4Less-postgres` | after `npm run db:up`, if the DB is available, inspect schema/seed/trust-sensitive data sanity in read-only mode |
| `project-0-Yum4Less-playwright` | if a local app instance is available, perform exploratory browser verification beyond committed e2e coverage; use `37.6085,-77.3739` primary and ZIP `23111` fallback path only |
| `project-0-Yum4Less-github` | if auth is available, inspect PR/check/workflow state or default-branch baseline when current branch PR is unavailable |
| `project-0-Yum4Less-context7` | fetch at least one current documentation reference relevant to a framework/tool touched by the audit when a doc-backed API expectation needs confirmation |

For Playwright MCP, explicitly verify trust wording like `estimated`, `directional`, `limited coverage`, `context only`, and `coming soon`.

Update the checkpoint report after each MCP lane.

## Phase 6 — final deliverables
Finish with two audit artifacts plus the chat summary:

1. `docs/audits/full-system-run-report.md`
2. `docs/audits/full-system-pr-review.md`

The final report must include:
1. Executive summary with highest-risk items first
2. Severity-ordered findings with file evidence
3. Commands run and exact pass/fail outcomes
4. MCP evidence and gaps
5. Hook/rule/subagent coverage: what triggered, what was supplemental, and what did not
6. PR status: existing PR findings, or draft-ready PR packet status, and whether PR creation was intentionally not attempted
7. Code-review findings separate from test failures
8. Refactor backlog: recommended refactors only, with rationale and scope, but no implementation
9. Residual risk and what still needs a human or CI to prove

Do NOT claim:
- verified
- production-ready
- deploy-ready
- CI green
- beta v1 demo-complete

unless this session's actual evidence supports it.

Do NOT make any application code refactors or cleanup edits during this run.
```

## Copy to here

---

## What this prompt triggers

| Layer | Triggered by this prompt? |
|---|---|
| Workspace rules in `.cursor/rules/` | Yes |
| `beforeSubmitPrompt` hook | Yes |
| `beforeShellExecution` hook | Yes |
| `beforeMCPExecution` hook | Yes |
| `afterFileEdit` hook | Yes, via audit checkpoint/report files |
| `stop` hooks | Yes |
| Yum4Less project agents | Yes |
| `explore` subagent | Yes |
| Bugbot | Yes |
| Security Review | Yes |
| Local lint / test / build / integration / e2e | Yes |
| GitHub PR / review inspection | Yes |
| Semgrep / Postgres / Playwright / GitHub / Context7 MCP | Yes |

## Important limitation

Local commands, local dev servers, Docker, Playwright, Postgres, and MCP calls that depend on this machine cannot truly keep running while the laptop is asleep. This prompt compensates by forcing background subagents where possible and checkpointed audit files so the run can resume cleanly after interruption instead of losing the whole audit.

## Tips

1. Use **Agent mode** in a fresh chat and paste only the fenced block.
2. Expect this to take a while; it is intentionally a heavy verification sweep.
3. If you want the agent to execute it in the most durable way possible, say: `Run this as a background-heavy audit and keep checkpointing after every phase.`
4. For follow-up implementation, use a new chat like: `Fix only the P0/P1 defects from the full-system run report; no refactors unless required for the smallest safe fix.`
