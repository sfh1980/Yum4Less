# Research pass — closing gaps in the de-hardcoding plan (2026-08-12)

> **Research and recommendation only.** No schema, migrations, or code.
> Sits alongside (does not replace):
> - [`de-hardcoding-nationwide-db-driven-plan-2026-08-12.md`](de-hardcoding-nationwide-db-driven-plan-2026-08-12.md)
> - [`scale-out-architecture-audit-2026-08-11.md`](scale-out-architecture-audit-2026-08-11.md)

**Scope:** five gaps flagged by external review. For each: what real systems do (cited), fit at our scale (hundreds–low thousands of stores; single-operator Postgres; no accounts in v1), and a clear adopt / defer-with-seam / reject recommendation.

**Stack facts used for fit assessment (codebase check):**

- Shopper path is already **coordinate-first**; ZIP is an input that resolves to lat/lng (`geocoding.ts`, `zip-search-centers.ts`, Decision log continental-US model).
- Ingest loops are **ZIP-labeled** (`YUM4LESS_INGEST_ZIPS`) but discovery/filtering is radius-around-resolved-coords.
- Kroger family banners are already **collapsed to `chain = kroger`** via name markers (`chain-rollout-policy.ts` `KROGER_FAMILY_NAME_MARKERS`; `kroger-family-discovery.ts`; shared Locations/Products API with optional `filter.chain`).
- **No user accounts** in v1; anonymous `customer_feedback` exists (no ZIP column); analytics deliberately strips exact lat/ZIP from properties; owner console + debug pipeline exist for ops.
- No PostGIS / H3 today; distance math is in-app miles/meters helpers.

---

## Gap 1 — ZIP code as the market / geography unit

### What real systems do

Uber’s **H3** hexagonal hierarchical index exists specifically because postal/admin boundaries are a poor analysis unit: ZIP codes are delivery routes, vary wildly in size, change for non-product reasons, and lack comparable spatial units ([Uber H3 blog](https://www.uber.com/us/en/blog/h3/); [H3 vs admin boundaries](https://h3geo.org/docs/comparisons/admin); [“Stop Using Zip Codes for Geospatial Analysis”](https://towardsdatascience.com/stop-using-zip-codes-for-geospatial-analysis-ceacb6e80c38) cited by H3 docs). Marketplace apps use H3 (or hand-drawn geofences) for surge, dispatch density, and demand heatmaps — integer cell lookups instead of point-in-polygon under load ([example write-up](https://medium.com/beyond-localhost/why-uber-gridified-the-world-solving-the-point-in-polygon-problem-with-h3-80c821676f43)).

Lighter alternatives in the same family: **geohash** / **S2** for proximity indexing; **PostGIS** polygons for true geofences. Industry guidance: pick H3 for analytics/aggregation and moving-object density; geohash or PostGIS for simple nearby search; skip exotic grids when the workload is “stores near a pin + radius” ([H3 vs Geohash vs S2](https://ky-gis.com/en/blog/h3-vs-geohash-vs-s2); [location indexing overview](https://joudwawad.medium.com/the-complete-guide-to-location-indexing-geohash-quadtree-google-s2-and-uber-h3-36a143569555)).

### Fit assessment for our scale/stack

| Option | Fit | Why |
|---|---|---|
| Full H3 market keys + `h3-js` / `h3-pg` | **Overkill now** | We do not run surge, driver dispatch, or city-wide demand forecasting. Store count is ~10²–10³, not millions of trips/day. `h3-js` is a large Emscripten bundle relative to need ([h3-js vs ngeohash](https://ky-gis.com/en/blog/h3-js-vs-ngeohash-javascript-spatial-libraries)). |
| Hand-drawn service-area polygons + PostGIS | **Overkill now** | Adds PostGIS ops surface, polygon maintenance, and “draw every metro” work a solo operator will not keep fresh. Product already treats CONUS + coverage honesty as the fence. |
| ZIP as PK for markets / geocode cache | **Acceptable short-term, with a seam** | Matches how Geocodio and ingest env work today; shoppers still enter ZIP. Weakness is real but does not break radius search if **runtime coverage logic never assumes ZIP = polygon**. |
| **Middle ground (recommended)** | **Best fit** | Keep ZIP as *input label / ops handle*. Key durable geography off **resolved lat/lng** (and optional derived cell later). Coverage, density, thresholds, and “stores near you” stay **pin + radius** (already how catalog/market-search work). |

**Migration cost if we ZIP-key first then move:**

- `zip_geocode_cache` keyed only by ZIP → later adding `h3_cell` / renaming to `geocode_cache` is a **small additive migration** (ZIP remains a lookup key into coords).
- `active_markets` keyed only by ZIP → later promoting to “market = center coords + radius (or cell)” means either (a) treating ZIP as a *label* on a market row that already stores lat/lng/timezone/density, or (b) merging adjacent ZIPs into one market. Cost is moderate if lat/lng are first-class from day one; high if every join assumes `zip_code` is the spatial unit.

### Recommendation

**Defer H3 / geofence markets with a documented seam; explicitly reject adopting H3 or PostGIS in the first DB-driven pass.**

**Do in the first pass (seam, not a rewrite):**

1. Treat ZIP as **user/ops input**, not the spatial authority.
2. On every market/geocode row, store **`latitude`, `longitude`, `timezone`, density fields`** as first-class — ZIP is unique for cache/ops convenience, not “the market polygon.”
3. Document: *coverage and thresholds are computed from pin+radius / store density, never from ZIP boundary geometry.*
4. Optional nullable `grid_cell_id` column reserved later — do not populate or depend on it until multi-market analytics actually need aggregation.

**Reject now:** H3 as market PK, polygon service areas, PostGIS requirement.

---

## Gap 2 — Regional chain banners (Kroger family and peers)

### What real systems do / public facts

**Kroger Co.** operates ~20+ regional banners (Kroger, Ralphs, Fred Meyer, Fry’s, QFC, King Soopers, Harris Teeter, Smith’s, Dillons, etc.). Public Locations/Products APIs are **one shared API**; `filter.chain` and `locationId` select banner/store — not separate APIs per banner ([Kroger Public APIs / Postman](https://www.postman.com/kroger/the-kroger-co-s-public-workspace/documentation/ki6utqb/kroger-public-apis); [grocer-cli Kroger notes](https://unpkg.com/grocer-cli@2.4.0/docs/KROGER-API.md); [kroger-mcp-server](https://github.com/blunn2/kroger-mcp-server)).

**Ahold Delhaize USA** keeps **Food Lion, Hannaford, Stop & Shop, Giant** as distinct storefronts with separate loyalty and weekly ads on shared back-end ([Ahold Delhaize USA playbook](https://www.anglera.com/blog/ahold-delhaize-usa-retailer-playbook); [Food Lion / sister chains](https://en.wikipedia.org/wiki/Food_Lion)). Expanding “Food Lion ingest” to New England is **not** the same as flipping a Food Lion flag — Hannaford is a different banner/sale surface.

**Publix** — single banner, Southeast-concentrated (not nationwide). Locator/scrape stay one brand; geographic footprint is the limiter, not banner fragmentation.

**Aldi (US / Aldi Süd)** — single consumer banner nationwide (expanding footprint). Treat as **banner-free** for registry purposes.

**Walmart** — Walmart / Neighborhood Market / Sam’s Club are format/club distinctions; Sam’s is already map-context-adjacent in our model. Not Kroger-style regional renaming; still one primary API/scrape family for “Walmart grocery.”

**Dollar Tree / Dollar General** — separate companies; Family Dollar was a Dollar Tree banner and is being divested ([CNN](https://www.cnn.com/2025/03/26/business/family-dollar-sale-dollar-tree)). For Option A map/context, treat each brand as its own chain row, not a parent family, unless we later prove shared locator tech.

### Fit assessment (our code today)

We already encode the Kroger pattern as **one shopper `chain_id = kroger`** plus name markers that map Harris Teeter / Ralphs / … → Kroger rollout (`chain-rollout-policy.ts`, `provider-rollout` tests). That is correct for **shared adapter + ranked membership**, but it loses **banner-level display, Flipp merchant, and weekly-ad URL** distinctions if those diverge by region.

Two design shapes:

| Shape | Pros | Cons |
|---|---|---|
| **A. Banner = separate `chain_id`, shares `parent_family` + `adapter_key`** | Clear Flipp/scrape/marker per banner; Settings can show “Harris Teeter” where that’s the local name; matches Ahold siblings | More rows; risk of double-counting in Settings if parent+child both selectable |
| **B. One chain row + region-scoped banner overrides** | Fewer rows; matches today’s “everything is kroger” | Overrides tables get messy; hard to hang Flipp merchant / id-prefixes per banner |

**Recommendation lean:** **A for shopper-visible banners that need distinct sale surfaces; collapse to parent for ranking math when the adapter and promotion gates are shared.** Concretely: `parent_family_id = kroger_co`, `chain_id = harris-teeter` (or keep `kroger` as the *adapter identity* and store `banner_key` on the store row). Prefer **store.banner** + **registry parent** over exploding Settings checkboxes until west-coast markets matter.

### Banner fragmentation priority (roadmap)

| Chain | Banner-fragmented? | Priority when expanding |
|---|---|---|
| **Kroger family** | **Yes — high** | Shared API helps; still need banner-aware display + Flipp/scrape targets outside VA |
| **Food Lion** | **Self is one banner; parent Ahold is fragmented** | Stay Food Lion–only until an explicit Hannaford/Stop & Shop project; do **not** assume parent = one registry row |
| **Publix** | No (regional footprint only) | Geography, not banners |
| **Aldi** | Effectively no | Low |
| **Walmart** | Formats/club, not regional rename | Low for banner model; Sam’s stays separate if ranked ever |
| **Dollar Tree / DG** | Separate brands | Separate chain rows; catalog-fit (#18) before ranked |

### Recommendation

**Adopt a lightweight parent/banner seam in the `chain_registry` design now; defer full banner expansion work until the first non-VA Kroger-family market or a new Ahold banner.**

- First DB pass: registry fields conceptually include `parent_family_id` (nullable) and/or store-level `banner_key` — even if only `kroger` is populated and markers stay as today.
- Do **not** create Ralphs/Fred Meyer ranked rows until that geography is ingesting.
- Explicitly document: Food Lion ≠ Ahold mega-chain.

---

## Gap 3 — “Not covered yet” UX / organic demand capture

### What real systems do

Gig platforms’ famous “waitlists” are mostly **supply-side** (too many Dashers/shoppers in a ZIP) ([DoorDash waitlist explainers](https://therideshareguy.com/doordash-waitlist/); [Instacart shopper waitlist](https://therideshareguy.com/instacart-waitlist/)) — not the consumer “we don’t deliver here” funnel.

Consumer-side patterns that *do* match our problem:

- **Try the product flow; if out of area, capture interest and promise a notify** (DoorDash merchant FAQ: start signup; if not serviced, “we will notify you when that changes” — [DoorDash merchant FAQ](https://merchants.doordash.com/en-us/faq)).
- **Feature-specific waitlists** with email/SMS for expansion (e.g. DoorDash Dot / drone neighborhood waitlists — [Dot](https://about.doordash.com/en-us/dot), [Wing expansion](https://about.doordash.com/en-us/news/doordash-wing-expand-to-atlanta)).
- Demand signal = **counts of interested addresses/ZIPs**, used by ops to prioritize launch — not automatic market activation.

### Fit assessment for our stack

Important product distinction already in Yum4Less:

| State | Meaning today |
|---|---|
| **Tier C** | Location works; map/context stores; **no ranked dinner estimates** (normal outside gates) |
| **Unresolved / out of CONUS** | Geocode fail or policy reject |
| **Thin ranked coverage** | Ingest hasn’t warmed that pin — still often Tier C with honesty copy |

We are **not** a delivery marketplace with a hard “closed city.” A DoorDash-style “join waitlist, app is useless” is the wrong default. The honest analogue is: **“Map works; ranked estimates aren’t warm here yet — tell us if you want this area prioritized.”**

**Infrastructure we have:** anonymous feedback POST + table (no location fields); analytics events (privacy strips ZIP/lat); no accounts, no email ESP assumed.

**Minimal version that fits:**

1. Detect “interested but thin” from existing signals: successful ZIP/geo resolve + market-search with **zero ranked-ready stores** (or below a coverage threshold) — not “ZIP unrecognized.”
2. Optional one-click: **“Prioritize my area”** → anonymous insert into `market_interest` (ZIP + lat/lng + timestamp + optional note). **No email required** for v1 signal (counts only). Email notify = later if we add a provider.
3. Nightly/ops query: `GROUP BY zip_code ORDER BY interest_count DESC` → upsert `active_markets` candidates with `source = organic_usage`, `status = paused` (as the de-hardcoding plan already sketched).

**Do not require:** accounts, marketing automation, LaunchDarkly, or blocking the whole app behind a waitlist.

### Conceptual UX flow

```text
User sets location (geo or ZIP)
  → resolve OK
  → market-search
      → has ranked-ready stores → normal ranked + trust labels
      → map-only / thin coverage (Tier C)
            → show existing honesty (“limited coverage” / coming soon chains)
            → optional CTA: “Want ranked estimates here? Tell us this area matters.”
                 → confirm (one tap) → “Thanks — we use this to decide where to expand ingest.”
                 → no fake ETA, no “you’re #482 on the waitlist” theater
  → resolve fail (invalid / non-CONUS)
      → error copy; no interest capture until a valid pin exists
```

### Recommendation

**Defer full waitlist UX to a later scaling phase; adopt the data seam early if cheap.**

- **Before first DB pass:** not blocking. Organic candidate upsert from *successful searches* (plan §2.1) already captures demand without a waitlist button.
- **When UX is built:** anonymous `market_interest` → paused `active_markets` candidates; reuse feedback-style rate limits; no accounts.
- **Reject:** account-gated waitlist, email-required notify, or treating Tier C as “not launched.”

---

## Gap 4 — Staged / gradual market rollout beyond boolean active

### What real systems do

Enterprise pattern: percentage canaries, attribute targeting, kill switches (LaunchDarkly-class). Self-hosted OSS alternatives exist (OpenFlags, Facet, flagz, tiny in-process libraries) with percentage rollouts ([OpenFlags](https://github.com/huextrat/openflags); [lightweight-feature-flags](https://github.com/boldoutlook/lightweight-feature-flags); [flagz](https://github.com/matt-riley/flagz)).

Marketplace “soft launch” is usually: **ops enables a city**, watches metrics, expands — not hashing anonymous users to 5% of a ZIP.

### Fit assessment

| Mechanism | Need at our scale? |
|---|---|
| LaunchDarkly / full flag platform | **No** — ops team of one; no multi-tenant flag governance |
| Percentage shopper canary | **Weak fit** — no stable `userId`; ZIP hash canaries are noisy and hard to reason about for ingest (ingest is all-or-nothing per market) |
| `active_markets.status` enum | **Sufficient core** |
| Extra statuses: `candidate` / `canary` / `paused` / `active` / `retired` | **Cheap and enough** |
| Kill switch | **Already conceptual** via `paused`; chain-level M128 pause is separate |

Honest assessment: **boolean `active`/`paused`/`retired` is almost enough.** The real failure mode is not “need 10% rollout” — it is “accidentally ingest-scrape a new ZIP at full weekly-ad cost” or “ranked reads look empty while global freshness is green.” A **`canary` status** that means “run map-catalog only” or “run one chain only” is more valuable than percentage flags — but even that can wait until multi-ZIP ops hurt.

### Recommendation

**Worth naming as a small enum extension when `active_markets` is built; not worth a feature-flag product.**

- First DB pass: implement `status ∈ { candidate, paused, active, retired }` (or keep plan’s three and add `candidate` for organic).
- Optional later: `canary` = ingest map-catalog only / skip weekly-ad until promoted — **manual promotion**, no percentage engine.
- **Explicitly not worth it now:** LaunchDarkly-style infra, % shopper bucketing.

---

## Gap 5 — Visibility into provisional / bootstrap-threshold markets

### What real systems do

Cold-start risk/fraud systems combine: (1) **safe default rules**, (2) a **review queue or flagged band**, (3) dashboards for teams, (4) offline reports for calibration ([fraud score explainers](https://www.sardine.ai/learn/fraud-score); [ML vs rules cold start](https://www.tagada.io/glossary/fraud-scoring)). Solo operators and small teams often start with **queued exceptions + periodic reports**, not a full real-time ops UI.

### Fit assessment

We already have owner console, debug pipeline (`/api/debug/pipeline`), Discord-ish homelab notifications, and Postgres MCP / SQL. Threshold provisional state is **low cardinality** (number of active markets ≪ number of fraud events). A dashboard that nobody opens is worse than a weekly query in the runbook.

**Lightest equivalent:**

```text
SQL / script: markets where thresholds_status = 'provisional'
  → zip, density_class, profile_id, store_count, ranked_obs_24h, activated_at
Cron or manual: print in ingest summary / Discord
Promote: UPDATE profile when metrics exist (owner action)
```

Owner console row later = nice-to-have, not a prerequisite.

### Recommendation

**Defer UI; adopt query/report visibility in the same slice that introduces `threshold_profiles`.**

- Persist `thresholds_status = provisional | calibrated` (as the plan already implies).
- Document one owner SQL (or `npm run` report) in homelab/deploy docs.
- **Reject:** dedicated threshold ops dashboard in the first pass.

---

## Revised priority order

Given the research, what must inform the **first DB-driven implementation pass** vs what can wait without expensive rework:

### Address in / before the first DB-driven pass (cheap seams or correctness)

| Item | Action |
|---|---|
| **Gap 1 seam** | Design `zip_geocode_cache` / `active_markets` with **lat/lng (+ timezone/density) first-class**; ZIP as label/input key; document pin+radius authority. **Do not** adopt H3. |
| **Gap 2 seam** | `chain_registry` includes nullable **`parent_family_id` / banner awareness**; keep collapsing Kroger family to one ranked adapter for now. |
| **Gap 4 light** | Prefer `candidate`/`paused`/`active`/`retired` over a bare boolean; skip % canaries. |
| **Gap 5 light** | When profiles land, ship **provisional flag + SQL/report**, not a UI. |
| Existing plan blockers | Fail-loud ingest ZIPs, durable geocode cache, remove UI default ZIP — unchanged priorities from the de-hardcoding plan. |

### Defer to a later scaling phase (no material cost if seams above exist)

| Item | Why deferral is safe |
|---|---|
| **H3 / geofence markets** | Pin+radius + lat/lng columns absorb ZIP weirdness until analytics need grids |
| **Full banner expansion** (Ralphs, Hannaford, …) | Only burns when those geographies ingest; parent field avoids redesign |
| **Consumer “prioritize my area” waitlist UX** | Organic search→candidate already signals demand; CTA is product polish |
| **Feature-flag / % rollout platform** | Manual status promotion matches solo ops |
| **Provisional markets owner UI** | Report/query sufficient until market count is painful |

### Explicitly reject for this product stage

- H3/PostGIS as a prerequisite for nationwide de-hardcoding  
- LaunchDarkly-class infrastructure  
- Account-gated expansion waitlists  
- Treating Tier C as “market closed”  
- Per-market identity seed files as the banner/expansion strategy (still Slice D)

---

## Bottom line

The external review correctly spotted **DoorDash-scale** patterns. At Yum4Less scale, the right response is mostly **seams, not systems**: coordinates over ZIP polygons, parent/banner fields without exploding the registry, paused organic candidates instead of marketing waitlists, enum statuses instead of canary platforms, and SQL visibility instead of ops dashboards. Those seams should be written into the first DB-driven pass; the heavyweight interpretations should wait until multi-market pain is measured.

---

## Scale check

- **Small scale:** Each of the five gaps has an adopt/defer/reject call tied to current code and solo-homelab ops.
- **Large scale:** Avoids premature DoorDash-shaped infrastructure while preventing ZIP-as-polygon and single-banner assumptions from becoming structural debt — residual scale risk is only if first-pass tables omit lat/lng or parent_family seams.
