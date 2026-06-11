# Yum4Less full repo audit prompt (resumable)

Copy everything inside the fenced block below into a **new Agent chat** (MCP enabled). If the chat stops mid-audit, start a new chat and use the **Resume block** at the bottom with the last `CHECKPOINT` from the previous reply.

**Before you paste:** Docker available for Postgres; `.cursor/mcp.json` configured; do not paste `.env.local` into chat.

---

## Prompt (copy from here)

```text
Yum4Less FULL REPO AUDIT — read-only review and PR readiness (resumable across multiple chats)

## Critical constraints
- NO feature work, NO commits, NO new packages/MCP servers unless I explicitly approve.
- Follow `.cursor/rules/yum4less-agent-orchestration.mdc`, `AGENTS.md`, and all Yum4Less always-on rules.
- Hooks are advisory (changed-files Semgrep + stop reminders). This audit requires EXPLICIT full-repo scans and tests with evidence.
- Do NOT read, paste, or commit `.env.local`. Treat secrets as env-only.
- If the chat may time out: work in PHASES, write a CHECKPOINT after each phase, and stop cleanly so I can resume.

## Resume protocol (use every time)
At the end of EVERY response (or when timing out), output:

### CHECKPOINT
- **Phase completed:** (number + name)
- **Next phase:** (number + name)
- **Services started:** db / dev / docker-github / semgrep (yes/no + ports)
- **Evidence files or commands run:** (list with pass/fail/skipped + exit codes)
- **Blockers:** (what stopped you)
- **Copy-paste resume line for next chat:** (one line I can paste)

If I say "continue audit", read the last CHECKPOINT, verify services, then run ONLY unfinished phases — do not redo passed gates unless something changed.

---

## Phase 0 — Environment bootstrap (YOU start services; do not ask me unless a command fails)

Run these yourself in the terminal (retry once on failure; document errors):

1. **Postgres**
   - `npm run db:up`
   - Confirm port **5433** reachable (Docker healthy).
   - Optional but recommended: `npm run ingest:weekly-ads:fixture` (note `price_observations` count if it runs).

2. **Dev server** (for Playwright MCP later)
   - If nothing is listening on **3000**, start in background: `npm run dev` (or `npx next dev -p 3000`).
   - Do not block the whole audit waiting on dev; start early so it is warm by Phase 5.

3. **GitHub MCP**
   - If GitHub MCP fails: ensure Docker is running, then `docker pull ghcr.io/github/github-mcp-server` if needed.
   - If still blocked: use `gh` CLI for read-only workflow status (do not mutate GitHub unless I ask).
   - Never print or commit tokens.

4. **Semgrep**
   - Confirm `semgrep --version` (expect pipx `%USERPROFILE%\.local\bin\semgrep.exe`).
   - If `SEMGREP_APP_TOKEN` is in env: note "ci scan eligible"; else note "OSS scan only".

5. **MCP health**
   - Read MCP tool schemas under `mcps/<server>/tools/` before each MCP call.
   - postgres | playwright | github | semgrep | context7 — record connected/failed/skipped per server.

If Phase 0 fails partially, continue with skippable phases and mark evidence as **skipped (reason)**.

---

## Phase 1 — Repo map (read-only; parallel OK)

- Task `explore` **very thorough** OR systematic read of: `src/`, `db/init/`, `scripts/`, `.github/workflows/`, `e2e/`, `docs/`, `.cursor/hooks` + rules (setup only).
- Cross-check `README.md`, `PROJECT_CONTINUITY.md`, `.private/epic-audit.md` (if present) for **implemented vs planned** drift.
- Output: short architecture map + audit scope checklist (unchecked items for later phases).

**Agents (apply checklists; parallel subagents encouraged):**
@senior-auditor @web-backend-standards @web-frontend-standards @database-codegen-standards @testing-cicd-standards @verifier

---

## Phase 2 — Automated test gates (run in order; stop phase on hard failure but CHECKPOINT)

Prerequisite: Phase 0 db up.

| # | Command | On timeout |
|---|---------|------------|
| 2a | `npm test` | CHECKPOINT; resume at 2a |
| 2b | `npm run build` | resume at 2b |
| 2c | `npm run test:integration` | resume at 2c |
| 2d | `npm run test:e2e:ci` | resume at 2d (heavy; run last in phase) |

Record: exit code, pass counts, first failure snippet if any.

---

## Phase 3 — Full-repo Semgrep (explicit; not hook-only)

From repo root:

semgrep scan --config auto --config p/secrets --config p/typescript --metrics off --json -o semgrep-full.json .

- Summarize: findings count, top 10 by severity/path (no secret values in output).
- If `SEMGREP_APP_TOKEN` set: `semgrep ci` — else **skipped (no token)**.
- Semgrep MCP optional if connected; CLI result is source of truth.

---

## Phase 4 — Postgres MCP evidence (read-only)

Prerequisite: Phase 0 db up.

- Store count (expect 8 seeded), key tables, sample latest `price_observations`.
- Note ingest/fixture state vs claims in docs.
- If multi-statement query fails schema validation, use single queries.

---

## Phase 5 — Playwright MCP (trust-sensitive UI)

Prerequisite: dev server on **localhost:3000**, ZIP **23111**, fixture/seed data if available.

- Core loop: location → stores → recommendations (as far as deterministic data allows).
- Assert explicit trust wording where visible: `estimated`, `directional`, `limited coverage`, coming soon — not just "elements exist".
- Note map, carousel, store card a11y observations.
- If timeout: CHECKPOINT with URLs/steps completed; resume remaining steps only.

---

## Phase 6 — GitHub / PR / diff (read-only)

- `git status`; diff summary vs `master` (or default branch).
- GitHub MCP or `gh`: latest workflow runs for sfh1980/Yum4Less; semgrep job skipped vs ran.
- PR-style section: Summary | Risks | Test evidence | Trust/privacy | DB | Docs drift | Blockers.

---

## Phase 7 — Synthesis (required final deliverable)

1. **Executive summary** (5–10 bullets)
2. **Evidence table** (phase | command/MCP | pass/fail/skipped | notes)
3. **Findings by severity** (P0 security/trust lie, P1 correctness, P2 hygiene/docs)
4. **Open gaps** (Walmart, live ingest, analytics flags, deployment) — honest
5. **What was NOT run** and why
6. **Next actions** (max 10, P0/P1/P2)

**Forbidden without full evidence:** merge-ready, deploy-ready, production-ready, security-clean, beta v1 demo-complete, CI green.

---

## Timeout behavior (mandatory)
- Prefer completing one full phase + CHECKPOINT over starting the next phase.
- Long commands (`test:e2e:ci`, full Semgrep): run in terminal with adequate wait; if cut off, record partial output and resume command in next chat.
- Do not claim Phase N passed without exit code or MCP output.

Footer: yum4less-agent-orchestration.mdc + AGENTS.md; explicit tests/scans required.
```

---

## Resume block (follow-up chat)

```text
Continue Yum4Less FULL REPO AUDIT from CHECKPOINT below. Re-run Phase 0 service checks only (db:up, dev on 3000, Docker/github, semgrep). Then execute unfinished phases only; do not redo passed gates.

### CHECKPOINT
(paste from previous chat)
```

---

## Optional: PR from audit only (no code changes)

```text
From the completed audit CHECKPOINT only: create a PR with gh (no code changes) titled "Audit report YYYY-MM-DD" and put the Phase 7 synthesis in the PR body. Do not push secrets.
```

---

## How to use across chats

1. **Chat 1:** Paste the main prompt. Copy the `### CHECKPOINT` block from the last reply.
2. **Chat 2+:** Paste the resume block and paste your CHECKPOINT under it.

See also: `AGENTS.md`, `.cursor/rules/yum4less-agent-orchestration.mdc`.
