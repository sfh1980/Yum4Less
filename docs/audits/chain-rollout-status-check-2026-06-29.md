# Chain rollout status check — 2026-06-29

Read-only audit verified against code (not `PROJECT_CONTINUITY.md` narrative alone).

---

## Routing

- **Suggested agent:** none required (read-only audit).
- **Rephrase:** `@verifier` — verify chain rollout constants vs `PROJECT_CONTINUITY.md` Resume vs Working today bullets.
- **Gates run:** `npm test`, `npm run build` (reported below). No doc edits.

---

## Date

**Monday, June 29, 2026** (from session metadata).

---

## `SETTINGS_SELECTABLE_CHAINS` (verbatim)

```10:15:src/lib/settings-store-selection.ts
export const SETTINGS_SELECTABLE_CHAINS = new Set<StoreChain>([
  "kroger",
  "aldi",
  "publix",
  "food-lion",
]);
```

Order constant (same four chains):

```17:22:src/lib/settings-store-selection.ts
const SETTINGS_SELECTABLE_CHAIN_ORDER: StoreChain[] = [
  "kroger",
  "aldi",
  "publix",
  "food-lion",
];
```

---

## `MEAL_PRICING_COMING_LATER_CHAINS` (verbatim)

```36:37:src/lib/provider-rollout.ts
/** Chains with ingest paths but no honest ranked-meal pricing rollout in beta. */
const MEAL_PRICING_COMING_LATER_CHAINS = new Set<StoreChain>([]);
```

**Empty set** — no chains are held via this gate today.

Related weekly-ad promotion allowlist (separate constant; Walmart is listed but hard-blocked in gate logic):

```12:18:src/lib/weekly-ad-ingestion/weekly-ad-coverage.ts
export const WEEKLY_AD_RANKED_PRICING_CHAINS = new Set<WeeklyAdChain>([
  "kroger",
  "publix",
  "walmart",
  "aldi",
  "food-lion",
]);
```

```85:91:src/lib/weekly-ad-ingestion/weekly-ad-coverage.ts
export function weeklyAdPromotionGatesPass(
  coverage: WeeklyAdStoreCoverage,
  chain: StoreChain,
): boolean {
  if (chain === "walmart") {
    return false;
  }
```

---

## Food Lion / Publix vs Kroger / Aldi — three areas

### 1. Settings store picker — **same treatment (all four selectable)**

Publix and Food Lion are in `SETTINGS_SELECTABLE_CHAINS` alongside Kroger and Aldi. Test explicitly expects all four even when `recommendationEnabled` is false:

```31:55:src/lib/settings-store-selection.test.ts
  it("includes Kroger, Aldi, Publix, and Food Lion even when recommendation gates are off", () => {
    const filtered = filterSettingsSelectableStores([
      // ...
    ]);

    expect(filtered.map((entry) => entry.id)).toEqual([
      "kroger-1",
      "aldi-1",
      "publix-1",
      "food-lion-1",
    ]);
  });
```

Settings copy names all four:

```91:95:src/components/meal-planner/settings-panel.tsx
      <p className="panel-copy">
        Set your location, search radius, shopping style, and store(s). Yum4Less
        saves these preferences locally. Ranked dinner estimates use Kroger-family,
        Aldi, Publix, and Food Lion when daily ingest and promotion gates pass.
      </p>
```

**Note:** `PROJECT_CONTINUITY.md` line 51 still says “Kroger + Aldi always listed” — that is **stale** vs code.

### 2. Weekly-ad promotion gates — **same path as Aldi; Kroger has an extra official-API path**

`MEAL_PRICING_COMING_LATER_CHAINS` is empty, so Publix/Food Lion are **not** forced to `coming-soon` via that lock. When `weeklyAdPromotionPassed` is true, all non-Walmart chains in the allowlist get `weekly-ad-preview` + `recommendationEnabled: true`:

```146:157:src/lib/provider-rollout.ts
  if (MEAL_PRICING_COMING_LATER_CHAINS.has(base.chain)) {
    return resolveComingLaterMealPricingRollout(base, weeklyAdContext);
  }

  if (weeklyAdContext?.weeklyAdPromotionPassed) {
    return {
      ...base,
      status: "weekly-ad-preview",
      recommendationEnabled: true,
      note: `${base.label} meal prices use weekly ad deals (${weeklyAdContext.matchedIngredientCount} matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.`,
    };
  }
```

Tests confirm Publix and Food Lion promote the same way as Aldi when gates pass:

```99:109:src/lib/provider-rollout.test.ts
  it("enables Publix weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Publix Atlee", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
```

```135:145:src/lib/provider-rollout.test.ts
  it("enables Food Lion weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Food Lion", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
```

**Kroger-only difference:** official API promotion path (`krogerOfficialApiPromotionPassed`) at lines 159–170 of `provider-rollout.ts` — not available to Publix/Food Lion/Aldi.

### 3. Trust copy — **mostly aligned with four-chain scope; two rank-flow strings still say Kroger/Aldi only**

**Updated to four chains:**

```22:25:src/lib/pricing-trust-heads-up-expanded.ts
      heading: "Chain coverage",
      paragraphs: [
        "The current production release ranks dinners from Kroger-family, Aldi, Publix, and Food Lion when daily ingest and promotion gates pass. Walmart, OSM, and other unsupported pins are map context only—not live-priced sources for meal totals.",
      ],
```

```11:14:src/app/page.tsx
          For the current production release, ranked dinner estimates focus on{" "}
          <strong>Kroger-family, Aldi, Publix, and Food Lion</strong> when daily
          ingest and promotion gates pass. Walmart and other pins may appear as
          map context; ranked pricing for them is planned in upcoming releases.
```

```121:123:src/components/meal-planner/meal-results-panel.tsx
            body="Yum4Less is matching your selected sale ingredients to recipes using nearby Kroger-family, Aldi, Publix, and Food Lion estimates where gates pass."
```

**Still Kroger/Aldi-only wording (internal inconsistency):**

```19:22:src/components/meal-planner/rank-step-panel.tsx
      <p className="panel-copy">
        Tap below when you are ready. Yum4Less matches your sale ingredients to
        recipes using saved weekly-ad and Kroger-family/Aldi estimates where gates
        pass — not live checkout totals.
```

```13:15:src/components/meal-planner/rank-loading-overlay.tsx
        <p>
          Yum4Less is matching your sale ingredients to dinner ideas using saved
          weekly-ad and Kroger-family/Aldi estimates where gates pass.
```

**Base rollout notes differ:** Kroger default note does not use “BETA” weekly-ad language; Publix/Aldi/Food Lion do:

```40:47:src/lib/provider-rollout.ts
  kroger: {
    // ...
    note:
      "Kroger meal estimates are not ready in this area yet. Weekly-ad or official online coverage is still building.",
  },
```

```49:57:src/lib/provider-rollout.ts
  publix: {
    // ...
    note:
      "BETA: Publix meal estimates use weekly-ad deals when ingested near you and promotion gates pass. Totals are directional—verify in store.",
  },
```

---

## `PROJECT_CONTINUITY.md` contradiction — which matches code?

| Location | Claim |
|---|---|
| **Resume line 17** | “**Kroger family, Aldi, Publix, and Food Lion** when daily ingest and promotion gates pass” |
| **Working today lines 44 & 54** | “**production deploy focus remains Kroger + Aldi**”; “Publix/Food Lion code paths exist for upcoming releases” |
| **Decision log line 1362** | 2026-06-29: Publix + Food Lion removed from `MEAL_PRICING_COMING_LATER_CHAINS`; added to `SETTINGS_SELECTABLE_CHAINS` — **Active** |

**Code matches Resume line 17 and Decision log 1362.**  
**Code contradicts Working today lines 44, 51, and 54** — those bullets were not refreshed after the 2026-06-29 promotion.

**Explicit flag:** `PROJECT_CONTINUITY.md` currently contains **both** “four-chain production-ranked” (Resume) **and** “Kroger + Aldi only” (Working today). Only one can be true; **code is on the four-chain side**.

---

## Tests and build

| Command | Result |
|---|---|
| `npm test` | **729 passed** / 729 total — **139 test files** passed |
| `npm run build` | **Pass** (Next.js 15.5.19, compiled successfully) |

---

## `docs/homelab-deploy.md` and scheduled ingest cron

- **`docs/homelab-deploy.md` exists** at `docs/homelab-deploy.md` — homelab cron runbook (prep doc, not proof of live ops).
- **No live cron evidence in repo.** Continuity text states ingest cron is documented but **not running on owner hardware**:

```11:11:PROJECT_CONTINUITY.md
**Homelab prep:** Scheduled-ingest runbook for a future 24/7 Linux box → [`docs/homelab-deploy.md`](docs/homelab-deploy.md) (cron, `.env.local`, log rotation, Postgres freshness checks, pre-go-live gaps). Not owner-run on hardware yet.
```

```15:15:PROJECT_CONTINUITY.md
**Hosting:** Self-hosted homelab (target); owner preparing dedicated Linux box — ingest cron wiring documented, not live on hardware yet.
```

Scheduled ingest today is a **manual script** (`npm run ingest:weekly-ads:scheduled`) plus **fixture/CI** (`ingest:weekly-ads:scheduled:fixture`). Cron wiring is documented in `.env.example` / homelab runbook only; there is no in-repo signal that a production cron job has been enabled on a live box.
