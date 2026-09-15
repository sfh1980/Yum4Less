# Open work inventory (2026-09-09)

Point-in-time list of **open tasks, slices, and ops**. Compiled from [`PROJECT_CONTINUITY.md` Resume](../PROJECT_CONTINUITY.md), the Decision log, Home-note open loops, and the 2026-09-07 Target/Walmart research session.

**This file is not the live status.** Current chain flags, freshness counts, and what is on yum4less.com stay in **Resume**. Refresh or replace this inventory when a slice closes; do not let it drift into looking shipped.

GitHub issues on `sfh1980/Yum4Less`: **0 open** (checked 2026-09-09). Tracking lives in Resume / Home / this inventory.

Last live TrueNAS paste-back in Resume: **2026-09-15** (Clear obvious ops **closed**; app+ingest `:homelab` created **2026-09-14 21:43Z** after `d3e9396`). Prior SQL snapshot **2026-09-14** (`chain_registry` 18 banners; Walmart in-stock **19/19** in 24h; DG/Lidl **0**; ledger **000–013, 015–031**).

---

## How to read this

| Band | Meaning |
|---|---|
| **Do now (ops)** | Owner actions on the box or site; little or no code |
| **Next product** | Named coverage work for `23111` |
| **Open slices** | Named implementation slices, not started or unfinished |
| **Ops leftovers** | Homelab/ingest debt that is not the coverage bucket |
| **Later** | Nationwide / v1-out / far future |
| **Never** | Explicit anti-goals |

Adapters must not hardcode store numbers, ingest ZIPs, or banner rosters. Facts go in Postgres. See [`.cursor/rules/yum4less-db-owned-data.mdc`](../.cursor/rules/yum4less-db-owned-data.mdc).

---

## 1. Do now (ops)

| # | Task | Why it is still open | Notes |
|---|---|---|---|
| 1 | TheMealDB **dev test key** on live ingest | Known ops gap | Not a merge-gate; replace with a production key when ready |

**Closed 2026-09-15 — leftover grocery / Clear obvious:** app + ingest Watchtower-recreated **2026-09-14 21:43Z** (`d3e9396`). Live ingest has `planPendingReviewResolution`; app has **Clear obvious**. Dry-run **yes=3 no=0 skip=34**. Owner monitors `/owner` Ingredient review as needed. Skip titles stay human. Do **not** SQL-reject.

---

## 2. Next product work — Flipp + scrape yield (`23111`)

This is the **active coverage bucket**. Thin sale data keeps pins tracked; dinners stay off until floors pass. Not a coupon or checkout path. Lidl is **not** in this dinner chase.

### 2.1 Walmart (adapter exists; yield is thin)

| State | Detail |
|---|---|
| Ranked | `shopper_ranked` on live (`028`). Same floors as other ranked banners |
| Yield | Flipp grocery flyer exists for `23111`; match rate is junk-heavy (older probe: 144 offers → ~113 junk / ~6 grocery matches). Live **2026-09-14:** Walmart in-stock **19** rows, **19** in 24h, newest **07:09:43Z** |
| Scrape | `walmart.com/store/weekly-ads` hits Akamai/PX (`Robot or human?` in Playwright; HTTP 521 on GET). Parser looks for `#weekly-ad-offers-data`, which the captcha page does not emit |
| **Shipped 2026-09-15** | Pause walmart.com HTML scrape when Flipp has offers (Food Lion shape; Walmart keeps its own fetcher/parser). Do not add stealth browsers or paid residential proxies |
| Do not | Claim more Walmart dinners; bypass WAF; hardcode store numbers |

### 2.2 Target (no adapter)

| State | Detail |
|---|---|
| Registry | `upcoming`, `map_catalog_only`. Shoppers can pick a Target pin when OSM/catalog shows one. No weekly-ad adapter. Not `shopper_ranked` |
| Flipp | No real Target circular in `23111` (`q=Target` hits “Targeted Relief” noise) |
| Research (2026-09-07) | Playwright opens `target.com/weekly-ad` without a robot wall. Visible HTML has no SKUs. Network JSON `api.target.com/weekly_ads/v1/store_promotions?store_id=` + `promotions/{id}` has food sale lines. ZIP locator: **23111 → store `1968`**, 7235 Bell Creek Rd. Other ZIPs must call the locator — **never hardcode `1968`** |
| Smallest slice | ZIP/coords → locator → persist `source_store_id` on the catalog pin → parse promotions JSON → shared matcher/junk path → directional `price_observations`. Dinners stay off until floors + membership |
| Guest API | Unofficial frontend key; can rotate or block datacenter IPs. Same class of risk as other scrapes |
| Do not | Flip `shopper_ranked` in the same slice; copy a Walmart stealth stack |

### 2.3 BJ’s (no ranked adapter)

| State | Detail |
|---|---|
| Role | Map/context or upcoming. Display-only in provider catalog. Same yield bucket as Target |
| Work | No BJ’s weekly-ad adapter started. Flipp may list BJ’s as a merchant in `23111` (seen in Target-research Flipp merchant lists) — confirm before building |
| Do not | Treat club pins as ranked dinners without floors + membership |

### 2.4 Adjacent coverage (not the next dinner chase)

| Banner | Status | Open work |
|---|---|---|
| **Lidl** | Map context (`030`). Flipp/hub ingest fail-soft. **2026-09-14:** **0** `lidl-weekly-ad-scrape` in-stock rows | Do **not** add store-finder scrape or ranked dinners until a store-bound licensed feed exists |
| **Dollar General** | Flipp ZIP circular ingest live (`031`). Directional sales can show. Dinners only when **no other shopper-ranked grocer is nearby** and the same floors pass | `23111` has other grocers, so DG dinners stay off there. **2026-09-14:** **0** in-stock `dollar-general-weekly-ad-scrape` rows |
| **Kroger / Aldi / Publix / Food Lion** | Ranked when ingest + floors pass. Last heartbeat had in-stock rows | Not the yield-gap bucket. Publix Q1 Settings alignment is a separate slice (below) |

---

## 3. Open slices (named)

Ordered as product next, then identity, then API honesty, then new-chain queue.

| Slice | What is left | Status | Suggested owner |
|---|---|---|---|
| **Target ingest adapter** | ZIP-generic locator + promotions JSON parser + catalog `source_store_id`; shared junk/matcher; fail-soft; tests. No hardcoded store id | Research done; **not implemented** | `@ingest-standards` |
| **Walmart Flipp-only scrape skip** | If Flipp returns offers, skip retailer HTML (match Food Lion shape; Walmart keeps own fetcher/parser) | **Closed** 2026-09-15 | `@ingest-standards` |
| **BJ’s yield / adapter** | Confirm Flipp circular; decide map-context vs ingest-only vs later ranked | Not started | `@ingest-standards` |
| **Option A Slice D** | Batch proximity/name matcher at ingest. Unblocks safer identity expand beyond the Aldi allowlist | **Open.** Slices 1–6 closed 2026-07-11. Flags `YUM4LESS_STORE_IDENTITY_EXPAND` and `AUTO_CONFIRM` stay **OFF** | `@database-codegen-standards` |
| **Wave 2 Q1 (Publix)** | Policy locked **Q1=1B**: Publix locator pins are Settings-selectable catalog. Code: remove Publix from `isMapContextCatalogStore`; merge/suppress tests; Settings+map smoke | **Not started** (policy 2026-07-16) | `@web-frontend-standards` |
| **Scale risk B** | Shared `assertMarketDataAvailable()` + honest 503 / UI outage surfaces so DB outage is never “no stores” | **Closed** 2026-09-15 | `@web-backend-standards` |
| **Scale risk A** | Client-trust audit across all public API routes (not only rank pass-through) | Deferred until traffic increase / public-launch bar | `@verifier` + `@web-backend-standards` |
| **Dollar Tree** | Locator source, chain id pattern, ingest feasibility, catalog fit vs private-label SKUs | **Queued.** Dollar General is live; Tree is not | `@ingest-standards` |
| **Banner-per-row** | One `chain_registry` row per shopper banner (Harris Teeter ≠ Kroger) with **shared** adapter keys. Display already banner-grain | Roster grain **not split** | `@database-codegen-standards` |
| **M128/M151 scrape automation** | robots.txt check before scheduled scrape; auto-pause one chain on 403/WAF; owner kill switch independent of cron | **Not started in code.** Manual pause only today. Containers/cron/Watchtower **are** shipped | `@ingest-standards` |
| **Cuisine chips (R11)** | Filter dinners by cuisine. Hidden until recipes have a cuisine facet in Postgres (`tags[]` / `dietary_tags[]` today) | Deferred | `@web-frontend-standards` |
| **Q34/Q35 compact Settings** | Closed for now (wizard reuse). Reopen only if owner wants a different compact form | Closed unless reopened | — |

Identity Phase 0 locks that stay in force (implementation may still be open for Q1 only):

- **Q2=2A** — ephemeral search-time OSM/provider pins stay **excluded** from identity linking and coordinate reconciliation
- **Q3=3B** — three-layer store existence is intentional (DB / map merge / Settings). Do not “converge” into one list

---

## 4. Ops leftovers (homelab / ingest)

Homelab deploy precursors that were blocking go-live are **closed** (Custom App, ingest container, Watchtower, Cloudflare Tunnel, two-night 3am, unattended worker, **15-night `ingest_jobs` proof 2026-09-14**, backup drill). OPEN-BLOCKS on the readiness verdict is **empty**. Remaining:

| Item | Status | Notes |
|---|---|---|
| Extra ZIP `23220` first ingest | **Closed** 2026-09-01 | Worker 6/6 succeeded; both `23111` and `23220` active |
| Watchtower hourly scan | **Closed** as the live `:homelab` pull mechanism | Not a missing job |
| Unattended 3am + worker (ongoing proof) | **Closed** 2026-09-14 | `ingest_jobs` **15** nights **2026-08-31–2026-09-14**, each **6/6 succeeded**, enqueue ~07:00:03Z. Do not disable the worker Cron Job. |
| Local `yum4less_dev` ≠ yum4less.com (open task) | **Closed** 2026-09-14 | Two databases by design. No MCP-to-TrueNAS, no daily dump, no DB rename. Live numbers still come from NAS paste-back ([`docs/homelab-deploy.md`](homelab-deploy.md) §4.5). |
| Watchtower migrate reminder (open task) | **Closed** 2026-09-14 | Watchtower still does not run SQL. 3am ingest prep applies pending `db/init`. Hand `sudo docker exec yum4less-ingest npm run db:migrate` only if you need it before morning. |
| Store-list omit on yum4less.com (hard-refresh) | **Closed** 2026-09-14 | Earlier same-day recreate **19:43Z** proved omit; Clear obvious image is **21:43Z** (see leftover grocery row). Map may still show those pins. Eyeball Settings is optional, not an open task. |
| Leftover grocery / Clear obvious on live | **Closed** 2026-09-15 | App+ingest `:homelab` **2026-09-14 21:43Z**. Planner + button live. Owner monitors pending/skip as needed. |
| Optional live SQL snapshot | **Closed** 2026-09-14 | `chain_registry` 18 rows as expected (`030`/`031` flags). Walmart **19/19** fresh in-stock. DG and Lidl **0**. Ledger **000–013, 015–031** (`version` is text; no `014` in repo). |
| Backup/restore drill | **Closed** 2026-08-31 | Host dump → `yum4less_backup_drill` counts matched; drill DB dropped. Nightly backup cron still optional |
| TheMealDB production key | **Open** | Live ingest still logs **dev test key** |
| Website `robots.txt` for `/owner` | **Closed** 2026-09-15 | `src/app/robots.ts` disallows `/owner` and `/api/`. Not scrape-compliance M128. Optional after Watchtower: `curl -sS https://yum4less.com/robots.txt` should show `Disallow: /owner` (Cloudflare may prepend content-signal comments). |
| Semgrep CI | Runs only if GitHub secret `SEMGREP_APP_TOKEN` is set | Local hooks need optional `semgrep` CLI |
| GHCR package visibility | Public (Actions-published from a public repo) | Private later = manual package admin |
| `P1-ops` local freshness | `yum4less_dev` can show `fresh_24h=0` when ingest has not run locally | Ops, not a live-site claim. Live heartbeat was `[OK] 428/428` on 2026-09-05 |
| Hash skip vs `observed_at` | Unchanged flyer can leave weekly-ad `observed_at` from Sunday | Not a missed night |
| One flyer per banner, then fan-out | Far-apart storefronts in one huge ZIP stay a later **per-market flyer** problem | Neighbor-ZIP map pins need those ZIPs Activated too |
| Overlay | **Off** on live | `YUM4LESS_INGEST_ZIPS` is debug only. Empty `active_markets` fails closed |
| Debug `KROGER_LOCATION_ID` / `PUBLIX_STORE_NUMBER` | Allowed as single-market overrides | Must not become the catalog of stores |
| SNAP nationwide USDA CSV on TrueNAS | Parser + fixture path **shipped** | Live CSV on the NAS is **ops-optional** |
| Ingredient-review keyboard / bulk triage | Called out as later | Standing human monitor of skip/unsure titles; not the closed Clear obvious ops task |
| Local Windows lint/build drift vs Linux CI | Historical P2 | Do not trust local gates over CI |

Live markets (as of 2026-09-05 paste-back): **`23111`** (owner ranked ingest anchor) + **`23220`**. Expansion = more owner Activate clicks, not a code ZIP list.

---

## 5. Nationwide de-hardcoding — later (not started)

A / B1 / B2 / C / membership DB-wins are **shipped**. Still later:

| Item | What |
|---|---|
| **Organic shopper-ZIP waiting list** | Auto-queue shopper cities. Phase C is owner Activate only |
| **`threshold_profiles`** | Density/distance/match floors as DB profiles instead of Mechanicsville-shaped constants. Existing promotion floors stay in code until an explicit migrate — do not grow per-chain copies |
| **Per-store scrape timezone** | Weekly-ad browser TZ is `America/New_York` today |
| **Open `StoreChain` union** | Runtime validate against `chain_registry`; compile-time union = known adapters only |
| **Flipp merchant names / id prefixes in registry** | Still partly TypeScript |
| **Name-fragment lists** | Settings omit / OSM Target keep-by-name. Debt: do not grow; migrate when touching |
| Store geographic breakdown audit | Read-only: are catalog pins VA-heavy? |
| Bootstrap seed `source_name` provenance | Distinguish hand-planted/CI bootstrap from discovered stores |

Plan: [`docs/audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md`](audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md).

---

## 6. Deferred (not v1 / later horizon)

| Item | Why later |
|---|---|
| **User accounts + Redis + cross-device Saved** | Same horizon. Device-local Saved shipped. In-process rate limits are enough for one TrueNAS app container |
| **Chain go/no-go** | Docs only, far future. Free stack only (OSM / Flipp / scrape). No paid aggregator |
| **Owner Check fragment lists** | Research (Wawa / CVS / Target fragments). Stay open |
| **New ranked adapters** (H-E-B, Safeway, Whole Foods, etc.) | Registry `upcoming`. Group with yield work; not a separate forever-out |
| **Spoonacular / Edamam** | Research-only; not shopper ranking |
| **OSRM driving distance on map/list/Settings** | Shopping-route already uses OSRM. Discovery stays straight-line labeled. Re-triage: **accept for beta v1** |
| **`enableHighAccuracy` / PositionOptions** | Still deferred after P1-3 denial fix |
| **ZIP + landmark hybrid** | Future location model (`us-service-area.ts`). Wizard is GPS or ZIP+pin |
| **H3 in the wizard** | Locked off. Shopper radius stays around the pin |
| **Shopping-plan `storeId`** | Plans emit `storeName`; map/route join by name. Out of Option A Slices 2–3 |
| **Live near-miss confidence analysis** | Required before changing the **0.55** weekly-ad persist threshold |
| **INTERNAL_CATALOG chain-content bias** | Tracked-ingredient coverage still Kroger-heavy on older measurements. Architectural call sites are chain-agnostic |
| **GYAM Cloudflare hostname** | Same tunnel, when reprioritized |
| **HSTS / CSP / app HTTPS redirect** | Tunnel already serves `https://yum4less.com/`. Extra header polish is leftover |
| **`/owner` Ingredient review bulk UX** | Later than junk SSOT |

Upcoming / map-context banners in `chain_registry` (no adapter work implied): Whole Foods, Target, Safeway, H-E-B, plus name-fragment clubs (Costco, Sam’s Club) that are not `StoreChain` rows yet.

---

## 7. Research agreed, not coded (2026-09-07)

Keep these next to the coverage bucket so they are not lost in chat:

1. **Database-owned data rule** — **shipped** (`.cursor/rules/yum4less-db-owned-data.mdc` + session hook). Promotion floors and name-fragment lists were **not** migrated.
2. **Target store bind is ZIP-generic** — locator + `store_promotions?store_id=`; Mechanicsville example is `1968`.
3. **Walmart HTML scrape is not beating Flipp** — **shipped 2026-09-15:** pause scrape when Flipp has offers (Food Lion shape).
4. **Do not** add Camoufox / Patchright / curl_cffi / SeleniumBase / Botasaurus / paid residential proxy as the default ingest layer.
5. **Camoufox / Patchright / curl_cffi were not live-tested** in that session (not installed).

---

## 8. Never

- Coupon clipper, checkout, payments, price-guarantee, “cheapest / best deal / save money / guaranteed”
- Paid aggregator subscriptions for go/no-go
- Treating fixture ingest as live retailer feeds
- Hardcoding store numbers, ingest ZIPs, or ranked-banner rosters in adapters
- Claiming **beta v1 demo-complete**, **deploy-ready**, **CI green**, or **more dinners** without current evidence

---

## 9. Shipped — do not reopen as “next”

Use this only as a negative checklist. Detail stays in Resume.

Redesign slices **1–5**, shell **D1–D7**, Section H, onboarding wizard on `master`, Settings grocery-pin picker, junk-skip SSOT, store-list omit, leftover grocery ingest + `/owner` **Clear obvious** (live **2026-09-15**), website `robots.ts` disallow `/owner` + `/api/` (**2026-09-15**), Walmart Flipp-first scrape-only-if-empty (**2026-09-15**), Scale risk B empty-vs-unavailable API+UI (**2026-09-15**), nationwide A/B1/B2/C, membership DB-wins, market admission + whole-ZIP ingest fence, unattended 3am + worker drain (**15-night `ingest_jobs` proof 2026-09-14**), 3am covers pending SQL (Watchtower does not; hand migrate optional), local≠live as **process** (paste-back, not a sync feature), Cloudflare Tunnel, Watchtower, backup drill, Option A Slices **1–6** (not D), Lidl **map-context** (`030`), Dollar General Flipp + food-desert (`031`), Walmart same floors (`028`), Publix weekly-ad ingest exclusion fix, geolocation denial P1-3, identity SSOT CI gate, FAQ/Terms, device-local Saved.

---

## 10. Suggested pick-up order

1. Product: **Target ZIP-generic ingest adapter** (dinners off), or BJ’s Flipp confirm.
2. Ops: TheMealDB **production key** when you have one (not a merge gate).
3. Then Slice D / Publix Q1 if coverage is paused.
4. Leave accounts, cuisine, go/no-go, and M128 automation until you reprioritize.

---

## Sources

- [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) Resume (as of 2026-09-15 Scale risk B + Clear obvious close; 2026-09-14 live SQL paste), changelog, Decision log
- Home note Open loops / Next actions (as of 2026-09-15 Scale risk B close)
- [`docs/audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md`](audits/de-hardcoding-nationwide-db-driven-plan-2026-08-12.md)
- [`docs/audits/homelab-readiness-verdict.md`](audits/homelab-readiness-verdict.md)
- 2026-09-07 Target weekly-ad / store-locator probes (not in production ingest)
