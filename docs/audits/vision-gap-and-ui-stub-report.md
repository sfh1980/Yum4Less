# Yum4Less — Vision gap + UI stub sweep

**Started / completed:** 2026-07-16 (local) / 2026-07-17 UTC  
**Branch / SHA audited:** `master` @ `43768ffe2e69fc21c4f78ea82c87cdef64a66d64`  
**Protocol:** Investigation + report + **2–3 example “coming soon” copy proposals only**. **No product bug fixes. No bulk copy apply.** Checkpoint for Sean before any further code changes.  
**Sequencing:** Kept separate from Tier 2 STOP-SHIP / P1-ops commit history (SS-1 already closed on this SHA). P1-ops freshness diagnosis was **not** claimed finished by this pass — live `yum4less_dev` still shows `fresh_24h=0` (see Part 2 notes).  
**Prior baselines:** [`tier2-comprehensive-audit-report.md`](tier2-comprehensive-audit-report.md) · [`tier1-foundation-hardening-report.md`](tier1-foundation-hardening-report.md)

---

## Checkpoint (stop here)

Sean reviews:

1. Part 2 **open questions** (especially “two API routes forever” and privacy/retention wording).
2. Part 3 **bucket calls** (unbuilt vs broken vs unsure).
3. Tone of the **three example “coming soon”** copy blocks below.

**Do not** apply bulk coming-soon messaging until Sean confirms.

---

## Part 1 — Full test suite (fresh this session)

| Suite | Command | Result (this session) |
|-------|---------|------------------------|
| Unit | `npm test` (`vitest run`) | **1033 passed / 1033** (183 files). Exit 0. |
| Integration | `npm run test:integration` | **48 passed / 48** (14 files). Exit 0. |
| E2E CI | `npm run test:e2e:ci` | **26 passed / 1 skipped / 0 failed**. Exit 0. |

**Skipped e2e:** 1 intentional skip in the suite (same class as prior Continuity notes; not treated as a failure).

### Local vs CI (do not conflate)

| Claim | Status | Evidence |
|-------|--------|----------|
| **Local-green on audited tree** | Yes (this session) | Counts above |
| **CI-green for audited SHA** | Yes — **separate claim** | [GitHub Actions run 29550992071](https://github.com/sfh1980/Yum4Less/actions/runs/29550992071) — `conclusion: success`, `headSha: 43768ffe2e69fc21c4f78ea82c87cdef64a66d64`, title: docs(continuity) SS-1 evidence on `8e1e705` |

Notes:

- Run **29550992071** is the remote CI for the **current committed HEAD** this report audited. It was **not** triggered by this investigation pass (docs-only deliverable below is still uncommitted at report write time).
- After Sean approves and any coming-soon copy (or this report) is committed, a **new** `gh run` link is required before claiming CI-green for that later SHA.
- This pass **did not** re-run Semgrep as a gate (no product files touched). Tier 2 SS-1 Semgrep was already exercised on the security fix path.

### Part 1 findings (failures)

None in the three suites this session. Pre-existing / out-of-suite issues are reported in Parts 2–3 (not “fixed” here).

---

## Part 2 — Vision vs implementation

### Core promise (as stated for this pass)

> Self-hosted, privacy-first grocery optimization and meal planning. Help the user find the cheapest way to buy groceries and plan meals around it, with no data leaving the household.

| Aspect | Adherence | Evidence / gap |
|--------|-----------|----------------|
| Self-hosted target | **Partial** | Homelab is the locked hosting target; Compose + ingest runbooks exist (`docs/homelab-deploy.md`). **Not** owner-run on dedicated hardware yet (Resume). |
| Privacy-first (analytics) | **Mostly matches** | Analytics off by default; forbidden exact coords/ZIP/store IDs in event props (`src/lib/analytics/analytics-privacy.ts`); allowlisted coarse buckets (`analytics-validation.ts`); append-only `analytics_events` (`db/init/006_analytics_events.sql`). |
| “No data leaving the household” | **Unclear / tension** | App still calls **external** services when configured: Geocodio, Kroger API, Overpass/OSM, Flipp/weekly-ad sources, TheMealDB ingest, optional OSRM. Self-hosting the **app+DB** ≠ air-gapped. |
| “Cheapest way” | **Tension with trust rules** | Product/trust rules **forbid** shopper-facing `cheapest` / `best deal` claims; UI uses estimated/directional language. Ranking may still pick min observations internally (`recommendation-scoring.ts`). Marketing vision wording vs shipped trust copy need owner alignment. |

### Locked decision checklist

#### 1. Chain-neutral architecture

| Adherence | **Partial** |
|-----------|-------------|
| What matches | Shared rollout/policy tables (`chain-rollout-policy.ts`, `provider-rollout.ts`); Settings selectable set is policy-driven (`SETTINGS_SELECTABLE_CHAINS`); weekly-ad match guards described as chain-agnostic in Continuity. |
| Discrepancies | Explicit chain branches remain in **non-isolated** shared modules: e.g. Kroger-only paths in `market-search-service.ts`, `provider-price-observation-sync.ts`, `weekly-ad-ingestion-service.ts`, `catalog-store-colocated-identity.ts` (Kroger merge miles); Walmart-special copy in `store-pricing-status-copy.ts`; dedicated files like `aldi-location-discovery.ts`, `kroger-catalog-canonical.ts`, `publix-catalog-sync.ts` (these last ones look **intentionally** chain-specific). |
| Ask Sean | Is “chain-neutral” meant as (A) **no** `if (chain === …)` outside `*-kroger*` / `*-aldi*` / policy files, or (B) **policy + dedicated adapters OK**, with shared ranking remaining chain-agnostic? Current code looks closer to (B). |

#### 2. Geolocation-first, ZIP fallback

| Adherence | **Partial** |
|-----------|-------------|
| Evidence (matches) | Server `resolveLocationInput` prefers coordinates when present; client supports browser geolocation + ZIP denial fallback; `locationMode` enum; e2e coordinate-first specs; denial asymmetry closed (P1-3). |
| Discrepancies | Settings UI is **ZIP-first** (ZIP field + “Find stores” primary; “Use my location” secondary). `isSettingsPreferencesComplete` / save path **require a valid ZIP** even after browser geolocation (`settings-preferences.ts`, `validateLocationFields(form, true)`). Hero copy on `page.tsx` still leads with ZIP. |
| Ask Sean | Can geolocation-only users complete Settings **without** storing a ZIP? Is ZIP-first Settings intentional (ingest/display key) despite coordinate-first API resolution? |

#### 3. Tier C as honest outcome

| Adherence | **Mostly matches** |
|-----------|---------------------|
| Evidence | Map/list “Coming soon — map context only” / limited-coverage pills (`store-pricing-status-copy.ts`); Deals/results trust copy; Tier C e2e; Continuity treats Tier C as normal outside gates. |
| Watch items | Disabled Settings options for non-`recommendationEnabled` stores still appear with `rolloutNote` (honest). Internal details modal still surfaces richer provenance when flag on — fine if gated. |
| Ask Sean | Any shopper path where empty **unavailable** still reads like “nothing on sale this week”? (Scale risk B / Tier 2 D7 — TheMealDB mid-request **500** vs **503**.) |

#### 4. Two API routes, forever

| Adherence | **Contradicts literal reading** |
|-----------|----------------------------------|
| Evidence | Eight App Router handlers under `src/app/api/**`: `recommendations`, `market-search`, `pantry-coverage`, `shopping-route`, `geocode/zip`, `analytics/events`, `feedback`, `debug/pipeline`. Build output lists all eight. |
| Likely intent | Continuity emphasizes **cache-first** `/api/recommendations` + `/api/market-search` as the core product read path — not “only two HTTP routes in the repo.” |
| Ask Sean | Confirm the lock: (A) only two **shopper ranking/discovery** routes forever, with supporting routes allowed; or (B) literally two HTTP endpoints total (would require collapsing pantry/geocode/route/analytics/feedback/debug). |

#### 5. Anonymous/aggregate analytics; append-only; no indefinite exact-coordinate retention

| Adherence | **Partial** |
|-----------|-------------|
| Matches | Coarse event allowlists; forbidden lat/lng/zip/store IDs in analytics; append-only insert sink; off by default. |
| Contradictions / gaps | **Exact coordinates persist indefinitely in browser `localStorage`** via Settings prefs (`latitude`/`longitude` in `settings-preferences.ts`) — Tier 2 **S4**. No automated **analytics retention prune** (Continuity: automated retention prune out of scope / open). Server `analytics_events` grows without TTL. |
| Ask Sean | Does “no indefinite exact-coordinate retention” apply to (1) analytics only, (2) server DB only, or (3) **also** client prefs? If (3), prefs need TTL/rounding/factory-reset policy. |

#### 6. Core flow: Home → Settings gate → market/rank/pantry → recommendations (TheMealDB-backed) → Cook; Deals + Saved alongside

| Adherence | **Matches shipped redesign** |
|-----------|------------------------------|
| Evidence | Settings-first gate; 5-tab shell; welcome → ingredients → pantry → suggest → results; Deals panel; Cook gated on ranked results; Saved placeholder. TheMealDB merged ranking + cron import (search-time refresh removed). |
| Nuance | Results also appear **in Home** after rank (`showResultsInHomeFlow`); Cook is a session mirror, not the only results surface. |
| Ask Sean | Is Home-hosted results still the intended primary UX, with Cook as revisit tab — or should results live only under Cook? |

#### 7. Store identity reconciliation (alias-graph) for cross-source price accuracy

| Adherence | **Partial / in progress** |
|-----------|---------------------------|
| Matches | Schema `021_store_identities` / aliases; recommendation path accepts `identityLookup` (`recommendation-service.ts`); shopping-plan builder supports `equivalentStoreIdsByStoreId`; Option A Slices 1–6 closed; flags + `AUTO_CONFIRM` still **OFF** by default. |
| Gaps | **Slice D** batch matcher **not started**; Q1 Publix locator map-merge align **not started** (Wave 2 Phase 0 locked). Identity expand is opt-in, so invisible correctness is **not** fully on by default. Name-based map overlay join still TODO (`shopping-plan-builder.ts` / `meal-presentation.ts`). |
| Ask Sean | Until Slice D + expand flags ON, is “invisibly correct wherever prices are compared” an **aspirational** lock or a **must-be-true today** claim? |

### Part 2 — Open questions for Sean (summary)

1. Chain-neutral = (A) strict isolation or (B) policy + adapters OK? (`market-search-service` Kroger official-API branch accepted exception?)
2. “Two API routes forever” = literal HTTP count or core product pair? Are `pantry-coverage` / `shopping-route` / `geocode` / analytics / feedback exempt?
3. Exact-coordinate retention: does client `localStorage` count?
4. Vision “cheapest” / “no data leaving household” vs shipped trust + external APIs (Geocodio/TheMealDB/retailer) — which boundary wins?
5. Identity expand OFF by default: acceptable for beta honesty, or a vision miss for cross-source price accuracy?
6. Home vs Cook as primary results surface?
7. Geolocation-only Settings completion without a stored ZIP — yes/no?
8. Confirm Bucket B5 (blank Cook after store change) as a fix candidate, not copy.

### Related ops note (not fixed here)

Postgres MCP on `yum4less_dev` this session: `price_observations` **308** total, **`fresh_24h=0`**, newest `2026-07-12T04:34:35Z`. Aligns with Tier 2 **D5 / P1-ops**. This pass did **not** run or close that diagnosis.

---

## Part 3 — UI stub inventory

**Rule applied:** intentionally unbuilt → propose honest “coming soon”; should-work-but-broken → report only; unsure → ask.

### Already honest / intentional (no new copy required unless tone tweak)

| Surface | File / component | Notes |
|---------|------------------|-------|
| Saved tab | `saved-placeholder-panel.tsx` | Explicit “Coming soon — no saved data is stored yet.” Matches Continuity deferred Saved persistence. |
| Map / list context-only chains | `store-pricing-status-copy.ts` | “Coming soon — map context only”, Walmart “No dinner estimates yet”, etc. |
| Settings non-ready stores | `settings-panel.tsx` | Options/checkboxes **disabled** + `rolloutNote` (not fake-enabled). |
| Deals empty / loading / error | `deals-panel.tsx` | Honest empty and error states; read-only by design. |
| Feedback disabled | `feedback-form.tsx` + `/feedback` | Explains enablement; not a silent stub. |
| Internal details | `InternalDetailsDevTrigger` | Hidden unless `NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS=1`. |
| Cook tab disabled | `bottom-nav.tsx` + `app-tab.ts` | Disabled until ranked recipes exist — correct gate, not a stub. |

### Bucket A — Intentionally unbuilt / out of v1 (candidates for coming-soon copy)

| ID | What / where | Why A | Proposed copy status |
|----|--------------|-------|----------------------|
| A1 | **Saved persistence** — `SavedPlaceholderPanel` | Continuity: Saved persistence deferred; shell placeholder by design | **Already present** — see Example 1 (tone confirm / optional refine) |
| A2 | **Cuisine chips (R11)** | Continuity deferred; **no UI control rendered today** | No stub to label unless Sean wants a Welcome/Settings *mention* (Example 2) |
| A3 | **Walmart / Lidl / BJ's / warehouse meal pricing** | Explicit context-only / coming-later in rollout policy | Map copy already exists; Settings does not list them for selection |
| A4 | **User accounts** | Anti-goal / deferred | No UI affordance |
| A5 | **Slice D matcher / Q1 Publix map-align / identity expand flags** | Locked deferred / not started | Not shopper-facing — **no UI coming-soon** |
| A6 | **OSRM driving distance on discovery list** | Continuity deferred; straight-line labeled today | Honest; optional future “driving distance coming later” only if Sean wants more visibility |

### Bucket B — Should work but broken (report only — **do not** label “coming soon”)

| ID | Sev | What | Reproduction / proof | Why not “coming soon” |
|----|-----|------|----------------------|------------------------|
| B1 | P2 | **`e2e/pantry-step` false-completion** (test/assert bug class) | Tier 2 E6/P4-1: clicks Suggest, waits only for “Dinner recommendations” heading which mounts before rank completes | Test/gate honesty bug — feature may work; suite can lie |
| B2 | P2 | **Recommendations mid-request TheMealDB DB failure → generic 500** | Tier 2 D7 / Continuity Scale risk B: `getLatestThemealdbImportAt()` after snapshot can throw → 500 instead of unavailable/503 | Broken unavailable semantics — not an unbuilt feature |
| B3 | P1 ops | **`yum4less_dev` ranked prices stale (`fresh_24h=0`)** | MCP this session | Ops/data freshness — labeling UI “coming soon” would hide a broken ingest heartbeat |
| B4 | P3 | **Shopping-plan → map overlay join by store *name*** | TODO in `shopping-plan-builder.ts` / `meal-presentation.ts`; `resolveNearbyStoreByName` in `meal-recommendation-card.tsx` | Same-chain twin ambiguity can open wrong pin or “Location not available” — shipped control that can fail |
| B5 | P2 | **Blank Cook tab after rank invalidation** | Rank meals → open Cook → change selected store(s) in Settings (resets `recommendationState` to `idle`) → stay on / return to Cook. `index.tsx` renders Cook content only when `cookEnabled`; tab can remain “Cook” with **empty** `app-shell-content`. | Shipped navigation path goes blank — guidance or tab redirect needed; **not** “coming soon” |

### Bucket C — Unsure (ask Sean before copy or fix)

| ID | What | Why unsure |
|----|------|------------|
| C1 | **Disabled Settings store rows** for chains that are “always listed” but not `recommendationEnabled` | Continuity says Kroger/Aldi/Publix/Food Lion always listed; disabled + note is honest — is that enough, or should copy say “coming soon” when promotion hasn’t passed? |
| C2 | **Vision “cheapest” language** anywhere outside trust-forbidden surfaces | README avoids cheapest; scoring comments use cheapest internally — OK? |
| C3 | **Hero ZIP-first copy** on `page.tsx` vs geolocation-primary product rule | Copy drift vs dead control — ask before changing |
| C4 | **Disabled Cook / pre-setup tabs lack explanatory helper** | Gate is intentional; silent `disabled` may be fine or need Example-3-style helper |
| C5 | **Cook may show stale results** after Settings save / welcome reset that does not clear `recommendationState` | Intentional session shortcut vs confusing leftover — ask before “fix” |
| C6 | **No dedicated Home “flow reset”** (only Settings factory reset) | Continuity distinguishes flow vs factory reset; may be intentional |

### Example “coming soon” copy (tone check — **not applied**)

Match Tier C voice: clear, honest, not cutesy.

#### Example 1 — Saved tab (refine existing)

**Where:** `src/components/meal-planner/saved-placeholder-panel.tsx`  
**Bucket:** A (intentionally unbuilt)  
**Current:** “Coming soon — no saved data is stored yet.”  
**Proposed refine:**

> Saved meals and shopping lists are not available in this beta. Nothing you rank is stored after this session. Use the Cook tab to revisit dinners you ranked during this visit.

#### Example 2 — Cuisine filters (only if Sean wants a visible mention; control does not exist today)

**Where:** optional line under Welcome dietary focus (`welcome-panel.tsx`)  
**Bucket:** A (R11 deferred) — **confirm before adding UI**  
**Proposed:**

> Cuisine filters (Italian, Mexican, and similar) are coming in a later release. For now, use dietary focus only.

#### Example 3 — Context-only chain on map (confirm existing tone)

**Where:** `buildStoreMapPricingLabel` in `store-pricing-status-copy.ts`  
**Bucket:** A (Walmart / unsupported meal pricing)  
**Current:** “Coming soon — map context only” / Walmart “No dinner estimates yet”  
**Proposed (if unifying tone):**

> Map context only — dinner price estimates are not available for this store yet. Verify any shelf prices in store.

---

## Part 4 — Continuity / changelog pointer

- Continuity changelog entry for this audit: see **`PROJECT_CONTINUITY.md`** (newest changelog) → this file.  
- Resume should link here as the vision-gap / UI-stub investigation deliverable.  
- **Not claimed:** deploy-ready, beta v1 demo-complete, or “all stubs closed.”  
- **Next after Sean checkpoint:** apply approved Bucket A copy only; open separate slices for Bucket B; answer Part 2 questions in Decision log where locks need clarifying.

---

## Scale check

```
Scale check:
- Small scale: Y — delivered investigation report + local/CI evidence + stub inventory without tangling STOP-SHIP commits or silently “fixing” findings.
- Large scale: Y (flagged) — “two API routes forever,” exact-coordinate retention, and chain-neutral wording look like decision-definition gaps that will keep producing audit churn until Decision log clarifies; identity expand-OFF vs “invisible correctness” is the same class of scale risk.
```
