# Yum4Less Playwright E2E suite

Committed browser tests (`@playwright/test`) gate merge via `npm run test:e2e:ci` (CI workflow `e2e` job). **Playwright MCP** in Cursor is for exploratory checks beyond this suite — not a substitute for these specs.

## Layout

| File | Responsibility |
|------|----------------|
| `helpers.ts` | Shared wizard → rank flows, ZIP pin seed (fast path), trust assertions, tab navigation |
| `fixtures/api-mocks.ts` | Deterministic Tier C and API error payloads |
| `gps-deny.spec.ts` | GPS deny → ZIP + real pin-step continue (no cache seed) |
| `faq-terms.spec.ts` | `/faq`, `/faq/[slug]`, `/terms`; Settings/Feedback legal links; Back from Terms keeps theme/tab |
| `mvp-flow.spec.ts` | Happy path, accordion, splash branding, FAQ from map `?`, save-to-Saved |
| `settings-stores.spec.ts` | Multi-store scoping, four-chain store list, ZIP validation |
| `coordinate-first.spec.ts` | GPS-primary wizard (`Use GPS`) to ingredients |
| `coordinate-first-cold.spec.ts` | Cold-start geolocation path before catalog cache warms |
| `single-store-map-overlay.spec.ts` | Single-store map overlay from ingredients step |
| `tier-c.spec.ts` | Map context without ranked meals (mocked Tier C) |
| `api-errors.spec.ts` | Market-search and recommendations 400/500 UI copy |
| `market-pass-through.spec.ts` | Trimmed market snapshot on rank + post-rank Deals |
| `stale-store-selection.spec.ts` | Stale localStorage store IDs → rank notice + effectiveSelectedStoreIds re-sync |
| `navigation-theme.spec.ts` | 6-tab nav, locked-tab messages, chrome theme toggle, Cook gating |
| `pantry-step.spec.ts` | Pantry check — near-miss checklist, sticky “dinners we can show next”, continue to rank |
| `error-surfaces.spec.ts` | H11 `error.tsx` (H12 skipped — bundled Leaflet) |
| `mobile-smoke.spec.ts` | Narrow viewport smoke (`mobile-chrome` project only) |

## Commands

```bash
# Full CI gate (build + fixture ingest + port 3100 server)
npm run test:e2e:ci

# Local against existing dev server
npm run db:up
npm run dev
# PowerShell:
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"
npm run test:e2e
```

## Data policy

- CI uses `yum4less_test` on port **5433** with fixture weekly-ad ingest and CI bootstrap stores.
- ZIP **`23111`** is the fallback-path anchor; geolocation tests use **`37.6085`, `-77.3739`**.
- Tier C and API failures use `page.route()` mocks — no live retailer pages or unstable geocoding in CI.

## When to extend

Add specs here (not only MCP) when Vitest cannot prove:

- Full location → store → ingredient → rank → results wiring
- Visible trust/fallback labels and Tier C honesty
- Map overlay, accordion a11y, tab navigation, theme
- API error panels surfaced in the UI

Keep ranking math, route validation, and DB merge behavior in Vitest / integration tests.
