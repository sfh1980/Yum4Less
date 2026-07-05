# Chain provider status audit (2026-06-27)

> **Superseded as of 2026-06-29** for shopper-facing chain scope: Publix and Food Lion are in `SETTINGS_SELECTABLE_CHAINS` and out of `MEAL_PRICING_COMING_LATER_CHAINS`. This file remains a **point-in-time** ingest/integration audit — do not treat its ranked-scope rows as current product truth. See [`PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md) Decision log (2026-06-29) and [`chain-rollout-status-check-2026-06-29.md`](chain-rollout-status-check-2026-06-29.md).

Read-only analysis for **Aldi**, **Food Lion**, and **Publix**, plus a scoped **Kroger API weekly-ad fallback** fix and doc update. Builds on [`docs/provider-integration-pattern.md`](../provider-integration-pattern.md) and the in-progress Kroger refactor.

**Authority:** `PROJECT_CONTINUITY.md` for product scope. Trust copy → `.cursor/rules/yum4less-product-and-trust.mdc`.

**Reusable pattern:** [`docs/provider-integration-pattern.md`](../provider-integration-pattern.md) · worked Kroger example: [`kroger-data-path-audit-2026-06-26.md`](kroger-data-path-audit-2026-06-26.md)

---

## What was run this session

| Command / check | Result |
|-----------------|--------|
| `npm test -- --run src/lib/weekly-ad-ingestion/` | **55/55 passed** |
| Live probes (`probe:kroger-api`, `probe:publix-live-ingest`, Flipp/Kroger network) | **Not run** |
| Postgres MCP | **Not run** |
| Playwright MCP | **Not run** |
| Full `npm test` | **Not run** (weekly-ad slice only) |

Baseline parsed→synced numbers below cite **`PROJECT_CONTINUITY.md` → Live weekly-ad baseline (last measured 2026-05, ZIP 23111)** unless noted as code-only.

---

## 1. Kroger API fallback — owner decision folded in

### Owner decision (locked)

Keep `kroger-weekly-ad-api-fallback.ts`, but **demote** and document as **last-resort partial enrichment only** — never primary sale discovery, never Flipp-equivalent coverage.

### Code confirmation (pre-fix)

| Requirement | Status |
|-------------|--------|
| API fires only after scrape **and** Flipp both return zero | **Yes** — `kroger-weekly-ad-ingestion.ts` checks `rawOffers.length === 0` after each tier |
| Fills only already-known tracked ingredients | **Yes** — `fetchKrogerOffersFromOfficialApi` filters `INTERNAL_CATALOG_INGREDIENTS` to `trackedIngredientIds`, `limit: 1` per term |
| Not general sale discovery | **Yes** structurally; labeling was wrong before fix (see below) |

### Gap found

When the API tier fired, it incorrectly:

- set `provenance: "weekly-ad-partner-feed"` — **same as Flipp**
- used `saleLabel: "Official API promo"` or **undefined** — not distinguishable from Flipp’s `"Directional — weekly ad syndicated feed"`

### Changes shipped

| File | Change |
|------|--------|
| `src/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback.ts` | Module doc: last-resort partial enrichment. Exported `KROGER_WEEKLY_AD_API_PARTIAL_FILL_SALE_LABEL` on every offer |
| `src/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion.ts` | API tier: `provenance = "weekly-ad-scrape"`; retrieval label states partial / tracked-ingredients / not weekly-ad discovery |
| `src/lib/weekly-ad-ingestion/weekly-ad-chain-config.ts` | Kroger `termsNote` updated |
| `docs/provider-integration-pattern.md` row 156 | Definitive: **kept, demoted, scoped** |

### Trust label distinction

| Source | `saleLabel` / provenance |
|--------|--------------------------|
| Flipp | `"Directional — weekly ad syndicated feed"` · `provenance: weekly-ad-partner-feed` |
| Kroger API partial fill | `"Partial — tracked-ingredient product API fill (not weekly ad discovery)"` · `provenance: weekly-ad-scrape` |

Persisted observations still use `kroger-weekly-ad-scrape` source name via the weekly-ad sync path; UI trust flows through the distinct `saleLabel`.

### Kroger fallback order (sale discovery)

```
scrape → Flipp (simple merchant search) → official Products API (partial, tracked ingredients only)
```

Unlike Aldi/Food Lion, Kroger uses **scrape-first** and **does not** call `resolveFlippWeeklyAdOffersForChain` (no flyer lookup + supplemental ingredient searches on the Kroger path).

---

## 2. Current-state report — Aldi, Food Lion, Publix

Honest **today** state — not aspirational. Structured like the Kroger audit: store location / item pricing / sale discovery.

### Aldi

| Category | Current state |
|----------|---------------|
| **Store location** | **OSM Overpass** → `buildAldiCatalogStoreForMarket` (`aldi-{osmId}`). No official Aldi locator API. Nearest OSM Aldi at ingest/sync; never ZIP-centroid fallback. |
| **Item pricing** | **No official pricing API.** Not in `provider-registry.ts`. Ranked path = weekly-ad observations only. |
| **Sale discovery** | **Flipp-first** via `resolveFlippWeeklyAdOffersForChain` (merchant `"ALDI"`, flyer lookup + supplemental ingredient searches) → scrape fallback to `aldi.us/en/weekly-specials/`. No official API tier. |
| **Sync funnel (baseline)** | **149 parsed → 6 synced** (May 2026, ZIP 23111). Matching funnel drops most Flipp SKUs by design. |
| **Shopper-facing ranked?** | **Yes — v1 production-ranked** with Kroger when promotion gates pass. |
| **`settings-store-selection.ts`** | **In** `SETTINGS_SELECTABLE_CHAINS` (`kroger` + `aldi`). |
| **Maturity vs selectable?** | Selectable **by design** (#2 ranked chain). Real but thin: Flipp-primary, no official-online path, 6/149 is funnel compression not feed failure. |

**Test coverage:** `aldi-weekly-ad-ingestion.test.ts`, `parse-aldi-weekly-ad-html.test.ts`, `flipp-weekly-ad-resolver.test.ts`, `aldi-location-discovery.test.ts`, fixture in `weekly-ad-ingestion-service.test.ts`. No live-network ingest test. No Aldi-specific owner probe.

---

### Food Lion

| Category | Current state |
|----------|---------------|
| **Store location** | **OSM context only** — `osm-food-retail-discovery.ts` maps Food Lion–like elements to `food-lion` chain. No official locator API client. |
| **Item pricing** | **None.** Not in `provider-registry.ts`. |
| **Sale discovery** | **Flipp-first** (`resolveFlippWeeklyAdOffersForChain`, merchant `"Food Lion"`) → browser scrape fallback. Direct HTTP often **403/WAF**; code handles blocked scrape. No official API tier. |
| **Sync funnel (baseline)** | **137 parsed → 20 synced** (May 2026, ZIP 23111). |
| **Shopper-facing ranked?** | **No — context-only** for ranked meal totals. `MEAL_PRICING_COMING_LATER_CHAINS` since 2026-06-15: gates exist for CI/rehearsal; `recommendationEnabled` stays false. |
| **`settings-store-selection.ts`** | **Not** in `SETTINGS_SELECTABLE_CHAINS`. Map pin + coming-soon rollout copy. |
| **Maturity vs exposure?** | Correctly not shopper-selectable. Ingest more mature than Publix on Flipp; explicitly demoted from production-ranked scope. |

**Test coverage:** `food-lion-weekly-ad-ingestion.test.ts`, fixture in service test. No live ingest test. No Food Lion–specific probe.

---

### Publix

| Category | Current state |
|----------|---------------|
| **Store location** | **Official locator service** — `publix-services-api-client` (website store-locator, not a developer API). `publix-catalog-sync.ts` upserts `publix-{storeNumber}` with `publix-store-locator` source. Registered in `provider-registry.ts`. |
| **Item pricing** | **Stub only.** `searchPricingPreview` returns `not-configured`. No `price_observations` from official-online path. |
| **Sale discovery** | **No Flipp in live path.** `publix-weekly-ad-ingestion.ts`: `resolvePublixStoreForZip` → `buildStoreCookie` → `fetchPublixWeeklyAdPage` → `parsePublixWeeklyAd`. Flipp types list `"Publix"` but ingest never calls Flipp. |
| **Sync funnel (baseline)** | **655 parsed → 21 synced** (May 2026, ZIP 23111). |
| **Shopper-facing ranked?** | **No — context-only.** `MEAL_PRICING_COMING_LATER_CHAINS`. Not in `SETTINGS_SELECTABLE_CHAINS`. |
| **Working sale discovery today?** | **Yes when scrape succeeds** — locator-cookie + chain parser. Failures: no store cookie, parser gaps, anti-bot. |

**Test coverage:** `parse-publix-weekly-ad.test.ts`, `publix-provider.test.ts`, `publix-services-api-client.test.ts`, `publix-catalog-sync.test.ts`, fixture in service test. Owner probes: `probe:publix-live-ingest`, `test-publix-live-scrape.mjs`.

---

### Cross-chain comparison

| | Aldi | Food Lion | Publix |
|---|:---:|:---:|:---:|
| Official store API | ❌ OSM | ❌ OSM | ✅ locator service |
| Official item pricing API | ❌ | ❌ | ❌ |
| Flipp in live weekly-ad path | ✅ primary | ✅ primary | ❌ |
| Scrape fallback | generic page fetch | generic (+ WAF) | locator-cookie + chain parser |
| `SETTINGS_SELECTABLE_CHAINS` | ✅ | ❌ | ❌ |
| Production-ranked meal totals | ✅ (gates) | ❌ | ❌ |
| Baseline parsed→synced (23111) | 149→6 | 137→20 | 655→21 |

### Live weekly-ad baseline (ZIP 23111, May 2026)

From `PROJECT_CONTINUITY.md`:

| Chain | Live result | Notes |
|-------|-------------|-------|
| Publix | 655 parsed, 21 synced | Browser + HTML parser |
| Kroger | 122 Flipp, 4 synced | Direct scrape often 0 |
| Aldi | 149 Flipp, 6 synced | Flipp primary path |
| Food Lion | 137 Flipp, 20 synced | HTTP often 403 |

---

## 3. Automation-readiness (informational — not built)

Per `provider-integration-pattern.md` non-goals: no plugin framework, no config-driven interpreter until a second chain proves the shape.

### Does “three+ chains share a shape” hold today?

**No.**

| Shape | Chains | Steps |
|-------|--------|-------|
| **A — Flipp-first + generic scrape** | Aldi, Food Lion | `resolveFlippWeeklyAdOffersForChain` → `fetchWeeklyAdPageContent` + `parseWeeklyAdHtml` |
| **B — Scrape-first + simple Flipp + API partial** | Kroger only | chain fetcher/parser → `fetchFlippWeeklyAdOffers` → `fetchKrogerOffersFromOfficialApi` |
| **C — Locator-cookie + chain scrape** | Publix only | `resolvePublixStoreForZip` → cookie → chain fetcher/parser. No Flipp. |

That is **two** on shape A, one on B, one on C. Publix does not count toward Flipp-first.

### Hypothetical minimal config (shape A only — propose, not build)

```ts
// illustrative only
type FlippFirstWeeklyAdChainConfig = {
  fallbackShape: "flipp-first-then-scrape";
  flippMerchant: FlippWeeklyAdMerchantName;
  scrapeUrl: string;
  fetchStrategy: WeeklyAdFetchStrategy;
  browserWaitSelector?: string;
};
```

Shared executor would cover ~90% of Aldi/Food Lion today. Kroger and Publix stay hand-written.

### Before revisiting abstraction

1. A **third chain on shape A** (e.g. Walmart converging to `resolveFlippWeeklyAdOffersForChain`, or Publix adding Flipp as first tier).
2. Or Kroger converging Flipp to the resolver (still scrape-first ordering — not identical to Aldi/Food Lion).
3. Prove a shared executor with three production chains without Kroger API partial tier or Publix cookie logic polluting the abstraction.

**Recommendation:** Keep hand-written per-chain files until a third Flipp-first+generic-scrape chain ships or paths converge enough that differences are config knobs.

---

## Related files touched (Item 1)

- `src/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback.ts`
- `src/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion.ts`
- `src/lib/weekly-ad-ingestion/weekly-ad-chain-config.ts`
- `docs/provider-integration-pattern.md`

---

## Verification statement

**Cited from code:** Fallback order, tracked-ingredient scope, chain ingest paths, rollout gates, `SETTINGS_SELECTABLE_CHAINS`, provider registry gaps.

**Not verified live this session:** Full unit suite, Postgres row counts, production Kroger API, live Flipp/Publix scrape against retailer sites today, or re-measurement of May 2026 baseline numbers.
