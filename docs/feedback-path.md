# Customer feedback path (planned)

Yum4Less keeps **first-party analytics** separate from customer feedback. Analytics events are coarse, allowlisted, and must never carry raw ZIP codes, exact coordinates, prices, meal titles, store IDs, provider IDs, IPs, or user agents.

## Planned channels

| Channel | Purpose | Status |
| --- | --- | --- |
| In-app feedback form | Bug reports, wrong-price reports, general product feedback | Planned |
| Email or support inbox | Complaints and account-free MVP contact | Planned (owner choice) |
| Analytics (`/api/analytics/events`) | Product usage signals only | Implemented, off by default |

## Wrong-price reports (planned fields)

When implemented, collect only what is needed to investigate:

- Chain label (not internal store ID)
- Ingredient or product description (user typed, length-capped)
- Optional coarse issue type: `wrong_price`, `missing_item`, `stale_ad`, `other`
- Optional free-text note (length-capped, no PII prompts)

Do **not** store full shopping carts, checkout receipts, or geolocation in the feedback payload.

## Environment placeholders (future)

```env
# YUM4LESS_FEEDBACK_ENABLED=1
# YUM4LESS_FEEDBACK_SINK=memory
# YUM4LESS_FEEDBACK_EMAIL_TO=owner@example.com
```

Wire these only after an owner-approved sink (email, form backend, or ticketing) is chosen.
