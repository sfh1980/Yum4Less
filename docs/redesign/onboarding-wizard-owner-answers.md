# Onboarding wizard — owner answers

**Status:** unanswered — fill this file before any product UI rewrite.  
**Date opened:** 2026-08-20  
**Screenshots:** [`e2e/fixtures/onboarding-wizard-screenshots/`](../../e2e/fixtures/onboarding-wizard-screenshots/)  
**Live code to repurpose (not replace blindly):** Settings panel, ZIP pin overlay, geolocation search, 5-tab shell, Welcome → ingredients → pantry → rank.

How to fill: under each question, write **Want** (what the control should do) and **Leads to** (next screen, tab, or overlay). Short answers are enough. Leave `n/a` if that beat should not exist.

This file is the source of truth for drafting the rest of the app in the new look. The static mockup HTML will not stay as a shopper surface.

---

## How to use this

1. Answer in place (keep the question text).
2. If two options are listed, pick one or write a third.
3. When you are done, say so in chat. Implementation should start only after this is filled — old UI commits remain on `master` (`389db47` / `origin/master`) for fallback.

**Code we already have (reuse targets):**

| Live piece | Role today |
|---|---|
| `settings-panel.tsx` | One form: ZIP, radius, shopping style, stores, theme, GPS + ZIP Find, save |
| `zip-search-center-picker-overlay.tsx` | After ZIP Find: Leaflet map, pin, confirm |
| `onBrowserSearch` / geolocation | GPS path; deny can fall back to ZIP |
| `app-tab.ts` + `bottom-nav.tsx` | 5 tabs; Settings-first until `setupComplete` |
| `welcome-panel.tsx` | Budget + dietary, then ingredients |
| `/feedback` | Separate page, not a tab |

---

## A. Shell (every screenshot)

The mockup chrome is: phone card, moon/sun in the top-right, six bottom tabs, Settings colored as active.

### Q1 — Phone shell vs full-width app

Live app is a wide page with a bottom nav, not a 280px device frame.

- **Want:**
- **Leads to:** (shopper always sees a phone column / full width below a breakpoint / something else)

i want sizing to be automatic for mobile screens but still not look horrible on a desktop monitor. the purpose of this app is still to migrate to a full fledged mobile app.

### Q2 — Tab set

Mockup tabs: Home, Deals, Cook, Saved, **Feedback**, Settings.  
Live tabs: Home, Deals, Cook, Saved, Settings. Feedback is `/feedback`.

- **Want:** (keep 5 tabs / add Feedback as a 6th tab / keep Feedback as a link only)
- **Leads to:** (what each extra or missing tab opens)

i want the feedback link at the bottom of the current UI to now exist as the button. based on how the buttons on the bottom nav currently work, i'd like mock ups of the screens those buttons could do based on the new mockup images.

### Q3 — Tabs during first-run

Live: other tabs are **disabled** until Settings is saved (`Finish setup to unlock this`). Mockup shows all six labels, muted, with Settings highlighted. They are not clickable in the mockup.

- **Want:** (disabled like today / visible but inert / hidden until setup is done)
- **Leads to:** (tap on a locked tab does what?)

instead of them being disabled. perhaps until all needed configurations are complete, just open to pages that give messasges that "XYZ steps need to be complete for this page to operate"

### Q4 — Theme control

Mockup: moon/sun on every screen (light ↔ dark only).  
Live: Theme **select** in Settings (`system` / `light` / `dark`).

- **Want:** (chrome toggle / keep Settings select / both / drop system)
- **Leads to:** (applies immediately? saved in prefs?)

in the new UI, use the mock light theme, repurpose that code to the now button kept in the upper right

### Q5 — Progress dots

Choose screen = middle dot. GPS/ZIP = last dot. Welcome splash has **no** dots. Step 1 is never shown as active.

- **Want:** (3-step setup / more steps / no dots)
- **Leads to:** (what is step 1, 2, 3, …?)

if youre referencing the dots at the bottom just above the navbar, i think it better to remove them. or add more dots based on how many steps are needed for configuration before actually using the actual app

---

## B. Screenshot 01 — Welcome / splash

![01 welcome](../../e2e/fixtures/onboarding-wizard-screenshots/01-welcome.png)

Copy: “Yum4Less” / “Find realistic low-cost dinner options near you.” / “Loading your setup…”  
Mockup: auto-advances after 1.8s. No button.

Live: no splash. First visit is the Settings **form**. After save, Home shows **Welcome** (budget + dietary) — a different screen with the same word.

i like the 1.8 second auto advance to the first step. lets make it 2 seconds. but i think we need to rethink steps and how many decisions are needed per step. 

### Q6 — Does this splash exist in the real app?

- **Want:**
- **Leads to:** (Choose location / live Settings form / skip if prefs already exist)

the choose location screen from the mockup image, keep it. on mobile devices, use that devices GPS. on desktops, if they choose GPS, interact with the browser to ask "know your location". you might want to ask more questions to get a more specific with the steps. 

### Q7 — Returning visitor with setup already saved

- **Want:** (never see splash / brief splash then Home / splash then last tab)
- **Leads to:**

show brief splash then on to main tab to begin using the app, unless they have cleared browser cache, then back all the to step 1 to configure again

### Q8 — Keep live Welcome (budget + dietary) at all?

That panel is `welcome-panel.tsx`, after Settings, before ingredients.

- **Want:** (keep as its own screen / fold into Home / fold into this splash / drop)
- **Leads to:**

budget and dietary both need their own screens. budget first. much like how previous screens looked. remembering still showing theme button and navbar at the bottom.

---

## C. Screenshot 02 — Choose GPS vs ZIP

![02 choose](../../e2e/fixtures/onboarding-wizard-screenshots/02-choose-location.png)

Copy: “Let’s get started” / “How should we center your area?”  
Buttons: **Use GPS** · **Enter ZIP code**  
Helper: GPS = precise, one tap. ZIP = works without location access, wider area.

Live: both actions sit on **one Settings form**, labels **For Better Results, Use My GPS Location** and **Find stores based on my ZIP**. ZIP Find currently opens the pin overlay **after** a typed ZIP.

repurpose the code for gps and ZIP. but for ZIP, also repurpose the code that pops the leaflet map up and asks to narrow down the search by placing a pin. then on the next screen choose a radius with message that settings can be changed in the settings tab below. 

### Q9 — Is this the first real decision after launch?

- **Want:**
- **Leads to:** (GPS screen / ZIP screen / still collect radius first / something else)

radius is collected after location is set, whether user chooses gps, or zip from map pin

### Q10 — Tap **Use GPS**

- **Want:** (request browser geolocation immediately / show the mockup success screen first / show a permission explainer first)
- **Leads to:** (screenshot 03 / live store list / error)

if user chooses GPS, move to radius selection. if user chooses ZIP, then leaflet map shows up. i need your help deciding the best place that the browser popup to access geolocation shows for user. to me, i think this is the best place. then the user places a pin on the map and progresses to radius selection screen.

### Q11 — GPS denied or unavailable

Copy implies ZIP still works. Live code can fall back to ZIP.

- **Want:**
- **Leads to:**

this is correct. if need be, fallback to ZIP. give message to user gps isnt working and proceed to configure using ZIP and pin on map.

### Q12 — Tap **Enter ZIP code**

Button says type a ZIP. Next mockup screen is **only** a pin map (no ZIP field).

- **Want:** (type ZIP first, then pin / pin only / type ZIP only, no pin / keep today’s overlay after typed ZIP)
- **Leads to:** (screenshot 04 / a ZIP field screen we have not drawn / live overlay)

type zip, then click the button to proceed. which proceeds to the leaflet map where user needs to set a PIN

### Q13 — When does `/api/market-search` run?

Today: GPS or ZIP Find (ZIP path waits for pin confirm). Not on splash.

- **Want:**
- **Leads to:** (finding-stores wait screen / store picker / stay on this screen)

i believe that runs automatically from truenas and the app pulls data from that task

---

## D. Screenshot 03 — GPS centered

![03 gps](../../e2e/fixtures/onboarding-wizard-screenshots/03-gps-centered.png)

Copy: “Centered on your location” / “Your radius will be based on your device's coordinates.”  
Controls: Back only. No Continue. No radius slider.

Live: GPS search runs, then the **same Settings form** fills with stores; shopper still sets radius, style, store(s), then **Save settings and continue**. Exact coordinates are **not** stored in long-term prefs.

the pin can start centered on their location, but user can also change the pins location, then click Set Location

### Q14 — Is this a pause screen or does GPS jump ahead?

- **Want:** (show this confirm / skip it and go to stores / skip it and go to radius)
- **Leads to:**

show radius selection screen, then click proceed, then show store location screen

### Q15 — What does **Back** do?

- **Want:**
- **Leads to:** (screenshot 02 / cancel geolocation / stay)

Back leads only to the previous screen, whether that be configuration set up if user is in that part, or actual app use, whatever the previous screen was

### Q16 — Missing Continue — what commits GPS and moves on?

- **Want:** (auto-continue after N seconds / a Continue button / next is radius / next is stores)
- **Leads to:**

a proceed, or continue or arrow button will allow user to progress to next screens. for all screens

**Update 2026-08-25:** Shopping style and Dietary focus have no Continue. Tapping a choice advances immediately (same pattern as Use GPS / Enter ZIP). Radius, ZIP, pin, stores, and budget still use Continue.

### Q17 — Radius on the GPS path

Mentioned in copy, not drawn.

- **Want:** (default radius, no UI / own wizard screen / keep numeric field from live Settings)
- **Leads to:**

start with the default 5 mile radius and allow user to change as desired

---

## E. Screenshots 04–05 — ZIP place pin

![04 default pin](../../e2e/fixtures/onboarding-wizard-screenshots/04-zip-place-pin.png)

![05 pin moved](../../e2e/fixtures/onboarding-wizard-screenshots/05-zip-pin-moved.png)

Copy: “Place your pin” / “Tap the map to manually center your radius on that spot.”  
Mockup map is a grid, not Leaflet. Tap moves pin + circle. Back only. No confirm.

Live overlay: real map, “Choose a spot…”, then **Use this as your search center?** / **Yes, find stores** / **Pick again**. Cancel notice if dismissed.

use leaflets code to and instruction to place the pin

### Q18 — Is this the live ZIP pin overlay, restyled?

- **Want:** (reuse `ZipSearchCenterPickerOverlay` / new full-screen step / mockup-style fake map is enough)
- **Leads to:**
i think so, yes, use this

### Q19 — Must the shopper type a 5-digit ZIP before this map?

Continental US ZIP is still how ingest/geocode work today.

- **Want:**
- **Leads to:**

the UI is different, but the workflow of the ZIP operation should essentially be the same, choose ZIP, enter a ZIP place a pin on the map. proceed to the radius screen per new UI instruction and workflow

### Q20 — Tap on the map (04 → 05)

- **Want:** (move pin only / move pin and immediately search / move pin then ask confirm like today)
- **Leads to:**
using leaflet, user can zoom in, zoom out, move the map to place the pin where they need

### Q21 — How does the ZIP path **confirm** and leave this screen?

Mockup has no Yes / Continue.

- **Want:**
- **Leads to:** (radius / stores / save / Home)

with some king of proceed button, i talked about it above. something simple, maybe an arrow

### Q22 — ZIP **Back**

- **Want:**
- **Leads to:** (screenshot 02 / ZIP text field / cancel search)

back button bas been talked about above, unless i didnt understand the question

---

## F. Screenshot 06 — Dark theme on ZIP

![06 dark](../../e2e/fixtures/onboarding-wizard-screenshots/06-zip-dark.png)

Same ZIP step, D7 dark tokens, sun icon.

### Q23 — Dark mode mid-flow

- **Want:** (allowed anytime / only after setup / only in Settings)
- **Leads to:** (same screen, new colors — confirm)

dark/light theme can be changed at any time as many times as user wants. it should not affect workflow, only the theme

---

## G. Beats the mockup never drew (needed to finish setup today)

Live setup is not complete until: location **and** radius **and** shopping style **and** at least one store **and** `setupComplete`. Then Welcome (budget/dietary) → ingredients → pantry → rank. Cook stays locked until recipes exist.

using the style/theme/language/example... whatever vocabulary you need to understand ... from above, design the rest of the screens similarly to what we have so far. each screen should generally only have one purpose. but you can ask questions later to help further understand.

### Q24 — After location is centered, what is the **next** screen?

- **Want:**
- **Leads to:**

radius is next, this was mentioned above

### Q25 — Shopping style (one store vs several)

Live: dropdown on Settings.

- **Want:** (two big buttons like GPS/ZIP / keep dropdown / skip, default one style)
- **Leads to:**

old UI was a drop down, suggest ways to make the new UI match what we have done in previous screens while using the current codebase

### Q26 — Store picker

Live: `<select>` or checkboxes after market search.

- **Want:** (cards / keep select / map pins to pick stores)
- **Leads to:**

i think checkboxes will be OK

### Q27 — What flips `setupComplete` and unlocks Home/Deals/Saved?

- **Want:** (Save button / auto after store pick / auto after GPS/ZIP only)
- **Leads to:** (Welcome budget / Home ingredients / screenshot 02 never again)

an arrow button with a message of some kind stating "now we can begin looking for dinner options"

### Q28 — Factory reset

Live: button on Settings, back to first visit.

- **Want:** (keep on Settings / hide / elsewhere)
- **Leads to:**

keep in settings

---

## H. Rest of the app (same look, live workflows)

These are not in the six screenshots. Answer so the rest of the app can be drafted in the same UI language.

i want the updated UI to look like the updated UI in all screens. 

### Q29 — Home after setup

Live Home: ingredients (sales list) → pantry → suggest recipes.

- **Want:**
- **Leads to:** (Cook / results on Home / keep pantry step)

same as today, just restyled. we can readjust as needed

### Q30 — Deals

- **Want:**
- **Leads to:**
same as today, just restyled. we can readjust as needed

### Q31 — Cook

Live: disabled until ranked recipes exist.

- **Want:** (keep that gate / allow empty Cook / other)
- **Leads to:**
same as today, just restyled. we can readjust as needed

### Q32 — Saved

Live: tab exists; persistence of saved meals is still limited.

- **Want:**
- **Leads to:**
same as today, just restyled. we can readjust as needed

### Q33 — Feedback

- **Want:** (tab / keep `/feedback` / link on Settings only)
- **Leads to:**
same as today, just restyled. we can readjust as needed

### Q34 — Trust / estimate wording

Live: estimated, directional, limited coverage, verify in store — on results, not only in Settings.

- **Want:** (keep on cards / one short line in chrome / both)
- **Leads to:** (n/a if unchanged)

### Q35 — Settings **after** first-run

Live: full form again (ZIP, radius, stores, theme, reset).

- **Want:** (same wizard screens as first-run / compact form / chrome-only theme + a Change location button)
- **Leads to:**

---

## I. Scope check (yes/no)

Write **yes**, **no**, or a one-line exception.

| # | Statement | Answer |
|---|---|---|
| S1 | Keep GPS-primary, ZIP-fallback, continental US. | yes |
| S2 | Keep public APIs read-only; no shopper accounts. | yes |
| S3 | Keep ranked chains as they are (Kroger family, Aldi, Publix, Food Lion when gates pass). | yes |
| S4 | Do not claim cheapest / save money / live prices on search. | correct |
| S5 | Repurpose existing Settings/geolocation/ZIP-pin/rank code; restyle and split into steps rather than new backend. | yes |
| S6 | Mockup HTML and `test mockup/` are throwaway once the real UI exists. | correct |
| S7 | Work on a branch; `master` old UI stays the fallback. | yes |

---

## J. Anything else

Free notes (copy you care about, screens we must not skip, order you want that is not above):

```
(your notes)
```

---

**When this file is filled:** tell the agent to read it and implement against these answers, reusing the live modules in the table at the top. Do not treat unanswered questions as product locks.
