# Page Grade v2.4 — KILLED 2026-08-16

**Do not use this file.** Matt 2026-08-16: the whole process is fucked.
Get rid of it. The skill is a refuse stub. This document is evidence of
the failure that flattened the shop (photography, maps, and listing
facts deleted so a caption rule could pass). It is not a loop. It is
not a ship gate. Do not grade. Do not regrade. Do not fix-to-a-rubric.

---

# Page Grade v2.4 — fossil (do not execute)

Everything below this line is the retired rubric. Do not score. Do not
regrade. Do not fix-to-a-rubric. Kept so the next agent can see what
broke the shop.

The loop that reran this rubric is dead. Ledger
`docs/plans/PUBLIC_PRODUCT/grade-ledger.json` is a fossil. Do not grade every unique public page plus one live exemplar per template.
Do not score every city, every master-plan, every plat, or every listing.
Do not treat this file as a second OS.

This file was diagnosis. A score was not a redesign license. The
page-grade skill is a refuse stub. It does not look, score, or write
product code.

**What the dead process claimed to grade toward:** every path is known from the first screen
to the finish. A stranger understands what is going on from the layout, not
from copy. The full housing record is findable. The screen is quiet. The
same page beats every named competitor on the job — measured, not asserted.
If the current control is cluttered, the punch list names a simpler one —
it does not add a sentence.

Simple is not empty. Complete is not a dump. Quiet is not unexplained.
Best is not a claim.

---

## Why v1 passed a miss

The Aug 13 public roll met the old bar and still failed the product.

| v1 measured | What agents did | What shipped |
|---|---|---|
| Visitor objective is *stated* | Recited `page-inventory.json` | Homepage objective is browse homes. First screen is a city-count grid. |
| One primary CTA | Counted a navy button in the DOM | Chrome is "Value my home" on buyer pages. At 390 that button is often the only filled control, and it is the wrong job. |
| Opening pattern exists | Mounted `V3Instrument` | PUBLIC_UI lock: Homes open on **Field**. Homepage comment now says Instrument then Field. The lock lost. |
| Looks GREEN | First-screenful photograph exists | Photos are postage stamps under a number. Addresses truncate. |
| Tokens / voice / DAL / ratchet | Gates green | About still shipped "boutique". Search says "in this map view" with no map. |
| Craft floor 8 | PUBLIC_UI scored itself 8.7 | Self-score is void. |

v1 optimized for *compliance with our own system*. The miss is *the system
became the product*. The visitor came for houses, a place, a price, or a
person. They got a navy serif H1, a gray eyebrow, a hairline, and a number.

v2 caught that. v2.1 catches the opposite miss: stripping the page to a
hero number (or a pretty Field) while the rest of the record we already
paid to compute — solds, history, MoS, schools, payment, pulse, narrative —
is buried, unlabeled, or only in JSON-LD.

v2.4 catches the next miss: four place grains scored as one "Places" opening,
and a listing graded in isolation so a foreign house page can pass. Same shop.
Five rhythms: city, neighborhood, master-plan, subdivision, listing.
Master-plan is not a neighborhood. Tetherow is an exemplar, not a product.

---

## The unit of truth

A page is a **job**, not a section stack.

1. Read the locked `visitor_objective` and `exits` in
   `docs/plans/PUBLIC_PRODUCT/page-inventory.json` (public) or the destination
   job in `docs/plans/ADMIN_PRODUCT/ia-lock.md` (admin).
2. Name **the thing** the visitor came to see or do. One noun.
   Homes → houses. City → this city's houses. Neighborhood → this
   neighborhood's houses + daily life. Master-plan → this community's
   houses + what belonging here is. Subdivision → this plat's homes.
   Market → the number and the chart. Sell → the address field.
   Listing → this house. About → these people. Today → the next action.
3. Write the **shelf** for this destination (section below). Those are the
   facts we already have. The page must expose them. It must not open with
   all of them.
4. Grade the **rendered first screen at 390**, then 1280. Code review is
   supporting evidence. A comment that claims "first viewport is homes" is
   not evidence. The PNG is.

If you cannot name the thing in one noun, the page has no job. Fail it.

---

## Known path — start to finish, from the screen alone

Before you score, write the journey in five lines. Each line ≤ 5 words.
Every word must be readable from the rendered page (label, control, or
the thing). If you have to invent a word the screen does not give, that
step is unknown. Unknown fails.

```text
START: why I am here
NOW:   where I am
NEXT:  the one tap
FINISH: the job done
BACK:  return without reset
```

Then list **every door** on the page. Each door needs a name the visitor
would say and a destination that matches. A door you cannot name is
clutter. A destination you cannot predict is a mystery path.

| Destination | START | NOW | NEXT | FINISH | BACK |
|---|---|---|---|---|---|
| Homes | see homes | houses on a map | open a house | I know it / I saved this | same filters |
| City | does this city fit | this city's houses | a house or a child grain | I decided / alert on | still this city |
| Neighborhood | does this area fit | these houses + daily life | a house or a plat | I decided / alert on | still this neighborhood |
| Master-plan | does belonging here fit | these houses + membership | a house or a plat | I decided / alert on | still this community |
| Subdivision | does this plat fit | these few homes | a house or the parent | I decided / alert on | still this plat |
| Market | what is the market | the number + chart | the place or the houses | I understand / I subscribe | same geo |
| Listing | this house | this house | tour or payment or place | I act | same search |
| Sell | what is mine worth | the address field | get the number | request is in | the spine, not a fork |
| About | who is this | these people | call / write | I reached them | — |
| Saved | what changed | my homes + searches | open one | I am current | same account |
| Today | what do I do | the next action | do it | it is done | the rest of the queue |

Mystery states that fail this section: a button whose result is not
obvious, a filter that does not say what it did, a success that does not
say what happens next, a breadcrumb that is the only orientation and is
illegible, two primaries so NEXT is a guess.

---

## Quiet — minimal copy, no clutter, a better control

The design explains. Copy confirms. If a sentence is doing the design's
job, cut the sentence and fix the control.

**Copy budget (first screen, 390):** count words that are not a place
name, an address, a price, a count, a date, or a button label. Budget is
**12**. A line you can delete without changing what the visitor can do
is already over. A sentence that explains the line above it is an
auto-fail (voice canon: state the fact, then stop).

**Clutter count (first screen):** count competing foci. Chrome
(wordmark + menu) is one. Cookie is one. Each distinct block (eyebrow,
H1, count grid, extra CTA, house peek, second list) is one. **Budget is
4** including chrome. Homepage Aug 13 was ~8 (chrome, seller CTA,
eyebrow, H1, count grid, body CTA, house strip, often cookie).

**Better solution (required on every punch):** do not add helper text,
a tooltip, a second CTA, or an intro paragraph. Name the quieter
control that replaces the defect.

| Defect | Forbidden punch | Better |
|---|---|---|
| Visitor might not know 495 is Bend | Add "listings in each city" | Towns are filters on the Field. The houses are the page. |
| Seller CTA missing on a buyer page | Repeat Value my home | Buyer primary is the house or Save this search. Seller lives in Sell. |
| Map view with no map | Add the word List | One Field: map and list are the same set. |
| FAQ is 33 links | Split into more FAQ | Named ledgers: nearby, solds, market. Eight doors, not thirty. |
| Address field not obvious | Add "enter your address below" | The field is the first screen. Label is the job. |
| Broker does not know the next task | Add a page title | The first row is the task. |

If you cannot name a better control, you do not have a punch yet.

---

## Beat — every page vs the competitor matrix

"We are the best" is a measured claim (Matt 2026-06-10). A page that does
not run this matrix cannot score Beat, cannot say GREEN, and cannot ship.

**Battery (frozen).** Do not swap names mid-review.

| Seat | Who | Why they sit |
|---|---|---|
| Local to beat | Cascade Hasson — cascadehasson.com | Matt 2026-04-25. The local brokerage bar. |
| Local 2 | Stellar Realty NW — stellarrealtynw.com | Frozen with the battery. |
| Local 3 | Duren Realty — durenrealty.com | Frozen with the battery. |
| Portal | Zillow equivalent surface | Buyer default. Houses-first, map+list. |
| Portal 2 | Redfin equivalent surface | Map discipline, solds, hot homes. |
| Craft bar | Compass — compass.com | Execution quality. Steal nothing. Beat the job. |
| Market only | Beacon Report — beaconappraisers.com monthly PDF | The regional market newspaper. We must beat it by a lot on live + depth + a normal person can read it. |

**Equivalent URL, not homepage.** Same job, same geo, same house when it
is a listing. `/cities/bend` vs Zillow Bend, not vs zillow.com. A listing
vs that address on Zillow and Redfin. Market vs Beacon's latest PDF *and*
the local brokerage market page if they have one. About vs their team page.

**Required rows.** Score each WIN / TIE / TRAIL / ABSENT. ABSENT on their
side and present on ours is WIN. ABSENT on ours and present on theirs is
TRAIL. Invented rows are theater.

| Row | What you compare | We win when |
|---|---|---|
| Thing first | First-screen occupancy of the thing | Our thing is larger and clearer at 390 |
| Known path | START/NOW/NEXT/FINISH/BACK from their screen | Ours is writable in ≤ 5 words; theirs needs copy or a guess |
| Live record | Freshness + the shelf facts this destination requires | Ours is live MLS / cache-stamped; theirs is monthly, IDX-thin, or missing solds / history / schools / payment |
| Quiet | Copy budget + foci | Ours is quieter and still complete |
| Honesty | Numbers, doors, units | Ours traces; theirs rounds into a story or 404s a door |
| Speed | LCP / feel of the thing | Ours puts the thing on screen faster. Write the measured ms or `?`. Do not invent. |
| Continuity | Place / search survives the next tap | Ours keeps Bend. Theirs resets. |
| Must-win | Destination lock below | We do not trail this row against anyone in the battery |

**Must-win by destination**

| Destination | Must-win |
|---|---|
| Homes | Map and list are one set. Houses fill the fold. Filters do not need a horizontal rail. |
| City | This city's houses fill the fold. Verdict is a caption. Child grains are doors, not the first screen. |
| Neighborhood | These houses + daily life (schools, parks). Not membership. |
| Master-plan | These houses + what belonging here is (amenity, membership, STR). Not a neighborhood. |
| Subdivision | This plat's homes as a list (or a real map). Parent is the back door. |
| Market | Live pulse + history a visitor can configure + meaning in plain words. Beats Beacon on freshness and readability. Beats locals on depth. |
| Listing | This house's media first. Payment, history, this geo's market, who listed it. Same address vs Zillow/Redfin. Same shop as the place pages. |
| Sell | Address field is the first screen. One 3% plan. No listing agreement, said once. |
| About | Faces first. Names are doors. A way to reach them without a form wall. |
| Saved | What changed, not a dashboard title. |
| Today | The next action. Beats Follow Up Boss at "what do I do right now." |

**How to run**

1. Fetch the equivalent URL for every seat that applies (Market includes
   Beacon; Today includes the broker's old FUB habit, not a public URL).
2. 390 PNG of theirs next to ours. Same crop: first screen.
3. Fill the row matrix. Every cell is WIN / TIE / TRAIL / ABSENT plus
   five words of evidence.
4. One honest sentence: where we lead, where we still trail.
5. If we trail any required row against any seat, Beat ≤ 5 and auto-fail
   18. The punch is the quieter control that takes the row, not "look
   more like Zillow."

Copying a competitor's chrome, card grid, or navy-on-cream clone is a
Distinctiveness fail and a Beat fail. We beat the job. We do not wear
their site.

A matrix without the other PNGs is theater. An asserted "we are the best"
with no cells is theater. Both auto-fail 17.

---

## Two layers — how simple and complete live together

| Layer | What lives here | Fail if |
|---|---|---|
| **0 — first screen** | The thing. One primary. Enough data to start (price on a house, verdict on a market). | The shelf is dumped here. Or the thing is a peek under a count grid. |
| **1 — same page, labeled** | The rest of this node's record, in visitor words, in a scannable order. Each block is one question. | A shelf fact is on the page but untitled, in a 30-link Quiet, or only in JSON-LD. |
| **2 — one labeled tap** | Sibling destinations with context kept: this place → its homes, this house → its market, this market → its places. | The visitor has to re-pick Bend. The door name does not match the page it opens. |

A fact we have that is not in layer 0, 1, or 2 is **hidden**. Hidden is a
fail. A first screen that tries to be the whole shelf is a **dump**. Dump
is a fail.

Sources for "we have it": `docs/DATABASE_FOR_AI_AGENTS.md` §0, the DAL
function this page already calls, `market_pulse_live`, `market_stats_cache`,
`sale_pricing_facts`, `activity_events`, `listing_boundary_xref_mv`. If the
read returned a row, the visitor gets a door. If the read is broken, that
is a punch-list item, not a reason to hide the fact.

---

## Knowledge shelf — required facts per destination

Score Reach against this list. Do not invent facts. Do not skip a row
because the current page omitted it. Absent-on-purpose needs a one-line
reason (no data this refresh, legal, or not this grain). "We migrated to
v3" is not a reason.

### Homes (`/`, `/homes-for-sale`, open houses, price drops, videos)

The job: show me the homes, live, filterable, on a map.

| Fact | Visitor words | Layer |
|---|---|---|
| The houses | photo, price, address, beds / baths / sqft | 0 |
| Map bound to the list | pins and rows are the same set | 0 or 1 |
| Filters | place, price, beds, status — one control set, not a chip wall | 0 |
| Modes | open houses, price drops, sold, video — filters of this browse, not sibling sites | 1 |
| Count + freshness | how many in *this* view, when updated | 1 |
| Place + market exits | this house's city / community / market, context kept | 2 |
| Save / alert | watch this search | 1 |
| Payment | on the listing, not a `/tools` exile | 2 |

### Place grains — same shop, four rhythms

The job at every grain: decide whether this place fits. The first screen
must name the grain. Shared facts below, then the extra that makes the
grain itself. Zip uses the city opening.

**Shared (every place grain)**

| Fact | Visitor words | Layer |
|---|---|---|
| Houses here | same population the headline names | 0–1 |
| Live pace | active, median list, months of supply + verdict, days to pending | 1 (caption on a city Field; Instrument on neighborhood / master-plan fallback) |
| Sold record | median sale, DOM, sale-to-list, $/sqft, YoY — from `market_stats_cache`, period named | 1 |
| History | years of closes, door to the explorer at that year | 1 |
| Alert for this place | email for new listings | 1 |
| Stamp | updated when, which MLS population | 1 |

**City extra.** Child neighborhoods and master-plans are labeled doors
below the fold. The fold is the city's houses, not a count grid.

**Neighborhood extra.** Daily life (schools, parks) on the first path.
Ladder is parent city + child plats. Not amenities or membership.

**Master-plan extra.** What belonging here is: amenity, membership, STR
reality. Child plats are doors. Parent city is a door. Not a neighborhood
with a nicer name. Exemplar is one community (Tetherow stands in for the
fourteen). Do not grade every master-plan URL.

**Subdivision extra.** This plat's homes as a Ledger (Field only if the
pins are a real map). Parent community or city is the back door. Schools
on the first path.

### Market (`/housing-market` and leaves)

The job: what do we know — present, past, and what it means.

| Fact | Visitor words | Layer |
|---|---|---|
| Verdict + live figures | median list, actives, MoS, days to pending | 0 |
| Past | price history, years the visitor can pick | 0–1 |
| Meaning | governed narrative, or a labeled hole if `market_narratives` is written and unread | 1 |
| Reports + words | weekly report, FAQ, blog as doors to the same knowledge | 1 |
| Geo drill | this number → the place → the houses | 2 |
| Subscribe | after the answer, never before | 1 |

### Listing (one house)

The job: know this house well enough to act.

| Fact | Visitor words | Layer |
|---|---|---|
| This house | photos / video, price, beds, baths, sqft, status, DOM | 0 |
| Money | payment, tax, HOA, concessions on a close | 1 |
| History | price changes, status changes | 1 |
| The place | city / neighborhood / community / zip, all doors | 1 |
| The market around it | this geo's pulse, not a generic region HUD | 1 |
| Features + remarks | what the MLS said, readable | 1 |
| Schools | when we have them | 1 |
| Attribution | who listed it, ODS | 1 |
| Similar / sold comps | doors, not a dead rail | 1 |
| Tour / ask | one | 0–1 |

### Sell

The job: decide whether and how to sell, and get the real number.

| Fact | Visitor words | Layer |
|---|---|---|
| Address field | the spine, visible at 390 | 0 |
| What it costs | one 3% plan | 1 |
| Proof | comps / market behind the number | 1 |
| Process | written CMA in 24 hours, no listing agreement | 1 |

### About

The job: who are these people, and how do I reach them.

| Fact | Visitor words | Layer |
|---|---|---|
| The people | faces, names as doors to `/team/[slug]` | 0 |
| The record | verified sales as doors | 1 |
| Reach them | call, text, form — one completion | 1 |
| Service area | Central Oregon, as place doors | 1 |

### Saved

The job: pick up where I left off, and what changed.

| Fact | Visitor words | Layer |
|---|---|---|
| Saved homes + searches | the list, not a dashboard title | 0 |
| What changed | new / dropped / pending since last visit | 0–1 |
| Alerts | pause, edit, frequency in visitor words | 1 |

### Admin Today / Messages / People / Prospecting

The job: what do I do right now / reply / this human / the weekly pass.

| Fact | Broker words | Layer |
|---|---|---|
| Next action | the queue, no page-title chrome | 0 |
| The human | name is a door, full history one tap | 1 |
| The artifact | draft / sent / CMA / packet is a door | 1 |
| The number | one definition, from the reporting SoR | 1 |

---

## Scorecard — 12 axes, 1–10

Ship floor is **8 on every axis**. Any auto-fail sets the page to **FAIL**
regardless of the average. Do not average a FAIL into a 7.

| Axis | Question | 8 means | 3 means |
|---|---|---|---|
| **1. Job occupancy** | Does the thing fill the first screen? | ≥50% of the 390×844 content area below chrome is the thing. | A count, H1, or eyebrow occupies the fold. |
| **2. Path** | Is the whole journey known from the screen? | START/NOW/NEXT/FINISH/BACK each ≤ 5 words from visible labels. One next tap. Hunt ≤ 2 taps. | NEXT is a guess. Two primaries. A step needs invented copy. |
| **3. Opening** | First section matches the locked grain opening? | Matches PUBLIC_UI.md §3 for this grain. City → Field. Neighborhood → Instrument then Field. Master-plan → Stage then Field. Subdivision → Ledger. Listing → Stage. | City opens on a giant 495. Listing opens on a leftover gallery. |
| **4. Distinctiveness** | Same shop, this grain? | Stranger names Ryan Realty *and* the grain. | City and Tetherow wear one DNA. Listing is another product. |
| **5. Craft** | Would Matt send this URL? | House photos large enough to judge. Addresses wrap. | Stamps, ellipsis, cookie on the first card. |
| **6. Motion** | Does something the visitor caused move? | Filter count-up, pin↔row, compute reveal. | Still. Spec exists, route does not run it. |
| **7. Performance** | Is the thing on screen fast? | LCP is the thing. CLS ≤ 0.05. Cookie does not steal LCP. | LCP is Amboqia. Cookie is 15% of 390. |
| **8. Honesty** | Is every number, door, and sentence true? | §0 trace. Door opens the population it names. | 36 vs 33. Map view, no map. Banned word. |
| **9. Reach** | Is every shelf fact in layer 0, 1, or 2? | Each required row is visible or one labeled tap. Absent rows have a reason. | Sold, history, schools, payment, or narrative exist in the DAL and have no door. |
| **10. Simplicity** | Would a stranger find those facts without learning our IA? | Visitor words. One question per block. Context follows. | 33 links under "questions." Re-pick Bend on every hop. |
| **11. Quiet** | Is the screen obvious with almost no prose? | Copy budget ≤ 12. Clutter ≤ 4 foci. Design explains; copy confirms. | Eyebrow + H1 + counts + two CTAs + cookie. A sentence explains the UI. |
| **12. Beat** | Do we win every required row vs the battery? | WIN or TIE+ on every row, every seat. Must-win is WIN. PNGs attached. | No matrix. Trail Zillow on thing-first. Trail Beacon on history. Clone their layout. |

Admin Path / Opening still include the ADMIN_UI bar (no page-title chrome,
no chip walls, entity and artifact names are doors, channel-aware Blocked,
identical-state walls are a STOP).

---

## Auto-fails — any one fails the page

Measure on the rendered 390 PNG and in the DOM. Computed style, not "the
header has a CTA."

### Public

1. **Wrong-job chrome.** Visible filled control in the first viewport is not
   this page's job. "Value my home" as the only filled button on `/`,
   `/homes-for-sale`, `/search`, `/cities/*`, or a listing is a fail. Chrome
   CTA counts only where it is visible.
2. **Number-as-hero on a browse page.** Largest first-screen element on Homes
   or a listing index is an inventory integer or a city-count grid.
3. **Opening-rule break.** First mounted v3 section disagrees with
   PUBLIC_UI.md §3. A file comment that rewrites the lock is a defect.
4. **Unreadable house.** Listing photo in the first screen shorter than 160px
   on 390, address truncates with `…`, or a widget covers the price.
5. **Sibling clone.** First-screen DNA matches another *destination*
   (homes vs market vs sell vs about). Place grains use auto-fail 27.
6. **Lie.** Sentence, door, or figure contradicts the page it opens.
7. **Voice / token / §0.** Banned word, em dash, raw hex, invented stat,
   empty faked as zero.
8. **Horizontal rail.** Filter chips or cards require sideways scroll at 390.
9. **Looks theater.** PNG + GREEN, no axis scores, no hunt test.
10. **Hidden record.** A shelf fact this node has (DAL returned a row, or
    cache has a figure) is not in layer 0–2. JSON-LD only does not count.
11. **Dump.** First screen tries to show the whole shelf, or a Quiet / FAQ
    holds more than ~8 mixed questions-and-links with no names.
12. **System words.** Visitor-facing copy uses our pattern names (Instrument,
    Field, Ledger, v3, pulse as a product name) or an internal slug.
13. **Broken continuity.** Place or search context resets on the next node
    (Tumalo → Homes is not prefiltered; listing → place is a different city).
14. **Unknown path.** You cannot write START/NOW/NEXT/FINISH/BACK from the
    screen alone, or two filled controls compete for NEXT, or a control's
    result is not obvious until after the tap.
15. **Explaining copy.** A visitor-facing sentence exists to explain the UI
    or the sentence above it. Includes "enter your address below", "use the
    filters to narrow", "see homes for sale" under a grid of homes.
16. **Clutter.** First screen has more than 4 foci, or two lists of the
    same thing, or a punch that adds copy instead of a better control.
17. **Beat theater.** No equivalent-URL PNGs, no filled matrix, or "we are
    the best" with empty cells.
18. **Trail.** Any required row is TRAIL against any seat in the battery,
    or the must-win row is not WIN.
26. **Not one shop.** Family strip of first screens (home, search, city,
    neighborhood, master-plan, plat, listing, sell, market, about) does
    not read as one site. Chrome, type, tokens, or card language broke.
    Conductor scores this at merge. A single grader cannot pass it.
27. **Wrong grain.** First-screen rhythm matches a different place grain.
    City wearing master-plan clothes, neighborhood wearing city clothes,
    master-plan wearing neighborhood clothes, plat wearing city clothes,
    listing wearing browse clothes. Master-plan is not a neighborhood.

### Admin

19. Page-title chrome on a non-entity page.
20. Chip wall / `av2-chiprow`.
21. Dead text naming a person, property, deal, or artifact.
22. "Blocked" when any channel is still open.
23. Wall of identical states shipped without a source-table probe.
24. First screen does not answer "what do I do right now?" on Today,
    Messages, or Prospecting.
25. A number the broker needs lives in a second report namespace with a
    second definition.

---

## Tests every page must run

Stop and FAIL at the first auto-fail. Then finish the rest so the punch
list is complete.

### A. Before you open the browser

- [ ] One-noun thing.
- [ ] Locked visitor_objective / destination job.
- [ ] One primary exit.
- [ ] Locked opening pattern.
- [ ] Shelf copied from this file for this destination. Tick each row
      *have / hide / none* from the DAL, not from the page.
- [ ] Signed-in vs signed-out if the page changes.
- [ ] Write START / NOW / NEXT / FINISH / BACK in ≤ 5 words each, from
      the screen you have not yet opened. After the PNG, rewrite from
      the screen. Any line that changed is unknown.

### B. First screen (390, then 1280)

- [ ] Screenshot before dismissing cookies. Coverage is part of the grade.
- [ ] Screenshot after dismiss.
- [ ] **5-second test:** URL hidden. They must say the job. "A real estate
      site" or "a dashboard" fails Path.
- [ ] **Occupancy:** % of pixels below chrome that are the thing. Below 50%
      on browse / listing / Today fails.
- [ ] **Visible primary:** every filled button in the first viewport, with
      computed visibility. One. It matches the job.
- [ ] **House scale** when the thing is houses: tallest photo ≥ 160px at
      390, ≥ 240px at 1280. Address wraps, never `…`.
- [ ] **Grain crop:** next to the other four place grains. If you cannot
      name this grain, fail Distinctiveness and auto-fail 27.
- [ ] **Family strip (conductor):** all first screens in one row. If it is
      not one shop, auto-fail 26 on every route in the strip.
- [ ] **Copy budget:** words on the first screen that are not data, a place
      name, an address, or a button label. Over 12 fails Quiet.
- [ ] **Clutter count:** competing foci, chrome = 1, cookie = 1. Over 4
      fails Quiet.
- [ ] **Path aloud:** say NEXT and FINISH pointing at the screen. If you
      need a new sentence, fail Path.

### C. Hunt test — Reach + Simplicity (required)

Pick **three** shelf facts that are not the thing. For each, from the first
screen, find it.

- [ ] Taps to the fact (0 = on first screen, 1 = scroll to a labeled block,
      2 = one door). Three or more fails Reach.
- [ ] Time. If you hesitate because the label is ours, not the visitor's,
      fail Simplicity.
- [ ] The door's words match the page it opens. A year row that clamps to
      another year fails Honesty and Reach.

Default hunts if you cannot pick:

| Destination | Hunt 1 | Hunt 2 | Hunt 3 |
|---|---|---|---|
| Homes | the map | solds / price drops | this city's market |
| City | months of supply | a child neighborhood or master-plan | last year's median sale |
| Neighborhood | months of supply | a school or park | last year's median sale |
| Master-plan | what belonging here is | a child plat | last year's median sale |
| Subdivision | the parent community or city | schools | last year's median sale |
| Market | the chart for two years | Bend's houses | what the numbers mean |
| Listing | monthly payment | this community | price history |
| Sell | the 3% plan | the address field at 390 | |
| About | Matt's phone | a review | a sold as a door |
| Today | the next text | the person behind it | the artifact |

### D. Do the job

- [ ] Complete the visitor_objective in one pass. Count taps to the exit.
- [ ] Follow every inventory exit. Wrong population is Honesty + Reach.
- [ ] Empty / loading / error: honest, still an exit. No fake zeros.
- [ ] Keyboard to the primary. Focus visible.
- [ ] Reduced motion: still complete.
- [ ] Continuity: one hop that should keep place or search. It does.

### E. Machine and speed

- [ ] Title, H1, and first sentence agree with the data.
- [ ] Every figure: source line + stamp, or it does not render.
- [ ] JSON-LD equals the visible number (same rounding).
- [ ] Lighthouse vs `lighthouserc.cjs` when the route is in it. LCP is
      the thing.
- [ ] No console errors. No overflow at 320 / 390 / 414 / 768.

### F. Admin extras

- [ ] Nav names the page. No duplicate H1.
- [ ] Filters are one control.
- [ ] Same-state walls probed at the source table.

### G. Beat matrix (required)

- [ ] Equivalent URL for every seat that applies. Listing = same address.
- [ ] 390 first-screen PNG of each, next to ours.
- [ ] Eight required rows filled WIN / TIE / TRAIL / ABSENT + five words.
- [ ] Must-win row is WIN against every seat.
- [ ] One honest lead / trail sentence.
- [ ] Lighthouse or feel: measured ms or `?`. No invented scores.
- [ ] Punch for every TRAIL names the quieter control, not their chrome.

### H. The send test (required, last)

Would you text this URL to a buyer, a seller, or a referring broker as
proof Ryan Realty is the one to use?

- Yes → Job occupancy, Craft, Reach, Simplicity, Path, Quiet, and Beat
  are at least 8, or you are lying.
- "Correct but I would not send it" → FAIL. That is the miss.
- No → FAIL. Write the one change that would make it sendable.

---

## How to report

One page, one card. No GREEN. No 8.7 self-score.

```text
ROUTE: /cities/bend
THING: Bend houses
PATH: START does Bend fit · NOW 495 · NEXT ? · FINISH ? · BACK still Bend?
COPY: 18 words · CLUTTER: 7 foci — FAIL 15/16
OPENING (locked / actual): Instrument then Field / giant 495 then stamp grid
390 OCCUPANCY: ~25% houses — FAIL auto-fail 2
VISIBLE PRIMARY: Value my home — FAIL auto-fail 1
SHELF: houses hide-as-stamps · pulse partial · solds ? · history ? · ladder ? · schools ? · OH ? · alert ?
HUNT: MoS = ? taps · last-year median = ? · schools = ?
BEAT: Cascade ? · Stellar ? · Duren ? · Zillow TRAIL thing-first · Redfin ? · Compass ?
MUST-WIN (houses + map): TRAIL
AXES: Job 3 · Path 3 · Opening 3 · Distinct 3 · Craft 4 · Motion 2 · Perf ? · Honesty 6 · Reach 4 · Simple 4 · Quiet 2 · Beat 2
SEND: no
PUNCH:
  P0 — first screen is the 495 → Field of Bend houses, 495 is a caption
  P0 — seller chrome on a buyer page → primary is a house or Save Bend
  P0 — trail Zillow on thing-first → houses fill the fold, towns are map filters
  P1 — solds / history / schools hidden → named ledgers, not a Quiet dump
  P2 — same DNA as / → this crop is Bend's houses, not a master-plan
  P0 — family strip not one shop → same chrome/type/cards; listing is this shop
EVIDENCE: looks/.../city-390-prod.png · competitor 390s · page.tsx:N · hunt notes
```

Severity:

- **P0** — cannot do the job, wrong or missing data, compliance, any auto-fail
- **P1** — ship floor miss on Job, Path, Opening, Honesty, Reach, Simplicity, Quiet, Beat, or Perf
- **P2** — Craft / Distinctiveness / Motion below 8
- **P3** — only an agent notices

Unknown is allowed. Write `?` and the check you did not run. Do not invent
a Lighthouse score. Do not mark Reach 8 because the DAL was called. Do not
mark Simplicity 8 because the page uses v3.

---

## What this rubric is not

- A license to invent a seventh v3 pattern on a page. If the job needs a
  control the barrel lacks, the punch list says "add the primitive."
- A license to restore KB / v2 / explore registers.
- A license to strip the shelf to make the first screen pretty.
- A license to dump the shelf into the first screen to look complete.
- A license to add copy, a tooltip, or a second CTA. The punch names a
  quieter control.
- A substitute for Matt locks. Visual lock still stands. This grades
  whether a migration onto that lock served the job *and* the record.
- A license to copy a competitor. We beat the job. Their chrome stays
  theirs. A matrix without PNGs is theater.
- A license to make four place grains one page. City, neighborhood,
  master-plan, and subdivision share a shop, not an opening.
- A license to treat Tetherow as a one-off product. It is the master-plan
  exemplar.

---

## Worked example — `/` on 2026-08-13 (prod 390)

THING: Central Oregon houses.
PATH: START see homes · NOW city counts · NEXT guess · FINISH unknown · BACK unknown.
COPY: over 12 · CLUTTER: ~8 foci.
LOCKED OPENING: Field.
ACTUAL: Instrument (H1 + six city counts) then a Field peek.

| Axis | Score | Why |
|---|---|---|
| Job occupancy | 3 | Type + a 2×3 count grid. Houses are a cropped strip. |
| Path | 3 | START is clear. NOW is a count grid. NEXT is a guess (See homes vs a stamp vs Value my home). FINISH and BACK are not on the screen. |
| Quiet | 2 | Copy over budget. ~8 foci. "See homes for sale" explains a grid that is already homes. |
| Opening | 2 | Lock says Field. Comment rewrote it. |
| Distinctiveness | 3 | Same DNA as `/cities/bend` and `/housing-market`. |
| Craft | 4 | Stamps, truncated addresses, Next "N" on a price. |
| Motion | 2 | Still. |
| Performance | ? | Not re-run. Cookie is a first-screen tax on sibling routes. |
| Honesty | 6 | Counts look live. Page *claims* first viewport is homes. PNG says no. |
| Reach | 4 | Towns are integers, not places with houses. No map. No solds. No market door in the first path. Modes are other URLs. |
| Simplicity | 4 | Visitor has to decode that 495 means "go to Bend." The thing is below the decoder. |
| Beat | 2 | Matrix not run in the Aug 13 look. Against Zillow Bend, thing-first is a TRAIL on sight: they show houses, we show counts. Must-win (map + houses) is TRAIL. Auto-fail 17 and 18 until the PNGs exist and the Field wins. |

HUNT (from the first screen): map = not there · solds = not there · Bend's
market = not a labeled door. Three misses.

SEND: no.
VERDICT: FAIL (auto-fails 1, 2, 3, 4, 5, 10, 14, 15, 16, 17, 18).
Better: one Field of houses. Towns are map filters. One buyer primary.
That is also how we take thing-first from Zillow without wearing Zillow.
This is the miss. A v1 agent marked GREEN because photographs exist.
A v2 agent would fail occupancy and still miss that the record is gone.
v2.1 fails the hidden shelf. v2.2 fails the unknown path and the clutter.
v2.3 fails an unmeasured "we are the best."
v2.4 fails a city and a master-plan that wear the same first screen, and a
listing that is not the same shop.
v2.4 fails a city and a master-plan that wear the same first screen, and a
listing that is not the same shop.
