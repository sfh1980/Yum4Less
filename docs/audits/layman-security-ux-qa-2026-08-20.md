# Yum4Less — Layman Q&A (security, ops, and shopper UX)

**Date:** 2026-08-20  
**Kind:** Read-only feedback. **No code was changed.**  
**Audience:** Owner questions in plain language, with a short “what to do next.”

This is **not** a claim that the site is production-ready, deploy-ready, or CI-green. It is a snapshot of how the project already handles (or does not handle) each topic.

**Live check this session:** `https://yum4less.com/` returned HTTPS `200` through Cloudflare. App-owned `/robots.txt` and `/sitemap.xml` are **404**. Feedback page is live (`/feedback` → `200`). Playwright browser MCP could not open the site (Chrome-for-testing missing locally). Semgrep MCP timed out on this pass; CI still has a Semgrep job.

---

## Quick scorecard

| # | Topic | Status today | Need more? |
|---|---|---|---|
| 1 | Hiding API keys | **Good** | Keep keys server-side; never add `NEXT_PUBLIC_` secrets |
| 2 | Env variables | **Good** | `.env.example` is the checklist |
| 3 | Admin routes | **Partial / good enough for beta** | Key-gated, not real login |
| 4 | Keys in git | **Good** | `.env` gitignored; example file has empty placeholders |
| 5 | XSS | **Good** | React escapes text; tiny leftover: map marker letters |
| 6 | SQL injection | **Good** | Queries use `$1` placeholders |
| 7 | DB rules | **Good for prices; not “all APIs”** | Rank/market read-only; feedback/analytics can insert |
| 8 | Rate limiting | **Good for one box** | In-memory; resets on restart |
| 9 | CSRF | **Low need today** | No cookie login |
| 10 | CORS | **Locked down** | No “allow any website” setting |
| 11 | HTTPS | **Yes on the public site** | Cloudflare Tunnel |
| 12 | Security headers | **Partial** | Frame/sniff/referrer present; no CSP or HSTS |
| 13 | Debug mode | **Off in production** | Forced off when `NODE_ENV=production` |
| 14 | Prod settings | **Mostly careful** | Compose forces debug/writes off |
| 15 | Horizontal scroll | **Mostly intentional** | Store cards swipe; not a proven page bug |
| 16 | Broken links | **No obvious dead internals** | Site has only a few pages |
| 17 | Meta description | **Yes, basic** | One sentence; no Open Graph extras |
| 18 | Footer links | **Minimal** | Feedback link on Home |
| 19 | Custom 404 | **Not built yet** | Next.js default 404; easy to add |
| 20 | Broken buttons | **Mostly OK; two confusing spots** | Ingredients Continue may hide under the map bar |
| 21 | Success / error messages | **Yes, with a few confusing mappings** | Forms, APIs, crash screen; Settings 400 often sounds like ZIP |
| 22 | Mobile overflow | **Partial** | Map bar + iPhone home indicator can cover controls |
| 23 | Mobile optimized | **Shell yes; phone path thin** | 5-tab nav; mobile e2e is smoke only |
| 24 | HSTS | **Not on yet — should add** | Best at Cloudflare |
| 25 | CSRF tokens | **Not needed yet** | Add if you ever add cookie login |
| 26 | sitemap.xml | **No — skip for v1** | Not a recipe blog; sitemap would advertise content we are not |
| 27 | Terms of Service | **Thin disclaimer, not a full ToS** | Footer “beta / estimates / verify in store” is enough for no-login |
| 28 | FAQ | **Not for v1 as a new page** | Locked: trust stays inline, not a new route |
| 29 | robots.txt | **No app file — should add** | Hide `/owner` from search engines |
| 30 | Feedback vs reviews | **Keep feedback; don’t make a public review wall** | Steer copy, keep reports private |

---

## Security

### 1. Hiding API keys

**Plain answer:** Keys live on the server, not in the shopper’s browser.

Kroger, Geocodio, Walmart, Apify, GitHub, and admin keys are read from environment variables. The browser only gets a few **public flags** (for example “is analytics on?”), not secrets. Geocoding and retailer APIs run in server code.

Shopper ZIP lookup **does** call Geocodio on the server (the key stays server-side). Kroger secrets are **not** used on shopper search — prices come from yesterday’s ingest. `APIFY_API_TOKEN` and Walmart keys are documented but **not wired** to live features.

**Recommendation:** Do not put real keys in any name that starts with `NEXT_PUBLIC_`. Those get baked into the website files.

**Where:** `.env.example`, `src/lib/geocoding.ts`, Compose / TrueNAS env, not the React UI.

---

### 2. Env variables

**Plain answer:** Yes. The project is built around a local secrets file you copy from an example.

You copy `.env.example` → `.env.local`. Real values stay on your machine / TrueNAS. The example file documents what each switch does (database URL, Kroger, feedback, debug, proxy trust, and so on).

**Recommendation:** Keep using `.env.example` as the only checklist. After homelab deploys, rotate away from the local-dev database password `postgres:postgres` if anything is reachable beyond your loopback/LAN plan.

**Where:** `.env.example`, `.gitignore`, `docs/homelab-deploy.md`.

---

### 3. Protecting admin routes

**Plain answer:** There is no shopper login. Owner tools are hidden and locked with a shared secret.

- Debug dump (`/api/debug/pipeline`) is **always 404 in production**. In local/dev it also needs `YUM4LESS_DEBUG_ADMIN_KEY`.
- Feedback list and analytics list need `YUM4LESS_FEEDBACK_ADMIN_KEY` (header or Bearer token).
- `/owner` is **not** in the shopper menu. You paste the same feedback admin key in that tab. Search engines are told `noindex`.

This is “secret handshake,” not a full admin account system. Fine for a household beta; not the same as Google-login admin. Anyone can **load** `/owner` HTML; the lists 401 without the key (no server-side page gate).

**Recommendation:** Keep it. Later: timing-safe key compare (already noted as a small leftover). Optional: Cloudflare Access in front of `/owner`. Do not link `/owner` from the shopper app.

**Where:** `src/lib/debug/debug-routes-policy.ts`, `src/lib/admin-key-auth.ts`, `src/app/owner/page.tsx`, `docs/feedback-path.md`.

---

### 4. Checking keys in git

**Plain answer:** Real env files are gitignored. GitHub search this session only found the **example** file with empty `WALMART_CLIENT_SECRET=` and the public TheMealDB demo key `1` (documented as a test key).

Also ignored: `.cursor/mcp.json`, `*.pem`, `secrets/`, `credentials.json`.

CI uses GitHub **Actions secrets** (not committed) and a Semgrep job.

**Recommendation:** Never commit `.env.local`. If a real key ever lands in git, rotate it immediately. CI Semgrep only runs when `SEMGREP_APP_TOKEN` is set; otherwise that job **exits 0** (advisory). There is no gitleaks/trufflehog workflow.

**Where:** `.gitignore`, `.env.example`, `.github/workflows/ci.yml`.

---

### 5. Protecting against XSS (cross-site scripting)

**Plain answer:** The site is built in React, which by default treats user text as text, not as code. A search found **no** `dangerouslySetInnerHTML`. Feedback notes are length-capped and shown as normal text in the owner console, not as HTML. Shoppers no longer see a public feedback feed.

Map popups that must use HTML go through `escapeHtml`. One small leftover: store-marker letter badges build HTML without that helper (1–2 letters from the chain name — low risk).

**Recommendation:** Stay on this pattern. Optional later: escape the marker abbreviation too. If you ever render weekly-ad HTML from retailers, sanitize it first.

**Where:** React components; `src/lib/html-escape.ts`; `src/lib/feedback/feedback-validation.ts`; owner console (text only).

---

### 6. SQL injection

**Plain answer:** User words are not glued into SQL strings. The database calls use numbered placeholders (`$1`, `$2`), which is the safe pattern.

Example: inserting feedback uses `values ($1, $2, $3, $4, $5)`.

**Recommendation:** Keep using placeholders. Do not build SQL with string concatenation from ZIP codes, notes, or store names.

**Where:** `src/lib/feedback/feedback-repository.ts` and other `pool.query` call sites.

---

### 7. DB rules

**Plain answer:** **Meal ranking and store search** are read-only in production, even if someone sets a “please write” flag by mistake. That is **not** true of every `/api` route.

- `YUM4LESS_ENABLE_API_DB_WRITES` is **ignored** when `NODE_ENV=production`. It does **not** sync live prices from HTTP (`.env.example` still says that in places — comment drift).
- Intended **price** writers: ingest/cron scripts.
- `POST /api/feedback` and `POST /api/analytics/events` **can insert rows** when those features are on. Anyone who can open the site can POST (rate-limited, length-capped, no login).
- Public JSON strips internal snapshot/provider IDs. Catalog store ids such as `kroger-mechanicsville` are **kept on purpose** (that is how Settings picks a store).
- Postgres itself has **no** row-level security and **no** separate app role — the app logs in as superuser `postgres`. Shopper read-only is an **app rule**, not a database user.
- Local Postgres MCP is read-only. Dev DB this session has the `customer_feedback` table (0 rows locally).

**Recommendation:** Keep ranking APIs read-only. Treat feedback/analytics as their own abuse surface. A later hardening step is a non-superuser DB role — not required for “do shoppers write prices?” (they don’t).

**Where:** `src/lib/public-api-db-write-policy.ts`, `src/lib/public-api-response-sanitizer.ts`, `db/init/`.

---

### 8. Rate limiting

**Plain answer:** Yes. Each public API has a per-minute cap so one person (or bot) cannot hammer the box.

Examples: recommendations 20/min, market search 30/min, feedback 10/min. Limits live **in memory on one process** — a restart clears them, and two app copies would not share the same counter.

IP detection only trusts `X-Forwarded-For` when you set `TRUST_PROXY_HEADERS=1` **and** confirm the proxy (`YUM4LESS_TRUSTED_PROXY_VERIFIED=1`). The live Tunnel runbook already sets both.

**Recommendation:** Fine for household beta. If you ever run many app replicas, move limits to Cloudflare or Redis.

**Where:** `src/lib/rate-limit.ts`, `docs/homelab-deploy.md` §12.

---

### 9. CSRF protection

**Plain answer:** CSRF is the trick of “another website submits a form as you.” That mainly matters when the browser automatically sends a **login cookie**.

Yum4Less has **no user accounts and no session cookies** for shoppers. APIs are same-origin JSON `fetch`. Risk is low today.

**Recommendation:** See Q25. No CSRF tokens required for current beta.

---

### 10. CORS settings

**Plain answer:** There is no “any website may call our API” header in the app. Shopper calls go to the **same site** (`/api/...`). Other sites should not be able to read results in a browser.

**Recommendation:** Do not add `Access-Control-Allow-Origin: *`. If a future mobile app needs a separate domain, allow only that origin.

**Where:** No CORS config found under `src/` or `next.config.ts`.

---

### 11. Is HTTPS enabled?

**Plain answer:** **Yes for the public site.** Shoppers hit `https://yum4less.com/` via Cloudflare Tunnel. The homelab box still speaks HTTP on the LAN (`192.168.1.246:3000`); Cloudflare wraps that in HTTPS on the way in.

This session: `curl` to `https://yum4less.com/` returned `200` with `Server: cloudflare`.

**Doc drift:** `docs/homelab-deploy.md` §9.3 still says put Caddy/nginx/Traefik + TLS in front and that layer “has not been set up yet.” §12 says Tunnel HTTPS is **live**. Trust §12 + the live curl; the §9.3 sentence is stale.

**Recommendation:** Keep Tunnel as the only WAN door. Do not publish Postgres to the internet (already loopback-only on Compose). Soften production ZIP errors so they do not name `GEOCODIO_API_KEY`.

**Where:** `docs/homelab-deploy.md` §12.

---

### 12. Security headers

**Plain answer:** Several “don’t trick the browser” headers are already on. A couple stronger ones are still missing.

**Already on (code + live site):**

- `X-Frame-Options: DENY` (don’t put us in someone else’s iframe)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera/mic off; geolocation only for this site

**Missing on live `yum4less.com` this session:**

- **Content-Security-Policy (CSP)** — extra lock on which scripts can run
- **Strict-Transport-Security (HSTS)** — see Q24
- Live responses still send `x-powered-by: Next.js` (small “what stack is this?” leak)

**Recommendation:** Add HSTS at Cloudflare first (easy, correct place because TLS ends there). Add a careful CSP later (maps/Leaflet/images need allowlisting). Optional: turn off `X-Powered-By` in Next config.

**Where:** `next.config.ts` `headers()`. Next.js docs support HSTS/CSP via the same `headers()` API.

---

### 13. Is debug mode disabled?

**Plain answer:** **Yes in production.** Debug routes return 404 whenever `NODE_ENV=production`. Compose also forces `YUM4LESS_DEBUG_ROUTES_ENABLED=0`. Internal “project details” UI is off unless a separate public flag is set for local work.

**Recommendation:** Never turn debug on for the Tunnel-facing app. If you debug on LAN, keep the admin key set and don’t expose that process to the WAN.

**Where:** `src/lib/debug/debug-routes-policy.ts`, `docker-compose.yml`.

---

### 14. Are prod settings secure?

**Plain answer:** The intended production posture is conservative: no public DB writes, no debug routes, HTTPS at the edge, rate limits, sanitized API JSON, fixture vs live ingest kept separate.

Caveats (honest):

- In-memory rate limits (Q8)
- Admin is a shared key, not SSO (Q3)
- No CSP/HSTS yet (Q12, Q24)
- Default Compose DB password is for local/dev; rotate for any wider exposure
- Homelab still has open ops (3am cron confirm, backup drill) — that is ops honesty, not a shopper security hole by itself

**Recommendation:** Treat current public HTTPS as **beta household**, not “we passed a pentest.” The next high-value knobs are HSTS, `robots.txt` disallow `/owner`, and a short ToS.

**Where:** `docker-compose.yml`, `.env.example`, `src/lib/public-api-db-write-policy.ts`.

---

## Shopper UX and pages

### 15. Horizontal scroll

**Plain answer:** Some **sideways swipe** is on purpose (nearby store cards). That is a carousel, not a broken page.

The layout uses a max width and `min-width: 0` so columns can shrink on phones. There is no global “never scroll sideways” lock on the whole page.

**Recommendation:** No change required unless you see the **whole page** sliding sideways on a real phone. Then we fix that component, not the intentional card strip.

**Where:** `src/app/globals.css` (`.nearby-stores-list { overflow-x: auto }`), `.page-shell`.

---

### 16. Are there broken links?

**Plain answer:** Internal links we found all go to real pages: Home `/`, Feedback `/feedback`, Owner `/owner`. No empty `#` links. Live `/feedback` is `200`.

There are **no** Terms/FAQ/sitemap links, so those cannot be “broken” — they simply do not exist yet.

**Recommendation:** When you add a short estimate disclaimer or privacy note, put it in this Home footer (and Settings). A dedicated FAQ route is **not** recommended for v1 (see Q28). Keep `/owner` out of the footer.

**Where:** `src/components/meal-planner/index.tsx`, Settings + trust heads-up also link to `/feedback`. Settings uses a plain `<a href="/feedback">` instead of Next `Link` (works; consistency only).

---

### 17. Meta descriptions

**Plain answer:** Yes, a simple one: title **Yum4Less**, description **“Budget-aware dinner planning built around local store pricing.”** Owner page has its own title and `noindex`.

There is no extra Open Graph / Twitter card setup (the preview Facebook/iMessage would show is basic).

**Recommendation:** Good enough for beta. Later you can write a slightly clearer description that still uses allowed words (`estimated`, not “save money” / “cheapest”).

**Where:** `src/app/layout.tsx`.

---

### 18. Footer links

**Plain answer:** The Home tab footer is one link: **Send feedback or report a wrong price** → `/feedback`. That is intentional and small.

**Recommendation:** If you add a one-paragraph estimate/privacy note, put it here. Keep `/owner` out of the footer. Do not add a FAQ link for v1.

**Where:** `src/components/meal-planner/index.tsx` (Home-only footer).

---

### 19. Can we create custom 404 pages?

**Plain answer:** **Yes, easily.** Next.js App Router supports `src/app/not-found.tsx`. Today that file **does not exist**, so a bad URL (this session: `/this-page-does-not-exist-yum4less`) is a generic Next 404 (`404` status). You already have a friendly **crash** page (`src/app/error.tsx` — “Something went wrong” + Try again).

**Recommendation:** Worth a small custom 404 (“This page isn’t part of Yum4Less” + link home + link feedback). Low effort, nicer for a public domain.

---

### 20. Are there broken buttons?

**Plain answer:** Most buttons do something, or they are **disabled on purpose** (setup not done, Cook waits for ranked meals, Saved is “coming soon”). Two spots can **feel** broken on a phone:

1. **Ingredients → Pick manually → Continue** can sit behind the fixed “Do you want to see store locations?” bar. Content padding accounts for the bottom nav, not that extra bar.
2. **Feedback** is always linked from Home/Settings. If writes are off, Send is disabled with a message — easy to think the button is dead.
3. **Factory reset** has no confirm (one tap wipes Settings). GPS/ZIP buttons **hide** after a successful find — easy to think ZIP search vanished.

This session could **not** click the live site in Playwright MCP (browser not installed).

**Recommendation:** If you implement later: extra bottom padding when the map-link bar is showing; optional confirm on Factory reset. No empty `onClick` handlers found.

**Where:** `src/components/meal-planner/bottom-nav.tsx`, `ingredients-step-panel.tsx`, `.map-link-bar` in `globals.css`, `e2e/mobile-smoke.spec.ts`.

---

### 21. Success messages and error messages

**Plain answer:** **Yes, on purpose.**

- Feedback: success (“Thanks — your feedback was saved anonymously”) and errors (disabled, network, validation).
- Meal search: shopper notices plus results (both can show at once).
- Settings: field errors (invalid ZIP, etc.).
- APIs: friendly JSON errors; stack traces stay in server logs, not the JSON.
- Whole-page crash: `error.tsx` with Try again.
- Rate limit: UI can show a rate-limited state.

**Confusing leftover:** any market-search **400** is mapped to copy about a five-digit ZIP and 1–25 mile radius (`mapMarketSearchApiError`). A radius problem can read like a ZIP problem. Settings/Deals show that body only.

**Recommendation:** Keep panel-local errors (no toast library). Later: split ZIP vs radius 400 copy; add e2e for `/feedback` submit.

**Where:** `src/components/feedback/feedback-form.tsx`, `src/lib/recommendation-error-copy.ts`, `src/lib/public-api-error.ts`, `src/app/error.tsx`, `e2e/api-errors.spec.ts`, `e2e/error-surfaces.spec.ts`.

---

### 22. Mobile overflow

**Plain answer:** The shell is built for a phone: bottom nav, extra padding so content isn’t hidden behind it, and a dedicated mobile Playwright smoke test (Settings + nav visible).

**Gaps found after the first pass:**

- `.app-shell-content` pads **5.5rem** for the nav. The map-link bar sits **above** the nav and is **not** included in that pad (see Q20).
- Bottom nav uses `env(safe-area-inset-bottom)`, but `layout.tsx` does **not** set `viewportFit: "cover"`. On iPhone Safari the inset is often `0`, so tabs can sit under the home indicator.
- First-visit disabled-tab **hints** can make the bar taller than the pad, covering Factory reset / the Settings feedback link.

**Recommendation:** If you implement later: `viewportFit: "cover"` plus extra padding when the map bar is showing. A live iPhone pass is the proof, not the Pixel 5 smoke test.

**Where:** `src/app/globals.css` `.bottom-nav`, `.map-link-bar`, `.app-shell-content`, `e2e/mobile-smoke.spec.ts`.

---

### 23. Is it optimized for mobile use?

**Plain answer:** **Yes as a mobile website shell**, not as a downloadable App Store app — and the **critical phone path is still thinly tested**.

Locked product: five tabs (Home, Deals, Cook, Saved, Settings), geolocation first / ZIP fallback. `e2e/mobile-smoke.spec.ts` only checks Settings heading + three nav labels on Pixel 5. It does not run search → rank → Cook.

**Recommendation:** Stay on responsive web for beta. Do not call it “fully optimized” until a phone walkthrough covers Ingredients Continue, iPhone home indicator, and rank. A PWA is optional later.

**Where:** Redesign / `bottom-nav.tsx`; `e2e/mobile-smoke.spec.ts`.

---

## “Should we add…?” product questions

### 24. Should we add HSTS?

**Plain answer:** **Yes, now that HTTPS is public.** HSTS tells browsers “only use HTTPS for this domain for a long time,” which blocks SSL-stripping on coffee-shop Wi‑Fi.

Live `yum4less.com` headers this session **did not** include `Strict-Transport-Security`. TLS is at **Cloudflare**, so the cleanest place is Cloudflare’s **Always Use HTTPS + HSTS** toggle (start with a modest max-age, then consider preload only if you are sure every subdomain is HTTPS).

You *can* also set it in `next.config.ts`, but Cloudflare is the better first stop because that is where HTTPS actually terminates.

**Recommendation:** Enable HSTS at Cloudflare. Skip `preload` until you are sure `www` and any future hostnames are HTTPS-only.

---

### 25. Do we need CSRF tokens?

**Plain answer:** **Not for today’s design.** No cookie session, no classic HTML form-to-another-site login.

Add CSRF (or at least check `Origin`/`Referer` on POST) **if** you later add:

- logged-in users with cookies, or
- cookie-based owner sessions instead of a pasted admin key.

**Recommendation:** Leave as-is. Document the trigger so a future auth slice doesn’t forget it.

---

### 26. Do we have or need a sitemap.xml?

**Plain answer:** **We do not have one.** Live `/sitemap.xml` is 404. Next.js can add `src/app/sitemap.ts` in a few lines.

**Need?** **Not for v1.** The product is not a recipe blog (anti-goal M133). A sitemap would tell Google to index pages we are not trying to rank. Skip unless SEO is explicitly unlocked in the Decision log.

**Recommendation:** Prefer a **restrictive** `robots.txt` (Q29) over a sitemap. If you ever want indexing, list only `/` (and maybe `/feedback`) and omit `/owner`.

---

### 27. Should we have a ToS page?

**Plain answer:** **A full legal Terms of Service is not required for no-login beta.** A **short footer disclaimer** is the v1-shaped slice: beta, estimated totals, verify in store, not a price-guarantee shopping service.

Locked docs use “ToS” mainly for **provider/API legal review** (scraping, Kroger, Geocodio), not a shopper contract. No accounts and no checkout (M133).

**Recommendation:** If `yum4less.com` stays public, add a one-paragraph estimate/privacy note in the existing Home footer — not a new clickwrap or a lawyer-length ToS. Revisit a real ToS **if/when accounts exist**.

This is **not** coded in this pass.

**Update 2026-08-21:** A short `/terms` page shipped (not a lawyer contract). See Decision log.

---

### 28. Should we have a FAQ page?

**Plain answer:** **Do not add a FAQ route in v1.** Help already lives next to the controls (trust banner, HelpHints, hero copy). A 2026-06-26 Decision log row is **Active**: recover trust copy in the expandable heads-up — **no new modal, Settings “About these estimates,” or route.**

**Recommendation:** If the same questions keep hitting `/feedback`, tighten the inline hints — don’t start a marketing FAQ that will drift from card wording.

**Update 2026-08-21:** Owner reversed this. `/faq` and `/terms` shipped; `?` links to FAQ articles. See Decision log.

---

### 29. Do we need a robots.txt?

**Plain answer:** **Yes, a small one — different from scrape robots.txt.**

Two different “robots” ideas in this project:

1. **Website `robots.txt` (this question):** tells Google what to index. **Missing in the app** today (live URL 404). You should add `src/app/robots.ts`: allow `/`, disallow `/owner` and `/api/`.
2. **Scrape compliance robots.txt (ingest):** checking Aldi/Kroger/Food Lion robots before weekly-ad scrape is **not shipped**. Operators pause chains by hand. That is a later homelab item, not a shopper SEO file.

Cloudflare may attach extra “content signal” comments at the edge; that is **not** a substitute for an app-owned robots file that hides `/owner`.

**Recommendation:** Add a real `robots.ts` that disallows `/owner`. Do not confuse it with M128 scrape automation.

---

### 30. Feedback page vs user-review page

**Plain answer:** You already have the right **kind** of page for beta. I would **not** turn it into a public Yelp-style review wall.

**What it is today**

- `/feedback`: anonymous “wrong price / bug / idea” form.
- No ZIP, no GPS, no receipts, no contact info by design.
- Public recent-feedback **feed was removed** (2026-08-04) on purpose.
- Owner reads rows in `/owner` with the admin key.
- Live flag can enable writes (`YUM4LESS_FEEDBACK_ENABLED`).

**Why a public “user reviews” page is a poor fit right now**

- v1 has **no accounts** — anyone can spam fake 5-star meals.
- Product anti-goal: Yum4Less is **not** a social network.
- Trust rules forbid “best deal / guaranteed / save money” claims; public reviews would pressure you toward those vibes.
- You already decided shoppers should not see other people’s raw notes.

**How to steer it toward “user review” without becoming a review site**

Keep it **private to you**, but change the tone:

- Headline more like **“How did this work for you?”** not only “report a wrong price.”
- Add issue types such as **Helpful estimate** / **Not useful** / **I cooked this** (still anonymous, still length-capped).
- Optional 1–5 “was this useful?” that **only you** see in `/owner`.
- Keep the wrong-price path — that is gold for ingest quality.

That gives you reviews **as operator signal**, not as a public testimonials board.

**UX leftover:** the footer always links here. If `YUM4LESS_FEEDBACK_ENABLED` is off, Send is disabled with “temporarily unavailable.” Empty “General” feedback can still succeed with almost no text. Wrong-price without chain/product fails only after submit. **No e2e visits `/feedback`.** Ignore `scripts/.feedback-page.html` — it still shows the public feed that was removed 2026-08-04.

**Recommendation:** Keep `/feedback`. Do not publish a review feed. Copy/types tweak is a later small slice (not this pass). Optional: client-side check for wrong-price fields before POST.

**Where:** `src/app/feedback/page.tsx`, `docs/feedback-path.md`, `src/lib/feedback/feedback-policy.ts`.

---

## Suggested order if you implement later

Do **not** treat this as a commitment to code now.

1. **Cloudflare HSTS** (Q24) + optional hide `X-Powered-By`
2. **`robots.ts`** disallow `/owner` and `/api/` (Q29) — crawl hygiene, not SEO
3. **Phone overlap:** padding when the map-link bar is showing; iPhone `viewportFit: "cover"` (Q20, Q22)
4. **Custom `not-found.tsx`** (Q19)
5. **Footer one-paragraph** estimate/privacy disclaimer (Q27) — not a new FAQ page
6. Feedback copy / extra “was this useful?” types, still private (Q30)
7. CSP after a careful allowlist for maps (Q12)

Skip for v1: sitemap, FAQ route, CSRF tokens, public review wall.

---

## What this session ran — and did not run

| Did | Did not |
|---|---|
| Read env, Next headers, API/DB policies, feedback/owner, CSS/nav, e2e names, homelab HTTPS runbook, prior Tier 1/2 audits | Change any product code |
| GitHub code search for committed secrets | Full git-history secret sweep |
| Live `curl` of `yum4less.com` headers, `/feedback`, `/robots.txt`, `/sitemap.xml`, a 404 URL | Playwright MCP walkthrough (Chrome-for-testing missing) |
| Postgres MCP: public tables; `customer_feedback` exists | Semgrep MCP completed scan (timed out); `npm test` (no code change) |
| Context7: Next.js headers / sitemap / not-found | Claim CI green or pentest-passed |
| Follow-up from specialist agents (security, frontend, backend, DB, ingest, QA, product/trust, CI) | Live Cloudflare dashboard HSTS toggle; live iPhone tap of Ingredients Continue |

This write-up is grounded in repo files, the live header check, and those agent reports. It is still **not** production-ready or demo-complete.
