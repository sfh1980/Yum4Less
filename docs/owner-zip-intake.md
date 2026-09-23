# Owner ZIP intake checklist

Private operator steps for adding a grocery ZIP from `/owner` **Markets**. Shoppers never see this page. Activate still only **books the ZIP** for the next night job — it does not download every store in that click.

Companion: [`feedback-path.md`](feedback-path.md) (console unlock and APIs). Commands: [`README.md`](../README.md) ingest section.

## Before you start

- Live debug overlay `YUM4LESS_INGEST_ZIPS` should be **off** so cron reads `active_markets`.
- ZIP is five digits, in the lower 48, and findable on the map.
- Laptop Postgres and yum4less.com are **different databases**. Rehearse locally first.

## 1. Check ZIP

Type the ZIP and click **Check ZIP**. Read two lists:

- **Tonight’s ZIP job** — buildings inside this ZIP’s Census shape (what weekly-ad ingest will try).
- **Shopper circle, other ZIPs** — dinner-chain buildings within about 8 miles that sit **outside** this shape. They stay on the shopper map. They do **not** get this ZIP’s flyer until **their** ZIP is Activated too.

Also read the **chain tools** line: official store list, flyer, or none — for adapters we already wrote. Unknown names stay **Needs you**. Do not auto-install a new chain from a web search.

Fas Mart / Dash-In and similar convenience names should be omitted here and in shopper Settings (same hide list).

If there is **no** Kroger-family / Aldi / Publix / Food Lion / Walmart pin in this first look, you may still Activate. Expect a **map**, not dinner estimates. Dollar General alone does not count as that supermarket first look.

## 2. Pins and twins

- Trust the chain’s own coordinates over a public-map pin when both exist.
- Search-only extra pins are display-only. They must not join the identity graph.
- Same building counted twice: map/Settings may hide one pin. **Slice D** (nightly matcher + Markets **Link obvious twins**) saves a lasting OSM↔official link when they are the same chain and about a parking lot apart. Auto-confirm stays **off**. Shopper identity expand stays **off** until 23111 and 23220 look right. Do **not** delete Mechanicsville test store names. Do **not** delete a public-map pin by hand if it is the only pin you have.

## 3. Activate

Saves the ZIP for tonight’s job. Does **not** turn the Check list into the official catalog. CLI backup: `npm run markets:activate -- 23220`.

The Markets map under **Active and paused markets** (Markets tab, not Coverage) shades Census ZIP outlines only (active, paused, and Check ZIP preview). The picture is clipped and height-capped (`overflow: hidden`; `max-height: min(32vh, 240px)`) so a statewide outline cannot paint past the card. It does **not** shade the 8-mile shopper circle. Neighbor-ZIP buildings can still appear for shoppers until those ZIPs are Activated.

## 4. After the night job

Order: find buildings → weekly ads → SNAP → official prices → recipes from sale overlap → freshness check.

Prove it like a shopper (ZIP or GPS, radius, pick stores). Extra ZIPs are often **map first** (example: 23220 can show many Settings pins and still zero dinner cards). That is not a broken Check ZIP.

Glance at **Coverage** (search by ZIP) and **Ingredient review** (Clear obvious preview: food / junk / unsure). Do not SQL-delete junk. Unsure junk is a classifier gap.

Do not say we added more dinners because Check ZIP or Slice D looks cleaner.

## Not this checklist

No **Run intake now** button. No one-click neighbor ZIP Activate. Night job stays ZIP-shape, not the shopper circle.
