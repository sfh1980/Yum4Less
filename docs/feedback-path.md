# Customer feedback path

Yum4Less keeps **first-party analytics** separate from customer feedback. Analytics events are coarse, allowlisted, and must never carry raw ZIP codes, exact coordinates, prices, meal titles, store IDs, provider IDs, IPs, or user agents.

## Channels

| Channel | Purpose | Status |
| --- | --- | --- |
| In-app feedback form (`/feedback`) | Bug reports, wrong-price reports, general product feedback | Implemented (disabled by default; enable with `YUM4LESS_FEEDBACK_ENABLED=1`) |
| Admin list API (`GET /api/feedback`) | Owner reads recent rows with `YUM4LESS_FEEDBACK_ADMIN_KEY` | Implemented |
| Owner console (`/owner`) | Key-gated UI for recent feedback + Postgres analytics events | Implemented (same admin key; not linked from shopper nav; `noindex`) |
| Public recent-feedback feed on `/feedback` | — | **Removed** from shopper UI (2026-08-04) |
| Analytics transparency panel on `/feedback` | — | **Removed** from shopper UI (2026-08-04); ops detail stays in this doc / env |
| Email or support inbox | Complaints and account-free MVP contact | Planned (owner choice) |
| Analytics (`POST /api/analytics/events`) | Product usage signals only | Implemented, off by default (client flag is **build-time** `NEXT_PUBLIC_…`) |
| Analytics list API (`GET /api/analytics/events`) | Owner reads recent Postgres rows with the feedback admin key | Implemented |

## Wrong-price and store-item reports

The feedback form collects only what is needed to investigate:

- Chain label (user typed, length-capped — chain name only, e.g. Kroger)
- Ingredient or product description (user typed, length-capped)
- Coarse issue type: `wrong_price`, `missing_item`, `stale_ad`, `bug`, `general`, or `other`
- Optional free-text note (length-capped, no PII prompts)

Do **not** store full shopping carts, checkout receipts, geolocation, ZIP codes, meal titles, or internal store IDs in the feedback payload.

## Environment

```env
# Enable anonymous Postgres-backed feedback (POST /api/feedback)
# YUM4LESS_FEEDBACK_ENABLED=1
# YUM4LESS_FEEDBACK_ADMIN_KEY=<secret for GET /api/feedback, GET /api/analytics/events, and /owner unlock>
```

Apply `db/init/007_customer_feedback.sql` before enabling feedback in deployed environments.

### Owner console

Open **`/owner`** (for example `https://yum4less.com/owner`). Paste `YUM4LESS_FEEDBACK_ADMIN_KEY` into the unlock field. The key is stored in **sessionStorage for that tab only** and sent as `Authorization: Bearer …` to:

- `GET /api/feedback?limit=50&offset=0` (then `offset=50`, `100`, … via **Show next 50**)
- `GET /api/analytics/events?limit=50&offset=0` (same load-more pattern)

Analytics are shown **grouped by session** (all loaded events for each `session_id`). Responses include `hasMore` so the console can offer the next page without dumping the full table at once.

Curl still works:

```bash
curl -sS "https://yum4less.com/api/feedback?limit=50&offset=0" -H "X-Yum4Less-Admin-Key: <secret>"
curl -sS "https://yum4less.com/api/analytics/events?limit=50&offset=0" -H "X-Yum4Less-Admin-Key: <secret>"
```

Analytics list reads **Postgres** only (`YUM4LESS_ANALYTICS_SINK=postgres`). Other sinks return an empty list with a notice.

Analytics remain separate and require both client and server flags:

```env
# NEXT_PUBLIC_YUM4LESS_ANALYTICS=1   # must be set at Docker *build* time for the client bundle
# YUM4LESS_ENABLE_ANALYTICS=1
# YUM4LESS_ANALYTICS_SINK=postgres   # optional; production default is stdout
```
