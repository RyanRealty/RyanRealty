# Current — 2026-09-06 (CMA home, price, competition)

Seller CMA spine: Home location (subject pin only), How we got the price
(one matrix with thumbs, then close-to-list math), then who they compete
with. Photos, Why $X, marker key, and "as your house" are gone. US-97
frontage sales do not price an inland subject. 2465 rebuilt: rec $389k.
Do not send.

---

# Previous — 2026-09-06 (Wave B: search chrome)

Homes Field: Google tiles stay, Google Draw/Map-dropdown/zoom are off.
MapChrome (Map/Satellite + zoom) + one Map/Split/List in the shell. Guest
Save this search is a chip that opens email, not an email field in the 375
dock. `view=list` stays on the Field. LOOP_SENTINEL stays off. Do not mix `_cma-*`.

Next: Wave C hub tiles-before-chart.

---

# Previous — 2026-09-06 (CMA one comps story)

Seller CMA spine is Home location, then How we got the price (one
matrix with thumbs + map), then who they compete with. Why $X, Photos,
and the second comps table are gone. "As your house" is Adjusted close.
2465 rebuilt. Rec $401k. Hayden Ranch pins still plot; TIGER US-97 says
same side. Do not send.

---

# Previous — 2026-09-06 (Wave A: LP 301s)

Place and sell LPs 308 to the inventory winners. `/lp/tetherow` → community,
`/lp/bend` → `/cities/bend`, seller LPs → `/sell`, buyer alerts → Homes Field,
luxury → Bend search `$1.5M+`. Capture stays on `/sell` (SellValueForm).
LOOP_SENTINEL stays off. Do not mix `_cma-*`.

Next: Wave B search chrome (Google UI, email-first 375, one view toggle).

# Previous — 2026-09-06 (remaining taste defects)

Four leftover first-viewport defects from the site-pages e2e review:

- `/homes-for-sale/bend` defaults to the same SearchFilters + MapSearchView
  split as regional `/homes-for-sale` (numeric `view=1..5` still grid).
- Tetherow belonging is a caption on the still, then Atlas. No `#facts` KPI.
- `/housing-market` opens on the MOS two-bar (homes for sale vs a month of
  sales). Median overlay is the fallback drawing.
- About/team portraits drop `--v3-section-pad` cream lakes. Team fold is
  photo + Call/Text/Email.

Looked at localhost 1440/375. Separate evaluators wrote `tasteReview` + PNG
receipts (search 54, community 57, about 51, team 47, market 54). LOOP_SENTINEL
stays off. Do not mix untracked `_cma-*` / deep-audit punchlist scripts.

---

# Previous — 2026-09-05 (dataviz skill)

`.claude/skills/dataviz/` is the chart method TASTE.md named and that
this session did not load. Form first, navy on cream, thin marks, Geist
on figures, never dual axis, never a number on every stem. Seasonality
on 2465 is now a line with Apr/May labeled. Rec $401k unchanged. Do not
send.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (CMA mannered prose, second pass)

Seller CMA copy is facts only. Audit "meaning" lecture is gone at source and
stripped at render so stored rows clean up without a rebuild. 2465 7th print
HTML was re-rendered from render_args. Fail-pile rebuild still running on the
local xAI key. Do not send letters.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (CMA first-build audit)

Judge/audit run on the local xAI key (`lib/grok`), not Anthropic. Failed last
list is stamped before the audit. Fabricated judge prose is replaced with an
honest retained-count line so first builds can pass. CLI rebuild of the fail
pile is running: `npx tsx scripts/_rebuild-failing-cmas.ts`.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (Studio slate off)

Studio does not create on a clock. `/api/cron/studio-slate` is unscheduled
and no-ops unless `STUDIO_SLATE_ENABLED=1`. Produce from `/admin/studio` only.

---

# Previous — 2026-09-05 (CMA queue + expired list cap)

`/admin/cmas` is the one list: filter by address, city, origin, created date, recommended price. Rows show range, rec, and last list on expireds. Review is numbers + the origin-aware email + Approve & send.

Expired CMAs cannot print a list above the failed last ask (engine clip + accuracy contract). Asked/FSBO/expired copy still differs only in the opening.

Uncommitted deep-audit punchlist files remain in the working tree. Do not mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-04 (golf Track C) — five remaining maps ship as operator plates

OSM still has no numbered 18/9 (unclipped cache, bbox XML, Overpass 504).
Do not invent. Do not re-open Nicklaus (`dfdfe4d2`). Do not number leftover
Pronghorn ways as Fazio.

Shipped rasters + `V3CourseMap` plate path. `hasCourseMap` true for plate OR holes.

- **fazio** — PRHF-SC.pdf map+card. Juniper Preserve scorecard, not a survey.
- **rivers-edge** — Updated-Scorecard.jpg map panel.
- **greens-at-redmond** — golfthegreens.com scorecard map panel.
- **desert-peaks** — operator `new-course-layout.jpg`.
- **eagle-crest-challenge** — 2026 Ridge+Challenge PDF page 2 (Challenge only).

Community rank prefers OSM, so Pronghorn still shows Nicklaus. Local
`wt/golf-maps-20260903`. Do not push this branch.

---

# Previous — 2026-09-03 (golf, Pronghorn Nicklaus) — twenty courses became twenty-one

The naming is solved. Do not re-ask. Operator scorecard `PRH-SC.pdf` is titled
**NICKLAUS COURSE**, TIPS 7,379 (USGA CourseID 5779). OSM par tags on the cluster
near 44.1865, −121.1715 are 4-5-3-4-4-4-3-5-4-4-4-4-4-3-5-5-3-4, summing to 72 —
exact match. Scorecard layout (1 west, 3 north, 15 southwest, practice by 1)
matches those centroids.

**Shipped** `data/golf/course-maps/pronghorn.json` with `courseSlug:
'pronghorn-nicklaus'`. Loader key is the registry slug. Cluster-inside-neighborhood
`pronghorn`, same provenance as Broken Top, **not clipped to the hood polygon**
(it covers 4 of 21 holes). Duplicate untagged `ref=17` farther west and two
unnumbered ways dropped; they are not Fazio. No bounds ring. Par 72 prints.
Yards 6,788 vs 7,379 **HELD** — do not fudge length. `pronghorn-fazio` stays
refused. `data/golf/courses.ts` par/yards untouched.

**Join.** `REGISTRY_SHORT_NAME['pronghorn']` is `Pronghorn Nicklaus`, not
`Pronghorn`. The registry has two shortNames on that property; the OSM cluster
is one eighteen.

---

# Previous — 2026-09-03 (golf, main) — sixteen courses became twenty, and the reason they were not

Matt asked for all Central Oregon courses. I reported sixteen and said
OpenStreetMap had no hole geometry for ten. **That was a conclusion from one
query shape, and it was wrong for four of them.**

`scripts/golf/fetch-osm-courses.py` clips every feature to the course's own
named `leisure=golf_course` polygon. The broad count — every `golf=hole` way in
the region, unclipped — returns 363, and **180 of them sit inside no such polygon
at all**. A boundary-clipped fetch could never have seen them. CLAUDE.md §0
carries the rule I skipped: run a second, differently-shaped check before
reporting an absence.

| | shipped | measured |
|---|---|---|
| **Broken Top, Brasada Canyons** `81adfb15` | Complete numbered eighteens. Neither has a golf_course polygon, so each is bounded by its own hole cluster, identified by the neighborhood polygon in `public.boundaries` that contains it. Both halves are needed: Pronghorn's neighborhood polygon covers 4 of the 21 holes on the property, Broken Top's covers the whole residential community, and a bare cluster has no name. | Broken Top par 72 OK, yards 6,337 vs 7,161 HELD. Brasada par 73 vs 72 HELD, yards 7,368 vs 7,295 HELD. 18 discs, 44×44 taps, no h-scroll at 390 and 1440. |
| **Awbrey Glen, Quail Run** `d483feeb` | Eighteen routings each and exactly one tag on every feature: `golf`. Mapped, not numbered. Heading is "drawn from the air"; marks are dots; no scorecard, so the marks are the control with a roving tabindex and Enter/Space wired by hand, each named by its own measured sentence. | Tapping the sixth mark moves the card to it; two ArrowRights move focus and selection together. 18 marks, none under 44px, one card visible. |

**Three fixes the render found, two of them older than this work.**
The source line said "clipped to the course boundary" on courses whose boundary
is a cluster extent — each file records which, and the line says it. The
selection island read the scorecard buttons to find its hole list, found none on
a course with no scorecard, and returned, leaving all eighteen cards on screen.
And `sentence()` capitalised the first clause but not the second, so every hole
that bends, carries water and has no bunker shipped "Doglegs left. water on the
hole." on all twenty courses.

**Two data fixes.** Brasada drew a 23-acre centre-pivot farm circle 626 m from
the nearest hole, because turf is inferred from colour and not from a tag; turf
now has to sit within 250 m of a routing. That number is measured, not chosen:
across the sixteen courses bounded by their own polygon the farthest turf blob
is 213 m, so nothing already built moved. And a cluster-bounded course no longer
draws its bounds ring — that rectangle is where the query stopped, not the edge
of the property.

**The six that still have no map, each checked twice:**
- **Pronghorn Nicklaus, Pronghorn Fazio** — one complete numbered eighteen on the
  property, par 72. Both courses are par 72, at 7,379 and 7,456 yards, and
  nothing in the tags says which is mapped; the routings run 8–9% under both
  cards, so length does not separate them either. A course map has to name its
  course. **This one is recoverable** — any source that says which part of the
  property is the Nicklaus routing unblocks it.
- **River's Edge** — zero features inside its polygon, re-checked by distance.
- **The Greens at Redmond** — one clubhouse within 3 km. **Desert Peaks** — zero
  within 3 km of its own polygon's centroid. **Eagle Crest Challenge** — three
  holes, numbered 12, 13 and 14, below the quarter-missing floor.

**Also.** `lib/golf` had no tests at all, with every §0 refusal living in it. The
fourteen added were each checked by breaking the rule and watching them go red.
And I corrected `d516979c`'s hover regression on the search map in `92ef0d72` —
see the block below; live production measures 22/23 marks owning their own
centre, and the one that does not is pre-existing Google marker overlap,
identical with the tap layer on and off.

**Carry forward:**
- The neighborhood-boundary join is hand-written in `NEIGHBORHOOD_COURSES` and in
  `scripts/golf/export-neighborhood-polys.mjs`. Awbrey Glen's course sits inside
  `bend-awbrey-butte`, not inside the `awbrey-glen` row, so a slug match would
  pick the wrong polygon and return nothing.
- `/tmp/region-golf-holes.json` caches the one region-wide hole pull. The public
  Overpass mirrors 504 on almost everything else; that query is the only one that
  reliably returns, and re-running the fetch after a code change should not have
  to win that race again.
- `geo_type` in `public.boundaries` is `neighborhood`, never `community`. Asking
  for `community` returns "no boundary row" for every resort we have.

---

# Previous — 2026-09-02 (/endtoend all open tasks, main) — the four open items are closed

Matt: `/endtoend all open tasks`. All four shipped, each measured on a running
server rather than asserted. Three ran as parallel workers on exclusive file
sets; the calculator was mine.

| | what shipped | measured |
|---|---|---|
| **Rental calculator off shadcn** `094a21ed` | 56 `data-slot` elements gone from TWO public routes. Native `input[type=range]`, `select`, `details`, a real `table`, V3Button. The four hover tooltips behind 16px "?" buttons became one "What these mean" fold, always in the DOM. `analyzeRental` untouched. | 0 data-slot, 22 controls, none under 44px, no h-scroll at 390 and 1440 on both routes. Walked for real: price 650k→450k and rent 3,250→3,400 moved cash flow −$1,055→+$24/mo; five ArrowRight on the slider 25%→30%; 15-year term −$579/mo; projection fold 7 rows + chart; lead form 44px fields. 30/30 rental-analysis tests. |
| **Four controls under the floor** `9ce57105` | chart-card source summary 17.84→44, instrument fold 42.34→44, save-search email 32→44, map view strip 28→44, plus the submit beside the email. | Section cost priced each time: +20.56 per chart card (a bare min-height cost 26.16; trading the parent's padding bought 5.6 back), +1.66, +12, +16. `/cities/bend` 21,285→21,401px at 390. `/homes-for-sale` does not grow — the map shell absorbs it. |
| **Map marks** `d516979c` + `92ef0d72` | Cluster bubbles and price pills carry a 44px `::after`; the paint is untouched. Three things the render taught. Hit-testing follows PAINT ORDER, so an unclamped box on an upper mark steals a lower one's centre — the upper one is cut instead. Google attaches marker DOM several frames after every event hook fires, so a MutationObserver is the only thing that catches it: last hook at 2.97s, marks in the DOM after, zero boxes fitted. And the box itself broke hover, which `d516979c` shipped without — see the correction below. | Verified independently of the worker, twice. Before the hover fix: 23 marks on /cities/bend at 390 and 1440, all in view, every one resolving to ITSELF at its centre, none stolen, targets 44x44 and 60x44. After: 20/20 at both widths, 0 stolen, every box 44x44, and the mark count holds across 10 samples with the pointer parked on a mark. |
| **G71, the gate** `4146c139` | Runtime Playwright over 8 routes at two viewports. Static could not work: the failures have no declared box, and the WCAG 2.5.8 Equivalent exception is a fact about the rendered page. Ratcheted by SIGNATURE — an href-keyed first cut produced 57 rows, 30 for one footer list, which is the cliff that gets a gate deleted. | 3,263 controls, 132 excused by Equivalent, 25 signatures baselined. Both red paths proven against a mutated-then-restored baseline. The exception is load-bearing: disabled, the homepage alone fails on the atlas polygons at 4.9x5.5. |

**The tap layer broke hover, and `d516979c` was already on main when the worker
reported it.** Two faults, both inside `SearchMapClustered.tsx`, both fixed in
`92ef0d72`. Hover was bound per marker on the content element; Google re-slots a
marker when its zIndex changes, so `mouseleave` lost its element and the pill
stayed emphasised after the pointer left (3/3 with the layer on, 0/3 with it
off). Hover is delegated to the map container now and keyed off
`data-listing-key`, which survives re-slotting. And the emphasised marker sat at
`MAX_ZINDEX` while cluster bubbles sit at `MAX_ZINDEX + count`, so a hovered pill
drew *under* a cluster it overlapped: pointer resolved to the cluster, hover
cleared, pill shrank, pointer resolved to the pill, and it flapped every frame.
Emphasis goes to `MAX_ZINDEX * 2`. `fitMapMarkTaps` also slides the box
(`--rr-map-mark-tap-x/-y`) before it trims, and never shrinks below the painted
footprint.

**The one honest caveat on the map marks.** Giving every mark a 44px box means
neighbours occlude more of each other, so the *contiguous* region around a mark
that still answers to it shrinks in some frames. That is the nearest-wins
behaviour the brief allows, and every mark still owns its own centre in every
frame measured. What it buys: a click 4px outside a cluster's painted circle now
fires `click`/`gmp-click` on that cluster, where before no point outside a mark's
paint resolved to it at all. The map screenshot with the layer on and off differs
by 0 pixels.

**Also fixed, found by the review sweep and not by a report:** `/communities/tetherow`
shipped "Value my home" twice — `buildExploreEdges` adds it and the page pushed
it again — so the closing block carried a duplicate exit and React warned on
duplicate keys. `splitQuietItems` dedupes by href now, so no caller can repeat
it (`53127679`).

**The review pass.** 13 routes x 2 widths: zero horizontal scroll anywhere,
exactly one `h1` per page, no unnamed links. Full suite 1,531 files / 16,190
tests green. The only console flags left are Google Maps announcing a vector to
raster fallback on map pages, which is theirs.

**Two corrections to what this session believed going in.** `.v3-field__pin` is
not a control — it is a span with a mouseenter handler inside an aria-hidden
plot, no href — so the "pin hrefs are duplicated by row anchors" mitigation
describes something that is not there. And zero in-degree is not dead code,
again: `PublicProductTypes` is recorded as replaced in four parity.json files
and imported by nothing findable, and G46 caught that
`NeighborhoodMarketContext` imports it.

**Carry forward:**
- G71's baseline was recorded against a dev server, the only one available here.
  If CI's production build reports a signature that is not in it, re-record with
  `ci:tap-targets:start` rather than deleting rows. The header says so.
- G71 is PR-time, not push-to-main: it needs a server, so it runs in the CI step
  that already starts one for route-smoke and the payload ratchet.
- The 25 baselined signatures are the real remaining debt, now visible on every
  run: 214 footer links at 203.2x32, 40 nav carets at 32x44, 35 footer
  disclosures at 203.2x17.8, 18 chart tabs at 47.6x32, and 19 search-UI controls.
- A `V3Field` atom would retire the rental calculator's `.design-token-lint-ignore`
  entry. The barrel has V3Filter (a search box) and no generic labelled field.

---

# Previous — 2026-09-02 (golf maps + the punch list, main) — sixteen courses, five items closed

Matt: "finish all Central Oregon courses and then finish the primary items in
this session, I want it all and I want it all done the best."

## The courses — 16 of 26, and the other 10 are a data wall

See the block below for the pipeline, the three build paths and the §0 refusals;
it is unchanged except that the count went 10 → 16 and a separate evaluator then
failed the section on four counts, all fixed:

- **The source line attributed per-hole par and yardage to the USGA.** A hole's
  length is the measured length of an OSM polyline and its par is a raw OSM tag;
  the USGA supplies the two totals in the claim line and nothing else. The trace
  is split, and a basis line sits with the figures.
- **A duplicate stroke index shipped** (Eagle Crest Resort printed index 6 on
  holes 10 and 11). A stroke index is a permutation of 1..N, so it reconciles as
  a SET now — complete and unique — or it does not print. It prints on no course
  today, which is the honest state of the tags.
- **Two totals for one course disagreed on one screen**: the USGA claim against
  the summed routings (Crooked River Ranch 5,818 vs 5,763). The nine totals say
  "measured" now.
- **The hole numbers failed AA on every map**: dimming the disc to 0.45 put
  cream-on-navy at 2.73–3.79:1. State is in the FORM now, a ring against a
  filled disc, both at 14.23:1.

Plus five more from the same pass: the scorecard's columns lied on courses with
missing holes (hole 3 sat in column 2), a nine that could total nothing printed
"Out" alone, the green and the water had no `.is-on` rule so a card reading
"water on the hole" lit no water, the buttons announced as "1 4", and the cells
measured 37×44px.

**~~The ten without maps are blocked on OpenStreetMap, not on us.~~ WRONG — see
the 2026-09-03 block at the top of this file.** Four of the ten had complete
hole geometry the whole time; it sits inside no `leisure=golf_course` polygon, so
a boundary-clipped fetch could not see it. Quail Run's own polygon holds 18
holes. Broken Top, Brasada Canyons, Awbrey Glen and Quail Run all ship now, and
twenty of the twenty-six have a map. The paragraph is left standing because it is
what a second query shape would have caught.

## The punch list — all five, plus two the recon surfaced

A ten-agent read-only recon measured every item against the live build and then
adversarially verified its own findings, which changed three of them materially.

| item | what shipped |
|---|---|
| `#belonging` prose class | V3Quiet gained `fact`, `chips` and `fold` rows. Tetherow 2,974 → 2,374px at 1440, 4,042 → 2,799 at 390, with the DOM word count unchanged. |
| `/communities#all-communities` | 600 links off shadcn onto the barrel: 14px text in an 18px box → 16px navy in a 44px row. Two new atoms, V3Filter and V3Segmented. |
| undeclared `.skeleton` | V3Placeholder (paint only) + V3Loading (the v3 section rhythm). Nine public routes are five lines each. |
| V3Proof | The homepage's eight hardcoded testimonials are the live Google reviews. 1,557 → 964px, with figures, dates and a door. |
| marks under 44px | The review strip's closest pair went 0.00px → 24.00 at 1440 and 10.94 at 390. The listing page's `?` link got a rule; it had none anywhere. |

**Two the recon found that were not on the list, both worse than the items:**

- **The listing page's broker contact rendered at NO width.** The mobile bar is
  `position: fixed` and lived inside `.listing-detail-aside`, which is
  `display: none` below 64rem — a fixed element does not escape a hidden
  ancestor — and the desktop card was hidden at exactly the width the aside
  appears. Measured 0×0 for both at 390, 1024 and 1440; now 390×56 and 518×510.
  The CSS comment above the bar reads "Conversion-critical."
- **The footer disclosure lied.** Above 40rem it was closed while CSS forced its
  list visible, so a screen reader met a control announced COLLAPSED over
  thirteen visible links. It ships `open` now and an island closes it narrow —
  that direction, because the inverse hides 52 destinations from every crawler
  that does not run JS.

## Still open

- **RentalCalculator on the public listing page**: 56 shadcn `data-slot`
  elements on a public surface, a straight §3 violation. It is a real rewrite,
  not a swap.
- **Map cluster and price pills** (`SearchMapClustered`): 32×32 / 38×38 /
  60×25, 22 of 23 under 44px on /cities/bend. Use the transparent-wrapper form
  the course map proved.
- **Control heights**: `.v3-chartcard__source-summary` 17.84px,
  `.v3-instrument__fold-summary` 42.34, `#save-search-email` 32,
  `.map-search-views` 26.
- **A tap-target gate** (§6). It must encode the WCAG Equivalent exception or it
  fails the atlas and the field pins on every run: a control under 44px fails
  only when no same-page control does the same job at ≥44px. Both existing
  mitigations are machine-checkable — atlas chips match places 1:1 by name,
  field-pin hrefs match row hrefs 1:1.

**Two traps worth carrying.** Zero in-degree is not dead code, again: I nearly
deleted PublicProductTypes on the strength of four parity.json files recording
it replaced and a grep that found no importer. G46 caught it —
NeighborhoodMarketContext imports it. And `git checkout HEAD -- <path>` on a
file the HEAD commit deleted does not restore it; chained with a `git show`
fallback it wrote two EMPTY files that then broke the same gate.

---

# Previous — 2026-09-02 (golf course maps + footer, main) — sixteen courses drawn hole by hole

Matt asked for the course map on the golf communities and then for all of Central
Oregon, against his restated standard that a page must be the best page on the
internet for its exact subject.

**Shipped, all on origin/main:** `V3CourseMap`, a new barrel pattern, on
`/central-oregon/golf/[slug]` (16 of 26 courses) and on seven community pages
(Tetherow, Crosswater, Sunriver, Caldera Springs, Black Butte Ranch, Eagle Crest,
Widgi Creek). Plus the footer disclosure fix and the golf hub's value column.

| | |
|---|---|
| Courses with a map | Tetherow, Crosswater, Sunriver Meadows, Sunriver Woodlands, Eagle Crest Ridge, Eagle Crest Resort, Aspen Lakes, Juniper, Bend Golf & Country Club, Widgi Creek, Glaze Meadow, Big Meadow, Meadow Lakes, Crooked River Ranch, Lost Tracks, Caldera Links |
| Committed geometry | `data/golf/course-maps/*.json`, 1.4 MB, one lazy import per page |
| Refused | Quail Run and River's Edge (boundary in OSM, nothing inside it); Pronghorn ×2, Brasada Canyons, Broken Top, Awbrey Glen, Eagle Crest Challenge, The Greens at Redmond, Desert Peaks (no polygon carrying golf features) |

**Where the geometry comes from.** OSM has greens, bunkers, tees and hole
routings; its fairway coverage is partial (12 of Tetherow's 18), so the fairway
body is mown turf traced out of Oregon's OSIP 2018 aerial, clipped to the
course's own named `leisure=golf_course` polygon. That boundary is load-bearing:
a radius query around Crosswater's clubhouse also returns Caldera Links and the
map then numbers 36 holes 1 to 18 twice.

**The hole notes are measured, not written.** Dogleg is the turn angle of the
routing on screen, bunker count is the number of bunker shapes that light when
the hole is selected, water is a drawn hazard. `lib/golf/course-map.ts`.

**Three build paths, each stated on the page:**
1. Routed and complete — the normal case.
2. Routed and short. A course may miss up to a QUARTER of its holes; the page
   names every absent one ("Holes 2, 12, 13, 14 have no routing in the map data")
   and prints no superlatives, because "longest hole" over 14 of 18 can name the
   wrong hole.
3. **Green-anchored.** Big Meadow has 19 greens, 64 bunkers, 51 tees and not one
   `golf=hole` way — but 18 of its greens carry `ref` 1 to 18, which IS the
   numbering. The number marks the green, nothing claims a length or a shape, and
   the section says so. The routing is NOT inferred: pairing a tee to a green by
   proximity has no unique answer (the tee for hole N sits beside green N-1) and
   a line between a guessed pair is a shape the course does not have, which would
   then be measured for a dogleg and printed as one.

**§0 refusals, all live.** Per-hole par prints only when the holes sum to the
published par (Tetherow's OSM tags sum to 71 on a par-72 course). Per-hole
yardage only within 1% of the published card. Green square footage is measured
and never published — OSM traces some greens as the whole complex and Crosswater
would print an 18,300 sq ft putting surface. A stroke index outside 1..holes is
dropped (OSM carries `handicap=-1` at Eagle Crest Ridge).

**The turf threshold is chosen by looking, per course.** `python3
scripts/golf/trace-turf.py <slug> --sweep` renders the candidate bands as red
overlays on the aerial side by side. Per course because what the threshold
separates turf FROM differs: sage at Tetherow (loose, 60 acres), wet meadow at
Crosswater (tight — loose floods the Deschutes floodplain and reports 115 acres
where 47 are fairway), pine shadow at Widgi Creek (widest, 8 acres on the default
against 46). Reasoning about HSV instead produced 3 acres on one attempt and 425
on another.

**Pipeline, one command per stage:** `scripts/golf/fetch-osm-courses.py` →
`scripts/golf/trace-turf.py <slug>` → `scripts/golf/build-course-maps.mjs`.

**Traps found here.** The registry parser read single-quoted fields only, so
River's Edge reported "no registry row" while sitting in `data/golf/courses.ts`;
fixing it also surfaced Bend Golf & Country Club. The ArcGIS image server answers
an oversized request with a JSON body that lands on disk as an unopenable `.png`.
Anything sized in SVG user units scales with the drawing, not the screen: a 44px
tap target measured 20px on Juniper at 390 and the hole numbers were 6px on a
desktop Juniper, so both moved into a percent-positioned HTML layer over the map.
Fading the unselected course to emphasise one hole wiped the map — turf sits at
20% of navy and a 0.18 multiplier left under 4% ink.

**Two other things shipped in the same stretch:**
- **The footer fold reports the state it is in.** Above 40rem the disclosure was
  closed and CSS forced its list visible, so a screen reader met a control
  announced COLLAPSED over thirteen visible links. The markup ships `open` and an
  island closes it below 56.25rem — that direction, because the inverse hides 52
  footer destinations from every crawler that does not run JS. The two- and
  three-column grid steps are deleted, which is what removed the blank-cream
  defect at 640–899 for good: no fold ever sits in a grid now. Footer height
  measured 947/884/862/862/862/907/907/907 at 390/640/768/834/899/900/1024/1440.
- **The golf hub's value column.** It printed "18 holes" on 24 of 26 rows. It is
  back-tee yardage now, ordered longest first, with V3Ledger's bar encode.

**Open here:** the ten refused courses need OSM hole geometry that does not
exist. The fix is contributing it upstream, which is slow but permanent.

---

# Previous — 2026-09-02 (golf course maps, main) — ten courses drawn hole by hole

Matt asked for the course map on the golf communities: "a beautiful course map with
hole descriptions or whatever," against his restated standard that a page must be the
best page on the internet for its exact subject.

**Shipped, all on origin/main, verified in production:** `V3CourseMap`, a new barrel
pattern, on `/central-oregon/golf/[slug]` (10 courses) and on six community pages
(Tetherow, Crosswater, Sunriver, Black Butte Ranch, Eagle Crest, Widgi Creek).

| | |
|---|---|
| Courses with a map | Tetherow, Crosswater, Sunriver Meadows, Sunriver Woodlands, Eagle Crest Ridge, Aspen Lakes, Juniper, Bend Golf & Country Club, Widgi Creek, Glaze Meadow |
| Committed geometry | `data/golf/course-maps/*.json`, 956 KB, one lazy import per page |
| Refused | Caldera Links 8/9, Eagle Crest Resort 14/18, Lost Tracks 15/18, Big Meadow, Quail Run, River's Edge 0/18 |

**Where the geometry comes from.** Two sources. OSM has the greens, bunkers, tees and
hole routings but its fairway coverage is partial (12 of Tetherow's 18), so the
fairway body is mown turf traced out of Oregon's OSIP 2018 aerial, clipped to the
course's own named `leisure=golf_course` polygon. That boundary is load-bearing: a
radius query around Crosswater's clubhouse also returns Caldera Links and the map
then numbers 36 holes 1 to 18 twice.

**The hole notes are measured, not written.** Dogleg is the turn angle of the routing
on screen, bunker count is the number of bunker shapes that light when you select the
hole, water is a drawn hazard. Sentence and picture come from one array, so the claim
is checkable by looking. `lib/golf/course-map.ts`.

**§0 refusals, all live.** Per-hole par prints only when the holes sum to the club's
published par (Tetherow's OSM tags sum to 71 on a par-72 course, so Tetherow prints
yardage and no par). Per-hole yardage only within 1% of the published card. Green
square footage is measured and never published — OSM traces some greens as the whole
complex and Crosswater would print an 18,300 sq ft putting surface. A course missing a
hole says which one and prints no superlatives, because "longest hole" over 17 of 18
can name the wrong hole. A stroke index outside 1..holes is dropped (OSM carries
`handicap=-1` at Eagle Crest Ridge, which printed "Stroke index -1").

**The turf threshold is picked by looking, per course.** `scripts/golf/trace-turf.py
<slug> --sweep` renders the candidate bands as red overlays on the aerial side by
side. It has to be per course because what the threshold separates turf FROM differs:
sage at Tetherow (loose band, 60 acres), wet meadow at Crosswater (tight band — loose
floods the Deschutes floodplain and reports 115 acres where 47 are fairway), pine
shadow at Widgi Creek (widest band, 8 acres on the default against 46). Reasoning
about HSV instead produced 3 acres on one attempt and 425 on another.

**Traps found here.** The registry parser read single-quoted fields only, so River's
Edge reported "no registry row" while sitting in `data/golf/courses.ts` — fixing it
also surfaced Bend Golf & Country Club. The ArcGIS image server answers an oversized
request with a JSON body that lands on disk as an unopenable `.png`. Fading the
unselected course to emphasise one hole wiped the map: turf sits at 16% of navy and a
0.18 multiplier left 3% ink, so the selected hole is emphasised and nothing is faded.

**Pipeline, one command per stage:** `scripts/golf/fetch-osm-courses.py` →
`scripts/golf/trace-turf.py <slug>` → `scripts/golf/build-course-maps.mjs`.

**Open here:** the six refused courses need OSM hole routings that do not exist yet.
Caldera Links needs its 9th, Eagle Crest Resort four holes, Lost Tracks three; Big
Meadow, Quail Run and River's Edge have no `golf=hole` ways at all.

---

# Previous — 2026-09-02 (evaluator punch list, main) — seven form defects closed in the PRIMITIVES

Matt picked the evaluator punch list. An 11-agent audit re-measured every open
finding against the live build first, which was worth doing: **the "market chart has
zero hover" finding was already fixed** and would have been rebuilt. The critic pass
that followed produced the work order everything below follows: *"the site's problem
is not a shortage of primitives — V3Answers is used once, V3Ledger has no encode,
V3Chart's range rows are aria-hidden, and V3Proof is switched off on the page that
most needs it. Improve the four that exist before adding four that do not."*

**Shipped this session, all on main, each deployed and verified in production:**

| | was | now |
|---|---|---|
| Footer, every page @375 | 2,599px | **947px** (all 52 links still crawlable) |
| Homepage @375 | 12,675px | **11,022px** |
| `/communities/tetherow` `#faq` @1440 | 3,405px | **513px** |
| `/cities/bend` place ledgers | 61 unencoded rows | **27 drawn bars** |
| Range chart rows | `aria-hidden`, `title` only | pointer + keys + touch, 9/9 rows |
| Place H1 vs its own H2 | 35px under a 58px | **58px over 35px** |

- **`cd65d5d6` the footer folds and a ledger row draws its figure.** `encode="bar"`
  on V3Ledger takes a `weight` (a SHARE, 0–1, computed by the caller beside the
  figure) so the primitive still never does arithmetic on a number it could then
  disagree with the trace about. One change lit eight place-ledger call sites.
- **`83518a2f` the fold only lives where the sitemap is one column.** The evaluator
  found two defects in my own footer an hour after I shipped it: the unfold started
  at 56.25rem while the grid goes multi-column at 40rem, so opening a group at
  640/768/834/899 left ~586px of blank cream; and I had written that the chevron
  matched V3Atlas when it pointed the opposite way. **Still open, a product call:**
  above 40rem each summary stays focusable and reports itself collapsed over visible
  links. CSS can force a disclosure open but cannot make the control agree.
- **`dfe115a1` market figures say what they mean.** TASTE names `median to pending ·
  90 days` as its example of banned jargon; it was shipping verbatim on four route
  classes. Nine `·` forms retired. **The rename is COUPLED** —
  `lib/market/how-we-get-our-numbers.ts` keys its explanation dictionary by the
  printed label — and **eleven tests had frozen the old spelling**, several by
  grepping source for the exact string.
- **`6f1126ed` + `a6477693` the questions fold, on five routes.** V3Answers ran on
  ONE route. The community `#faq` was one V3Quiet doing three jobs; the 41 outbound
  doors were the real bulk and now fold past six behind a counted summary. Folding,
  never cutting: a test walks all 41 hrefs. `splitQuietItems` does the split once, in
  the barrel. **ci:page-purpose caught the plan drifting from the page** and the city
  + community parity.json moved with it.
- **`038d15b4` the range rows can be read.** 57 rows across nine call sites had
  `aria-hidden="true"` and a native `title`. V3ChartHover took an `axis` and does the
  same job turned ninety degrees. Two defects the RENDER caught: the tip covered the
  row it described (a range plot already prints every value, so row charts get the
  crosshair and live region and no tip), and the crosshair pointed one row high
  because I sized the layer to the whole range box including its band header.
- **`bd17f8ab` a page's title is the biggest thing on it again.** V3Atlas hand-rolled
  a clamp and used it whether its headline was an H1 or an H2; that clamp is now
  `--v3-size-display-hero`, the step the ramp was missing.

**Still open, in the critic's order:** the place-page prose class (`#belonging` is
2,974px of essay, and `buildPlaceKnowledge` flattens fully STRUCTURED data —
`hoa.annual`, `driveTimes[{minutes,destination}]`, `membershipTiers[{name,price,
waitlist_status}]`, `courseSpecs` — into `·`-joined strings, so it is a composition
job and not a data one); marks-as-doors clearing 44px (13px Google pins, 5×9px atlas
region buttons on the homepage hero, 24×24px review marks); V3Proof as one primitive
for all three review surfaces; `/communities#all-communities` (598 links at 18px in
shadcn markup on a public page); and the undeclared `.skeleton` across 13 loading
routes. `/faq` is deliberately unconverted — it interleaves category rows as
pseudo-questions and needs a category-aware design.

**Two traps worth carrying:** a suspiciously fast dev-server response after an edit is
a CACHE, not a pass (a stale `/contact` cost me a hunt for a bug that did not exist —
testing the splitter against real data and restarting the server settled it); and
equal-specificity CSS is decided by SOURCE ORDER, which is how a modifier placed above
its base rule silently shrank the homepage hero.

---

# Previous — 2026-09-01 (Claude Code UX session, main) — homepage three routes, phone in chrome, TASTE is a gate, CMA on xAI

**Shipped, all on origin/main, production READY:**
- `317d7a12` homepage: V3Doors (new barrel pattern) routes Buying / Selling / Investing under
  the hero with one live fact each from the destination page's own source; the broker phone is
  in the header bar at every width (icon at 390, digits from 40rem); HomeAlertSheet retired
  (one ask per page). `INVEST_SEGMENTS` moved to `lib/invest/segments.ts` (one population for
  /invest and the door).
- `5c860c1f` place+type pages never print a raw slug: `resolveSlug` falls back registry-label-
  first (Caldera Springs' listings carry MLS City Bend, so the Sunriver-scoped lookup always
  missed) then title-cases. Matt's screenshots of "Lots and Land in caldera-springs" were this.
- `b7753ad0` CMA judge + audit run on xAI through `lib/grok` (strict json_schema, XAI_API_KEY,
  fail-open kept; tests mock `@/lib/grok`). `lib/cma/subdivision-story.ts` (vision) is still
  on Anthropic and fails open — migrate to `lib/grok/vision.ts` next. End-to-end proof on a
  real backlog CMA rebuild is still owed.
- `f388698d` TASTE IS A GATE: `design_system/public/TASTE.md` rewritten (why our pages come
  out generic; builder ritual with interaction as a required answer; evaluator rubric run by
  a SEPARATE agent; banned tells; design-the-class rule), research at
  `docs/research/taste-for-agents.md`, pointers in CLAUDE.md §3 / AGENTS.md / frontend-design
  skill, enforced by `ci:taste-canon` (every public route's parity.json carries a
  `tasteReview` receipt; 21 pre-rule routes in a shrink-only baseline).

**Matt's standing directives, this session (all in decisions.md items 4–7):** "We are a wall
of text, scrolling lists, and boring." Every page visually breathtaking; interactive data on
every page ("not a number, a percentage, and jargon"); every place page blown out with the
data cube (every property type, every subdivision); beat the best page for Tetherow,
Northwest Crossing, Old Bend, West Hills, every listing; brokerage pages and contact dialed;
stop the one-off approach — design the CLASS of pages. Any tool, every session, uses TASTE.md.

**Evaluator pass on the homepage (2026-09-01, separate agent, report in the session
scratchpad): 41/100 FAIL.** Design 14/30, originality 9/30, interaction 5/15, craft 7/15,
honesty 6/10. Only `#doors` and desktop `#faces` were judged deliberate. Craft defects fixed
and on main (swept into the admin session's `fbbef2af` by a shared-checkout `git add`; content
intact): `#sell` mounted in SellCapture with heading + 44px controls (was a bare full-bleed
form), Buying door made place-first ("Find your place", map search — Matt: a buyer does not
want every home), pace figures as one sentence instead of a KPI grid with the banned
`median to pending · 90 days` label, source line in visitor language, all three brokers at
375, hero eyebrow and footer figure-repeat removed. STILL OPEN, all form-level and all
requiring variants: towns ledger encodes nothing (bars or choropleth), market chart has zero
hover and no claim (marks + scrubber + emphasis line), verdict should be a range meter,
reviews is a 1.5–2.3k px prose wall (proof band), homes map pins are 13px at region zoom,
communities repeats the towns ledger and discards its video posters, footer is 2,686px at 375.
Matt's reaction to the shipped top of page: "is this supposed to wow me?" — it is not, and he
is right: the opening is a stock hero plus three text doors.

**LIVE ON MAIN (8af091f6) — the living map after three evaluator passes, on every place page:**
`V3Atlas` (`components/site/v3/V3Atlas.client.tsx` + `.css`) opens the homepage and, scoped to the
recorded boundary, is `#atlas` on every city, neighborhood, community, and subdivision page
(Bend's places are its 13 neighborhoods; other cities' are their busiest recorded plats;
neighborhoods and communities show their plats; a plat shows itself). Population through ONE
builder, `lib/atlas/build-place-atlas.ts`, over ONE lean read, `lib/data/listings/getAtlasTiles.ts`
(on-market rows keyset-paged from listing_tile_mv on its city+status indexes; the 30-day closed
window from `listings` on `idx_listings_closed_close_date`, because the tile MV has no close_date
index and 550K closed rows; sixteen columns; THROWS on error). The compact population (~400KB) is
what unstable_cache holds — the raw rows are 2.2MB, over Next's 2MB per-entry ceiling. A short
read is never cached: the instance's last good population draws, and the Atlas prints NO counts
("Live counts are unavailable right now"). Layers: canvas heat with 1/√N kernel alpha under a
ceiling, cream halos under every place outline (pass three found the field hid all 27 places),
non-scaling-stroke dots (no hydration flash), HTML labels, pulses on their own layer with slots
per kind (16 new / 6 pending / 18 sold) paused off-screen, a text-toggle legend in flow, pinned
card released by empty-map tap / Escape / outside click, a phone strip that keeps the tapped place
visible. Evaluator (separate agent) scores: pass one 52/49/57, pass two 62/57/67, pass three
72/58/71 (dots/heat/split); pass four is grading the current build. The decision sheet (artifact
"The Living Map") carries the pass-three renders and all scores; Matt picks A/B/C; the losers are
deleted on the pick. Production is ISR (300s); `?opening=` renders only in development. Branch
`wt/home-opening-20260901` (`/Users/matthewryan/RyanRealty-wt-home-opening-20260901`, dev server
`wt-home-opening-dev`, port 3321); every commit is on main.

**CHART ATOM WENT MAX (e740644f):** `V3Chart` gained `claim` (one formatted sentence under the
caption), `yTicks`/`xTicks` (gridlines + labels the caller formats; `lib/charts/plot.ts` exposes
the line scale and `lineTicks`), `emphasize: 'first'|'last'` (one series in ink with marks, the
rest in navy tints — emphasis over the five-hue yoy run), and a hover layer
(`V3ChartHover.client.tsx`: crosshair, dot per series, the reading at the nearest x; pointer,
touch, arrow keys, live region). `placeMedianChart` (homepage + every city page) passes all four.
**Rolled out site-wide (648864e0, merged c0740278):** `lib/charts/ticks.ts` (niceStep, money/
count/day/percent/custom ticks, month/year/spaced ticks, `yoyClaim`/`windowClaim`/`seriesClaim`,
74 tests) and every public chart builder passes claim + ticks + emphasis where honest. Rules the
builder set: a percent series states its change in POINTS; a one-chart card claims through its
title, a switcher card claims per panel, a standalone chart always claims; no emphasis on 260+
point weekly lines. 6f4bc753: a claim's percentage is computed from the figures it PRINTS (the
point's label, else the unit formatter) so a reader can check it (§0).

**MENUS WENT LIVE (this commit):** `V3Chrome` takes `live?: V3ChromeLive` (site-nav group key →
eyebrow, facts, values-by-href, dot field, read stamp), composed by `lib/site/chrome-live.ts`
(`composeChromeLive` pure + tested; `getChromeLive` reads the place atlas, the region pulse, and
`getAllCitySnapshots` — the same city snapshot the homepage ledger prints — under a 4s cap and a
15-min `unstable_cache`, null on failure) and passed from `app/layout.tsx` (now async). Homes: dot
field + for-sale/pending/sold; Places: detached count beside each town; Market: median list, MoS +
verdict, days to pending; Sell: sold 30d + days to pending. The phone overlay prints the same facts
under each group. About carries links only (no honest aggregate for reviews in the repo yet — the
reviews page deliberately prints no aggregateRating).

**ATLAS PASS FIVE GRADED, PASS SIX BUILT:** evaluator pass five (scratchpad `atlas-eval-5.md`):
dots 83 · split 77 · heat 66 · Tetherow 69 · Bend 79 · Larkspur 64 · chart 77. Twelve of thirteen
pass-five claims verified. Pass six closes R1 (hit strokes stole interior taps → hits are `<use>`
clones UNDER the places; halos are `<use>` clones too, so the geometry ships once, not three times
— R4), R3 (five more recorder-residue classes in `lib/atlas/place-names.ts`, tested), R5 (desktop
card names clamp at 4 lines), R6 (the source details reconcile counted cities with drawn outlines),
R7 (place pages render the Atlas with `EMPTY_PLACE_ATLAS` instead of deleting the section), R8
(wide boundary on a phone takes its aspect), R9/R10 (chart touch reading holds after the finger
lifts; the tooltip is a strip under the plot on phones), R11 (rail card labels wrap). Pass six is on main
(8aadb26f + 6f4bc753); evaluator pass six is measuring it. R2 closed: under 48rem every place is
also a chip under the dock (`.v3-atlas__chips`, by count, empties last), tapping one pins its card
from the place's own centre and scrolls the map into view — 27/27 homepage and 22/22 Tetherow places
reachable by chip; measured 6/6 chip taps pin the right card on both. Interior taps: 26/27 homepage
places answer their own tap at 375 (was 14/27), Larkspur 73/80.

**PASS SIX GRADED (scratchpad `atlas-eval-6.md`): dots 86 · split 82 · heat 69 · Tetherow 74 ·
Bend 80 · Larkspur 73 · chart atom 84 (SHIPS — first surface to clear the bar) · chart rollout 67.**
Pass seven (this commit) closes S1 (source line counts towns + places), S2 (name publisher: orphan
periods, Vacation Plat, `atlasRegionNames` keeps the published name when stripping would fold two
plats), S3 (a partial current year on the subdivision chart stands alone, its bar reads "2026 to
date"), S4 (phone tick rows of five or more thin to every other label), S5 (the weekly rate overlay
emphasizes the latest year; the atom draws marks on an emphasized line only up to 60 points), S6
(bar runs print up to six ticks), S8 (captions and KPI labels lose "Market Truth leftover",
"ALL-TYPE", "leftover membership"). Open: S7 (bar runs and range strips have no hover layer), S9
(three plat names still ellipsize on the desktop card), S10 (two homepage silhouettes under 8px wide
answer for a neighbour — geometry, not the hit layer), and the Tetherow "12 sold" (every type in the
boundary) vs "7 closed · 30 days" (detached, by plat name) pairing wants an explicit label.

**BROKERAGE WAVE:** `/reviews` rebuilt on the new barrel primitive `V3Proof` (figures, record strip,
year chips, two-column cards with the first sentence in the display face); `/contact` rebuilt on
`V3Ask` (one screen) with `V3Doors` above it (call / write / book) and `ContactSheet` deleted;
`/about` (21382948) mounts the regional `V3Atlas` in place of its city ledger plus a `V3Proof` band of
the newest four reviews (`record={false}`), and `app/_v3/region-atlas.ts` is now the ONE region
assembly the homepage and About share. `/team` index shows the newest reviews as a Proof band (47e55230). **Evaluator pass one over the
brokerage pages** (scratchpad `brokerage-eval-1.md`): /reviews 78, /contact 60, /about 80 (ships);
all data checks passed (every figure reconciles to the page's JSON-LD, no review text altered).
Closed in this commit: B1 (a strip click no longer lets the card sliding under the pointer steal the
focus — a timer-released scroll lock, pointer resolved to the NEAREST mark by the layer), B2 (the
contact H1 returned: the head Quiet carries one line, since V3Quiet returns null on empty items), B3
(row partners' controls align: the control sits at the foot of its cell), B4/B8 (strip marks are
positioned buttons — true dots at every width, 24px targets, keyboard by nature), B5 (the consent
block wears the form's ink and size via `.v3-ask__consent`), B6 (a subset band is a 2-column grid
with uniform pulls: `.v3-proof__list--compact`), B7 (`getOrCreateRrSessionId` in lib/tracking; the
section tracker mints the id when VisitTracker has not yet — no more 400 on first load), B9 (no
permanent live region; a status line announces the filter), B10 (rating marks only when a rating
under 5 exists), B11 (the About page's dead market query and latent "leftover" footnote strings are
gone), B13 (sentence-case option). Open: B12 (the two legal links are tab stops before the button).

**`/team/[slug]` REBUILT (this commit):** the broker's record from `getBrokerSales` (projection now
carries Latitude/Longitude/PropertyType/property_sub_type; cache keys bumped to v2) —
`app/team/[slug]/_v3/broker-record.ts` (pure, 12 tests): V3Instrument figures (closed sales, span on
the MLS, median close, listed · represented, so far this year) with the closings-by-year bar chart
(partial year stands alone), then V3Atlas "Where Matt has closed" (every closing a dot, `s: 'closed'`,
`noun={{ one: 'closing', many: 'closings' }}` — the Atlas learned both), the 8 newest closings, a
V3Proof band of reviews naming the broker (record off), and V3Doors (call / text / email). Measured:
21 closings for Matt, 21 dots, claim "21 closings of every type", page 6,570px (was 10,196).

**THE BASEMAP IS IN (2e54768a, 304422f4).** Matt's "we do need some map features like roads
for context but should match the style" is answered from public-domain US Census TIGER/Line
2024, drawn in our own projection in the register — never a Google or Mapbox tile layer.
`scripts/gis/build-basemap-skeleton.mjs` builds three things from one pass: a `region` tier
at 200m (the highway skeleton, named rivers and canals over 25km, water bodies over 0.5km²
— 66 KB, 19 KB over the wire, shipped on every frame), a `near` tier at 40m, and 877 street
tiles of 0.05° holding all 12,798 named local streets (S1400), read from disk by
`lib/geo/basemap-streets.ts` for any frame under about ten kilometres. Paths are quantized
deltas with an integer bounding box per feature, so a page clips without decoding
(`lib/geo/basemap.ts`, `lib/geo/basemap-source.ts`; `basemapForRegions(regions, opts)` is the
one call a page makes). The street tiles are traced in `next.config.ts` for the six routes
that draw a walkable frame — without that they are absent at runtime and the map silently
loses its streets. Rebuild after a TIGER vintage change:
`node scripts/gis/build-basemap-skeleton.mjs`.

**MATT'S DECISIONS (2026-09-02, asked and answered):** (1) the homepage living map ships as DOTS —
heat and split get deleted (variant prop, heat canvas, choropleth steps, split rail, the `?opening`
switch, their CSS and tests; the decision sheet closes); (2) listing pages carry the living map
ONLY, no Google parcel map beside it, no street view strip (the Google map remains only as the
fallback when the read fails); (3) the next class is the rest of the listing page — one instrument
for the ask-vs-nearby figures and the market context, the long tail as doors, similar homes as a
strip; (4) the separate evaluator pass runs after EVERY build round until a surface ships; (5) Matt
2026-09-02, mid-round: "we do need to have some map features like roads for context but should
match the style" — the living map gets a BASEMAP LAYER drawn in the register (navy hairlines on
cream, our own projection): primary/secondary roads and linear water from the public TIGER/Line
files for Deschutes (41017), Crook (41013), Jefferson (41031), ingested to Supabase (PostGIS,
simplified per class), a DAL read by bbox + class, and an Atlas layer under the dots (highways at
the region frame; arterials + local streets + the river inside a neighborhood frame). Never a
Google/Mapbox tile layer under the SVG (different projection, per-view cost, foreign style).

**LOT LINES ARE IN (Matt asked for them 2026-09-02, and answered the four scoping questions:
Deschutes free first, subject parcel plus faint neighbours, also subdivision + CMA + land, and
publish the assessor's acreage as its own figure).**

- **Source.** Deschutes County's own open layer, `OpenData/LandFD/MapServer/2` — 109,505 parcels,
  and the one endpoint of three where TAXLOT is unique (the county's hosted AGOL copy has 39
  duplicate ids; `Dial2_Taxlots` inflates to 112,381 rows through a one-to-many mailing join).
  Licence on the county's own item: "Free to download and use", attribution "Deschutes County -
  Assessor's Office".
- **Storage.** `public.taxlots` (PostGIS MultiPolygon, GIST, unique on county+taxlot, acres
  computed on the spheroid at ingest). RLS on, no anon policy: reads go through SECURITY DEFINER
  `taxlots_near_point()` and `taxlots_in_boundary()`, which CLIP and SIMPLIFY server-side to the
  resolution the frame can draw. That is the whole efficiency answer — a listing frame ships 20
  lots at 186 bytes each, about 4 KB, rather than the 333 KB the raw fabric would cost.
- **Ingest.** `scripts/gis/import-taxlots.mjs --bulk` uses the county's whole-layer export: 123 MB
  in twelve seconds, against 438 paged requests the service serves very slowly through the
  large-lot ranges. The export is EPSG:3857, so `upsert_taxlots` takes a source SRID and PostGIS
  reprojects. The paged walk survives for a county with no bulk item.
- **Staying current.** NOT a re-ingest. The county stamps every lot with an edit date, and the
  churn is tiny: 3 lots in the week to 2026-09-02, 31 in the month, 1,462 year to date. So
  `/api/cron/taxlot-refresh` (nightly, 09:20 UTC, registered in vercel.json) asks what changed
  since the last clean run and pulls only those. The cutoff lives in `public.taxlot_refreshes`,
  not in code, and a run that could not read part of its window is marked not-ok so the next one
  re-covers it.
- **Where it draws.** `V3Atlas` takes `parcels`: the subject lot in full navy, its neighbours as
  hairlines. The listing page prints the assessor's acreage, the tax lot id and a link to the
  county record; the subdivision page draws the lots inside the plat. Both carry
  `TAXLOT_DISCLAIMER` — an assessor's map is not a survey, and it sits beside the map, never in a
  footer.
- **Where a plat's lots actually draw: `/communities/[slug]`, not `/subdivisions/[slug]`.** A
  registry community's subdivision URL redirects to the community route, so Tetherow and Awbrey
  Glen never ran the subdivision page at all. Both routes carry the parcel layer now (Tetherow
  320 lots, Awbrey Glen 220). Three traps in one afternoon on this read, all fixed and all worth
  knowing: the boundary row for a registry community is filed as `geo_type='neighborhood'`, so
  asking for 'subdivision' found nothing; **supabase-js omits a null argument**, and PostgREST
  answers PGRST202 for the missing overload, so the RPC defaults `p_geo_type` and the DAL omits
  it rather than sending null; and an empty answer is legitimately cacheable for a day, so every
  fix to this read needs a cache-key bump (now v3).
- **CMA — DONE (`64eb7ecf`).** A new section, "The land", after the sales that set the number, on
  both the print pages (`opinion-pages.ts`) and the web scenes (`opinion-scenes.ts`). It draws the
  subject's recorded lot and each comp's **at one shared scale**, which is the point: every parcel
  viewer fits one lot to one frame, making a tenth of an acre and ten acres the same size on
  screen. `lib/cma/parcel-shapes.ts` fetches, `parcel-silhouettes.ts` draws, 16 tests pin the
  judgment calls — when the spread passes 4:1 it says IN WORDS that each lot is drawn to its own
  scale (it never switches silently); price per acre shows only on an acreage comp set (median lot
  ≥ 1 acre), because "$4.5M an acre" on a fifth-acre house lot is arithmetic about a house; and a
  tile whose MLS and county acreages disagree prints both. Separately, `parcelAcres` had been
  computed since that morning and reached ONLY the audit LLM prompt — `factsPage` now prints it as
  "Lot, county record". `ci:cma-opinion-spine` bans pills from the seller CMA, so the badge is set
  in type.
- **FOUR COUNTIES NOW (`52cd703a`), 246,872 lots.** Klamath 61,227 (Klamath County GIS), Josephine
  41,751 (the county GIS coordinator's own account), and `jackson` 34,426 — which is the **City of
  Medford's** layer covering the CITY ONLY, because Jackson County publishes no attributable
  county-wide layer (the only county-wide copy on AGOL is an unattributed third-party snapshot).
  An Ashland listing draws no lot, correctly. Crook and Jefferson publish nothing, checked twice
  with two query shapes. Together the new three cover 4,750 listings against Deschutes' 3,134.
  Regrid remains the one-integration commercial option for uniform coverage.
- **THE READ HAD ALREADY BROKEN AND NOTHING SAID SO.** `taxlots_near_point` filtered on
  `st_dwithin(geom::geography, …)` while the index is `gist(geom)` on GEOMETRY; the cast puts the
  predicate out of the index's reach, so every call scanned the table. At 109K rows that fit
  inside the function's 6s timeout. At 247K it did not: **10,554 ms, parallel seq scan, 126,321
  rows removed by filter**. Every uncached listing page had silently lost its lot section. Fixed
  by putting an indexable bounding box in front of the geography test, sized in degrees from the
  caller's own latitude so the box strictly contains the circle — **16.8 ms on an index scan**,
  identical rows (migration `20260902220000`). `taxlots_in_boundary` was always fine: it filters
  with `st_intersects` on geometry. **Lesson: a predicate that casts away from its index is a
  seq scan that works until the table grows.**
- **Staying current for the new three is a SWEEP, not a delta.** None stamps a row with an edit
  date. Klamath advertises Sync, so it was asked for changes directly and answered "Change
  tracking is not enabled"; its DDate and Heliondate are one publish date repeated on every row.
  So they are swept from the CLI (`--county <key> --write`), and `lib/taxlots/refresh.ts` reports
  a sweep older than 60 days by name with the command that fixes it, instead of letting a county
  serve a stale map in silence.
- **Three importer traps, all found by running it.** The upsert sat OUTSIDE the retry, so a
  transient network error threw past the gap-recording code and Medford stopped at 22,000 of
  34,447 with nothing recorded — read, merge and write are now one retried unit. A lot filed as
  several polygon rows lost all but its largest piece (and its acreage with it), so the importer
  merges pieces into one MultiPolygon: 17 in Josephine, 21 in Medford. And **measure the id field,
  never assume it** — Medford's obvious `MAPLOT` is 32,487 distinct over 34,447 rows and would
  have dropped 1,960 lots invisibly; `ACCOUNT` is 34,426. Hosted feature services honour
  `resultOffset` with geometry (the Deschutes MapServer does not); always send `orderByFields`,
  both to stop unordered paging dropping rows and to put a split lot's pieces in one page.

**ROUND SIX IS IN (all seven surfaces).** Scores: reviews 66, subdivision 41, team-matt 62,
listing-bend 63, listing-noboundary 55, homepage 65, about 64. It caught FOUR regressions in the
round-five fixes, all now fixed and pushed:
- the `keepZeros` flag was wired from the chart props to the plot builder, and the builder is
  called with an explicit field list that omitted `run` — so the fix never took effect and a
  twelve-year record still drew four bars. **Check the call site, not just the flag.**
- moving the card out of the stage made it 26px wide on a phone (two columns in a 285px box), so
  a plat name rendered as "Aw" down four lines. The phone card stacks in one column now.
- the new mark readout was mouse-only: a tap fired pointerdown then pointerleave on lift, so it
  flashed and vanished, 0 of 10. A touch keeps it now.
- naming the type filter doubled the noun: "274 house houses for sale", because `nounFor` already
  returns the type's own noun when one type is on.
Plus two of mine it graded: pending carried the heaviest mark of the three states while being the
smallest population, and the key's sold mark was a ring where the map draws a disc.

**THE OPEN DECISION FOR MATT (round six failed the homepage AND the subdivision page on it):**
there are TWO maps of Central Oregon on the homepage — the living map hero, and 383px below it a
live Google raster in Google's own chrome (`PlaceFieldMap` in the `#homes` V3Field). The
subdivision page has the same shape, where the Google slab also printed 100 homes under an atlas
saying 15 (now labelled). Matt already made this call for listing pages: living map only. I did
NOT extend it unilaterally, because the Google field is bound to a list and the living map has no
list binding yet. Recommendation: build the living map's list binding, then retire the Google
field everywhere — it also ends a per-view map bill.

**ROUND SIX (workflow `wf_31de9f2c-235`, seven surfaces + a regression hunter).**
First result in: /reviews 66, no ship — five of seven round-five fixes verified landed (mark
separation 3.48px → 14px, a 4px-off click hits its own review, one tab stop, no clipped rows),
one PARTIAL (8px off: 6 of 10), and two NO that later commits answered (the focus ring's
contrast, and the field below the strip). The field was the failing reason: 25 quote cards,
3,264px at 1440 and 7,651px at 375, every control above them — TASTE's scrolling-list ban. The
strip is sticky now, so the quotes are read against the timeline, and a card lights its own mark
on hover, on focus, and on tap.

**PROCESS NOTE, learned the hard way:** round six was launched and then three more batches were
committed to the dev server it was grading. Freeze the tree while an evaluator round runs, or
point it at a pinned deployment — otherwise a finding cannot be tied to a build.

**EVALUATOR ROUND FIVE (2026-09-02, separate Opus agents, ten surfaces, measurements
in `/private/tmp/.../scratchpad/` and the workflow journal `wf_83ae7161-679`).** Scores:
homepage 80, listing-bend 75, team-rebecca 68, team-matt 64, about 62, reviews 76,
subdivision-chart 53, listing-noboundary 57. None shipped. These evaluators measure far
harder than the earlier passes — every finding carries a number read off the DOM.

Fixed and pushed in a0be7256: TEAM-MATT-1 (a bar run dropped its empty years, so a
nine-year gap was drawn as wide as a one-year gap — `buildBarPlot` filtered `value > 0`
back out of what `broker-record.ts` had filled in; a run now keeps zeros, categories do
not), TEAM-MATT-2/TEAM-REBECCA-1 (the source line counted regions handed over, not
outlines drawn: "36 places" over a map drawing 17), TEAM-REBECCA-3 (a closing's owner was
`ids[ids.length-1]` from an unsorted array, so the map and the ledger named all four of a
broker's closings differently — it is the smallest place by area now), TEAM-MATT-3/4 (the
claim named the price filter and never the type filter, and said "Tap a place" where none
are drawn), HOMEPAGE-1 (a `use` clone of a focusable path is focusable: 27 invisible inert
tab stops; clones are pointer-only and the map is ONE stop with arrow keys), HOMEPAGE-2
(seven property types on one alpha ramp put manufactured and house on identical navy and
pending between commercial and land — dots encode STATE only now, with a key printing the
same three numbers the claim does, and the type row is switches), TEAM-MATT-5/TEAM-REBECCA-2/
ABOUT-4 (400px of empty column beside the map while the chips that name every place were
display:none above 768px — chips now sit under the search at every width). Also the build
cost the street tier exposed: `outerRings` copied every plat coordinate per page to get a
bounding box, worth 31 rail timeouts and 57s of SSG; the box is walked without allocating
and memoised, and the next deploy measured 0 timeouts and SSG back to 99s.

In the tree at the time of writing (second batch, gates not yet run): the dots answer a
pointer (nearest mark within 14px, a readout of state, price, type and age — this is what
makes a no-boundary frame interrogable at all), the card sits under the map on a phone
instead of covering 100% of it, every chart rail label sits on its gridline (three separate
geometry faults: plot-relative fraction applied to the rail's full height, a rail stretched
to a taller grid row, and the phone's 28px reading band), the phone tick rule never hides
the last label, x ticks are centred on their bars, the price label prints the price actually
applied, the stage box is the painting (28.7% empty → 3%), and the false "a few sit just
beyond its edges" sentence is gone. Still open from this round: REVIEWS-1 (at 375 the strip's
marks overlap by two-thirds and a 4px miss opens the wrong review), ABOUT-1/2/3/10/11,
LISTING-BEND-6, LISTING-NOBOUNDARY-6/10.

**SHIPPED c5b56ed1 (2026-09-02, pushed, deploy verified separately): decision (1) — heat, split,
`?opening`, the `variant` prop and the `V3AtlasVariant` export are deleted; V3Atlas is dots-only;
the homepage parity.json carries `tasteReview` 86 and left the taste baseline (20 remain). The
primary worktree `RyanRealty-wt-home-opening-20260901` was fast-forwarded to it. After the push,
three Workflows ran in this session: an eight-surface evaluator round (homepage, listing Bend /
Redmond / a no-boundary city, team Matt / Rebecca, reviews, subdivision chart at 375; two skeptics
per verdict; a completeness critic), the roads-basemap research, and the listing-page research —
their findings are the next block above this one when it is written.**

**PASS FOUR (scratchpad `brokerage-eval-4.md`): listing map 74 (E1 label covers the dot), team 85
(D4), reviews 89 ships.** Fixed in c5b56ed1: E1/E9 (the home label wins its transform, clamped
inside the stage), E2 (the home's own plat is always outlined, cap or no cap), E3 (`outlinedOf`: "outlines
N of the M places with a recorded boundary"), E4/E12 (`is-stacked` mount for a narrow column), E5 (chips
rail capped at 24), E6 (`.v3-atlas__door`), E7 (sold dots drawn, lighter), E8 (a second dedupe pass
falls back to the recorder's raw string), E10 (the held home dims under a filter but keeps its mark),
E11 (places take keyboard focus; Enter pins), E13 (a city with no recorded boundary frames its own
listings — one section for every listing), E14 (phone tick thinning from four ticks), D4 (a closing
counts in the smallest place holding it), D5 (a record map draws only the places it touches), D9 (the
beyond-frame sentence follows the filter).

**BROKERAGE PASS TWO (scratchpad `brokerage-eval-2.md`): /reviews 87 · /contact 72 · /about 85 —
all three SHIP; /team/[slug] 74, no ship.** All 13 pass-two claims verified TRUE. Closed in
9177b29b (evaluator pass three is measuring it): C1 (a record map frames its dense core by an IQR fence per axis; dots beyond the frame
are counted and NAMED in the source line, never silently clipped — the Ashland closing), C2 (bar
runs get the hover layer; a broker's years are `run: true`, one ink, no legend restating the axis),
C3 (the Proof claim says "the newest three/two" from the count), C4 (a close date is a calendar
day: `CloseDate.slice(0, 10)` before formatDate, in the ledger and the stamp), C5 (a record map's
chips list only places the record touches), C6 (the valuation sheet's consent line sits inside a
v3-rooted section), C7 (the broker's ledger is every MLS closing, the same set the figures and map
count — `brokerageTileToRow(tile, { anyArea: true })`; the brokerage feed keeps its 977 filter), C8
(E.164 tel/sms), C10 (the reviews strip is one tab stop; arrows walk the marks), C11 (About header
comment). Open: C9 (/about fires two /api/visitors/track POSTs per load; automated reloads trip
the endpoint's 429), B12.

**BROKERAGE PASS THREE (scratchpad `brokerage-eval-3.md`): /team/[slug] 74 → 82, /reviews 88.** All
ten pass-three claims TRUE. Closed in 84223da2: D1 (a record map's nature comes from the whole
population, never the filtered counts — an empty price filter no longer turns it into a for-sale
map), D2 (year ticks stay years; the partial year says "to date" in its reading and the claim
prints the count), D3 (a bar rail's floor reads 0, never the last bar's value), D12 (the reviews
strip's tab stop rests on a mark the filter shows). Also closed: D7 (the
valuation sheet's consent line wears the register's ink and a 20px box via `.v3-sheet__consent`),
D8 (that section is `#home-value-ask`, no duplicate landmark name), D10 (a closing of a type the
atlas does not name gets its own toggle), D11 (a run charts every year between first and last,
empty years as zero bars), D13 (sale-rows header). Open, in the Atlas: D4 (a closing inside two
overlapping places counts in both chips), D5 (outlines with 0 closings still open a card on a
record map), D9 (the beyond-frame sentence ignores the filter). D6 closed: every bar run, however
short, prints its ticks under its bars.

**LISTING PAGE — STARTED (84223da2, finished for the map in c5b56ed1): the living map around this home.** `app/listing/[listingKey]/
_v3/listing-atlas.ts` reads the recorded neighborhood boundary by slug (else the page's city
boundary), `buildPlaceAtlas` scoped to it, the plats as doors; the page mounts `V3Atlas` with
`highlight={{ key: listingKey, label: 'This home' }}` (new prop: the held dot + a label) in the
location map's slot, the Google map as the fallback when no boundary resolves; the listing parity
contract binds V3Atlas. Measured on 2533 Pine Terrace: "Awbrey Butte around this home", 75 for
sale / 24 pending / 11 sold, 99 dots, 80 plats, this home held. The rest of the listing plan below
is NOT started.

**LISTING PAGE — THE NEXT CLASS (surveyed 2026-09-02).** Measured on
`/homes-for-sale/bend/awbrey-butte/rivers-edge-village/2533-pine-terrace-220223522` at 1280:
13,030px tall, 23 sections, 119 images, 104 buttons, 1 chart, 3 map surfaces, 1,817 words — the
data is all there (payment calculator, schools, sale history, "how the ask sits against nearby
sales", Bend market chart, parks, guides, trails, rental analysis, similar homes) and it reads as a
scroll. Its parity contract binds 26 components (`ui_kits/listing-detail/parity.json`). The plan,
design-the-class: (1) the photo stage with the ask and three facts, a contact rail that stays; (2)
one "this home in numbers" Instrument holding the comps chart and the ask-vs-nearby figures; (3) the
living map scoped to the plat/neighborhood with THIS home's dot held (V3Atlas needs a `highlight`
dot) in place of the static location map; (4) the neighborhood's character + a Proof band; (5) the
long tail (schools, parks, trails, guides) as one V3Doors row, not five sections; (6) the payment and
rental instruments kept, as instruments; (7) similar homes as a strip. Execution-grade plan first,
then build, then the evaluator. Do not start it without reading TASTE.md and the listing parity note.

**Next program (the place-page class), in order:**
1. ~~The homepage OPENING as a real interactive data experience~~ — built, see IN FLIGHT.
2. Design the place-page class as a composed page, not stacked sections: an interactive
   property-type × subdivision display (hover/toggle/scrub reveals the cube), the closed-sales
   moat made visible, the map cells carrying per-type counts (punch-list item 6), and the
   named page to beat per place written into each parity.json. Build 2–3 variants, decision
   sheet for Matt, delete the losers.
3. Listing pages and brokerage pages (about/team/profiles/reviews with pullable GBP reviews)
   through the same ritual.
4. CMA: subdivision-story vision migration, real rebuild proof, then the review-queue send
   agent (Matt reviews every send until he flips automation).

**Lane split with the concurrent session (ryanrealty-9e):** I own the CMA ENGINE
(judge/audit/xAI) and the public UX; they own CMA DELIVERY (`app/admin/(protected)/cmas/**`)
and the logged-in browse/save UX. Shared checkout: stage only your own files; message before
pushing if the other has uncommitted work in your path.

---

# Current — 2026-09-01 (Claude Code admin/delivery session, main, through `b583dc63`) — Messages fold FINAL, CMA send queue, gap-audit sweep

**Shipped on origin/main, production READY, live-verified in Matt's browser:**
- Messages fold FINAL: `/admin/crm/inbox` 307s to `/admin/messages` (config redirect, legacy
  `?folder=` mapped in the page), 19-file tree deleted. Capability parity held: SMS AI pills +
  per-contact template render ported into `ComposeSurface` text mode
  (`components/admin/crm/TextDraftTools.tsx` + `getSmsComposeTemplatesAction`); multi-select
  bulk triage became folder-level Done-all (`QueueDoneAll`). Gate cascade updated
  (admin-v2-tokens scan list, email-quality, crm-mobile-track, help/smoke/e2e route lists,
  streamed-redirect baseline, crm-screens contracts repointed).
- CMA delivery (Matt: review-first until he flips automation): `/admin/cmas` fronts
  "N people asked for a value and never got it" as a door to the new `?status=asked` facet
  (seller-lp/lead-form undelivered, oldest first); the send dialog prefill is AI-drafted
  source-aware via `lib/grok` textFast (form ask = "here is what you asked for" + apology when
  old; expired = sorry-it-didn't-sell; FSBO stays templated; template fallback on any model
  failure). Nothing sends without Matt in the dialog.
- `parseCmaAddress` strips trailing unit designators (Unit/Apt/Ste/#) — two form-asker
  addresses now resolve (pinned in subject.test.ts); `rebuildCmaAction` preserves the original
  `request_source` (was stamping admin-rebuild, ejecting rows from the asked queue).
  `cma-1617-nw-8th` REBUILT successfully via the marketing_brain_actions rail → the asked
  queue now holds 9 sendable documents.
- Identity: rr_vid carryover at session birth (`/api/visitors/track`) + map-first widening in
  `getLookingAtNow` — stitched returners reach the looking-at SMS wake and Today lane.
  Guest listing-save capture auto-absorbs into the verified account person on sign-in
  (`lib/crm/absorb-guest-capture.ts`, P12 fail-closed posture; Matt confirmed keep).
- Google sign-in: official GIS control on /login//signup/save-gate with a REQUIRED visible
  fallback (`GoogleOneTap` `fallback` prop) — GIS pins its iframe 0x0 for Google-signed-out
  visitors (memory: gis-button-zero-size). Personalized "Continue as Matthew" verified live.
- Admin gap-audit sweep: 5 orphaned expired/fsbo dashboard actions + 4 dead sync components +
  `testListingHistory` deleted; calls report's fabricated "0 calls made" now says "not
  tracked"; 6 serial-await pages batched; `/admin/users` migrated to admin-v2 ReportGrid
  (shadcn burndown 78→75); 4 analytics pages' raw reads moved into `lib/data/analytics/*`
  (agent worktree, cherry-picked as `17f2322c`).

**In flight, resume these:**
1. DEAD-CODE SWEEP AGENT (worktree `.claude/worktrees/agent-aba84bded80d98abd`): deleting 18
   fully-orphaned `app/actions/*` files (16 zero-importer + crm-deals.ts/listing-views.ts
   transitive chains), full audit report in this session's task log. When its commit lands:
   review the diff, cherry-pick to main, run full gates, push. The same audit's §3 list
   (~100 orphaned VALUE exports across 41 live action files) is a queued follow-up slice.
2. TWO CONDO ASKED ROWS refuse comps after the parser fix ("0 qualifying closed comps"):
   `cma-141-sw-15th-unit-21`, `cma-1833-sw-canal-unit-24-redmond-97756` — actions sit
   'pending' on the rail and will retry+refail. Engine question (comp selection for condo
   units), engine lane's call whether to widen or leave the honest refusal + a manual note.
3. Remaining asked-queue classes: 9 sendable now at `/admin/cmas?status=asked` (Matt reviews
   each send in the dialog); 5 rural comp-refusals need a product answer (honest "no
   defensible comp value" letter?); 2 never-MLS-listed + 1 out-of-area are correct refusals
   pending D2 (assessor-backed resolver).

**Queue (docs/plans/ADMIN_PRODUCT/work-queue.json):** tablet-width CRM layout, phone-width
walk via dev harness, gclid capture, cma-performance personId threading, and the
app/actions §3 export-trim slice.

---

# Prior — 2026-09-01 (Claude Code UX session, main) — subdivision 500 P0 killed + place-flow punch list

**Shipped `c83043a7`, production READY, live-verified.** Every `/subdivisions/[slug]` URL had
served a 500 to every visitor since 2026-07-15 (5,448 errors / 764 users in Vercel's window):
empty `generateStaticParams` left the route classified SSG, every request attempted a static
render, and PlaceSplitView's session read (`cookies()` via `getSession`) threw
DYNAMIC_SERVER_USAGE with no build-time bailout to absorb it. Fix: `force-dynamic` on the plat
route (the sibling place routes are already de facto dynamic — their build-time prerenders trip
the bailout and Next silently reclassifies), `withTimeoutFallback` now `unstable_rethrow`s Next
control-flow errors, and the G70 contract in `site-contracts.test.ts` pins the new truth. Same
commit: neighborhood subdivision ledgers dedupe through `displaySubdivision` at
`getCommunitiesInNeighborhoodLite` (Larkspur showed four Cessna cards and a `********` card
linking `/subdivisions/unknown`) and sort actives-first before the 12-card cap.

**Matt's directives this session (standing):** the place hierarchy (neighborhood ⊃ subdivisions,
master-plan community ⊃ subdivisions) + listing↔place flow is the competitive moat — keep
refining continuously; and NO FRANKENSTEIN: one style system, all pages same look and behavior.

**Place-flow punch list (found by browsing prod + local prod build, in priority order):**
1. ~~Card-vs-page population mismatch~~ **SHIPPED `cd837385`, live-verified**: cards bin SFR
   (matching their printed trace and the destination's counted set), unresolvable plats are
   dropped, and the plat page gained path 3b (direct SFR tile read by MLS name) so plain
   recorded plats like Pettigrew Place render instead of refusing. Live check 2026-09-01:
   all 12 Larkspur cards land on rendering pages, zero dead ends.
2. **PARTIALLY SHIPPED (c1cc10d3):** place-page shells are now visitor-independent — the
   cookies() reads moved client-side (useViewerListingState), killing the 500-class risk for
   good and cutting per-render work. MEASURED RESULT on prod: Vercel still serves
   `cache-control: private, no-cache` on dynamic renders — the next.config s-maxage headers
   are overridden for dynamic routes (the /homes-for-sale one always was, too). Actual CDN
   caching needs the routes to stop reading searchParams during SSR (client-read URL filters)
   or Next 16 cacheComponents / 'use cache' adoption — that refactor is the remaining half.
   Old framing: place pages run per-request with `revalidate=60` theater fleet-wide — real ISR means moving
   session-dependent reads (session/saved/liked in PlaceSplitView) behind a client or Suspense
   boundary. Big TTFB/cost win; belongs WITH the restyle program, not against it.
3. ~~Community child-subdivisions Ledger~~ **SHIPPED `6ccabc03`, live-verified**: registry
   children counted from the same city SFR set as the face, named via publishPlatDisplayName,
   Quiet keeps prose only (duplicate links + local ALIAS_DISPLAY map deleted), sectionOrder
   contract updated with the page. `getCommunitySubdivisions` RPC remains unconsumed — still
   available for a spatial (non-registry) enumeration later.
4. MLS alias → recorded plat mapping incomplete (PLACE_MEMBERSHIP_MISSION W1, soft-404 class).
5. Vercel error noise: `pages/500.html` ENOENT when a 500 is served (app-router error page gap).
6. **Matt 2026-09-01 — per-type breakdown per child place:** on a neighborhood/community page,
   each subdivision cell/card should break out its property types ("Subdivision 1: 5 townhomes,
   Subdivision 2: none…") — the map cells shipped in f10ee055 carry activeHomes; extend the
   community_subdivisions RPC (or bin from tiles) to per-type counts and surface on cell
   hover/click and the Subdivisions ledger rows.
7. **Matt 2026-09-01 — place+type SEO landing pages:** the type cards ("33 Single-family in
   Black Butte Ranch") land on `/homes-for-sale/...?propertyType=A&propertySubTypes=...` — a
   query-string search result. Matt wants a dedicated crawlable page per place+type with real
   content and onward exploration links (no dead ends — every page keeps the visitor moving to
   sibling types, child/parent places, market context). Design consideration: SSG budget +
   sitemap cost (thousands of place×type combos — index only combos with inventory or sales
   history; the rest render on demand, noindex). Also carries f10ee055's one-source count rule.

**Coordination:** concurrent ADMIN session shares this checkout (admin v2 work, db126181+).
File-ownership agreed in-session; the misleading "other-session TEMP-DIAG" stash was dropped.

**RESTYLE DISPOSITION EXECUTED (2026-09-01, Matt's continuous-work directive):** PRs 166–169
closed by deleting their branches after archiving every tip as `archive/cursor-{city,
neighborhood,community,subdivision}-restyle-*` tags — all commits recoverable, main is the one
restyle direction. The valuation branch/PR stays open: its 3 own commits cherry-pick clean and
whether that look ships is Matt's call. Verdict details below.

**RESTYLE PR REVIEW VERDICT (2026-09-01, full three-way analysis, both reviewing agents'
reports in this session).** The "five PRs" are ONE serial stack off base 2eba920b (Aug 28):
listing → land-face → homepage → search → sell → valuation → city → neighborhood → community
→ subdivision. `cursor/subdivision-restyle-3f5a` is the tip and contains everything.
Findings: main has independently shipped its own restyle of the same pages since Aug 29
(PlaceFaceStrip + PlaceAreaHero + PlaceSplitView + publishPlaceFace — the Grok/Claude work,
f5336df1 and after), so the stack and main are two mutually exclusive architectures, not a
rebase. Landing the stack would (1) resurrect `revalidate = 60` on the plat page — the exact
production 500 fixed in c83043a7; (2) revert the Eagle Crest camera fix and displace the
Redfin-badge and listing-map work; (3) fail ci:mockup-parity/grain gates on any partial mix
(parity.json + page.tsx must come from one side). Rebase effort is a re-implementation.
**Recommendation: close PRs 166–169 (keep branches for intent-mining — the Stage/HomesField
modules, ListingGallery consolidation, and the *-html-gate scripts are ideas worth
harvesting), and treat main as the one restyle direction.** Exception: the valuation branch's
OWN work is exactly 3 commits (075229ca, 1bbbb141, c770cd31 — /sell/valuation Stage + cream
address sheet + html gate) that cherry-pick onto main with zero conflicts; land or skip on
look alone. Matt's hero-verdict demotion rides with whatever restyle work lands on main next.
Matt directed the review 2026-09-01; PR disposition awaits his read of this verdict.

# Prior — 2026-09-01 (Claude Code, main) — Grok place-page leftovers rescued + shipped

**What shipped.** The 2026-08-30 Grok session died on credits with its final commit stranded
locally AND non-compiling: G46 failed on `components/search/PlaceSplitView.tsx` (tsc cannot
narrow `props.listings` through the aliased `mustSearch` condition). Fixed with a coalesce in
the else branch, amended into the same commit, full gates 150/150, pushed as `f5336df1`
("Eagle Crest map camera, lots thumbs, and leftover extras") — **production deploy verified
READY on Vercel.** Follow-up `054e1062`: `publicSegmentVerdictLabel` now returns
"buyer's market" / "seller's market" / "balanced market", because a segment with MoS
null/0 printed the verdict alone (Redmond Townhomes card read "BUYER'S" with nothing after
it). Push pending the gates re-stamp (this session).

**Open questions Matt raised (Grok session died before answering), with the analysis:**

1. *"We ask what type of market but display the answer in the hero."* Verified on live
   `/cities/redmond`: `publish-place-face.ts:81` puts the verdict in the hero face strip in
   the same Amboqia numeral treatment as the price, while the Quiet FAQ below asks "Is
   Redmond a buyer's or seller's market?". The FAQ restating hero figures is deliberate
   (FAQPage JSON-LD + the MoS reasoning). The hero treatment is the deviation:
   PUBLIC_UI.md §3 city row says **"Verdict is a caption, never a number hero."** The
   in-flight Cursor city-restyle (PR 166) already moves this way ("Kill the buyer/seller
   H2... mid-page tightness sentence"). Recommendation: demote the verdict from a face-strip
   numeral to a caption; do it inside the restyle PRs rather than on main to avoid a
   collision. NOT done — Matt's call on whether main gets it before PR 166 lands.

2. *"Is it normal for some content to go full width and others constrained on the same
   page?"* Yes, and it is the spec: Broadside runs Stage/Field/photography full-bleed and
   unframed; everything else sits on `--v3-measure` (72rem), prose on `--v3-measure-text`
   (44rem). The Eagle Crest about-paragraph-with-empty-right-column is the 44rem text
   measure inside a 72rem section — the Stripe/Linear "large quiet margins" foundation, not
   a bug.

**Verified-not-bugs (do not fix):** place-type-card "clipping" on `/cities/redmond` is JPEG
screenshot illegibility — DOM shows every bit intact and wrapped (`scrollWidth ==
clientWidth`). The blank cream bottom-of-page screenshots are unpainted-capture artifacts —
sections tile contiguously (measured, no gaps).

**Context a follow-on needs:** the live restyle program is the Cursor PRs 165–169
(`cursor/city-restyle-ba64`, `cursor/community-restyle-0404`,
`cursor/neighborhood-restyle-cfa4`, `cursor/subdivision-restyle-3f5a`,
`cursor/valuation-restyle-942b`) — Stage then one Field, fewer H2 stacks, tightness
sentence. Do not build a competing direction on main. Matt's standing directives this
session: LOOK at rendered screens after building (screenshot + read it, tests are not
verification), work inside the v3 system + THE LOOP, no one-offs.

Skills read: `frontend-design`, PUBLIC_UI.md, loop-brief. Commits: `f5336df1` (deployed),
`054e1062` (pending push).

# Prior — 2026-08-29 (Grok Build) — bulk email signature + from-line

**Surface:** `/admin/crm` Batch Email and `/admin/email/compose`. Goal: `docs/plans/ADMIN_REBUILD/BULK_EMAIL_SIGNATURE_AND_FROM.md`.

Signature defaults on (Gmail-matched via `getSignatureForMailbox`). Preview, test send, and the cohort worker share `composeOutboundHtml`. Default From is the named identity on `mail.ryan-realty.com` with Reply-To the real mailbox. Sending from Gmail (`matt@ryan-realty.com`) is an explicit option with a daily-cap warning. Live test copy: From `"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>`, Reply-To `matt@ryan-realty.com`, signature in the body.

Skills read: `endtoend`, `tdd`, `frontend-design` (admin v2 only). Do not fire the 2,714-person River West send from an agent session.

> **GROK BOTS:** start at `docs/GROK_BOT_BRAIN.md`. Do not load this whole file. Matt asked 2026-08-21 to re-arm the loop on current main.
> **FLEET + MAP:** Enterprise Map SoR = `docs/plans/ENTERPRISE_MAP/` — start `SESSION_HANDOFF.md`. **Company start ritual (THE LOOP v1.6.0): `npx tsx scripts/loop-brief.ts`** (work graph + scoreboard + next ship class), then the version manifest `docs/plans/ENTERPRISE_MAP/VERSION-1.md`. Blast-radius required. Stranded ledger domains are frozen (mechanical); manifest shrinkage fails G56. Full open list: `ALL-OPEN-ITEMS.md`.
> **NEWEST SUBJECT: Reality Law retired. Place chrome may be reference-conditioned. Do not invent a listing.**
> Prior: Form catalog T2.1b LIVE `caa92e2a`. Incoming agent referrals LIVE `b4bf6b8d`. Seller net `104c01cc`.

# PUBLIC SITE ENDTOEND COMPLETE — 2026-08-27 (Claude Code, main)

Every one of the 20 public page contracts (`design_system/ryan-realty/ui_kits/*/parity.json`)
now audits clean: zero open items in `openDefects`, claim-wrong resolutions kept with
reasons. Shipped through `22e390c4` (defect closure itself is `66bf4f15`; the audit waves
are `5ce0570c`, `1d73657c`, `8083df83`, `43d9f305`). Production deploy verified serving the
fixes on ryan-realty.com. Gates 165/165, 15,376 tests, tsc clean.

Things a follow-on session must not undo:
- The page-purpose gate binds sectionOrder + competitiveTarget; a page change that breaks
  its plan fails `ci:page-purpose`. Update the contract WITH the page, never delete items.
- Hub/region market heroes are LIVE-FIRST with 2025 closed-year figures following; stamps
  compose through `publishInstrumentStamp` (no `??` clock coalescing — gated).
- One ask per market page: the inquiry form. Do not re-add Value-my-home/Sell doors to
  content sections.
- One HOA figure per community page, measured basis outranking the registry estimate
  (`lib/market/publish-place-hoa.ts` `measured` tier).
- `listingDetailPath` guards the 'Outside Boundaries' sentinel for every URL surface.
- Two live-DB int tests were re-expressed to producer contracts (archive leftover-overlay
  years; subdivision snapshot-as-of-computed_at) — see `66bf4f15` message before touching.

# CMA/BPO IS CLAIMED — one tree, 2026-08-27 (Claude Code)

**Matt 2026-08-27: "roll up the entire CMA process... a number of sessions touching CMA work
right now, consolidate into one tree."** All CMA and BPO work now belongs to
`RyanRealty-wt-cma-20260827` (branch `wt/cma-20260827`). If you are not that tree, do not
edit `lib/cma/**`, `lib/data/cma/**`, `app/admin/(protected)/cmas/**`,
`app/admin/(protected)/bpo/**`, `app/actions/cma-*`, `app/actions/bpo-*`, or
`app/api/cron/cma-build-worker/**`. Hand the request over instead.

**The consolidation found nothing to merge, which is the good news.** Two sessions held CMA
commits (`0dfe5fd4` market-area product classes, `d2b07bab` band inventory); both had already
pushed by the time the tree was cut, and every file was byte-identical to `origin/main`. The
tree is simply current main: 646 CMA tests pass, tsc clean, 238 code files and 84 test files
across the surface.

**The open work, measured 2026-08-27, is delivery — not the builder.**
`public.cmas` holds 359 rows: **340 still `draft`, 9 ever `delivered`.** 288 carry a real
client email and were never sent. The build worker's own docblock says why:
*"BUILD ONLY — never sends anything. Drafts surface at /admin/cmas."* Meanwhile
`app/lp/seller-home-value` publicly promises the report "lands in your inbox within one
business day". The build is automatic, the send is a human step nobody takes.

Split by origin, because it decides what is owed: **18 asked** through the valuation form
(6 built and unsent, 12 never built); **270 nobody asked for** (112 expired-listing
auto-builds, 156 bulk) — those are cold outreach and stay behind §1 approval.

**Two distinct build failures, and only one is a bug.** 16 fail on comps ("Only 2 qualifying
closed comps found (minimum 3)" — La Pine, Sisters, rural; the builder is RIGHT to refuse).
7 fail on address matching, and at least one of those is a genuine defect: **1617 NW 8th St,
Bend is in `listings` right now as Active** and the builder still reported it unmatched.

**What Matt asked for next (2026-08-27), in order:** fix the address matcher first, then an
SMS alert when a CMA is prepared carrying a review link, opening a surface where he can
approve / rebuild-with-notes / send to recipient — "super intuitive" — plus auto-send as an
option he can switch on. Two things still to settle with him: whether "rebuild with notes"
adjusts the valuation inputs or just annotates for whoever prepares it, and whether auto-send
covers only form requests or everything.

Full triage list (18 named, with why each failed):
https://claude.ai/code/artifact/59cad4eb-0a80-4b04-afaf-cabf5cb8c0ac

# Current — 2026-08-26 (Claude Code) — resort membership audit: 23 false children removed, now gated

**Surface:** `origin/main` `238c2f31`.

`data/resort-communities.json` → `subdivision_aliases` is rendered as a literal
"Subdivisions in X" claim by THREE components (KbResortOverview, peerPlatsForResort,
and `buildPlaceKnowledge`'s subdivision doors — that third one is easy to miss), and
it also SCOPES NUMBERS: the alias-aware active count, the community market scope, and
`lib/cma/resort-guard.ts`, where a false alias makes an ordinary home price as a
resort home. Most entries earned their list from a ">=80% inside-test" that infers
membership from listing PROXIMITY. Awbrey Glen was fixed in `05917a61`; this pass
finished the other nine. **23 removed** (tetherow 7, northwest-crossing 7, broken-top
4, eagle-crest 3, crosswater 2, brasada-ranch 1) — about 2,900 closed sales had been
mis-flagged as resort property to the CMA comp guard.

**The lesson worth carrying: the POLYGON is sometimes the thing that is wrong.**
Three entries would have lost CORRECT children to a containment rule.
- **Crosswater** — Matt asked for research instead of a geometry call. Osprey Pointe
  Condo STAYS: its recorded declaration (Deschutes 97-33704, Bk 462 Pg 1137) names
  Crosswater Owners' Association as master association. It is a condo carved OUT of
  Crosswater, so a union of the Crosswater plats necessarily misses it. Pace Estate
  and Lisle Acres removed (no HOA, no CC&Rs, across the river).
- **Three Rivers** — keeps all 11. It is a 4,819-acre CDP of 20+ subdivisions; the
  polygon is the DRRH plat union alone (2,503 acres, 51.9%). The 8 aliases that fail
  containment sit CLOSER to the CDP centre than the 3 that pass. **Widen the polygon**
  — that is the open follow-up, logged in the entry's `verification` block.
- **Black Butte Ranch** — Country House Condo is 0/5 inside a homesite-section union
  that omits the condo tract, but 6/6 of its listings carry MLS City='Black Butte
  Ranch'.

Also: Matt's "3 rivers homesites north of bend" is a DIFFERENT PLACE — MLS
`3 Rivers Rec`, 535 listings, City=Culver 97734, Lake Billy Chinook, Jefferson County,
56km NW. No registry entry, no page. Never merge it with `three-rivers`.

**Gated:** `ci:resort-membership-evidence` fails the commit when an alias has no
measurement in `verification.confirmed[]`, when a `pct_inside` does not recompute from
its own counts, when a sub-50% row carries no written evidence naming another query
shape, when `child_count` drifts, or when an entry re-declares the proximity method.
`scripts/resort-membership-baseline.json` is EMPTY — all 19 communities are evidenced.

**Open, filed but not fixed (pre-existing, wider than this change):**
`/communities/<city>-<anything>` renders an `index, follow` page with a self-canonical
for ANY name — proved with the never-registered control
`/communities/bend-some-ordinary-plat`. The 23 names now land in that unbounded bucket
instead of 308-ing. The fix is a junk-slug guard on the /communities route (and the
streaming trap means the redirect must come from middleware, not the page body).

Also fixed here: `generateMetadata` on `/subdivisions/[slug]` titled ~3,200 non-registry
plat pages "Central Oregon, Oregon". It now takes the city from the indexable set it
already fetches.

# Prior — 2026-08-26 (Claude Code) — CMA client document, FSBO first touch unblocked, dashboard gap closed

# Current — 2026-08-26 (Claude Code) — Grok Studio: the social/media producer rebuilt

**Surface:** `origin/main`. Matt: "rebuild our social media / media content
producer using grok imagine and all of the other grok features, easy and
streamlined" + "we cannot have slop at all ever no way."

**Canon to read first: `docs/GROK_CRAFT_CANON.md`.** CLAUDE.md §4 now points at it.

**Shape.** `lib/grok/` is the ONE Grok transport (client / text / image / video /
vision); `lib/grok-*.ts` are shims. `lib/studio/` is pure + adapter-injected
(`craft` builds every prompt, `formats`, `slate` is the editorial layer,
`produce` is the one pipeline, `caption`, `spend`). `lib/data/studio/` is the DAL.
Console `/admin/studio`, cron `/api/cron/studio-slate` (13:10 UTC daily). Drafts
are `marketing_brain_actions` rows, so the existing approval queue and
`publisher-sweep` still own publishing. Nothing auto-posts.

**The anti-slop method:** hero still → Grok vision inspects it against a closed
defect enum → ONE regenerate on the inspector's own fix hint → kill. Only a
passing frame gets animated. A real MLS photo is never generated or restyled.

**Verified live, not asserted:** listing_motion $0.483 / 95s; place_video $0.567
(vision scored the frame 86/100, no defects). Clip is 1088x1920, 6.04s, no audio
track, house geometry holds across the push.

**Three API facts that cost real money to learn** (in
`.claude` memory as `reference-grok-api-surface`):
- Live Search is DEAD (HTTP 410). Research is `/v1/responses` with
  `web_search`/`x_search`; citations are in `output[].content[].annotations[]`.
- `generate_audio` DEFAULTS TRUE on video. Forced false.
- `cost_in_usd_ticks` does not reconcile (~5e-12 USD/tick text vs ~5e-11 image).
  We price from the published rate card. **Do not price from ticks.**
- Open-ended search costs ~$2.60-$3.18 per question; the same craft question as a
  structured `/chat/completions` call cost ~$0.01 and answered better.

**Two silently-empty query shapes found by counter-query, now gated
(`ci:studio-geo-contract`):** SFR is `property_sub_type` (bare lower case;
`PropertySubType` errors and reads as empty), and `geo_type='community'` has ZERO
rows in BOTH `market_pulse_live` and `market_stats_cache` — resort communities
live under `neighborhood`. Note `market_pulse_live` NOW has 28 neighborhood rows;
the older "zero neighborhood rows" note is stale.

**New gates:** `ci:grok-models` (nightly, needs XAI_API_KEY) and
`ci:studio-geo-contract` (static chain). `ci:claude-canon` was red on main from a
legitimate vendor-name detector regex in `lib/data/analytics/captureDoors.ts`;
fixed with an inline `@vendor-name-detector` opt-out rather than a silent
allowlist.

**Open / next:** trend_reactive and market_pulse formats are built and typed but
have not been run live end to end (listing_motion and place_video have).
`/admin/studio` renders behind admin auth and was verified by compile + the cron
path, not by a signed-in browser pass.

# Current — 2026-08-26 (Claude Code) — CMA client document, FSBO first touch unblocked, dashboard gap closed


**Surface:** `origin/main`. Continues the "buyer/seller journeys" block below.

**CMA — READ `marketing_brain_skills/producers/cma/SKILL.md` BEFORE TOUCHING THE
ENGINE.** Matt stopped a change mid-flight with "you must know how we do cmas
before implementing anything". Two of my first instincts were wrong:
- The missing comp subtype filter I flagged was ALREADY FIXED (hard product-type
  exclusion, Fannie Mae B4-1.3-08, `6f37d466` Aug 23). The CMA I judged was built
  Aug 12 and predates it. Judge a FRESH build, never an old artifact.
- Unknown subtype FAILS CLOSED on purpose (SKILL.md:275) — `PropertyType='A'`
  once mixed 14% attached/manufactured into Bend sales, "that is how Santorini
  townhomes appeared next to an SFR". Never loosen it.

Shipped:
- `6148d113` **recommended list no longer prints at its own floor.** Not policy,
  a collapse: `recommended` is Method 3, and when the method spread landed at or
  below it the clamp pulled `conservative` DOWN to meet it and flattened the
  band ("$395,000 · supported range $395,000 to $420,000"). Now the midpoint.
  STAYS WITHIN SUPPORT — SKILL.md §4 step 9 forbids the engine listing above
  support unilaterally, and the accuracy contract hard-checks
  conservative <= recommended <= highEnd. A broker priceOverride is untouched.
- `59733785` **stale photo, plain English, neighborhood wording.** The
  aerial-fallback rule was locked 2026-06-13 and only HALF built: heroForSubject
  had no age check (a Jan 2023 photo led a 2026 pricing document) and its
  no-photo branch returned null — the blank the directive forbids. Staleness is
  24 months, matching the contract's comp-recency window. "Capped by method
  spread 6%" is now plain English, and the Bend-only mesh no longer tells every
  Redmond/Sisters/Sunriver/La Pine seller they sit "outside every mapped
  neighborhood polygon".

**Property-type comp coverage — DECISIONS MADE, CODE NOT WRITTEN.**
`productClass` maps only detached / attached / manufactured-on-land /
leased-land / coop. Everything else returns null and `productTypeCompatible`
fails closed, so those subjects get ZERO comps and cannot be CMA'd at all:
**1,652 closed sales in 12 months, ~15% of inventory** — Residential Lots 773,
In Park 429, Duplex 136, Recreational 89, Agriculture 63, Multi Family 41,
Quadruplex 41, Commercial 35, Rangeland 15, Triplex 15, Industrial 9,
Investment 4, Timeshare 2.
**Matt's grouping:** land = EACH TYPE SEPARATE (lots comp only to lots, ag to
ag); multi-family = 2-4 UNITS AS ONE CLASS. Give each its own ProductClass so
exact-match still holds. This is the next piece of CMA work.

**FSBO first touch — was dead, now live.** `fsbo-first-touch-v1` had
`is_active = false` and `sendProspectingIntro` hard-fails on an inactive
template, so EVERY FSBO first touch failed while expired worked (expired revised
Aug 6, FSBO untouched since Jul 15). Rewritten to mirror the expired body (169
chars, one segment, service pitch moved into the CMA the link opens), voice
clean, activated with Matt's approval. Everything else on that path was already
built and well guarded: quiet hours, ensureNativeLead, person AND phone-keyed
suppression, token fail-close, short-linking, `_pid` stitch.

**Dashboard.** Most of the Phase 4 list already worked — saved homes carry Share
(native sheet, SMS, WhatsApp, Facebook, X, LinkedIn, copy) plus
like/save/remove via ListingTile's CardActionBar; hidden / saved-searches /
collections / history all render. I nearly built a duplicate share component
before checking. The real gap was no CMA/home-value entry in the account
dashboard; added to AccountNav as "Value my home" (ci:brand-voice rejects
"What's my home worth?" as a CTA outright).

**Booking.** Google Calendar merged into availability for all three brokers
(`bc311742`) after Matt asked whether scheduling read the calendars — it did
not. Read via a NEW `getGcalBusyIntervals`, because `getGcalEvents` collapses a
failed API call into an empty list, which here would publish a free week.
All-day events are skipped: the CRM writes its own TC milestones into that
calendar and counting them is what showed 4 bookable days out of 15.
Consequence: an all-day "Vacation" does not hold time, use a timed event.
Hours Mon-Sat 09:00-17:00.

**Open**
- Property-type comp coverage (above) — the next CMA task.
- CMA PDF right-margin overflow on the adjustment grid at high comp counts.
  Pre-existing, verified on a clean tree, running in its own session.
- Overlapping saved searches still send simultaneous near-duplicate emails.
- A zero-match alert still tells nobody (4 of 24 active alerts).
- 332 CMA drafts vs **2** real client deliveries (the other 5 "delivered" are
  zz-test fixtures). Matt: document first, backlog after.

## Prior — 2026-08-25 (Claude Opus 5) — MARKET_TRUTH D26+D27 shipped, 2,526 unshipped lines rescued, sandbox race killed

**Surface:** `origin/main` `bb604b78`. D26 and D27 deployed and verified on ryan-realty.com.

**Shipped**
- `f2a81fa7` **D26** — picked up from a Grok session that ran out of weekly tokens mid-verification.
  Housing-market instruments, reports-hub live figures and city/neighborhood/community as-of stamps
  read leftover membership. Live: `/cities/bend` stamp 11:21 AM = leftover `market_metric.computed_at`;
  neighborhood and community stamp 11:40 AM. The stamps differing BY GRAIN is what proves they are
  leftover computed_at and not one shared pulse refresh.
- `4150dccd` **admin sales-funnel tab, rescued.** 2,526 lines across 12 files existed ONLY as untracked
  files in the main checkout, which sat 611 commits behind and was approved for reset. A `git clean`
  would have destroyed it. Two type errors kept it from building (`filterCohort` widened `cohort` past
  `PersonRow`); made generic over the row type. Enrolled `SalesFunnelTab` + `FunnelAudienceControl` in
  the G65 SCAN_DIRS rather than exempting them.
- `96aed416`..`3f04ee4c` **D27 — client documents read leftover.** Most of the migration was already
  done by `214b0a01`; the real defect was that the CRM market report, the CMA and the BPO still
  DECLARED `market_stats_cache + market_pulse_live` for figures leftover produces. On a broker-signed
  document the citation is what makes a number auditable, so those figures were unverifiable against
  the store they named. All three now carry per-figure source attribution.
  Also: `new_listings_30d` cell built and live (Bend **247**, region **505**, Coming Soon excluded —
  4 Bend listings were pre-marketing); **New · 30 days** tile restored; blog months-of-supply guard
  moved to leftover; gate-6 `CumulativeDaysOnMarket` baseline **7 → 0** (verified dead: 0 of 4,628
  non-null on Active SFR).
- `bb604b78` **parallel-suite sandbox race, fixed as a class.** `check-view-preset-equivalence` used a
  FIXED `tmpdir` sandbox while running in two vitest projects, so concurrent instances overwrote each
  other — passing standalone, failing only in the full suite. `check-entity-scope` had already solved
  this and the fix never propagated; three more files carried it. All four uniquified.
  Adds `scripts/apply-sql-function.mjs`: applies `scripts/sql/*.sql` in a transaction and reads the
  deployed definition BACK, so "applied" means verified. Those four compute functions previously had
  no applier and were hand-pasted.

**Rejected with evidence** — work-graph node `bedc35f4` (regression of G15, "sold search shows no
homes"). Does not reproduce at 390 or 1280 on production: 86,330 homes, Sold badges, prices, and the
reported empty-state string is absent from the page. A blank map pane seen in the in-app browser is an
artifact of THAT browser — constructing a `google.maps.Map` there paints nothing while real Chrome
renders tiles. No code change; nothing on the shopper path is broken.

**Three guards that held only by luck, now pinned by mutation-checked tests:** the delivered-CMA
freeze (both call sites pass `hydrateArea: false` — one edit from silently restating a signed
document), the resort verdict gate (dropping it makes a Tetherow board render Bend's verdict — one
population labelled as another), and the client report's source trace.

**THE GRAPH DOES NOT KNOW ANY OF THIS.** `loop_work_nodes` has no node for D26, D27, the salvage or
the tooling fix; its only intake is `fleet-intake-core.ts` (bot findings), and nothing reconciles
shipped commits against it. `site_improvement_ledger` carries a `commit_sha` column and has **0 rows
shipped since 2026-08-17** — every ship since, not just this session, has bypassed it. Treat the
commit messages and `docs/plans/MARKET_TRUTH/` as the durable record until that gap is closed.

**Gate lesson, third time this session:** G52, the D91 contract test and `ci:publish-months-of-supply`
each pinned the SPELLING of a mechanism rather than its outcome, and each failed a change that was
strictly stronger than what it replaced. When a gate fails a correct improvement, move the rule to a
shared module with failing fixtures and assert the outcome — write the negative fixture first.

## Prior — 2026-08-25 (Claude Code) — buyer/seller journeys walked as real people; 5 silent defects fixed; /book shipped

**Surface:** `origin/main` `ee4b3534`. Deployed and verified in a real browser on ryan-realty.com.

**Why this session found things gates could not:** every defect below was silent.
Nothing errored, no gate failed, and each surface looked correct in a screenshot.
They only appeared by running the journey as an actual buyer/seller against
production data.

**Shipped**
- `0d33be7e` **broker notify prefs**. `brokers.notify_new_leads` /
  `notify_deal_activity` / `notify_task_due` were written by
  /admin/settings/account and read by NO send path — the switches were
  decorative. Now gated in `queueBrokerAlert` via `lib/crm/broker-notify-prefs`
  (24 tests). Adds `notify_return_visit`, `notify_cma_ready`, a personal quiet
  window and a per-day cap. Quiet window + cap DOWNGRADE to `push_only`, never
  drop: a preference may silence a text, never lose a lead. Health alarms bypass
  everything. Also: self-serve alerts now default to `instant` (they silently
  took the column default `daily` while the LP promised 30 minutes) and the LP
  fires the first batch on submit via `runListingAlerts({ alertIds })`.
  Also: `instrumentEmailHtml` signed the HTML-ESCAPED href into the click token,
  so every tracked link in every alert/report/newsletter landed on params named
  `amp;utm_medium` / `amp;utm_campaign` — GA4 lost medium+campaign on all of it.
- `1a899f45` **cma-ready alert**. `queueCmaReadyAlert` had NEVER fired in
  production (0 `cma-ready:*` timeline rows, all time) against 335 drafts / 7
  delivered, because it required an opt-in notify list most build paths never
  set. Now falls back to the linked person's assigned broker.
- `0b1ae82c` **LP cookie identity hijack** — the big one. All four intakes took
  the `rr_pid` cookie unconditionally, ignoring a DIFFERENT submitted email.
  Live repro filed Quinn's home, seller tags, a CMA of a house she does not own,
  two call tasks and an auto-sending seller sequence onto BLAKE. Now routed
  through `lib/crm/submitted-identity` (6 tests). VERIFIED FIXED in production.
- `37407524` + `fddebdf3` **public /book**. Real calendar, not a request form.
  Pure slot engine (`lib/booking/slots`, 16 tests): DST-safe, 30-min slots, 2h
  lead, 21-day horizon, 15-min buffers. Slot race re-checked INSIDE the write
  path (`slot_taken` → refresh, never a double-book). `booking_hours` is a NEW
  column, deliberately NOT `office_hours` — that one gates inbound CALL ROUTING
  where empty means "always ring", so filling it would have sent after-hours
  callers to voicemail. The two disagree about empty on purpose.
  `fddebdf3`: all-day rows are TC milestone pins ("Contract accepted · …"), not
  meetings — counting them as busy showed 4 bookable days out of 15. Excluded.
- `ee4b3534` LP no longer promises "your first batch is on its way" to a buyer
  whose search matches nothing (4 of 24 active alerts, 17%, match zero).

**Verified end to end in production**, not from the UI: appointment #44
(17:30Z = 10:30 PDT), person 63551 created as Quinn with her OWN email (the
identity fix, from the same cookied browser that broke it), broker SMS `sent`,
confirmation email delivered.

**Open, needs Matt**
1. `booking_hours` seeded Mon-Fri 09:00-17:00 Pacific — AN ASSUMPTION. One
   column value. Saturdays likely worth it for buyers.
2. 335 CMA drafts vs 7 delivered. Alert fixed going forward; backlog untouched
   on purpose (retro-alerting = 335 texts). Suggest filtering to drafts whose
   person has SINCE shown activity.

**Open, not built**
- Overlapping saved searches send simultaneous near-duplicate emails (Blake got
  2 Redmond alerts in one minute). Needs per-recipient batching in
  `runListingAlerts`.
- A zero-match alert tells nobody — not the buyer, not the broker. 17% of active
  alerts. That is a coaching signal being dropped.
- Meta pixel throws repeated CSP errors iframing facebook.com (frame-src).
- **Phase 3 (FSBO)** not started. `sendFsboIntroSmsAction` is a DELIBERATE dead
  end (`retiredProspectingSendError`) — cold outreach was consolidated into
  `/admin/prospecting` → `sendProspectingIntro`, which requires a client-ready
  CMA before it will text. Data: 52 FSBOs, 29 reachable, **23 with no contact
  path at all**, 2 added in the last 7 days.
- **Phase 4 (returning-user dashboard)** not started. Most surfaces already
  exist under `/account` (saved-homes, saved-searches, hidden, collections,
  history, notifications). The gaps Matt named that I do NOT see: request a CMA
  from the dashboard, and easy sharing of saved homes to messages/social.

**Method note worth keeping:** twice a single query nearly produced a wrong
report — 461 unconsumed `content:cma` rows looked like a dead pipeline (335 real
drafts existed), and 677 "CMA" broker alerts looked healthy (~672 were fixtures
from one day). Also nearly reported a dead button that was drifted coordinates.
Run the second query shape before escalating a null result.

# Current — 2026-08-21 (Claude worktree) — SSG rail timeouts zeroed (G70 round 2)

**Surface:** `main` `9162c204`, deployed `dpl_C7NtuaxP3KRrpzR9CE9qHKS8dqmn` READY, verified in a real browser on ryan-realty.com.

**What:** after G70, `app/cities/[slug]` + `[neighborhoodSlug]` still logged ~44 rail timeouts per build (`city:yearPricing`/`city:quarterSto` on 7/7 city pages, `nbh:boundary` 8, `nbh:communities` 7 of ~14 — already baking empty into deployed HTML). Chart-room, boundary, and subdivision-ledger rails now skip during SSG via `skippableRail`/`skippableRailResult` (`lib/build-phase.ts`); ISR refills at `revalidate=60`. Core figures (`nbh:stats`, `nbh:mktStats` — HUD/facts/FAQ) stay hot with `hotRailTimeoutMs` (3× leash at build only). Measured on the deploy: **0 timeouts** (was 44/352), SSG **76s** (was 3.6/11.2 min), build total **3 min**. Refill verified live: Redmond chart room full; Awbrey Butte + Southeast Bend refill chart room, polygon, subdivisions, open houses, activity on the first revalidate cycle.

**Rule when extending:** skip any rail that collapses-to-nothing per §0; never skip an indexable core figure — lengthen its build leash with `hotRailTimeoutMs` instead. `skippableRailResult` preserves the degraded-vs-empty `.ok` contract; the site-contracts §0 test accepts either Result-shaped guard.

# Prior — 2026-08-21 (Claude Code) — all four locked restyles LIVE

**Surface:** `origin/main`. Home (#146 `f66ac340`), River West hood-d (#144
`c4f0bbec`), Redmond city-d + Tetherow comm-d (batched, #143+#145 `666983b2`)
all merged, deployed, and verified in a real browser on ryan-realty.com. Matt
pinged per page. Market Desk is gone from `/`; journal H2 clears the nav.

**Gate re-anchors that rode along** (each keeps its trap armed): publish
months-of-supply / median-caption / regional-search-href homepage checks went
conditional on the retired components; pulse-city-remainder reads
SITE_CITY_SLUGS; days-figure → hood-d-model; place-hero-grain parameterized
helper (cityHeroLead/hoodLead); place-browse → CommunityKbView+FeaturedView;
westside luxury door → CityDFooter/KB_FOOTER_COLUMNS; kb-shared-shell accepts
all register footers; D93 activity feed retired from city+hood; D99/D101 lock
the HUD off `/`. pa11y hero fix = navy background under hero media (WCAG walks
ancestors, cannot see a sibling scrim) on home-d/hood-d/comm-d.

**CI de-flake `22e35a42`:** /admin/ routes out of the PR-blocking smoke
(SMOKE_INCLUDE_ADMIN=1 restores), pa11y before Lighthouse. Vercel push-to-live
measured ~11.5 min with warm cache (log of dpl_5qnLLnb...); a task is queued to
cut SSG further (ISR the 1-minute-revalidate tail, PR preview builds + promote).

**Open in the restyle program:** listing House A and resort Sunriver proofs had
no PRs — not started. The crank (rolling the kits across all cities/hoods/
communities) awaits Matt's review of the four live proofs.

**Do not:** put KbMarketHud or KbSell back on `/`. GitHub dropped PR
synchronize events twice today — after any retrigger push, VERIFY a workflow
run exists for the new SHA before waiting on it.

# Prior — 2026-08-21 — kit on main; re-arm the loop

**Surface:** `origin/main`. Home-d shipped (PR 146). Locked pack `design_system/ryan-realty/locked/`. Brain `docs/GROK_BOT_BRAIN.md` (PR 148). CRM is ryan-realty.com.

**Loop:** Sentinel default-on (`LOOP_SENTINEL_DEFAULT_OFF = false`). 10-min heartbeat launches one ship class from `loop-brief` after this lands on production. Hard limits stay: no outbound, no posts, no ad spend, no OAuth, no SkySlope, no newsletter. Public restyles stay Grok Build, not Cursor.

**Do not:** send the 648 CMA. Never the 648 household. Do not invent listings, parks, HOA, counts, or routes. Do not start a second work graph. Work graph stays `loop-brief` + ENTERPRISE_MAP.

**Grok bots:** I cannot delete sidebar agents. New bots read the brain, then one door.

# Prior — 2026-08-21 (claude worktree) — runtime rail class: video-tours fixed, pricing index is a trap

**Surface:** `main` @ `8793f648`. The `sub:video-tours` rail (worst runtime offender, 85 SSG timeouts historically) is fixed: subdivision pages read `getSubdivisionVideoTours` from `@/lib/data` (300s cache; `ci:page-action-imports` ratchet is why it lives there), VideoTourRail uses `getListingsWithVideosCached`, the cascade no longer double-queries, and `idx_listings_city_vt_modts` cut the candidates query 1368→416ms cold (migration 20260821190000, applied live via pg_cron CONCURRENTLY).

**Do NOT re-add** a covering index on `sale_pricing_facts` for `city_year_pricing`/`city_quarter_sale_to_ask` — built and measured 2026-08-21: 5.75s (planner prefers its random I/O) vs 1.77s seq scan. Reverted; details in the migration file header. Those RPCs are SSG-skipped + 6h-cached and inside budget. Profiling method when a rail is slow: `-- audit:`-prefixed `EXPLAIN (ANALYZE, BUFFERS)` of the exact query shape via the Supabase MCP — static index-gap guesses were wrong 3 of 5 times.

# Prior — 2026-08-21 (claude worktree) — ship pipeline maximized (every agent, read this)

**Surface:** `main` @ `8a7c659b`. The push→live cycle is now ~5–6 min total (was 30–40 this morning). What changed for HOW YOU SHIP:

- **`npm run push` auto-recovers origin races.** Non-fast-forward (another agent pushed while your gates ran) is exit 7 → `scripts/push-retry.sh` fetches, rebases (conflicts abort loudly), and re-verifies the new HEAD, 3 attempts max. Stop hand-rebasing on rejection — just read the verdict line.
- **G46 typecheck is incremental** (~/.cache/rr-commit-check tsbuildinfo; 55–80s → 9–15s warm). `COMMIT_COMPILES_NO_CACHE=1` forces cold.
- **`npm run deploy:verify` prints build telemetry** (compile · SSG · rail-timeout count from the REAL build log) and **exits 1 if the build-cost class returns** (SSG > 300s or > 50 rail timeouts). Do not work around it — fix the regression or get Matt's explicit OK with `BUILD_TELEMETRY_ALLOW_SLOW=1`.
- **`/api/cron/warm-geo-pages`** (every 10 min) warms the on-demand geo tail once per deployment (crm_try_cron_lease keyed on the deploy SHA). Do not add per-request warming loops elsewhere.
- The build is ALREADY Turbopack (Next 16 default; `next build --webpack` only if you need the Serwist SW). Do not "switch it to Turbopack".
- Worktree agents: never reference `<repo>/node_modules` in scripts — use `scripts/lib/resolve-node-modules.mjs` (JS or CLI). The stub broke 5 pipeline paths on 2026-08-21.

# Prior — 2026-08-21 (claude worktree) — Vercel build cost: SSG fan-out zeroed (G70)

**Surface:** merged to `main` from worktree `bold-jang-cc92e0`. **Every agent that touches `app/`: the build-time SSG budget is now gated (`ci:ssg-budget`, G70).**

**What:** Vercel build profiling showed "Generating static pages (644)" ate 11.2 of 14 min — ~125 `subdivisions/[slug]` + `oregon/[city]` pages each chaining sequential 3000–9000ms timeout-capped Supabase rails; 352 rail timeouts in one peak-hours build, which also baked EMPTY rails into deployed HTML. Both routes now hold `generateStaticParams → return []` (on-demand ISR, same URLs, same content, `dynamicParams=true` + short `revalidate`). Do NOT re-seed their fan-out; the gate fails the commit. If a build gets slow again, profile first: `vercel inspect --logs <deploy-url>` and grep `withTimeoutFallback.*timed out`. Full rationale: `docs/MECHANICAL_GATES.md` G70.

**Also true:** sitemaps are already off the build path (dynamic + warm-sitemaps cron); build cache restores fine; the 30–40 min push-to-live wall clock was build-queue serialization — shrinking the build shrinks it.




**Surface:** Grok local worktree `/Users/matthewryan/RyanRealty-wt-cma-sunstone-20260819` (`wt/cma-sunstone-20260819`). Product **`6ed2b5aa`**. Vercel production **READY** `dpl_3YBxhEC38sVWgU6QEJk9NfcgpsJQ`. Loop stays **DISARMED**. Do not re-arm. No send. Dirty CMA branch `cursor/cma-client-document-7fc3` was not mixed (CRM health `b0e9f537` and `origin-dual-remote` left behind).

**Done**
- Matcher: no `PRICING_QUALITY_STOP`. Target 8 / max 10. Townhouse ≠ condo ≠ SFR. Parkway/US-97 and Deschutes sides from `data/cma/bend-divide-sides.json`. Zoning cut when both sides known. GLA bracketing.
- Seller letter: 16 Sunstone chapters. Cover is list range + recommended list. Expected close off the seller HTML. Gate `ci:cma-exemplar`.
- Gold house **648 SE Douglas** rebuilt to `out/cma-648-se-douglas/cma.html` (gitignored). 19 pages. Recommended list **$513,000**. Matcher returned 6 sales; judge kept 3 (Thomas, 947 6th, 135 4th). Permits omitted (no extras). R-068 stays **PARTIAL** until Matt ticks the PDF.

**Next**
- Matt opens `out/cma-648-se-douglas/cma.html` (worktree path below) and ticks the 16 chapters against `docs/plans/cma-exemplars/56628-sunstone-rpr.pdf`. Reply "ship it" to move the draft into `public/cmas/` and send. Do not auto-send.
- Draft: `/Users/matthewryan/RyanRealty-wt-cma-sunstone-20260819/out/cma-648-se-douglas/cma.html`

**Do not:** re-arm the loop. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not clone Tumalo/Robin as the client layout.

**Skills read:** CMA producer SKILL, CMA_SUNSTONE_CONTRACT, TDD, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CRM compose rebase

**Surface:** Cursor Cloud `cursor/site-texting-1eb2` PR **128**. Loop stays **DISARMED**. Rebased onto current `main` (PR 123 + people file + CMA 127 + person-link). Notes timestamp pinned to PT so hydration gate passes. File-size budget locked (`crm.ts` shrank). CRM compose is the only send path. Library attach, group text, Text me opens compose. No Jane/Odessa/Nealon sends. No Gmail fallback. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CMA person-link and SE persist live

**Surface:** Cursor Cloud. Merged to `main` @ `23f936a51`. Vercel production **READY** `FnhKRD21AK26xTzUs4wTnKau6K6w`. Live `cma-648-se-douglas` is `person_id=63285` Odessa, `client_name=Odessa`, address `648 SE Douglas, Bend, OR 97702`, beds/baths/sqft 3/1/1056, `Intent: sell`. Review header reads the linked person. Rebuild keeps `person_id` and SE. Kickoff/rebuild/manual build collect beds/baths/sqft + rent-vs-sell. Admin actions and version-chain reads no longer `select(*)`. Review page does not iframe the document. Relationships + address-on-quick-add stay on `main`. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit, database-canonical-reference.

# Prior — 2026-08-19 (cursor-cloud) — People file related people + notes

**Surface:** Cursor Cloud. Merged to `main` @ `7a30d1ef8`. Vercel production **READY** `2PxU2QeAJnU5Qe5BF9ADdYTEefuq`. Loop stays **DISARMED**. Related-people form first-paints open; notes list + `savePersonNoteAction`; stage/tags on first paint. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — People New contact first-paint

**Surface:** Cursor Cloud. Merged to `main` @ `cea4bde19`. Vercel production **READY** `94hZ3rcsAmuPze5JTWockB7Ejnx4`. Loop stays **DISARMED**. `AddPersonCard` first-paints above the People list. Gate `ci:crm-add-person`. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — hub reject + Foley investor HOA

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Foley investor HOA `$0` vs `$22` **fixed**. Product `main` @ `2ff523f5e`. No CMA. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** database-canonical-reference, git-commit.

**Skills read:** admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CMA phone open + PDF

**Surface:** Cursor Cloud. PR #127 merged to `main`. Loop stays **DISARMED**. Unauth view/pdf → login. Review slim-reads. `/view` serves stored HTML. PDF from render_args. SE from slug. person_id on kickoff. Drafts stay private. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, database-canonical-reference, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — stats-truth Madras + Foley p0s

**Surface:** Cursor Cloud. Loop stays **DISARMED**. stats-truth p0s reproduced and class-fixed on `main` @ `062ff2372` READY `6LzgjAwNN7XvAjjBEGYfQVjtCZSk`. Madras `/housing-market/madras` hero+FAQ both `$399,900` (zero `$400,000`). Foley 220221409 Active 2 DOM, Listed Aug 16, no Pending Aug 2. Hub SFR pulse+FAQ both `$729,000`. Place-pages (Terrebonne, Powell Butte, Summit West MOS) left to that ship. Punch dispositions appended on `3a6198cd`; parent stays open (119 lines). No CMA. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** database-canonical-reference, tdd, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — leftover Triple / street 0 / closings / plat crumb

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Walker leftovers still live: Triple H1, 0 Moonshadow search cards, Matt 19 vs 9, plat hero on crumb. Class-fixed on `main` @ `b46698c76`. Did not re-touch featured plats or Tetherow 33=33=$1.499M. Deploy verify next. CMA / loop-sentinel / email not touched. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** CROSS_AGENT_HANDOFF, git-commit, public-product-os (folded).

# Prior — 2026-08-19 (cursor-cloud) — vendor CRM name purge

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Removed leftover vendor-CRM docs, setup scripts, and product-name strings. Live CRM is `public.crm_people` via `lib/crm/send-event.ts` at `/admin/crm`. `main` @ `3e832749d`. `ci:gates` passed on GitHub. First Vercel production deploy `323yhyaDX5S7J75ecVUc3qdK43tN` ERROR after BUILDING. Retrying. CMA not touched. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

# Prior — 2026-08-19 (cursor-cloud) — four shopper defects LIVE

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Four morning defects class-fixed on `e68b5e07f` and **live** on READY production `e8f1d4cd3` (`dpl_3sYtNggHWR3oFayXtELqP7s1ANyV`): browse Bend FAQ/snapshot **980** + MOS **—**; Mariposa 220204494 no $9.8M drop; `#save-search-email` in the DOM; tour confirm names the listing. File-size follow-up `7c28f4cab` Vercel ERROR (behavior unchanged). `/cities/bend` one render showed pulse **474** (empty tile fetch fallback). CMA / loop-sentinel not touched. No client mail. No re-arm.

# Prior — 2026-08-19 (cursor-cloud) — listing/place leftovers

**Surface:** Cursor cloud `bc-f3f636d7`. Loop stays **DISARMED**. Nine queued leftovers only. Live-reproduced on ryan-realty.com. Shipped 3 class-fixes on `main` @ `bf85c08d5`. Rejected 6 with live evidence (wheel-tab, featured 0 ACTIVE, browse href, Moonshadow card text, lot beds, Tetherow 19/35 and 35/28). CMA / sitemaps / loop-sentinel / email not touched. Do not re-arm.

**Shipped:** team closings count = ledger rows (`publishOwnClosingRows`); MLS remarks join mid-sentence blank lines; listing slugs withhold StreetNumber 0. `ci:gates` 255/255. Deploy verify next.

**Skills read:** CROSS_AGENT_HANDOFF, database-canonical-reference, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — listings.xml honesty class

**Surface:** Cursor cloud `bc-7d0ca98e`. Loop stays **DISARMED** (Matt). Family `fleet:public-ux:sitemaps` class-fixed. Live `listing_tile_mv` Active/AUC = 7586. Prod `listings.xml` had 7586 locs / **5827 unique** — `fetchAllRows` paged the MV with no ORDER BY. Fix: `getListingSitemapRows` ordered `listing_key` read. Gate `ci:sitemap-listings-honest`. CMA not touched.

# Prior — 2026-08-19 (cursor-cloud) — loop DISARMED

**Surface:** Cursor cloud `bc-f77b4a1c`. Matt said **"Disarm the loop"**. Code default-off: `LOOP_SENTINEL_DEFAULT_OFF = true` in `lib/data/loop/sentinel.ts`. Cron may still hit `/api/cron/loop-sentinel`; route no-ops. Did not touch CMA, punch list, findings, or email.

# Prior — 2026-08-19 (grok-build) — graph armed, motivated-sellers 308 shipped

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Loop stays **ARMED**. Graph folded: G34/G35 **done**, R-219/R-220, CAP-015/017/031 evidence updated. FLEET-PUNCH motivated-sellers slice **fixed** (live 308 `/motivated-sellers` → `/price-drops`, SHA `a6558109` READY `dpl_8PiPQmohwuu12UhRfmpYGEvZaTmt`). Parent released. Next brief: `fleet:public-ux:sitemaps` — `/sitemaps/listings.xml` is an empty urlset while `listing_tile_mv` has 7589 Active/AUC rows. Sentinel handoff skipped: Cursor User API Key 401 (unattended chain cannot launch). CMA in_progress on the other checkout not touched.

# Prior — 2026-08-18 (grok-build) — page-tied analytics

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Public tracking is layout-owned. `lib/analytics/page-type.ts` is the only taxonomy. `ci:page-analytics` locks new pages. GA4 `page_type` + `crm_person_id`. SHA `02948bcd` READY. CMA not touched.

# Prior — 2026-08-18 (grok-build) — remotion + brain runtime retired

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Remotion factory deleted. Producer-runtime crons off. `analytics_dim_agent` dropped (`20260818233000`). Revalidate uses `REVALIDATE_SECRET` (set on Vercel prod/preview/dev). Extra Vercel projects `tmp` and `ryan-realty-lps` deleted. GTM already has GA4 `G-ST40W4WM6T`. CMA checkout not touched.

# Prior — 2026-08-18 (grok-build) — runtime crosswalk leftovers closed

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. **Time:** 2026-08-18 evening PT. Product land **`0afc2335`** already READY. This follow-up closes leftover audit items (unused modules + hosted stale objects + live Playwright checks). CMA dirty checkout `cursor/cma-client-document-7fc3` was not touched.

**Done**
- Live Playwright on `ryan-realty.com`: `/contact` has one `#contact-email` (forms e2e 7/7); GTM-WV6R4NZ5 present; no extra `gtag('config', G-ST40W4WM6T)`; `/homes-for-sale/bend/awbrey-butte` H1 Awbrey Butte, 69 homes.
- G55 leftovers deleted (17→7). Dead OpenAI `classifyListingPhoto` removed. Hosted drop `20260818223000`: `listing_detail_mv`, `_lss_backfill_cursor`, `cache_backfill_progress`, unused tick/refresh RPCs. `analytics_dim_agent` kept (reserved empty dim).
- Gmail reads on `marketing@` / `admin@` work. No client mail sent.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Do not start a new ship class from this land.
- CMA work stays on `cursor/cma-client-document-7fc3` in the primary checkout.

**Do not:** merge this land into the CMA branch. Do not restore the in-house CRM keys. Do not completeWorkNode on FLEET-PUNCH. Do not invent a listing. Do not SMS, publish, spend, or OAuth.

**Skills read:** CROSS_AGENT_HANDOFF, SESSION_HANDOFF, database-canonical-reference, deploy-verify-before-done, supabase-migrations-auto.

# Prior — 2026-08-18 (cursor-loop-sentinel) — listing-detail TIC/empty/navy/history reject slice

**Surface:** Cursor cloud `bc-26cdbbff` (`cursor/loop-sentinel-2026-08-18t13-10-b8d6`). **Time:** 2026-08-18 ~13:25 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 180). Claimed parent only as `cursor-loop-sentinel-bc-26cdbbff-2026-08-18t13-10`. **No product change from this session.** Production stays on last product **`af9e9308d`** (READY `HVMX96aLeSPgLGnGdkfGGExAkjfK`; concurrent listing-history dump class). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (164 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Redtail Hawk $5K / $3 ppsf / no share label **rejected** (hero `$5K TENANCY IN COMMON`, H1 `$4,900`, View all 47; What this listing shows is HOA `$399` / tax `$550`, no living-area `$/sqft`; prior class `cdb35fb11`). Awbrey Butte under-400k empty state **rejected** (7 homes, 1–7 of 7; under-300k still 3). Monta Vista blank navy UNMUTE **rejected** (Spark field, `$119K`, 7.44 ACRES, View all 6, video=0). Roosevelt intermittent navy **rejected** (live exterior, `$989K` 5/2/1092, View all 50). Borden missing history **rejected** (Listing history LISTED Jul 22, 2026 `$487,000`). Borden missing history dup **rejected** (same dated row). Borden missing agent attribution **rejected** (Listing courtesy of eXp Realty, LLC, agent Molly McInelly). Empire missing history **rejected** (LISTED Aug 10, 2026 `$455,000`; courtesy Cascade Hasson, Jenna Raanes). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet unlabeled share / empty under-400k / blank-UNMUTE / intermittent navy / missing history / missing courtesy did not reproduce. Do not invent a listing, beds, or a second TIC/ppsf fix.
- Prod probe on live pages: Redtail H1 `$4,900` + TENANCY IN COMMON; Awbrey under-400k 7 homes; Monta Vista H1 `$119,000`; Roosevelt H1 `$989,000`; Borden H1 `$487,000` + history + Molly McInelly; Empire H1 `$455,000` + history. After shots `/opt/cursor/artifacts/after_redtail_{390,1280}.png`, `/opt/cursor/artifacts/after_awbrey400_{390,1280}.png`, `/opt/cursor/artifacts/after_montavista_{390,1280}.png`, `/opt/cursor/artifacts/after_roosevelt_{390,1280}.png`, `/opt/cursor/artifacts/after_borden_{390,1280}.png`, `/opt/cursor/artifacts/after_borden_390_history.png`, `/opt/cursor/artifacts/after_borden_390_molly_mcinelly.png`, `/opt/cursor/artifacts/after_empire_{390,1280}.png`, `/opt/cursor/artifacts/after_empire_390_history.png`.
- Punch dispositions already on the parent (hex-only; matching this session's verdicts). Parent not completed. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail withhold raw ListPrice history dump

**Surface:** Cursor cloud `bc-8bf1d624` (`cursor/loop-chain-2026-08-18t13-29-e1f3`). **Time:** 2026-08-18 ~13:45 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 172). Claimed parent only as `cursor-loop-chain-bc-8bf1d624-2026-08-18t13-29`. Product **`af9e9308d`** landed on **`main`**. Vercel Production **READY** for `af9e9308d` (`HVMX96aLeSPgLGnGdkfGGExAkjfK`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (164 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Empire future date **rejected** (today Aug 18; Data last updated August 18, 2026). Empire missing history **rejected** (Listing history + Listed `$455K`). Rockway UNMUTE on still **rejected** (photo `$649K` 3/2/1392, video=0). Rockway interstitial **rejected** (no Next-step / NOT NOW). Swalley raw ListPrice dump **reproduced** then class-fixed. 438 9th courtesy **rejected** (Premiere Property Group, LLC). Roosevelt courtesy **rejected** (Stellar Realty Northwest). 438 9th lot size **rejected** (specs `0.64 acres`; hero withholds acres when beds exist). Hex-only fingerprints (1 fixed + 7 rejected).
- Class: buyer-facing listing history never prints MLS field dumps (`ListPrice: 14900000.00 → 11900000.00`). `publishListingHistoryDescription` withholds those strings; `publishListingHistoryDeltaLabel` prints `$3.0M down` via `formatPriceCompact`. Wired PropertyHistory + expired-listing-note. Gate `ci:publish-listing-history` 8/8. Founding fingerprint `7e278bfeb28c9806649154eeb32c5567`.
- Prod probe after READY `af9e9308d`: Swalley history **`$11,900,000`** + **`$3.0M down`**, no `ListPrice: 14900000`. After shots `/opt/cursor/artifacts/after_swalley_{390,1280}_listing_history.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail TIC share label + withhold ppsf

**Surface:** Cursor cloud `bc-a0c77b4b` (`cursor/loop-chain-2026-08-18t12-00-4d91`). **Time:** 2026-08-18 ~13:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 188). Claimed parent only as `cursor-loop-chain-bc-a0c77b4b-2026-08-18t12-00`. Product **`cdb35fb11`** landed on **`main`**. Vercel Production **READY** for `cdb35fb11` (`CxViDz2vpqBeLEYN8NsTuDcypKwD`; GitHub Vercel success + Production deployment). First `npm run deploy:verify` hit READY on the prior product SHA `05bbb31`; the HouseMe follow-up SHA verified via GitHub Production status after the CLI login stall. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (180 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Old Farm under-300k auto-nav **rejected**. Dick George missing-spec **rejected** (`$380K` 6.34 ACRES). River Bend blank UNMUTE **rejected** (live photo + `$1.9M`). 2390 Snowgoose share ask **reproduced** then class-fixed. Black Canyon Aw Snap **rejected** (`$25K` 20 ACRES). Gerig blank navy **rejected** (`$1.9M` 190.69 ACRES). 2250 Snowgoose share ask **reproduced** then class-fixed. Surveyor missing photo **rejected** (`$698K` VIEW ALL 54). Hex-only fingerprints (2 fixed + 6 rejected).
- Class: MLS `PropertySubType` Tenancy in Common / Timeshare prints that label on the hero and strip. `publishListingSharePricePerSqft` withholds living-area `$/sqft` on hero, strip, PriceBlock, PropertySpecs, ListingCard, and HouseMe. Do not invent fractional or timeshare when the feed says Tenancy in Common. Do not parse PublicRemarks. Gate `ci:publish-listing-share` 9/9. Founding fingerprints `ae66a0f065d3affe2713352b2f71e1b5` / `41fed0ac49bcf207696a8c1990faf07f`.
- Prod probe on live `cdb35fb11`: 2390 Snowgoose hero **`$5K TENANCY IN COMMON`**, HouseMe no `$4 per sq ft`. 2250 Snowgoose hero **`$3K TENANCY IN COMMON`**, HouseMe no `$3 per sq ft`. After shots `/opt/cursor/artifacts/after_snowgoose2390_{390,1280}.png`, `/opt/cursor/artifacts/after_snowgoose2250_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail unmute + Aw Snap reject slice

**Surface:** Cursor cloud `bc-74d9bae3` (`cursor/loop-chain-2026-08-18t11-45-fffc`). **Time:** 2026-08-18 ~11:52 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 196). Claimed parent only as `cursor-loop-chain-bc-74d9bae3-2026-08-18t11-45`. **No product change.** Production stays on last product **`0bcfc7110`** (already READY; dpl `GnLoMc7NzMfxLcNPabcorWJx2qvP`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (188 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Albany Gerig blank navy UNMUTE **rejected** (Spark aerial, `$1.9M`, 190.69 ACRES, +9 more, video=0). Strawberry missing photo **rejected** (View all 12 + Spark field). Strawberry missing specs **rejected** (hero `$435K` + 0.51 ACRES; MLS 220215800 type D, beds/baths/sqft null). Old Farm under-1.5m auto-nav **rejected** (same URL after 8 scrolls; 1-9 of 53). Conestoga / Galium / Cassidy / Black Canyon Aw Snap **rejected** (each 200 + live hero; Black Canyon still same URL after scroll). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet UNMUTE-on-still / missing photo / invented beds / auto-nav / Aw Snap did not reproduce. Do not invent a listing or beds.
- Prod probe on live `0bcfc7110`: Gerig H1 `$1,875,000`; Strawberry H1 `$435,000` + 0.51 ACRES; Conestoga `$739K` 3/2/1798; Galium `$2.1M` 4/4/3318; Cassidy `$320K` 3/2/1462; Black Canyon `$25K` 20 ACRES. After shots `/opt/cursor/artifacts/after_gerig_{390,1280}.png`, `/opt/cursor/artifacts/after_strawberry_{390,1280}.png`, `/opt/cursor/artifacts/after_oldfarm_{390,1280}.png`, `/opt/cursor/artifacts/after_conestoga_390.png`, `/opt/cursor/artifacts/after_galium_390.png`, `/opt/cursor/artifacts/after_cassidy_390.png`, `/opt/cursor/artifacts/after_blackcanyon_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail $1000K + land-acres slice

**Surface:** Cursor cloud `bc-146bbab6` (`cursor/loop-chain-2026-08-18t10-55-4a7c`). **Time:** 2026-08-18 ~11:42 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 204). Claimed parent only as `cursor-loop-chain-bc-146bbab6-2026-08-18t10-55`. Product **`0bcfc7110`** landed on **`main`**. Vercel Production **READY** for `0bcfc7110` (`GnLoMc7NzMfxLcNPabcorWJx2qvP`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (196 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Roosevelt `$1000K` **reproduced** then class-fixed. Columbus / Kouns missing acres on hero **reproduced** then class-fixed. Bryant missing photo **rejected** (photo + `$1.1M` / H1 `$1,073,000`). Columbus Aw Snap **rejected** (200, live hero). Rogue “make numbers match” 220208750 **rejected** (hero 4,021 SQFT is MLS 220208751; do not invent 23/22). Bryant Next / Violet blank navy video **rejected** (real photos, no `<video>` / UNMUTE). Hex-only fingerprints (3 fixed + 5 rejected).
- Class: `formatPriceCompact` / `publishListingHeroCompactPrice` emit `$1.0M` when thousands-round ≥ 1000 (never `$1000K`). `publishListingHeroKeyStats` publishes lot acres only when beds/baths/sqft are absent. Wired ListingHero + listing-detail page. Gate `ci:publish-listing-hero-stats` 4/4. Founding fingerprints `2ceabe03a3cc759cc09d94d2bd1e442a` / `639e24f1d222997d0f59f2e137981de8` / `57b38d188f133fe2c93c05ca6150d5d9`. Do not invent beds or a second MLS row.
- Prod probe after READY `0bcfc7110`: Roosevelt hero **`$1.0M`** (no `$1000K`); Columbus hero **19.77 ACRES**; Kouns hero **1.35 ACRES** at 390+1280. After shots `/opt/cursor/artifacts/after_roosevelt_{390,1280}.png`, `/opt/cursor/artifacts/after_columbus_{390,1280}.png`, `/opt/cursor/artifacts/after_kouns_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 3 fixed + 5 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail not-found + Troon/Bryant reject slice

**Surface:** Cursor cloud `bc-1668f809` (`cursor/loop-chain-2026-08-18t10-39-67fd`). **Time:** 2026-08-18 ~10:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 212). Claimed parent only as `cursor-loop-chain-bc-1668f809-2026-08-18t10-39`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (204 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Medford Table Rock / Cave Junction Pinewood / Medford Gayety / Williams Powell Creek 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Troon missing listing history **rejected** (Listing history: Listed Jun 25, 2026 `$1,425,000`). Troon scroll-jump past Rental analysis **rejected** (rental y=9840/9717; scroll 9840→15366 / 9717→12896, no Financial snap). Troon hero-wheel lightbox **rejected** (`Photo lightbox` count 0). Albany Bryant placeholder heading **rejected** (H1 `Bryant Way, Albany, OR 97321 $1,073,000`). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / missing history / scroll jump / lightbox-on-wheel / placeholder H1 did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: Table Rock H1 `$39,900`; Pinewood H1 `$429,000`; Gayety H1 `$389,900`; Powell Creek H1 `$320,000`; Troon H1 `$1,425,000` + history; Bryant H1 `$1,073,000`. After shots `/opt/cursor/artifacts/after_table-rock_{390,1280}.png`, `/opt/cursor/artifacts/after_pinewood_390.png`, `/opt/cursor/artifacts/after_gayety_390.png`, `/opt/cursor/artifacts/after_troon_390_history.png`, `/opt/cursor/artifacts/after_troon_390_rental_precise.png`, `/opt/cursor/artifacts/after_bryant_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail not-found + SSL reject slice

**Surface:** Cursor cloud `bc-5bc17e51` (`cursor/loop-chain-2026-08-18t10-16-1314`). **Time:** 2026-08-18 ~10:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 228). Claimed parent only as `cursor-loop-chain-bc-5bc17e51-2026-08-18t10-16`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (220 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Ashland McCall / Phoenix Main / Ashland Strawberry / Chiloquin River Bend / Cave Junction Dick George / Christmas Valley Arrowhead / Prineville High Desert 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Brookings Byrtus SSL timeout **rejected** (200 in 720ms HTML / 1632ms 390; `1101 Byrtus Place` `$1,100,000`). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / SSL fail did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: McCall H1 `$315,000`; Phoenix Main H1 `$1,695,000`; Byrtus H1 `$1,100,000`; High Desert H1 `$1` (MLS ask, not a homepage). After shots `/opt/cursor/artifacts/after_mccall_{390,1280}.png`, `/opt/cursor/artifacts/after_phoenix-main_390.png`, `/opt/cursor/artifacts/after_byrtus_390.png`, `/opt/cursor/artifacts/after_high-desert_390.png`, `/opt/cursor/artifacts/after_strawberry_1280.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — listing-detail not-found + tour-key + history reject slice

**Surface:** Cursor cloud `bc-5b7dd86a` (`cursor/loop-sentinel-2026-08-18t09-50-2db8`). **Time:** 2026-08-18 ~10:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 244). Claimed parent only as `cursor-loop-sentinel-bc-5b7dd86a-2026-08-18t09-50`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (236 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Hilmer mismatched Spark tour keys **rejected** (all Schedule a tour hrefs `listingKey=220222626`; contact MLS tile loads 61172 Hilmer Creek `$755,000`). Bly Ivory Pine / Albany Columbus / Highway 34 / Bryant / Kamph 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Sprague River Tableland SSL timeout **rejected** (200 in 1570ms; `0 Tableland Road` `$590,000`). Foley missing price/status history **rejected** (reduction line plus Listing history: Listed Aug 16, Pending Aug 2, two price changes). First resolve pass wrote `fleet:fleet:` tags; second pass used hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / SSL fail / missing history / mismatched tour keys did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: Albany Columbus H1 `$1,495,000`; Foley Listing history visible at 390; Hilmer tour key is MLS only. After shots `/opt/cursor/artifacts/after_columbus_{390,1280}.png`, `/opt/cursor/artifacts/after_foley_390_history.png`, `/opt/cursor/artifacts/after_hilmer_390.png`, `/opt/cursor/artifacts/after_tableland_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail calendar-day slice

**Surface:** Cursor cloud `bc-4c1236cf` (`cursor/loop-chain-2026-08-18t09-14-bc2c`). **Time:** 2026-08-18 ~09:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 252). Claimed parent only as `cursor-loop-chain-bc-4c1236cf-2026-08-18t09-14`. Product **`de3733b74`** landed on **`main`**. Vercel Production **READY** for `de3733b74` (`4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (244 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: `/homes-for-sale/bend/21357-kilimanjaro-220222798` stored 08/18–20 printed Mon Aug 17 / Tue 18 / Wed 19 **reproduced** then class-fixed. Providence / Rainier / Hilmer missing history **rejected** (Listing history + Listed dates already on the page). Hale / Verdin / 7th stale Aug 15 open houses **rejected** (`OpenHouses` null, no Open houses section). Albany Violet navy hero / zero photos **rejected** (Spark hero + View all 46; `media_suppressed=false`).
- Class: `publishCalendarDay` / `publishOpenHouseDay` / `publishHistoryDay` wrap `formatCalendarDay` (noon UTC anchor) so YYYY-MM-DD civil days stay on the stored day in `America/Los_Angeles`. Wired listing-detail Open houses + Property history, OpenHousesGrid, oh-when, KB place-sections, listing banners, open-house clients. Gate `ci:publish-calendar-day` 6/6. Founding fingerprint `e100e9e1a244369ec0d5b7aee1ce11a6`.
- Prod probe after READY `de3733b74`: Kilimanjaro HTML prints **Aug 18 / Aug 19 / Aug 20** (dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). After shot `/opt/cursor/artifacts/after_kilimanjaro_390.png`. First resolve pass wrote `fleet:fleet:` tags that `openPunchLines` cannot match; second pass used hex-only fingerprints (1 fixed + 7 rejected). Parent not completed.
- Leftover listing-detail + other families stay on the inbox. Do not invent a second calendar-day fix.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages browse + mixed-stamp + chart-axis slice

**Surface:** Cursor cloud `bc-1afd11d9` (`cursor/loop-sentinel-2026-08-18t08-30-11a1`). **Time:** 2026-08-18 ~09:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 260). Claimed parent only as `cursor-loop-sentinel-bc-1afd11d9-2026-08-18t08-30`. Product **`90155dcf8`** landed on **`main`**. Vercel Production **READY** for `90155dcf8` (`9JQDeR7rQLifd2tj9oxSVeNZ5w66`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (252 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/subdivisions/ridge-at-eagle-crest` Browse homes / See homes dropped the plat **reproduced** then class-fixed. `/subdivisions` truncated plat names **reproduced** then class-fixed. `/housing-market` Aug 10 vs Aug 16 stamps **reproduced** then class-fixed. Chart JAN/DEC bunched in the Y gutter **reproduced** then class-fixed. `/neighborhoods/tetherow` 35 vs 28 **rejected** (200 + H1 Page not found). Terrebonne days-to-pending **rejected** (pulse null). Powell Butte this-month median **rejected** (July median sale `$1,263,000`). `/neighborhoods` reused Awbrey aerial **rejected** (three distinct curated photos).
- Class: `publishPlaceBrowseHref` / `publishPlaceHeroCta` withhold `/homes-for-sale` and `?view=list`. `looksLikeMlsAbbreviation` drops WildflS / SkylinC / Fairway Vill Condo from the A-Z catalog (Triple / Inn Of The 7th stay as recorded English). `publishInstrumentStamp` withholds a mixed Instrument clock. V3Chart x-axis is `grid-column: 2`. Gates `ci:publish-place-browse` 7/7 and `ci:publish-mixed-instrument-stamp` 4/4.
- Prod probe after READY `90155dcf8`: Ridge hero + Browse homes + list door are `/homes-for-sale/redmond/ridge-at-eagle-crest` (12 cards). Housing-market lead has **no** `updated` (clocks differ); city/SFR stamps are Aug 18. Chart ticks Jan x=134 / Dec x=1169 at 1280. After shots `/opt/cursor/artifacts/after_ridge-at-eagle-crest_{390,1280}.png`, `/opt/cursor/artifacts/after_housing-market_{390,1280}_chart.png`, `/opt/cursor/artifacts/after_subdivisions_{390,1280}_az.png`.
- Punch dispositions appended (parent not completed): 4 fixed + 4 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list. Known leftovers that this class already killed as instances: `7c15bd27` / `0637cc1d` (same chart-axis + mixed-stamp observations). Next slice should reproduce-or-reject them, not invent a second fix.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages featured-inventory + reject slice

**Surface:** Cursor cloud `bc-028b80c5` (`cursor/loop-sentinel-2026-08-18t07-30-da07`). **Time:** 2026-08-18 ~08:30 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 268). Claimed parent only as `cursor-loop-sentinel-bc-028b80c5-2026-08-18t07-30`. Product **`9f207c4cc`** landed on **`main`**. Vercel Production **READY** for `9f207c4cc` (`CqDNRaMXqjCVQsqZ6ToXpf74UwFV`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (260 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/subdivisions` featured strip zeros **reproduced** then class-fixed. Before: `featuredActive [0,2,12,0,0,5,0,3,0,0,8,0]`, **7 zeros**. After READY: `[14,12,12,11,8,7,6,5,3,3,2,9]`, **0 zeros**. `/subdivisions/brookswood-crossing` 404 **rejected** (200 + H1 + empty-state + sales history). `/subdivisions/brooktree` 404 **rejected** (200 + H1 + listing cards + sales history). `/schools/summit-high` empty map **rejected** (`.v3-field__map` 350×263 / 586×440; 6/9 Google tiles). `/oregon/portland` out-of-area **rejected** (`outsideMarket=true`; 19 all-type / 12 SFR / $505k from `geo_snapshot_mv`). `/housing-market` 5707 vs 5691 **rejected** (ALL-TYPE 5,707; eight type cards including Farm/ranch 11 + Other 5 sum to 5,707). Mix chart slivers **rejected** (8 segments + ordered list). `/communities/tetherow` 35/28 **rejected** (hero **34** homes; **See all 34 Tetherow homes for sale**).
- Class: `publishFeaturedPlats` prefers the highest verified SFR count per community and does not pad featured tiles with 0 ACTIVE sibling aliases. Wired `/subdivisions` after inventory fetch. Gate `ci:publish-featured-plat-inventory`. Zeros stay on the A-Z index. Do not invent inventory.
- Prod probe after READY `9f207c4cc`: featured strip **0 zeros** at 390 and 1280 (`[14,12,12,11,8,7,6,5,3,3,2,9]`). Tile shots `/opt/cursor/artifacts/after_subdivisions_{390,1280}_featured_tiles.png`. Also `/opt/cursor/artifacts/after_brookswood-crossing_{390,1280}.png`, `/opt/cursor/artifacts/after_tetherow_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages street-0 + venue-city slice

**Surface:** Cursor cloud `bc-d14c774b` (`cursor/loop-chain-2026-08-18t06-04-137f`). **Time:** 2026-08-18 ~07:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 284). Claimed parent only as `cursor-loop-chain-bc-d14c774b-2026-08-18t06-04`. Product **`c3b968afb`** landed on **`main`** (class `cef36790f` + founding-list follow-up). Vercel Production **READY** for `c3b968afb` (`4AmF8K5eMUkDDCffWa43wWd2yYK8`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (276 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/central-oregon/events/sunriver-music-festival` “Tower Theatre, Bend in Sunriver” **reproduced** then class-fixed. `/cities/bend/awbrey-butte` cards printed **0 Moonshadow Court** **reproduced** then class-fixed (MLS 220221237 / 220221242 / 220221243). Tower Theatre / Pilot Butte / Tumalo Falls empty map **rejected** (tiles after load). Barclay Meadows Aw Snap **rejected** (200 + H1 + empty-state). Brentwood / Brier Ridge 404 **rejected** (200 + H1).
- Class: `publishStreetLine` withholds MLS house number 0 and keeps the street name. `publishPlaceInCity` withholds the page city when the venue already names one. Wired dual-pane `splitRowsFromTiles`, KB ticker / featured / map / activity, v3 field titles, listing cards, nearby lifestyle DAL, looking-at. Gates `ci:publish-street-line` 8/8 and `ci:publish-place-in-city` 4/4. Do not invent a house number.
- Prod probe after READY `c3b968afb`: Awbrey Butte list + ticker print **Moonshadow Court**, 0× `0 Moonshadow`. Festival Where is **Tower Theatre, Bend**, 0× `Bend in Sunriver`. After shots `/opt/cursor/artifacts/after_awbrey-butte_{390,1280}.png`, `/opt/cursor/artifacts/after_sunriver-music-festival_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages chrome-only + Terrebonne days + event map reject slice

**Surface:** Cursor cloud `bc-17952d67` (`cursor/loop-sentinel-2026-08-18t05-50-59a3`). **Time:** 2026-08-18 ~06:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 292). Claimed parent only as `cursor-loop-sentinel-bc-17952d67-2026-08-18t05-50`. **No product change.** Production stays on last product **`0f57f5e7c`** (already READY; tip `b35d5eacc` docs). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (284 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: six `/subdivisions/{slug}` chrome-only lines **rejected**. Aubrey Heights / Blue Chip Ranch: H1 + listing cards + sales history. Chase Village / Chloe Estates / Brookswood Estates / Brentwood: H1 + “No active listings…” + sales history. GIS plats exist (`boundaries` 3,213; all six slugs present). `/housing-market` Terrebonne missing days-to-pending **rejected** — pulse city `terrebonne` methodology `v3-2026-05-07` `median_days_to_pending=null` (Metolius also null); page omits unverified days. `/central-oregon/events/bend-farmers-market` empty map **rejected** — `.v3-field__map` 586×440 / 350×263 with 36/33 Google tiles after load. HTML + Playwright (system Chrome) at 390 and 1280; `chromeOnly=false` on every row.
- Class: none. Fleet chrome-only / invented days / empty map did not reproduce. Do not invent a fix.
- Prod probe on live `0f57f5e7c`: H1 visible in-viewport (390 h1Top 486; 1280 h1Top 381). Terrebonne row `6 FOR SALE Terrebonne $685,000`. After shots `/opt/cursor/artifacts/after_chloe-estates_{390,1280}.png`, `/opt/cursor/artifacts/after_blue-chip-ranch_{390,1280}.png`, `/opt/cursor/artifacts/after_aubrey-heights_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages subdivision chrome-only reject slice

**Surface:** Cursor cloud `bc-e3dbb660` (`cursor/loop-chain-2026-08-18t04-58-faa9`). **Time:** 2026-08-18 ~05:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 308). Claimed parent only as `cursor-loop-chain-bc-e3dbb660-2026-08-18t04-58`. **No product change.** Production stays on **`ab140f397`** (already READY). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (300 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: all eight `/subdivisions/{slug}` chrome-only lines **rejected**. Bella Vista / Blue Ridge / Brookside / Buena Ventura: H1 + “No active listings…” + sales history. Big Sky / Brier Ridge / Black Bear Meadows / Boyd Crossing: H1 + 2 listing cards + sales history. HTML + Playwright (system Chrome) at 390 and 1280; `chromeOnly=false` on every row.
- Class: none. Fleet chrome-only did not reproduce. Do not invent a fix.
- Prod probe on live `ab140f397`: H1 visible in-viewport (390 h1Top 486–527; 1280 h1Top 329–381). After shots `/opt/cursor/artifacts/after_bella-vista_{390,1280}.png`, `/opt/cursor/artifacts/after_boyd-crossing_{390,1280}.png`, `/opt/cursor/artifacts/after_big-sky_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages this-month median + chrome-only reject slice

**Surface:** Cursor cloud `bc-812b6297` (`cursor/loop-chain-2026-08-18t02-04-a235`). **Time:** 2026-08-18 ~02:42 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 340). Claimed parent only as `cursor-loop-chain-bc-812b6297-2026-08-18t02-04`. Product **`c2c6c0fb0`** landed on **`main`** (class `0ed74366e` + compile follow-up). Vercel Production **READY** for `c2c6c0fb0` (`7dQpSydh4ZJfEFAGnPrVgttrkuZ8`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open** (332 leftover lines). Release skipped: another session (`cursor-loop-chain-2026-08-18-bc-0a79e0c8`) holds the parent `in_progress`. Do not steal. Do not `completeWorkNode`. Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/housing-market/powell-butte` this-month median absent **reproduced** then class-fixed. Cache city `powell butte` methodology `v3-2026-05-07` August monthly `sold_count=1` `median_sale_price=null`; July complete `$1,262,500` / 6; YTD `$1,200,000` / 35; rolling 365d `$1,334,500` / 52. Seven `/subdivisions/{slug}` chrome-only lines (altura, american-west, antler-crossing, arborwood, awbrey-meadows, big-sky-country, arrowdale) **rejected** — H1 + “No active listings…” + sales history at 390/1280.
- Class: `publishCompleteMonthMedian` publishes this-month median only when the current-month cache row has a verified median; otherwise last complete month as `{Month} median sale`. Wired DAL `getCompleteMonthlyMarketDetail` + public housing-market + `_v3` figures + broker SMS `market_stats` + G-publish-complete-month-median (6/6).
- Prod probe after READY `c2c6c0fb0`: Powell Butte **July median sale `$1,263,000`** (`formatPrice` nearest-thousand of `$1,262,500`); 0× “this month median”. After shots `/opt/cursor/artifacts/after_powell-butte_{390,1280}.png`, `/opt/cursor/artifacts/after_altura_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list. Leave the parent claim with `cursor-loop-chain-2026-08-18-bc-0a79e0c8`.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages alias 308 + MLS plat names slice

**Surface:** Cursor cloud `bc-1d730b67` (`cursor/loop-chain-2026-08-18t00-28-e09f`). **Time:** 2026-08-18 ~01:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 364). Claimed parent only. Product **`aa4c62d67`** landed on **`main`**. Vercel Production **READY** for `aa4c62d67` (`3nZFnPSbtSAVLzWquxqMkfvJG7q2`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (356 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Awbrey index 52 vs page 63 **rejected** (both 64). Ridge 12/$910k vs 14/$535k **rejected** (both 12 / $909,950). `/housing-market` SQL leak **rejected** (no `closed_cte`). All 13 `/neighborhoods/{slug}` 404 **reproduced** then class-fixed. River Meadows More areas Oww / DrrhTrs **reproduced** then class-fixed. Tetherow Regional median **rejected** (string gone). `/housing-market/central-oregon` SQL leak **rejected**. Pronghorn 23-day pending + 0 Closed **rejected** (0 Closed honest; median-to-pending null).
- Class: `publishPlatDisplayName` withholds MLS abbreviations on peer plats and place-context. `resolveNeighborhoodAliasRedirect` 308s Bend districts in middleware (page-level `permanentRedirect` was a soft 200 under Next 16). Gate `ci:publish-place-names` 6/6.
- Prod probe after READY `aa4c62d67`: `/neighborhoods/awbrey-butte` **308** → `/cities/bend/awbrey-butte` (64 homes). `/neighborhoods/tetherow` does not 308. River Meadows More areas: Sun Dance / Deschutes River Recreation Homesites, **0** of Oww / DrrhTrs / OWW2. After shots `/opt/cursor/artifacts/after_neighborhoods_awbrey_308_{390,1280}.png`, `/opt/cursor/artifacts/after_river_meadows_peers_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — seller valuation name + 24h + Places overlay slice

**Surface:** Cursor cloud `bc-53dadb0e` (`cursor/loop-chain-2026-08-17t23-20-af1f`). **Time:** 2026-08-18 ~00:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:seller` (8 of 372). Claimed parent only. Product **`109af2b3b`** landed on **`main`**. Vercel Production **READY** for `109af2b3b` (`47HoMGUP4L9YwxA2hsu8LBmjHrYB`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (364 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 seller lines) at 390+1280: Step 2 required Your name **reproduced** (`name=name` `required`). Places `.pac-item` over Value my home at 390 **reproduced**. Confirmation missing 24-hour SLA **reproduced** in source. Address clear after select **rejected** (Somerset / Greenwood stuck). Step 2 reset while typing phone **rejected** (503 / 541 stayed on step 2). Bend median format mismatch **rejected** (visible `$755,000` once; `$$755,000` is RSC `$` escape).
- Class: `publishSellValuationConfirm` + `sellQualifyNameRequired()`. Email required, name optional, confirm names **within 24 hours**. `AddressAutocomplete` reserves `pb-48` while open and removes its `.pac-container` on unmount. Gate `ci:publish-sell-valuation` 5/5.
- Prod probe after READY `109af2b3b`: name input `required=false`, label Your name (optional). Value my home clickable under open suggestions. Fleet-identity confirm: **within 24 hours**, no business day. After shots `/opt/cursor/artifacts/after_sell_{390,1280}_{step1,pac,step2,median,confirm}.webp`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover seller + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-096/R-132, SITE_PAGE_STANDARD §5, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — listing-detail history + unmute slice

**Surface:** Cursor cloud `bc-738b62c1` (`cursor/loop-chain-2026-08-17t22-07-294b`). **Time:** 2026-08-17 ~23:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 380). Claimed parent only. Product **`8ce73d3d2`** landed on **`main`** (history merge `386ad65da` + `zonedDateKey` `5f2aaea32` + timeout seed). Vercel Production **READY** for `8ce73d3d2` (GitHub Vercel success `EVe1nnE1ozvKACJeuxHk3Emydmfn`). Draft PR **#90**. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (372 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Borden / Rockway / Breezes missing history **reproduced** (`listing_history` empty; live `status_history` + `OnMarketDate` unused). Rockway UNMUTE on still **reproduced** (Zillow view-imx in `details.Videos`, zero `<video>`). Stale Aug 15 open house **rejected** (`OpenHouses` null, Pending, no Open houses heading).
- Class: `publishListingHistory` merges `listing_history` + `status_history` + `price_history` + Listed from `OnMarketDate`. `publishListingHeroUnmute` is video-tag only; 3D/Zillow rows are virtual tours. Timeout seed: `readListingDetailHistory` falls back to Listed from the already-loaded listing so a 3s empty ISR cannot hide the section. Gate `ci:publish-listing-history` 5/5.
- Prod probe after READY `8ce73d3d2`: Borden **listed-2026-07-22 $487,000**; Rockway **pending-2026-08-17 + listed-2026-07-31 $649,000**, no UNMUTE; Breezes **listed-2026-08-08 $1,250,000**. After shots `/opt/cursor/artifacts/after_history_{borden,rockway,breezes}_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 7 fixed + 1 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.
- Known leftover on this family: `PropertyHistory` `formatDate` shifts date-only `YYYY-MM-DD` one calendar day earlier in PT (`new Date('2026-07-22')` → Jul 21). Event keys are correct; display is not. Next listing-detail slice should format through `zonedDateKey`, not UTC midnight.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-094/R-105/R-152/R-101, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-17 (cursor-grok-tile-mv-probe) — listing_tile_mv health probe

**Surface:** Cursor desktop on `/Users/matthewryan/RyanRealty`. **Time:** 2026-08-17 ~22:45 UTC. Matt asked to fix the CRM health text that paged on `listing-tile-mv-stale`. This is **not** a FLEET-PUNCH / `fleet:public-ux:search` ship. Claimed data-sync node **`56aa39db`** only. Product **`9e06e018`** landed on **`main`**. Vercel Production **READY** (`dpl_AuMtN6UH4Dre8CAQ4XGSvVVDhDqS`, `npm run deploy:verify` exit 0). No PR. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open**. Loop stays **ARMED**. Do not start leftover search from this session.

**Done**
- Rule 8 pages on `mv_refresh_state.listing_tile_mv_src.refreshed_at` age ≥ 2 hours, not `mv_freshness().lag_days`. Friday-to-Monday CloseDate gap (alert 1013, 2026-08-17 18:11Z) stays quiet while the `:02/:32` tile job is live. The 8-day stamp-stale class still critical.
- Cron message names `refresh_listing_tile_mv_30min` and `/api/cron/refresh-mvs`.
- 54 `lib/crm/health-rules` tests. Node **`56aa39db` done** with READY evidence.
- CMA WIP remains on `cursor/cma-client-document-7fc3` + stash `cma-wip-keep-probe`. Do not mix it into this ship.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice.
- Optional later: `mv_freshness()` can return `refresh_age_hours`; residual Sat/Sun `server restarted` on long tile refreshes.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, deployments-cicd.

# Prior — 2026-08-17 (cursor-loop-chain) — search pending status chrome slice

**Surface:** Cursor cloud `bc-1dc8ed53` (`cursor/loop-chain-2026-08-17t21-15-4427`). **Time:** 2026-08-17 ~21:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 396). Claimed parent only. Product **`f7383a332`** landed on **`main`**. Vercel Production **READY** (`6H84kwqZR9MjxdwkZbJHBFJK1REy`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (388 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: acreage Aw Snap **rejected** (200, heading renders). Pending chip For Sale / no Pending cards **reproduced**. First card → `/subdivisions` **rejected** (listing href). No Alerts / missing Alerts at 1280 (2 lines) **rejected** (Save is the alert; Get listing alerts 121×28). Count/sort clipped at 1280 **rejected** (1,279 homes + Sort Newest visible). Map/List overlay at 390 **rejected** (List/Map y=255). Save name-only dialog **rejected** (Email alerts + you@email.com).
- Class: `publishSearchStatusChip` + `publishListingStatusBadge`. SearchFilterBar, SEO list cards, and map cards name pending/sold. Gate `ci:publish-search-status` 5/5.
- Prod probe after READY `f7383a332`: pending chip **Under contract only**. First card **Pending $1,199,000** 2999 Three Sisters. 9 Pending badges. After shots `/opt/cursor/artifacts/after_pending_{390,1280}_{top,cards}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — search Homes door + 390 sort slice

**Surface:** Cursor cloud `bc-16d00c5f` (`cursor/loop-sentinel-2026-08-17t20-40-4ced`). **Time:** 2026-08-17 ~21:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 404). Claimed parent only. Product **`d12437028`** landed on **`main`**. Vercel Production **READY** (`7eWxd8WGZ9tguq5rDggg2QGztuSV`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (396 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: chips 0x0 **rejected** (For sale/Beds/Baths 79×44; Price probe matched Price drops). Homes + See homes Bend inject **reproduced**. Watching bar onto `/join` **rejected** (clean visit false). All-filters no panel / missing alerts / left-offset / tap-noop (4 lines) **rejected** (sheet 390×844, Owner financing unclipped; Save is the alert). Count/sort clipped **reproduced** (390 sort sat on the chip row).
- Class: Buy/Homes doors use `REGIONAL_SEARCH` / `REGIONAL_SEARCH_HREF` (`/homes-for-sale?view=list`). `.search-app-frame` drops the leftover 64px offset; filter dock stays in flow. Gate `ci:publish-regional-search-href` 12/12.
- Prod probe after READY `d12437028`: Homes href + 1280 click land on **`/homes-for-sale?view=list`**, **3,380 homes found**, no Showing Bend only. 390 map: chips y=198, **Newest y=255**, **1,279 homes** visible above the first card. After shots `/opt/cursor/artifacts/after_homes_1280_regional_list.png`, `after_search_390_sort_count_visible.png`, `after_search_list_390_regional.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — homepage regional grain + remainder slice

**Surface:** Cursor cloud `bc-191234c4` (`cursor/loop-chain-2026-08-17t17-08-2150`). **Time:** 2026-08-17 ~17:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:site` (8 of 412). Claimed parent only. Product **`d400501f5`** landed on **`main`**. Vercel Production **READY** (`D2VDAjEH2M5nExLQB94EjA6CtiZL`, `npm run deploy:verify` exit 0). Draft PR **#88** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (404 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 site lines) at 390+1280: featured plat 8/12 zero **rejected** (no plat strip on `/`; 4 community cards). Town-door sum vs hero 1,823 **reproduced** (delta 895). Six town rows broken **rejected** (6 visible, fill opacity 1). SEE EVERY COMMUNITY overlap **rejected** (contrast 14.23). Dual/triple primary CTAs (3 lines) **rejected** (See homes filled + Value my home ghost; Search is form submit). Watching sheet on first load **rejected** (clean visit false; residual cookie only).
- Class: hero lead names regional grain (`across Central Oregon`). Town doors call `namePulseCityRemainder` + `formatPulseCityRemainderPublic`. Gate `ci:pulse-city-remainder` covers `app/page.tsx`. Remainder CSS appended at end of `kb.css` so `ci:css-layers` baseline line numbers stay put.
- Prod probe after READY `d400501f5`: hero **1,823 homes for sale across Central Oregon**. Town remainder names Black Butte Ranch / Camp Sherman / Culver / Madras / Metolius / Powell Butte / Prineville + **646 more** outside town rows. After shots `/opt/cursor/artifacts/after_home_{390,1280}_{hero,towns}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover site + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — search card ask + filter sheet slice

**Surface:** Cursor cloud `bc-decba6c7` (`cursor/loop-chain-2026-08-17t13-06-4a94`). **Time:** 2026-08-17 ~13:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 436). Claimed parent only. Product **`19ef79d81`** landed on **`main`**. Vercel Production **READY** (`8J6smhg5f6yasqpoNzKMMY9WAUwX`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (428 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: Summerfield card $2,000,000 vs H1 $1,999,900 **reproduced**. Save/Alerts (2 lines) **rejected** (Save is the alert; Get listing alerts at 1280). All-filters Owner finan clip **reproduced**. Rainier price/status history **rejected** (listing-detail). Sold timeout **rejected** (200, empty map, no timeout). Chips 0x0 at 390 **rejected** (79x44 tappable). Dismiss without Apply **rejected** (cancel).
- Class: `ListingCard` + `VideoListingCard` use `formatPublishedAsk`. All-filters `data-[side=right]:w-full` + wrapping boolean labels. Gate `ci:publish-listing-ask` 15/15.
- Prod probe after READY `19ef79d81`: search card **$1,999,900** (0 of $2,000,000). Sheet **390 wide, Owner financing unclipped**. After shots `/opt/cursor/artifacts/after_summerfield_390_card_in_view.png`, `after_search_{390,1280}_filters.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — blog MOS verdicts + index uniqueness slice

**Surface:** Cursor cloud `bc-791e34a1` (`cursor/loop-chain-2026-08-17t12-16-0077`). **Time:** 2026-08-17 ~12:30 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 444). Claimed parent only. Product **`b4f03efdc`** landed on **`main`**. Vercel Production **READY** (`FxtYpHcRf1RTbkLxzKfCS1DWEgnw`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (436 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: CO July 5.4 as middle + buyer **reproduced**. Bend July 474 vs 512 **rejected** (June 30 vs July 9 grains). Index Vacation Rental on p2 and p3 **reproduced**. MOS excerpt July vs body Aug 17 **rejected**. Checklist days 6-24 **rejected** (range headings). Redmond related-homes / See Redmond homes **rejected**. Closing Talk to a broker **rejected**. Sell-Bend overflow **rejected** (`scrollWidth===clientWidth`).
- Class: `rewriteBlogMosVerdicts` uses `marketVerdict()` (≤4 seller's, <6 balanced, ≥6 buyer's) after `rewriteBlogCurrentMos`. `publishBlogIndexItemList` uses collection-global positions + `published_at`+`id` order (`published-blog-posts-v4`). Gates `ci:publish-blog-mos-verdicts` + `ci:publish-blog-index-list`.
- Prod probe after READY `b4f03efdc`: CO July **Sunriver 12.0 + La Pine 11.4 buyer; Madras 5.4 balanced**. `/blog?page=2` positions 13-24; `/blog?page=3` 25-36; overlap empty. After shots `/opt/cursor/artifacts/after_co_july_1280_body.png`, `after_*_{390,1280}_*.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — blog NW Crossing alias slice

**Surface:** Cursor cloud `bc-b9425f1f` (`cursor/loop-sentinel-2026-08-17t11-40-d87e`). **Time:** 2026-08-17 ~12:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 426). Claimed parent only. Product **`f29d930dd`** landed on **`main`**. Vercel Production **READY** (`FwWvpPVpzcSGr7eMH7m5H7xs2ktx`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (418 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: June-vs-May **rejected** (report month vs May closings). NW Crossing related-homes **reproduced** as Bend rail. $475k vs $500k **rejected** (attached floor vs overall). Schools scroll **rejected** (ids unchanged). Eagle Crest related-homes **rejected** (already Eagle Crest). Buyers related-homes / blank MORE RESOURCES **rejected** (Bend homes + explore populated). Buyers vs 3.6 months **rejected** (body already not-a-full-buyer). Dining related-homes / Value my home **rejected** (lifestyle withhold + Talk to a broker).
- Class: `matchGeoLinksForPost` accepts registry slugs + `COMMUNITY_ALIASES` (`nw crossing`, `nwx`) so a neighborhood short name wins over city Bend. Gate `ci:publish-blog-related-homes` 7/7.
- Prod probe after READY `f29d930dd`: NW Crossing **#related-homes NorthWest Crossing homes** / See NorthWest Crossing homes / $1,549,500. Eagle Crest still Eagle Crest. Dining: no related-homes, Talk to a broker. After shots `/opt/cursor/artifacts/after_nwx_{390,1280}_nwx_homes.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — blog related-homes / CTA slice

**Surface:** Cursor cloud `bc-e459ecbb` (`cursor/loop-chain-2026-08-17t10-35-b6a3`). **Time:** 2026-08-17 ~11:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 442). Claimed parent only. Product **`10a8a7a77`** landed on **`main`**. Vercel Production **READY** (`PKBGTWs5K9Bcdg7SdpsVyvLfSarC`, `npm run deploy:verify` exit 0). Draft PR **#82** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (434 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: Brasada / Bend-retirees / Caldera related-homes **reproduced** (no `#related-homes` before). Arts + retirement related-homes **rejected** (lifestyle tags, no buyable place). Arts + retirement missing CTA **reproduced**. Retirement numbers-disagree **rejected** (CMS ranges; no same-label pair).
- Class: `publishBlogRelatedHomes` + `matchBuyablePlaceForPost` (community via geo links; city only with buy-intent). `publishBlogContextualCta` → See {place} homes vs Talk to a broker `/contact`. Gate `ci:publish-blog-related-homes` 6/6.
- Prod probe after READY `10a8a7a77`: Brasada **#related-homes** $1,425,000 / See Brasada Ranch homes. Bend retirees **Bend homes** $750,000 / See Bend homes. Caldera **$3,400,000** / See Caldera Springs homes. Arts + retirement: no related-homes, **Talk to a broker → /contact**. After shots `/opt/cursor/artifacts/after_{brasada,caldera,bend_retirees}_1280_homes_clear.png`, `after_{arts,retirement}_1280_cta_clear.png`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — place-pages resort index 12-vs-35 slice

**Surface:** Cursor cloud `bc-99eda833` (`cursor/loop-sentinel-2026-08-17t09-40-82e4`). **Time:** 2026-08-17 ~10:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 450). Claimed parent only. Product **`f76383e76`** landed on **`main`**. Vercel Production **READY** (`GRTMbTeioUET9JxfiSDTY4MyPL3y`, `npm run deploy:verify` exit 0). Draft PR **#81** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (442 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Big Sky / Calaveras $756k/18 days **rejected** (hero silent). Housing-market wheel nav **rejected** (URL unchanged). Larkspur Grotto $1,238,000 vs $1,238,136 **rejected** (exact $1,238,136 only). `/neighborhoods/tetherow` **rejected** (404). `/communities` 19/$2.25M **rejected as stated**. Homepage Tetherow 12 vs page 35 **reproduced**; A-Z also 12.
- Class: `publishResortIndexFigures` + `getRegistryResortPublicFigures` overlay alias-aware count/median on homepage, `/communities` flagship + A-Z, and `getCommunityBySlug`. City door = registry city + `mls_cities` (a global pile inflated Tetherow to 48 via Triple). Gate `ci:publish-resort-index-figures` 6/6.
- Prod probe after READY `f76383e76`: homepage **Tetherow 35 ACTIVE**, `/communities` A-Z **Tetherow Bend · 35 homes**, `/communities/tetherow` **35 / $1,499,000**. After shots `/opt/cursor/artifacts/after_v6b_{home,communities,tetherow}_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages hero-empty / regional / ask slice

**Surface:** Cursor cloud `bc-2843f15f` (`cursor/loop-chain-2026-08-17t09-06-ba29`). **Time:** 2026-08-17 ~09:45 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 458). Claimed parent only. Docs/probe **`2d8accfe5`** landed on **`main`**. Vercel Production **READY** (`BMKP2RCrCs7BAKvShrAykFtDpjMy`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (450 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Calaveras / Blakley / Aspenwood / Canyon Breeze / Aubrey Heights hero-count vs empty list **rejected** (hero silent; lists 5 / 8 / 1 / 1 / 1). 1925 Townhomes 155 Closed + $756k/18 days **rejected** (sales history 33 SFR; 1 card $999,000). Bend Park $756k/18 days **rejected** (hero silent; 4 cards). Summit West $2,035,000 vs $2,034,500 **rejected** (list + ticker both $2,034,500 / $1,999,900).
- No class-fix. Prior plat-inventory + publishPlatFigures + formatPublishedAsk already hold. Probe `scripts/probe-place-pages-punch-v5.mjs` + shots.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024/R-110/R-020, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — homepage ArrivalIntent quiz unmount

**Surface:** Cursor cloud `bc-8f43d00f` (`cursor/loop-chain-2026-08-17t08-22-7277`). **Time:** 2026-08-17 ~09:05 UTC. Brief served **solo Matt CHANGE** `08152acc` (class of one). Claimed that node. Product **`df1a8bfd8`** landed on **`main`**. Vercel Production **READY** (`3doPtMka2BFtvCg7uLj2c8GbthAS`, `npm run deploy:verify` exit 0). Draft PR **#80** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). Node **`08152acc` done**. FLEET-PUNCH parent stays open (other session). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Clean-cookie `/` at 390+1280: Buy/Sell/Look quiz under V3Chrome **reproduced** (`quizNav` y=57, links y=69, hero 512/423).
- Class: unmounted ArrivalIntent from `app/page.tsx`, deleted `ArrivalIntent.client.tsx` (reachable-exports), mounted `V3SectionTracker` so public-ui B does not grow. D103 + homepage-v6 parity + R-218. No new modal.
- Prod probe after READY `df1a8bfd8`: `quizNav` false, no Buy/Look quiz, header Sell only, hero 444/355. After shots `/opt/cursor/artifacts/after_home_{390,1280}_top.png`.
- Node `08152acc` completed with READY SHA evidence.

**Next**
- Next `loop-brief` serves the next ship class. Leftover punch families stay on FLEET-PUNCH.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-113/R-218, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages exact list-median slice

**Surface:** Cursor cloud `bc-96d8d9d5` (`cursor/loop-chain-2026-08-17t07-47-939f`). **Time:** 2026-08-17 ~08:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 474). Claimed parent only. Product **`3168f52fc`** landed on **`main`**. Vercel Production **READY** (`8722cBnVRL22wcBTFxC8U4urHKHQ`, `npm run deploy:verify` exit 0). Feature branch same SHA (no PR: no diff vs `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (466 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Southern Crossing hero $919,500 vs HUD/FAQ/sell $920,000 **reproduced**. Tetherow $1,200,000 vs $1,199,500 **rejected** (median $1,499,000; $1,199,500 is Brookside Way). NWX High Lakes / Ordway card rounds **rejected** (already exact). Widgi 10 vs 23 / Regional **rejected**. Awbrey Court 155 Closed vs 26 **rejected**. Amber Springs / Bailey / Bradetich Park hero-count vs empty list **rejected** (hero silent; list 2 / 2 / 1).
- Class: `kbMoneyFull` and `buildMarketFaq` print exact whole dollars for list medians. Activity ledger uses `formatPublishedAsk`. Gate `ci:publish-listing-ask` 13/13.
- Prod probe after READY `3168f52fc`: Southern Crossing **$919,500** on hero + HUD + FAQ (0 of $920,000). NWX **$1,199,900** on hero + HUD + sell (0 of $1,200,000). After shots `/opt/cursor/artifacts/after_v4_southern_crossing_{390,1280}_{top,hud}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS §0 plat row.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages inventory / ask / Tumalo slice

**Surface:** Cursor cloud `bc-3a2506e2` (`cursor/loop-chain-2026-08-17t06-56-2ebd`). **Time:** 2026-08-17 ~07:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 482). Claimed parent only. Product **`d3bff1ccb`** landed on **`main`**. Vercel Production **READY** (`npm run deploy:verify` exit 0). Draft PR **#78** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (~474 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: South Meadow 0 vs 3 MLS **reproduced**. Tumalo 307→Bend **reproduced**. Deer Park / Deschutes River Recreation Homesites / Rivers Edge Village count+median **rejected** (own inventory). Boyd Acres / Old Bend / Southern Crossing thousand-round asks **reproduced**.
- Class: plat city aliases (`rowMatchesPlat`) so Sisters-keyed South Meadow matches City=`Black Butte Ranch`. Pulse-only city door for Tumalo (redirect removed). `formatPublishedAsk` / `formatPriceExact` on place-owned list and median. Do not cache empty plat inventory when supabase is missing (`registry-plat-public-inventory-v3`).
- Prod probe after READY `d3bff1ccb`: South Meadow **3 / $795,000**. Tumalo **200** at `/cities/tumalo`, 0 homes, Tumalo copy. Deer Park 12 / $862,498. DRRH 14 / $789,950. Rivers Edge 11 / $1,159,000. Boyd **$949,900** / **$899,900**. Old Bend **$1,999,500**. Southern Crossing median **$919,500**. After shots `/opt/cursor/artifacts/after_v3_{south_meadow,tumalo,boyd_acres,old_bend,southern_crossing}_{390,1280}_top.png`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS §0 plat row.

# Prior — 2026-08-17 (cursor-loop-chain) — listing-detail HOA / ask / contact slice

**Surface:** Cursor cloud `bc-42b57373` (`cursor/loop-chain-2026-08-17t04-57-75e4`). **Time:** 2026-08-17 ~05:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 506). Claimed parent only. Product **`cf90a3c2e`** landed on **`main`**. Vercel Production **READY** (`F3jT3EERo8nwXtMpMdLnfUZ4jK73`). `npm run deploy:verify` exit 0 in 448s. Draft PR **#72** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (498 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280 on production before the ship: Hilmer contact MLS **reproduced**. 7th / Horse / Kokanee / Hudspeth / Canyons / Foley HOA **reproduced** (Facts nearest-thousand vs True cost exact). 7th + Hudspeth ask **reproduced** (H1 thousand-round vs JSON-LD). Kokanee baths 3 vs 2.5 **rejected** (hero `BathroomsTotal`, remarks are MLS prose). Bryant crash **does not reproduce** (200, H1 $1,073,000).
- Class: `publishListingHoa` exact monthly on Facts + True cost + CMA fee fallback. `publishListingAsk` / `publishListingDrop` exact `ListPrice` on H1 + drop. `publishListingContactKey` prefers `ListNumber`; `/contact` resolves listingKeys + listNumbers. Gates `ci:publish-listing-hoa` 3/3, `ci:publish-listing-ask` 3/3, `ci:publish-listing-contact-key` 4/4.
- Prod probe after READY (`PROBE_PREFIX=after_`): 7th H1 **$424,990** = JSON-LD; Facts HOA **$45** = True cost. Foley **$22**. Canyons **$1,529**. Hudspeth **$629,500** / drop **$15,500** / HOA **$160**. Hilmer `/contact?listingKey=220222626` shows **61172 Hilmer Creek**. Horse **$70**. Kokanee **$42**. Bryant still 200 / $1,073,000. After shots `/opt/cursor/artifacts/after_listing_{7th,foley,hilmer,hudspeth}_{390,1280}_*.png`.
- Punch dispositions appended (parent not completed): 7 fixed + 1 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS lookup (listing HOA / ask / contact key).

# Prior — 2026-08-17 (cursor-loop-sentinel) — site regional See homes slice

**Surface:** Cursor cloud `bc-a505260a` (`cursor/loop-sentinel-2026-08-17t02-40-c49f`). **Time:** 2026-08-17 ~03:20 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:site` (8 of 518). Claimed parent only. Product **`ebd0d0279`** on this branch. Draft PR **#69**. `npm run push` gates + build green. **Production is not this SHA** — cloud run stays off `main`; `deploy:verify` found no production deploy for `ebd0d02` (vercel ls hung). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (510 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 site lines) at 390+1280 on production: Bend 484 vs city 483 **does not reproduce** (both 483 / $756,000). Get-alerts silent revert **does not reproduce** (1280 Set). Hero vs map 1,835 **does not reproduce** (both settle 1,836; mid-count is animation). Three hero CTAs **reproduced, rejected** (product lock). Two headers **reproduced, rejected** (ArrivalIntent). Town doors no photos **does not reproduce** (town-fill opacity 1). SEE HOMES → Bend **reproduced**.
- Class: `publishRegionalSearchHref` → `/homes-for-sale?view=list` on homepage See homes, towns CTA, map Browse homes, featured view-all, footer. Gate `ci:publish-regional-search-href` 8/8.
- Prod probe `scripts/probe-site-punch-prod.mjs`: `showingBendOnly: true` on live `/homes-for-sale`. Screenshots `/opt/cursor/artifacts/site_home_{390,1280}_top.png`, `site_see_homes_{390,1280}.png`, `site_bend_{390,1280}_top.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover site + other families stay on the inbox.

**Next**
- Merge PR 69 so production picks up `?view=list`. Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024/R-095, git-commit, DATABASE_FOR_AI_AGENTS lookup (regional href).

# Prior — 2026-08-17 (cursor-loop-chain) — blog gutter + live MOS slice

**Surface:** Cursor cloud `bc-1d79681c` (`cursor/loop-chain-2026-08-17t01-20-78f6`). **Time:** 2026-08-17 ~02:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 503). Claimed parent only. Product **`a17c3f4c0`** (accept probe `a58402a54`) landed on **`main` @ `18bb59e02`**. Vercel Production **READY** (`G8nDqmYjyuKXPXDmq59hbPm7LVEi`). `npm run deploy:verify` exit 0 in 734s. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (495 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines): body flush / Share clip on moving-to-redmond, preparing-home-for-sale, hb-2001, retirement (flush + first-char clip) **reproduced** at 390+1280. Self-nav on retirement **does not reproduce** (URL unchanged; related posts are arts-culture / working-remote / raising-kids). MOS 6.5 vs June 6.0 **reproduced**.
- Class: article island shares `--v3-measure` + `--v3-gutter` (`V3ArticleIsland.css`). Current MOS rewrites through `publishBlogCurrentMos` ← `getMarketPulse` + `publishMonthsOfSupply`. June `X.X in 20XX` snapshots stay. Gate `ci:publish-months-of-supply` 11/11.
- Production probe `scripts/probe-blog-punch-prod.mjs` after READY: `layoutOk` `mosOk` `navUnchanged`. Body/Share left = H1 gutter (20 @ 390, 84 @ 1280). Visible overall **Central Oregon overall: 5.7 months**. 0 of 6.5. Screenshots `/opt/cursor/artifacts/after_blog_{redmond_390_top,redmond_1280_body,mos_390,mos_1280}.png`.
- Punch dispositions appended (parent not completed): 6 fixed + 2 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024, git-commit, DATABASE_FOR_AI_AGENTS lookup (pulse only).

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages days figure slice

**Surface:** Cursor cloud `bc-d246e9da` (`cursor/loop-chain-2026-08-17t00-32-e58c`). **Time:** 2026-08-17 ~01:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages`. Matt override: punch list is the inbox, not one job. One family, p0 first, max 8 lines. Search-count / Show 409 / 390 chips skipped (already on `main`). No child tickets. No review PR. Product **`949a01e5a`**. Vercel Production **READY** (`Fp9jYCrGV3h9bcvfAzUU9mRyWF3i`). `npm run deploy:verify` exit 0. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open** (inbox). Loop stays **ARMED**.

**Done**
- Slice (8 p0 place-pages days lines): Black Butte card 40 vs FAQ 39.5; NWX 11 vs 10.5; Broken Top 9 vs 8.5; Brasada 16 vs 15.5; Redmond 20 vs 19.5; Larkspur 7 vs 6.5. Sunriver 19.5 vs 20 and La Pine 50.5 vs 51 **do not reproduce** (all 18 / all 50).
- Class: SoR `publishDaysFigure` / `publishDaysLabel`. Pulse medians land on half-days. Tenths grain. No `Math.round` on a public days figure. Gate `ci:publish-days-figure`.
- Production probe `scripts/probe-days-figure-prod.mjs` **6/6** after READY: BBR 39.5, NWX 10.5, Broken Top 8.5, Brasada 15.5, Redmond 19.5, Larkspur 6.5. Screenshots `/opt/cursor/artifacts/black_butte_days_{1280,390}.png` (hero Pending in 39.5 days) and `redmond_days_{1280,390}.png`.
- Punch dispositions appended (parent not completed): 6 fixed + 2 rejected. Larkspur price $1,238,000 vs $1,238,136 left on the inbox as a new remainder line. Search-count lines untouched.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, fleet-intake-core / ship-class punch-slice (PR 59).

# Prior — 2026-08-17 (cursor-loop-chain) — search count LIVE on main

**Surface:** Cursor cloud `bc-4382906a` (`cursor/loop-chain-2026-08-16t23-45-84b5`). **Time:** 2026-08-17 ~01:05 UTC. Rebased onto `79fb9820b` (PRs 57/58 FLEET-PUNCH intake kept). Product **`735c31037`**. Vercel Production **READY** (`dpl_FUgkMxxiq34GmTuvnmbe8geq1iVK`). `npm run deploy:verify` exit 0. PR 59 punch-list serve (`811ecbefc`) landed after that SHA — not touched, not folded. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). Loop stays **ARMED**. Eight search-class nodes stay **done**. Do not start a new ship class.

**Done**
- Rebased `cursor/loop-chain-2026-08-16t23-45-84b5` onto current main. Product commits survived. Fast-forward `main` + one `npm run push`.
- Production 2026-08-17T00:50Z (MISS, dpl_FUgkMxxiq34GmTuvnmbe8geq1iVK): `/homes-for-sale/bend` **1,298 homes for sale, all types**. FAQ question **How many single-family homes are for sale**. Answer **active single-family listings**.
- Class: SoR `publishSearchCount` / `publishSearchCountPair`. Gate `ci:publish-search-count`. Local probe ok before rebase; after rebase `ci:publish-search-count` + 190 tests including fleet-intake-core.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Next**
- Leftover 33 `fleet:public-ux:search` siblings stay open for the next iteration. Do not start them from this session.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not touch FLEET-PUNCH. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor) — fleet full site review (R-217)

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~17:15 PT. Matt: pack-only briefs were too limited; he already had the bots do a full site review. Not a fleet-node fix. Product **`5d983f76`**. Vercel Production **READY** (`dpl_5dzNFFkBD4tweMF8fdL4emzqxeui`). `npm run deploy:verify` exit 0. Production briefs confirmed: walker-mobile has SITE REVIEW and does not end on token match; Flow Prover does NOT do SITE REVIEW; content-blog lane serves. No hosted migration. No public-ux or factory ledger insert (open windows `2a5054ac` / `ba3435dd`). Loop stays **ARMED**. Ship-class R-216 stamp is Prior. FLEET-PUNCH intake (PRs 57/58) landed on the same `main` tip.

**Done**
- Live briefs no longer end walker / money / stats / lane runs on RUN-TOKEN match. Packs are the floor. Walkers walk pack cases every run, then SITE REVIEW (home, search, cities, communities, neighborhoods via `/cities/{city}/{slug}`, market, sell, team, stand-alone listing, footer). Flow Prover stays on the four flows and may END on token match (do not re-submit).
- Extra lanes Matt already stood up are now served at `/api/fleet/briefs/<bot>`: page-core, chrome-nav, content-blog, geo-cities, geo-places, geo-subdivisions, listings-*, matrix-*, LEGAL, SOCIALS, e2e-proof.
- Pack header no longer says "END this run now". R-209 amended. R-217 VERIFIED. Max pin R-217. G44 asserts SITE REVIEW + no pack-wide END. Ship-class folds `/subdivisions` and `/oregon` into place-pages; `/admin/loop` names blog posts.
- Intake already ran on the flood: ~634 findings, 570 in the last 6h, 520 open nodes. Dominant classes: plat pages, blog (related-homes / self-nav / month-vs-figures), listing inventory, place counts. Do not start instance fixes from this session — next `loop-brief` prints the ship class.

**Next**
- Extra bots that still have paste-only instructions should use the 3-line bootstrap (`GET /api/fleet/briefs/<bot-id>`) so they do not snap back.
- Next `loop-brief` prints the ship class for the incoming flood. Do not start instance fixes from this session.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, REQUIREMENTS R-209/R-216/R-217, VERIFICATION-FLEET, database-canonical-reference (findings query only).

# Prior — 2026-08-16 (cursor) — ship class: one rebuild per category

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~16:45 PT. Matt ADD (R-216). Not a fleet node. Product **`63422a30`**. Vercel Production **READY** (`dpl_4RWYnF4abxZ5wGE82DtWq1KQpVXH`). `npm run deploy:verify` exit 0. No hosted migration. No public-ux or factory ledger insert (open windows `2a5054ac` / `ba3435dd`). Loop stays **ARMED**. Southern Crossing reject stamp from `bc-b448549b` is Prior.

**Done**
- Bots were minting many same-category findings. The graph served one node per cycle; each cycle ran isolated `next build` + `deploy:verify`. That is the Build CPU burn.
- Class: `selectShipClass` groups fleet nodes by domain + surface family (place pages, search, listing detail). Planned G-rows stay a class of one. Cap 8; leftovers stay open for the next slice of the same class.
- Brief prints **SHIP CLASS** and forbids push until the printed set is locally accepted. Sentinel prompt is ONE SHIP CLASS, one `npm run push`, one `deploy:verify`. `claimShipClass` claims the set so another session cannot steal a sibling and push alone.
- `/admin/loop` says when the next items rebuild together. G44 fails if the prompt or brief regresses to one-node-one-rebuild. R-216 VERIFIED.
- Fleet finding `08704f1f` / `8a95d715` Southern Crossing index-1 vs place-23 **rejected** (does not reproduce). Production shares 3 / $920,000. Probe `scripts/probe-southern-crossing-count-prod.mjs` exit 0. R-024 coverage note only.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, REQUIREMENTS R-216, frontend-design, R-024.

# Prior — 2026-08-16 (cursor-loop-chain) — Southern Crossing index-1 vs place-23 finding rejected

**Surface:** Cursor cloud `bc-b448549b` (`cursor/loop-chain-2026-08-16t23-20-2fa9`). **Time:** 2026-08-16 ~23:35 UTC. Brief served fleet finding `08704f1f` (public-ux / fleet `8a95d715ef63989d964b9d643d2938f4`), not G16/G32. One node only. No product change. Production already **READY** on the shipped neighborhood inventory class (`9cac09b1` / plat pulse `3f34bf653`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). Finding `8a95d715` status rejected. No public-ux ledger insert (open window `2a5054ac`). Collision: `cursor-loop-chain-2026-08-16t23-20-dd33` claimed first and wrote graph evidence at 23:25:36 (xref SFR+PUBLIC_ACTIVE=3; all-types Active=23 explains the stale 23). This session independently reproduced the same reject and stamps the handoff. Rebased onto ship-class `63422a307` (R-216 stays Current).

**Done**
- Fleet finding [p0]: Southern Crossing index tile 1 active vs place hero/map 23 homes / 23 ACTIVE LISTINGS vs FAQ 3 vs visible cards ~21. FIRST STEP reproduce: it does not. Class already shipped (`getNeighborhoodPublicInventory`).
- Production 2026-08-16T23:22Z (HIT/STALE): `/neighborhoods` tile **3 Active $920,000**, `/cities/bend` row **3 Active $920,000**, place hero **3 homes for sale in Southern Crossing** + **Median list $920,000**, FAQ / Dataset Active Listings **3**, `#homes` list **3** unique inventory hrefs, hydrated map badge **3 ACTIVE LISTINGS**. 0 of 1 / 21 / 23. Probe `scripts/probe-southern-crossing-count-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/southern_crossing_count_{place,index_tile,city_nbh,city_ledger,place_map}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** ship-class R-216 `63422a307`. Awbrey 52/63/62 reject `1faedbd9b` (node `5688e089` **done**, does not reproduce). Ridge plat parent-pulse `3f34bf653` / stamp `d688cd4ef` (node `a8726dc3` **done**). Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-sentinel) — Awbrey 52/63/62 three-count finding rejected

**Surface:** Cursor cloud `bc-c33f68f1` (`cursor/loop-sentinel-2026-08-16t23-10-7e09`). **Time:** 2026-08-16 ~23:20 UTC. Brief served fleet finding `5688e089` (public-ux / fleet `c2764a13014ffde27bb0758f43bdb546`), not G16/G32. One node only. No product change. **`main` @** `d688cd4ef` + this stamp. Production already **READY** on the shipped neighborhood inventory class (`9cac09b1` / plat pulse `3f34bf653`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). Finding `87884938` status rejected. No public-ux ledger insert (open window `2a5054ac`). Collision: `cursor-loop-chain-2026-08-16t23-10-c1cd` overwrote the claim at 23:13:58 with no evidence; this session completed it.

**Done**
- Fleet finding [p0]: Awbrey Butte index tile 52 ACTIVE / $1,385,000 vs place hero 63 homes / 63 ACTIVE vs FAQ 62. FIRST STEP reproduce: it does not. Class already shipped (`getNeighborhoodPublicInventory`).
- Production 2026-08-16T23:13Z (HIT): `/neighborhoods` tile **64 Active $1,363,000**, `/cities/bend` row **64 Active $1,363,000**, place hero **64 homes for sale in Awbrey Butte** + **Median list $1,363,000**, FAQ / Dataset Active Listings **64**, `#homes` list **64** unique inventory hrefs. 0 of 52 / 62 / 63 / $1,385,000. Probe `scripts/probe-awbrey-three-counts-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/awbrey_three_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Ridge plat parent-pulse `3f34bf653` / stamp `d688cd4ef` (node `a8726dc3` **done**). Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — withhold parent pulse on registry plat pages

**Surface:** Cursor cloud `bc-99a3fd18` (`cursor/loop-chain-2026-08-16t22-47-1f61`). **Time:** 2026-08-16 ~23:10 UTC. Brief served fleet finding `a8726dc3` (public-ux / fleet `6a52801e3ef9e0d041b830497794290d`), not G16/G32. One node only. Product **`3f34bf653`**. **`main` @** `3f34bf653` + this stamp. Vercel Production **READY** (inspector `Bns3BZiz96Whq1EtiUkcFBfbbVnR`). `npm run deploy:verify` exit 0 in 671s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done**. PR **#51**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Ridge At Eagle Crest index tile 12 / $910,000 vs place hero 14 / $535,000 / pending 19.5 days (Redmond city pulse). FIRST STEP reproduce: count and median already shared after the inventory class; **Pending in 19.5 days** still matched Redmond (Eagle Crest pending is 53).
- Class: SoR `publishPlatFigures` is the plat inventory median only. Days-to-pending and 30-day sold withhold. City/community pulse must not fill the unlabeled hero or sell tail. Gate `ci:publish-plat-figures`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — place hero **12 homes for sale in Ridge At Eagle Crest** + **Median list $910,000**, 0 Pending in 19.5 days / $535,000. Index tile **12 Active $910,000**. Redmond city still prints honest $535,000 / 19.5. Probe `scripts/probe-ridge-plat-pulse-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/ridge_pulse_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one SFR count on registry plat pages

**Surface:** Cursor cloud `bc-31d1fea8` (`cursor/loop-chain-2026-08-16t22-06-cbc5`). **Time:** 2026-08-16 ~22:45 UTC. Brief served fleet finding `390ea7a4` (public-ux / fleet `37d5349b2d2e55aa62df73389d8bad85`), not G16/G32. One node only. Product **`846193510`**. **`main` @** `846193510` + this stamp. Vercel Production **READY** (inspector `HgAYesBm6C5a5D8YAHyqbaEGcWs7`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `npm run ci:gates` 223/223. No hosted migration. Loop stays **ARMED**. Node **done**. Same SHA already on `main` (no PR diff). No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Ridge At Eagle Crest index tile 12 vs place hero 14 vs `#homes` 26. Reproduced on production before the class: three queries (geo_snapshot SFR Active / featured-fetch cap / PropertyType A including townhouses).
- Class: SoR `getPlatPublicInventory` is MLS SubdivisionName in the parent city, SFR (`property_type='A'` AND `property_sub_type='Single Family Residence'`) + `PUBLIC_ACTIVE_STATUSES`. Same payload on `/subdivisions` tiles and `/subdivisions/{slug}` hero + list keys. Gate `ci:publish-plat-inventory`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — index tile **12 Active**, place hero **12 homes for sale in Ridge At Eagle Crest**, `#homes` **12** unique inventory hrefs. 0 of 14 / 26. Probe `scripts/probe-ridge-plat-count-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/ridge_count_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — Awbrey index-vs-place count finding rejected

**Surface:** Cursor cloud `bc-cfc9ebee` (`cursor/loop-chain-2026-08-16t21-49-e840`). **Time:** 2026-08-16 ~22:10 UTC. Brief served fleet finding `2d90a914` (public-ux / fleet `9f0392434899acb5c7543925a52e542b`), not G16/G32. One node only. No product change. **`main` @** `6f334748e` + this stamp. Production already **READY** on the shipped inventory class (`9cac09b1` / grain `c6c5ad1fd`). `npm run ci:gates` 222/222. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). PR **#50**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Awbrey Butte index tile 52 vs place hero/stat 63, and hero "63 homes for sale in Bend". FIRST STEP reproduce: it does not. Class already shipped earlier today.
- Production 2026-08-16T21:52Z (PRERENDER): `/neighborhoods` tile **64 Active**, `/cities/bend` row **64 ACTIVE**, place hero **64 homes for sale in Awbrey Butte**, FAQ / Dataset Active Listings **64**, `#homes` list **64** unique inventory hrefs. 0 of 52 / 63 / "homes for sale in Bend" on the place page. Probe `scripts/probe-awbrey-index-count-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/awbrey_count_{place,index_tile,city_nbh}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one published listing down-payment figure

**Surface:** Cursor cloud `bc-ee409fe5` (`cursor/loop-chain-2026-08-16t21-17-4508`). **Time:** 2026-08-16 ~21:45 UTC. Brief served fleet finding `ee37b3a4` (public-ux / fleet `0b2eea305a233f4a1d246cf2e8f1a299`), not G16/G32. One node only. Product **`aba8c2222`**. **`main` @** `aba8c2222`. Vercel Production **READY** (inspector `5BnZrcoJ1jTH6XJ35NajCE44MXam`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#49**.

**Done**
- Fleet finding [p0]: `/homes-for-sale/bend/61579-rockway-220226183` printed Monthly payment $130,000 down / $519,000 loan next to Rental analysis 20% · $129,800. 20% of the listed $649,000 is $129,800. Reproduced on production before the class.
- Class: SoR `publishFinancingSplit` is whole-dollar down plus remainder loan. Display those dollars exact, never nearest-thousand. Wired on listing Monthly payment, rental engine, estimated monthly payment, standalone mortgage calculator, and showcase payment. Gate `ci:publish-down-payment`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Monthly payment **$519,200 · $129,800 down**. Rental analysis **20% · $129,800**. 0 of $130,000 / $519,000. Probe `scripts/probe-rockway-down-payment-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/rockway_down_{1280,390}_{monthly,rental,monthly_results}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** place list medians `eff056fb2` / handoff `fd72195e6` (node `6cc544ec` **done**). page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed `a67f17d6f`. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — place list medians labeled with their geography

**Surface:** Cursor cloud `bc-b007f583` (`cursor/loop-sentinel-2026-08-16t20-10-291a`). **Time:** 2026-08-16 ~21:15 UTC. Brief served fleet finding `6cc544ec` (public-ux / fleet `5f0ec58d60988a52e76b8a559ef22f0c`), not G16/G32. One node only. Product **`eff056fb2`**. **`main` @** `9afe74a6a` + this handoff. Vercel Production **READY** (inspector `AWXRagFsuxjPARVYVgLpe1AQLsMu`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#48**.

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed $1,499,000 as Regional median. Same number as the Tetherow list median on the hero. Reproduced on production before the class. Membership Initiation / Monthly dues printed as em-dashes. RSC leaked `market_stats_cache` / `geo_slug='bend'`.
- Class: SoR `publishSellMedian` pairs a place number with `{place} median`. "Regional median" only for the region pulse. KbSell withholds a price with no caption. Empty membership facts withhold (`publishFactValue`). Public chart sources go through `toPublicCoreChartSeries` (Oregon Data Share + human geography). Wired on community, city, neighborhood, homepage, ZIP, subdivision tail, listing market charts. Gate `ci:publish-median-caption`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Tetherow footer **$1,499,000 Tetherow median**, 0 Regional median. Membership has no Initiation / Monthly dues rows. HTML has 0 table-name leaks. Homepage **$730,000 Regional median** (honest). Bend city **$756,000 Bend median**. Screenshots `/opt/cursor/artifacts/tetherow_sell_{1280,390}.png`, `tetherow_membership_{1280,390}.png`, `bend_sell_1280.png`, `home_sell_1280.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed `a67f17d6f`. Tetherow one-annual HOA `7e8c0fc99`. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor) — page-grade process KILLED

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~13:40 PT. Docs/skills only. Not a fleet node. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Matt STOP: page-grade is fucked. Kill the process (grade → flatten to pass Quiet → regrade). Not a live-site restyle.
- Both skill copies are refuse stubs (`KILLED 2026-08-16`, `Do not grade`). `ci:process-canon` asserts that.
- `PAGE-GRADE.md` is evidence, not instructions. `grade-ledger.json` `status: killed`. Look-walk stays a G9 URL set, not a regrade.
- R-215 LOCKED. R-051 amended. Max pin R-215. CLAUDE §9, PRODUCT.md, SESSION_BOOT, public-product-os, both skill registries marked dead.
- Public look is Matt keep/kill on real pages. Do not invent a replacement rubric.

**Next**
- Wait for Matt to name the source look. Do not resume the rejected unification after family. Do not run `/page-grade`.

**Do not:** product UI from this kill. Do not grade. Do not SMS, publish, spend, OAuth. Do not invent a listing. Do not wire the live NWX community header. Disarm = Matt says "disarm the loop".

**Skills read:** page-grade (refuse stub), public-product-os, git-commit, CLAUDE §9, PRODUCT.md, decisions.md.

# Prior — 2026-08-16 (cursor) — NWX v8e logo-in-frame killed

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~13:26 PT. Studio only. Not a fleet node.

**Done**
- Matt kill on sight: logo on the balloon does not work. Style went off the locked stand. v8e whole batch dead.
- Hang restored: `nwx-v8d-stand.mp4` + still `v8-walk`. Type in post. Balloon stays empty cloth.
- Lesson 22 rewritten as the failure, not the method.

**Next**
- Stay on the locked stand. Do not put the wordmark in a generated frame again. Do not wire the live community header.

**Do not:** live page, publish, SMS, spend, OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** creative-brain SKILL + LESSONS.

# Prior — 2026-08-16 (cursor-loop-chain) — one published annual HOA on place pages

**Surface:** Cursor cloud `bc-494f1515` (`cursor/loop-chain-2026-08-16t19-46-e7c1`) shipped the class. Cursor Grok claimed the node, dropped a duplicate grain-naming commit, and wrote the graph evidence. This session rebased the accept/handoff stamp onto that complete. **Time:** 2026-08-16 ~20:20 UTC. Brief served fleet finding `b25bf5f4` (public-ux / fleet `eab91ac8dfa9b833ade88640c6cce7d4`), not G16/G32. One node only. Product **`7e8c0fc99`**. **`main` @** `26307c1b9`. Vercel Production **READY** (inspector `4PWdPQmmXFseriLDjReZcXJWspJd`). `npm run deploy:verify` exit 0 in 382s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#47**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed Master HOA $1,464/yr in glance and FAQ "start around $2,244" (Heath sub-neighborhood estimate). Reproduced on production before the class (glance 1,464; FAQ + FAQPage JSON-LD 2,244).
- Class: SoR helper `publishPlaceHoa` prefers the master assessment, else the floor of registry estimates. Glance, FAQ, and Dataset share that annual. Phase totals stay on phase / LP pages. Wired on community page, KbResortOverview, CommunityRichContent, V3 place-knowledge / opening, `buildMarketFaq`. Gate `ci:publish-place-hoa`.
- After READY: production 1280 + 390 — glance Master HOA $1,464/yr; FAQ and JSON-LD start around $1,464; no $2,244. Playwright accept `scripts/probe-tetherow-hoa-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/tetherow_hoa_{1280,390}_{overview,faq}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow MOS withhold `a15404f23` / handoff `056ba6cd0` (node `57a2abd4` **done**). Tetherow counted-set list `dada087f8` / handoff `fd628a6de` (node `bff867b9` **done**). NWX v8 walk lessons `be938f107`. G33 `/admin/loop` `1f01f54f` (node `1a6eb37a` **done**). La Pine hyphen-cache `6eded9fd`. SFR city-table remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — withhold pulse MOS when the page count is a different set

**Surface:** Cursor cloud `bc-5ffa2bf0` (`cursor/loop-sentinel-2026-08-16t19-00-d437`). **Time:** 2026-08-16 ~19:50 UTC. Brief served fleet finding `57a2abd4` (public-ux / fleet `5d55abbd72a67d25a5d7232b46fd2fb0`), not G16/G32. One node only. Product **`0028904a8`**. **`main` @** `fd628a6de` + this handoff. Vercel Production **READY** (inspector `6ySP1fBHNPYCa7nm6w4WUtYS1dJ7`). `npm run deploy:verify` exit 0 in 763s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#46**.

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed 4.6 months of supply next to 35 actives (implies ~45.7 six-month closes) against FAQ 36 sold in 12 months. Pulse row was honest for 19 actives / 4.56 MOS. Reproduced on production + `market_pulse_live` / `market_stats_cache` before the class.
- Class: SoR helper `publishMonthsOfSupply` withholds when the pulse numerator differs from the count on screen, or when implied six-month closes exceed the printed 12-month sold count. Public pages withhold (no invented 12-month MOS under the same label). CRM/CMA may fall back after null. Wired on community, city, neighborhood, homepage, housing-market, FAQ, CRM, CMA, report export. Gate `ci:publish-months-of-supply`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Tetherow HUD is 35 homes / $1,499,000 / 19 days, no 4.6 MOS. FAQ keeps 36 sold / 12 months and drops the buyer/seller MOS question. JSON-LD has no Months of Supply. Awbrey Glen HUD is 8 homes, no MOS. Bend city still prints honest 3.5 MOS (pulse numerator matches). Screenshots `/opt/cursor/artifacts/tetherow_{1280,390,faq_1280,faq_390}.png`, `awbrey_glen_1280.png`, `bend_city_1280.png`.
- R-002 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow counted-set list `dada087f8` / handoff `fd628a6de` (node `bff867b9` **done**). NWX v8 walk lessons `be938f107`. G33 `/admin/loop` `1f01f54f` (node `1a6eb37a` **done**). La Pine hyphen-cache `6eded9fd`. SFR city-table remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-002, git-commit.

# Prior — 2026-08-16 (cursor) — Tetherow counted-set list shipped

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~12:40 PT. One node only: fleet `a1851580` / graph `bff867b9` (public-ux). Product **`dada087f`**. Vercel Production **READY** (`dpl_3Rf1T6djVVd332EgHTQzW6MxGsZY`, `npm run deploy:verify` exit 0 in 830s). No hosted migration. Loop stays **ARMED**. Node **done**. No public-ux ledger insert (open window `2a5054ac`). Did not fire an extra sentinel.

**Done**
- Fleet finding [p0]: Tetherow hero said 35 homes; a `/bend/tetherow/`-only URL grep saw 19. Reproduced: inventory doors were 25 (19 Tetherow + 3 Braeburn + 3 Lodges at Bachelor V) because `splitRowsFromTiles` silently capped at 24 and dropped no-geo tiles; featured/hero doors missed `#homes`.
- Class: place pages list the counted set (no default cap; keep no-geo rows). City pages keep `CITY_PLACE_LIST_CAP = 24` with a showing label. Hero + featured CTAs jump to `#homes`. Alias homes keep MLS subdivision URLs — do not rewrite them to `/tetherow/` to game the bot.
- After READY: production `https://ryan-realty.com/communities/tetherow` 200 PRERENDER. Hero **35 homes for sale in Tetherow**. `#homes` list **35** unique inventory hrefs (28 `/bend/tetherow/` + alias slugs). Map **LIVE · MLS 35**. Hero CTA `#homes`. Featured **See all 35 Tetherow homes for sale** → `#homes`. Playwright 1280 + 390 `listRows=35`. Shots `out/tetherow-count-prod/`.
- Pre-existing console noise only: `/api/visitors/track` 400; React 418 hydration on the KB hero. Not this class.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow MoS withhold `a15404f2`. Housing-market pulse JSON-LD fallback `0028904a`. G33 `/admin/loop` `1f01f54f`. La Pine hyphen-cache `6eded9fd`. SFR pulse remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**. Local-only lessons commit `be938f10` (NWX v8 walk) rides this handoff push.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not wire the live NWX community header. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, database-canonical-reference, git-commit.

# Prior — 2026-08-16 (cursor) — G33 /admin/loop in plain English shipped

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~11:55 PT. One node only: G33 `1a6eb37a` (factory). Matt ADD routed through the register (R-214) + manifest + seeded graph node — not a side feature. Product **`1f01f54f`**. **`main` @** `1f01f54f`. Vercel Production **READY** (`dpl_G9w7nisxxBiAkXh7gchLsBzMrG1y`, `npm run deploy:verify` exit 0 in 385s). No hosted migration. Loop stays **ARMED**. Node **done**. Did not claim a fleet node. No factory ledger insert (open window `ba3435dd`). Did not fire an extra sentinel.

**Done**
- `/admin/loop` is Now / Next / Waiting / Finished in plain English. Shop jargon (Fleet finding, p0, sentinel, ledger) folds away. Copy helpers in `lib/data/loop/status-copy.ts`.
- Accept on production: signed-in 390 + 1280 at `https://ryan-realty.com/admin/loop`. Verdict + folds + human titles. No console errors. Shots `out/loop-status-prod/`.
- R-214 VERIFIED. VERSION-1 G33 **DONE 2026-08-16**. Graph node `1a6eb37a` **done**.

**Also on this SHA (other session, do not steal / do not undo):** La Pine hyphen-cache `6eded9fd` / READY `FJgUZGejwabU1xuWChDSn6A8pBpb`. SFR pulse city-remainder `4ca02de19`. NWX studio hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** claim a fleet p0. Do not insert another public-ux or factory ledger row. Do not claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, COMPANY_IMPROVEMENT ADD verb, admin-product-os (named-page, not a full OS grind), git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — hyphen city URLs resolve to space-form cache

**Surface:** Cursor cloud `bc-875be615` (`cursor/loop-chain-2026-08-16t18-00-f801`). **Time:** 2026-08-16 ~18:40 UTC. Brief served fleet finding `7d7c74c6` (public-ux / fleet `75370225805bb52d38b151ced2dab5c1`), not G16/G32. One node only. Product **`6eded9fdb`**. **`main` @** `1f01f54f5` + this handoff. Vercel Production **READY** (inspector `FJgUZGejwabU1xuWChDSn6A8pBpb`). `npm run deploy:verify` exit 0 in 734s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#45**.

**Done**
- Fleet finding [p0]: hub city table printed La Pine 175 SFR / $500,000 / 50.5 days to pending, but `/housing-market/la-pine` 404ed (`NEXT_HTTP_ERROR_FALLBACK;404`). Same class: powell-butte, black-butte-ranch, camp-sherman. Reproduced on production + `market_pulse_live` before the class (space-form keys only; hyphen rows absent).
- Class: SoR helper `canonicalCityCacheSlug` / `citySlugCandidates` maps URL hyphens to the space-form cache key (`la pine`). Wired on housing-market `resolveGeo`, MarketSnapshot, city/neighborhood/community/ZIP pages, search + OG, mega menu, CRM report, golf/events/venues/trails, agent market tool, pulse populate. Gate `ci:city-cache-slug`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: pulse `v3-2026-05-07` updated 2026-08-16T18:30:00Z — la pine **175** / $499,950 displayed **$500,000** / 50.5; powell butte 63 / $1,350,000; black butte ranch 31 / $1,073,000; camp sherman 4 / $945,000. Production 1280 + 390 — all four `/housing-market/{hyphen}` reports 200, no 404 fallback, live figures. `/homes-for-sale/la-pine` SFR widget 175 / $500,000 / 51 days. Screenshots `/opt/cursor/artifacts/la_pine_report_{1280,390}.png`, class siblings, `la_pine_homes_sfr_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Pulse still includes Coming Soon (G27). Do not mark G27 done.

**Also on this SHA (other session, do not steal / do not undo):** G33 `/admin/loop` plain English `1f01f54f` is **done** (node `1a6eb37a`). SFR city-table remainder `4ca02de19`. xAI studio NWX hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29).

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-020/R-024, git-commit.

# Prior — 2026-08-16 (cursor) — NWX social tile motion (studio only)

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~11:26 PT. Studio only. Not a fleet node. Did not claim G32/G16.

**Done**
- Discovery lifestyle batch refused (off the rails; not Bend). Stayed on the hung NWX social tile `keep/02-social-v2.jpg` / `v2-s1-sculpture`.
- Two 8s i2v takes from that still. Hang: `out/xai-ryanrealty-studio/show/northwest-crossing-v2/nwx-social-a-car-bike.mp4` (car through the existing circle, balloon, then cyclist). B is the dog-walker alternate.
- Viewing room: `out/xai-ryanrealty-studio/show/northwest-crossing-v2/index.html`. Lessons 25–26.

**Next**
- Matt keep/kill on motion A (and B if he wants the dog). Do not remake Discovery. Do not wire the live community header.

**Do not:** live page, publish, SMS, spend, OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** creative-brain SKILL, LESSONS, attention-editing, ai-filmmakers.

# Prior — 2026-08-16 (cursor-loop-chain) — SFR pulse vs city-table remainder named

**Surface:** Cursor cloud `bc-cf38c0a5` (`cursor/loop-chain-2026-08-16t17-19-57b8`). **Time:** 2026-08-16 ~17:55 UTC. Brief served fleet finding `f214eae4` (public-ux / fleet `5439b87e`), not G16/G32. One node only. Product **`4ca02de19`**. **`main` @** `4ca02de19` (handoff lands after `a8f515147`). Vercel Production **READY** (inspector `DQgDZhkkCyhxvMuQem1pMU6Q1idH`). `npm run deploy:verify` exit 0 in 580s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#44**.

**Done**
- Fleet finding [p0]: `/housing-market` printed the region SFR pulse next to seven city rows that omitted Madras, Powell Butte, Black Butte Ranch, Culver, Metolius, and Camp Sherman. The footnote only named Tumalo. Reproduced on production + `market_pulse_live` before the class (region 1840, hub sum 1025, omitted 166, TIGER remainder 649).
- Class: SoR helper `namePulseCityRemainder` names omitted pulse cities with inventory and the TIGER/MLS remainder. DAL `getMarketPulseAllCitySnapshots`. Wired on hub, `/housing-market/central-oregon`, and `/housing-market/annual-review`. Gate `ci:pulse-city-remainder`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: pulse region **1839** (`v3-2026-05-07`); displayedSum 1024; allCitySum 1190; remainder **649**. Production 1280 + 390 — omitted cities named with counts and `/housing-market/{slug}` doors; Tumalo still named; remainder "649 more in the region pulse sit outside a city-boundary row". Screenshots `/opt/cursor/artifacts/{housing_market,central_oregon,annual_review}_footnote_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Pulse still includes Coming Soon (G27). Do not mark G27 done.

**Also on this SHA (other session, do not steal / do not undo):** xAI studio NWX hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-020/R-024, git-commit.

# Prior — 2026-08-16 (cursor) — xAI studio: NWX header + social stills

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~10:55 PT. Isolated studio in gitignored `out/xai-ryanrealty-studio/`. No product files. No live KbHero swap. No loop node. Did not claim G32 or G16. Docs **`a8f515147`**.

**Done**
- Look lock stays first-cycle Mirror Pond `keep/01-boardwalk.jpg`. Bake-off is research. CARD_TEMPLATE relocked + awareness ladder written (owned → Unsplash/Pexels/Shutterstock → parent keep → refuse).
- Remembered NorthWest Crossing. Owned Area Guide 01 (sculpture circle) and 03 (Discovery pond). 02 is Sisters — refuse. 04 verified as the same Discovery pond, not a canal.
- Made five 16:9 headers and five 9:16 socials. All ten passed the sat gate. Hang: `cards/places/northwest-crossing/keep/01-header.jpg` (h4 walker+dog) and `keep/02-social.jpg` (s2 sculpture vertical).
- Show: `out/xai-ryanrealty-studio/show/northwest-crossing/index.html`. Matt looks. Nothing published.

**Also on this SHA (other session, do not steal / do not undo):** place-page hero count grain `706327241`. Awbrey inventory-count class `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Next**
- Matt keep/kill on the NWX hang pair. Do not wire the live community header.
- Later Mirror Pond pass may add clouds / walker / one fish rise. Do not remake that library first.
- IMAGE_1 on every Make is still the boardwalk keep.

**Do not:** claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not send a fish rise on Discovery Pond.

**Skills read:** creative-brain SKILL + PLAYBOOK + LESSONS + emotion-mechanics + neuroaesthetics + piece-brief, platform-best-practices (logo closer, not opener).

# Prior — 2026-08-16 (cursor-loop-sentinel) — place-page hero count grain shipped

**Surface:** Cursor cloud `bc-dc2e5e24` (`cursor/loop-sentinel-2026-08-16t16-50-c8df`). **Time:** 2026-08-16 ~17:20 UTC. Brief served fleet finding `97c68da5` (public-ux), not G16/G32. One node only. Product **`706327241`**. **`main` @** `706327241`. Vercel Production **READY** (inspector `6vKiLggcCckH5uH4LnDdp6mrXL9p`). `npm run deploy:verify` exit 0 in 780s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#43**.

**Done**
- Fleet finding [p0]: Awbrey Butte hero copy read "63 homes for sale in Bend" on the neighborhood page. Reproduced on production before the class change (`lead":"in Bend. List prices…"`).
- Class: KbHero prefixes `{N} homes for sale` + `lead`. Sub-city pages that continued with `in {city}` attributed a finer-grain count to the city. SoR helper `placeHeroLead` names this page's grain. Wired on city / neighborhood / community / subdivision / ZIP. Gate `ci:place-hero-grain`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: Playwright 1280 + 390 on `https://ryan-realty.com/cities/bend/awbrey-butte` — hero-sub **63 homes for sale in Awbrey Butte** (not Bend). Class also Southern Crossing **3 homes for sale in Southern Crossing**; Tetherow **35 homes for sale in Tetherow**. City `/cities/bend` stays `in Bend`. Screenshots `/opt/cursor/artifacts/awbrey_viewport_{1280,390}.png`.
- R-109 coverage note only (still PARTIAL / G21). G21 residual punch recorded. Do not mark G21 done.

**Also on this SHA (other session, do not steal / do not undo):** Awbrey inventory-count class `9cac09b1` / handoff `3d248f330`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one public inventory count for Bend districts

**Surface:** Cursor cloud `bc-406a42b5` (`cursor-loop-chain-2026-08-16t16-01-5039`). **Time:** 2026-08-16 ~16:50 UTC. Brief served fleet finding `945d3e5e` (public-ux), not G16. One node only. Product **`9cac09b1`**. **`main` @** `9cac09b1`. Vercel Production **READY** (`AxpVMY6cXodZpfNkjSQ5M7NsJ2tY`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). `npm run deploy:verify` exit 0 in 606s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#42**.

**Done**
- Fleet finding [major]: Awbrey Butte index tile printed 52, place hero 63, FAQ 62. Reproduced on production + DB before the class change (A `listing_tile_mv.boundary_neighborhood` SFR+PUBLIC=52; B pulse `active_count`=62 includes CS; C pin Active A/B/C=63; D xref SFR+PUBLIC_ACTIVE=63).
- Class: one DAL `lib/data/geo/neighborhood-public-inventory.ts`. Geography `listing_boundary_xref_mv` (`public.boundaries`). Property SFR. Status PUBLIC_ACTIVE (Active + AUC). Same cache on `/neighborhoods`, `/cities/bend` tiles, place hero/FAQ/metadata/Field. Timed-out ledger is `null`, not `0`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: probe D=63 (61 Active + 2 AUC). Production 1280 + 390 — `/neighborhoods` tile 63 Active, `/cities/bend` town-row 63 Active, place FAQ "There are 63 active single-family listings", mobile hero "63 homes". Screenshots `/opt/cursor/artifacts/awbrey_{neighborhoods,city_tile,place_faq,place_hero}_{1280,390}.png`.
- Residual (not this node): browse `/homes-for-sale/bend/awbrey-butte` still uses `boundary_neighborhood` tags. Pulse still includes CS (G27). Do not flip G27.

**Also on this SHA (other session, do not steal / do not undo):** G32 seeded `f6dc09e7` (xAI-only gen stack + cancel list). G6 admin SMS-agent toggle. G6 accept stays **blocked** (live marketing-line APPROVE).

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G32 Matt ADD, else G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, DATABASE_FOR_AI_AGENTS §0/§3, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-020/R-025, git-commit.

# Prior — 2026-08-16 (cursor) — G32 seeded: xAI-only gen stack + cancel list

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~09:15 PT. Matt ADD (R-205): one generative product — xAI. Product **`f6dc09e7`**. Loop stays **ARMED**. This session seeded G32; it did not claim G16 and did not fire a second sentinel (bc-406a42b5 already launched).

**Done**
- R-213 + G32 + M7 on the version/register. Max pins **G32 · M7** and **R-213**.
- M3 CHANGE: park-in-practice lifted for xAI only. Rebuild is Imagine + Voice, not ElevenLabs Turbo. R-045 stays LOCKED.
- Expert brief `docs/plans/ENTERPRISE_MAP/xai-stack.md` (required read for social-presence). Official docs https://docs.x.ai/overview.
- Cancel list SoR `docs/plans/ENTERPRISE_MAP/xai-stack-accept.json`. **Cancel now:** fal.ai, Synthesia. **Cancel after cutover:** ElevenLabs, Replicate, OpenAI, Anthropic. **Keep:** xAI, Remotion, licensed stock, product rails.
- Queue: `Matt ADD` titles priority 1 (with fleet majors), so G32 outranks planned G16 when the next brief runs.
- Node title: `Matt ADD [major]: xAI-only image, video, voice, and content gen`. Domain social-presence. Accept is the cancel list + chokepoint.

**Do not:** cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, COMPANY_IMPROVEMENT ADD verb, xAI overview/models/Imagine/TTS.

# Prior — 2026-08-16 (cursor-grok-town-doors) — town doors at rest + daily launch cap removed

**Surface:** Cursor Grok (`cursor-grok-town-doors-20260816`). **Time:** 2026-08-16 ~08:57 PT. Brief served fleet finding `071bd6f0` (public-ux), not G16. One node only. Product **`b33fe504`**. Baseline **`eddccdbd`**. **`main` @** `9ac608ab`. Vercel Production **READY** (`dpl_49opLtX7FCPXPmAMaB5hQVaL1zGq`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). Product already live; this commit is the handoff. No hosted migration. Loop stays **ARMED**. Daily launch cap **removed** (Matt 2026-08-16). Node **done**.

**Done**
- Fleet finding [major]: six town doors had CSS background photos at `opacity:0` at rest (`KbExploreTowns` + `.town-fill` in `components/site/kb/kb.css`). Reproduced on production before the class change at 1280 + 390.
- Class: `.town-fill` is `opacity:1` at rest. Rows with a fill use cream type on a navy scrim. Hover still `translateX`s the name. Contract D103b. No public-ux ledger insert (open window `2a5054ac`).
- After READY: Playwright 1280 + 390 — all six names (Bend, La Pine, Redmond, Sunriver, Sisters, Terrebonne), each `/cities/{slug}` href, all six fills opacity 1. Screenshots `/tmp/rr-town-doors/prod-after-1280.png` + `prod-after-390.png`.
- Sentinel daily launch cap removed: no `DAILY_LAUNCH_CAP`; `/admin/loop` figure is `N in 24h · no daily cap`. Kill switch, activity standdown, boot guard, busy check stay. R-206 covers the removal.
- R-095 stays **PARTIAL** (photos visible at rest; still curated scenics, not live MLS — G21).

**Also on this SHA (other session, do not steal / do not undo):** G6 admin SMS-agent toggle `0e7d6eed`. G6 accept stays **blocked** (live marketing-line APPROVE). Toggle does not satisfy G6 accept.

**Do not:** claim the minor two-CTA fleet finding. Do not insert another public-ux ledger row. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, REQUIREMENTS R-095 / R-206, kb.css town-door class, git-commit.

# Prior — 2026-08-16 (cursor) — G6 admin SMS-agent toggle shipped

**Surface:** Cursor local. **Time:** 2026-08-16 ~08:37 PT. Matt-directed ADD on G6 (not a loop-brief node). Product **`0e7d6eed`**. Loop stays **ARMED**. G6 accept stays **blocked**.

**Done**
- Superuser per-broker SMS-agent Switch on `/admin/crm/settings/brokers` (SMS agent section). Writes `brokers.sms_agent_enabled` via existing DAL `setAgentEnabled`.
- Site-wide `BROKER_SMS_AGENT_ENABLED` shown read-only on the verdict. Inbound route uses `isBrokerSmsAgentEnvEnabled()`.
- `getCrmBrokers` now projects `smsAgentEnabled` (fail-closed). Cache key `crm-brokers-v3`.
- Action `setCrmBrokerSmsAgentAction` is owner-only; unknown slugs never hit the DAL. Tests: mapper, action auth, env helper.
- Local render: 3 switches, Matt On / Paul Off / Rebecca Off, env on. Screenshots `/tmp/rr-sms-agent-toggle/brokers-1280.png` + `brokers-390.png`.
- G6 node `c8bbccaa` stays blocked. VERSION-1 G6 residual named. No SMS sent. Paul/Rebecca flags not flipped.

**Do not:** mark G6 done. Do not SMS, publish, spend, or OAuth. Do not flip R-045. Do not mark G27 done. Do not unpause TC. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29).

**Skills read:** admin-product-os, tdd, verification-before-completion, requesting-code-review, git-commit, BROKER_SMS_AGENT R1.4.

# Prior — 2026-08-16 (cursor-grok-g15) — G15 search completeness shipped

**Surface:** Cursor Grok (`cursor-grok-g15-20260816`). **Time:** 2026-08-16 ~08:20 PT. Brief served **G15** (public-ux). One node only. Product **`e6523399`**. **`main` @** `0524b4ee`. Vercel Production **READY** (`dpl_GZNBEt5SVpbXwFMRL9rXTKzgd43Y`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). `npm run deploy:verify` exit 0 in 644.9s. No hosted migration. Loop stays **ARMED**.

**Done**
- G15 Search completeness to plan acceptance (`c2c9adde-22f0-4359-971e-409d04a2ec32`) **done**. Accept: every FILTER_COMPLETENESS item dispositioned; prod TTFB p75 recorded.
- Class: SoR `docs/plans/ENTERPRISE_MAP/search-completeness-accept.json`. DAL `readSearchCompletenessAccept` / `searchCompletenessComplete`. Packet §0 + §1b + §2 + scoreboard `searchCompleteness`. `/admin/loop` QuietRow. Gate `ci:search-completeness-accept`. No public-ux ledger insert (open window `2a5054ac`). No schema migration.
- 268 long-tail concepts (222 custom + 46 standard) dispositioned, unexplained = 0. Every `registry-report.json` long-tail concept is in the ledger.
- Prod TTFB p75 (8 curl samples, 2026-08-16): `/homes-for-sale` **275ms**, `/homes-for-sale/bend` **254ms** (target 600ms).
- Post-deploy check (2026-08-16 ~08:19 PT, after READY): `https://ryan-realty.com/homes-for-sale` HTTP 200 (488/315/365ms); `/homes-for-sale/bend` HTTP 200 (233/248/379ms). All under 600ms.
- Register: R-097, R-098, R-099, R-100, R-102, R-103, R-106 **VERIFIED**. R-101 **PARTIAL** (VOW live; sold browse still legacy RPC). R-104 **PARTIAL** (TTFB measured; client filter-paint / pan-pin RUM residual). R-105 already VERIFIED. Max pin **R-212** unchanged.
- Accept proof: `npx tsx scripts/loop-probe-g15.ts` — `complete=true` longTailDisposed=268 unexplained=0 ttfb 275/254 samples=8. Gate 10/10. Tests 11564. `npm run build` exit 0. `ci:gates` 215/215 on push of `0524b4ee`.
- VERSION-1 G15 **DONE 2026-08-16**.

**Do not:** insert another public-ux ledger row. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G27 done. Do not unpause TC. G6 stays blocked (live SMS). G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, MECHANICAL_GATES, FILTER_COMPLETENESS plan §3/§4.8/§15, REQUIREMENTS R-097…R-106, VERSION-1 G15, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, git-commit.

# Prior — 2026-08-16 (Cursor) — Matt steered M1–M6; G31 seeded; G27 residual confirmed

**Surface:** Cursor local. **Time:** 2026-08-16 ~07:50 PT. Steering delivery (R-205). No product class that session. G15 was in_progress then; it is now **done**.

**Done (durable state only)**
- M1 CHANGE: newsletter first-cohort blast is not the v1 gate. Loop work is **G31** redesign (look only). After Matt approves the look, he enrolls and sends manually. R-212 MISSING→G31. R-159 PARTIAL.
- M2 HOLD: TC cutover held until TMS thoroughly tested. Do not unpause TC_BUILDOUT.
- M3 SILENCE: park-in-practice. R-045 LOCKED. Docket `decision.status` stays pending (ci:video-docket). No rebuild until Matt says rebuild.
- M4 PARKED: no ad spend for v1. Audience heartbeat continues.
- M5 DONE 2026-08-16: ryan-realty.com live (A 76.76.21.21, `server: Vercel`). DNS cutover removed as an open gate (row kept, marked DONE).
- M6 REVIEWED: KEEP socials connected (TikTok/YT/X/GBP + refresh). LinkedIn expired 2026-07-09 no refresh. Threads/Pinterest/Nextdoor auth empty. No reconnect ask.
- G27 **not done**. 2026-08-02 session sealed public CS access. Pulse `active_count` still includes CS. Bend pulse 486; City=Bend SFR CS = 5. Node `2891d28e` stays open.
- Manifest Max pin **G31 · M6**. Register Max **R-212**.

**Do not:** flip R-045. Do not SMS, publish, spend, or OAuth. Do not mark G27 done. Do not unpause TC. Disarm = Matt says "disarm the loop". Bots still need Matt to create them (G29).

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, COMPANY_IMPROVEMENT §How Matt steers, VERSION-1, REQUIREMENTS, VERIFICATION-FLEET, BROKER_SMS_AGENT DoD, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-26bd9513) — G12 video docket shipped

**Surface:** Cursor cloud agent `bc-26bd9513-82b6-4e3e-b22e-9aba3838e83e`. **Time:** 2026-08-16 ~11:55 UTC. Brief served **G12** (factory). One node only. **`main` @** `ca8f7f636` (product `fd71eee24` + DAL deploy touch). PR **#40**. Vercel Production **READY** (GitHub deployment `5930667908`, inspector `BERhGqFnQqdf2TsFJgZ1eervPref`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `ci:gates` **213/213** including `ci:video-docket`.

**Done**
- G12 Video decision docket (`53355a5b-fafc-4136-8cbd-dc98aa73ed05`) **done**. Accept: docket exists with both options costed. Decision stays **pending** (M3) until Matt answers.
- Class: SoR `docs/plans/ENTERPRISE_MAP/video-decision-docket.json`. DAL `readVideoDecisionDocket` / `videoDocketComplete`. Packet §0 + §5 + scoreboard `video`. `/admin/loop` QuietRow. Gate `ci:video-docket`. No factory ledger insert (open window `ba3435dd`).
- Park: incremental vendor **$0**. Keep R-045. Inbox video types stay `comms:matt_alert`. 11 dead safe-zone imports stay. CAP-017 stays maturity 2 until M3.
- Rebuild: ElevenLabs Turbo **$0.05/1k** (https://elevenlabs.io/pricing/api fetched 2026-08-16) + producer cap **$5/row $15/run**. Re-register 24 producers, restore 13 capability skills, repoint 11 dead imports. Requires Matt to CHANGE/SUPERSEDE R-045.
- Accept proof: `npx tsx scripts/loop-probe-g12.ts` — `complete=true` parkUsd=0 rebuildTurboPer1k=0.05 rebuildCapPerRow=5 deadSafeZoneImports=11 decommissionedProducers=24 remotionConfigs=16 mp4OnDisk=84 decision=pending.
- VERSION-1 G12 **DONE 2026-08-16**. M3 still open. R-045 stays LOCKED. No schema migration.
- Ship: `ci:gates` 213/213; `origin/main` includes `ca8f7f636`; production deploy success. PR #40.

**Do not:** flip R-045. Do not re-register video producers. Do not SMS, publish, spend, or OAuth. Do not flip INT-007 to KEEP before 2026-08-22. G6 stays blocked (live SMS). G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, MECHANICAL_GATES, AGENTIC_GRAPH_ENGINEERING, REQUIREMENTS R-042/R-043/R-044/R-045, VERSION-1 G12/M3, CAP-017, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-fe75bb57) — G11 audience hold machinery shipped, node blocked

**Surface:** Cursor cloud agent `bc-fe75bb57-b840-4d01-846f-67efa6a79fbc`. **Time:** 2026-08-16 ~11:20 UTC. Brief served **G11** (factory). One node only. Product **`8247ee9b2`**. Handoff lands on **`main` after G10** (`0b1ba14c9` / `ecb22e78f`). Vercel Production **READY** for the G11 product SHA (GitHub deployment `5930137236`, inspector `9oPuFMsP2VEtmz3E8Yet84XbKMoe`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Blocked**
- G11 Meta audience heartbeat hold (`568d807b-ac07-43cc-9eea-52b8f67460a6`) **blocked**. Accept: seven consecutive `ran_at` days ending on or after **2026-08-22**; map cell updated with evidence.
- Class shipped (do not redo): named hold DAL `readMetaAudienceHold` / `computeAudienceHold` (`META_AUDIENCE_HOLD_END=2026-08-22`, `HOLD_DAYS=7`, `CURRENT_HOURS=36`). Heartbeat `audienceSyncHours: 36` + `evalMetaAudienceHold`. Admin audiences + meta-health. Gate `ci:meta-audience-hold`. Signals `identity.audienceHold`. INT-007 cell updated (still **FIX**). VERSION-1 G11 machinery note only — **not DONE**. No factory ledger insert (domain already has open window `ba3435dd`).
- Accept proof (environment): `npx tsx scripts/loop-probe-g11.ts` — `meta_audience_log` 79 rows; consecutive UTC days **55** (`2026-06-23`…`2026-08-16`); last LIVE **2026-08-16T09:01:26Z** CRM `120246504502300698` `add_num_received=13980`; westside `120244510092910698` last **2026-08-15T14:03:29Z** (daily 14:00 UTC; still current under 36h). `holdMet=false` because `lastDay=2026-08-16` < 2026-08-22. June-23 INT-007 cell was stale — the log never stopped.
- Blocker: calendar accept cannot be met until a consecutive streak ends on or after 2026-08-22. Unblock then when `readMetaAudienceHold.holdMet === true`; flip INT-007 FIX→KEEP; mark VERSION-1 G11 DONE; `completeWorkNode` with probe evidence. Spend stays Matt-gated.
- Planes: dal-stat (hold DAL + signals), admin-crm (`/admin/audiences`, `/admin/analytics/meta-health`), reporting (packet + INTEGRATIONS + scoreboard), ads (36h heartbeat, no spend). Public-site / alerts / identity stitch unchanged.
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `8247ee9b2` (`c0465bc5a` + email-send-gated re-key `8247ee9b2`); production deploy success. PR #38 merged.

**Do not:** flip INT-007 to KEEP before 2026-08-22. Do not insert another factory ledger row. G10 is **DONE** on main (`ecb22e78f`, production READY GitHub `5930254210` / inspector `8koYeDcaTiGfCwhMrNLjMgKxJXF5`) — do not redo `/join`. G6 stays blocked (live SMS). Do not SMS, publish, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, DATABASE_FOR_AI_AGENTS (lookup + cache model), INTEGRATIONS INT-007, VERSION-1 G11, COMPANY_SCOREBOARD ads row, COMPANY_IMPROVEMENT blast-radius, git-commit, facebook-seller-growth (read-only; no spend).

# Prior — 2026-08-16 (loop-sentinel bc-120b6b86) — G10 /join conversion shipped

**Surface:** Cursor cloud agent `bc-120b6b86-e7c3-4235-8ec9-72f20954bf55`. **Time:** 2026-08-16 ~11:01 UTC. Brief served **G10** (recruit-retain). One node only. **`main` @** `ecb22e78f`. Vercel Production **READY** (GitHub deployment `5930254210`, inspector `8koYeDcaTiGfCwhMrNLjMgKxJXF5`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Done**
- G10 Instrument `/join` conversion (`086bdf15-0172-4f9f-8704-70ba9094ef0f`) **done**. Accept: packet shows a `/join` conversion figure with a named source.
- Class: visits already lived in `visitor_events` (`page_url` path `/join`); no convert writer and the probe did not read them. DAL `getJoinConversionStats` / `readJoinConversionStats` / `recordJoinConversion` / `tagRecruitJoin`. Contact form `Join the team` writes `join_convert` and tags `recruit:join` (no buyer enroll, no CAPI Lead). `/join` phone + contact CTAs via `JoinCtaTracker`. Today + packet read the same DAL. Gate `ci:join-conversion`.
- Accept proof: `visits7d=13` / `visitsAll=67` / `conversions7d=0` / `conversionsAll=0` / `status=ok`. Source: `visitor_events via getJoinConversionStats (page_url path /join + event_type=join_convert)`. Fleet-test convert insert succeeded (`convertRowsIncludingFleet=2`) and did **not** change packet counts. Series days present (2026-08-03 had 38 visit events). Production `/join` HTTP 200 (browser UA).
- Ledger `5683a341-68d4-4b5f-aed0-6a5f4922ed0b` (recruit-retain, class `join-conversion`). VERSION-1 G10 **DONE 2026-08-16**. R-201 VERIFIED. CAP-022 residual (OAuth) unchanged. No schema migration (series table is existing `visitor_events`).
- Planes: dal-stat (`lib/data/loop/join-conversion.ts` + signals), public-site (contact + `/join` tracker), identity (`recruit:join`), ads (skip CAPI Lead for recruit), admin-crm (`/admin/today` VerdictLine), reporting (packet §1b + recruit-retain). Alerts unchanged.
- Ship: `ci:gates` 212/212; `origin/main` includes `ecb22e78f`; production deploy success. Rebased over G11 machinery (`readMetaAudienceHold`) so both gates stay in `ci:gates:chain`.

**Do not:** SMS, publish, spend, or OAuth. Do not treat a recruit contact as a buyer Lead. Do not redo `/join`. G6 stays blocked (live SMS). G11 accept still open (KEEP waits for a day ≥ 2026-08-22). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, BROKER-OPERATING-SYSTEM-PLAN, MASTER_SPEC, REQUIREMENTS R-201, COMPANY_IMPROVEMENT blast-radius, VERSION-1 G10, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-66d23ef1) — G9 look-walk baselines shipped

**Surface:** Cursor cloud agent `bc-66d23ef1-fc40-4fe7-87ec-b7dc59ce4f39`. **Time:** 2026-08-16 ~10:12 UTC. Brief served **G9** (public-ux). One node only. **`main` @** `8a847a8e7`. Vercel Production **READY** (GitHub deployment `5929885543`, inspector `46WCQ6dmZSQvuBbfdkfeDNwNmyQS`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Done**
- G9 Look-walk baselines (`4aa54907-47ce-4b96-9eaa-d370a6e56df5`) **done**. Accept: Packet §1b CMA look and public-ux walk are no longer UNKNOWN.
- Class: production walk at 390+1280 for the 8 `beat_on` routes + graded CMA HTML. SoR `docs/plans/ENTERPRISE_MAP/look-walk-baseline.json`. DAL `readLookWalkBaseline` / `lookWalkBaselineComplete`. Scoreboard probe `cma.look` + `lookWalk`. Packet §1b cites the baseline. Gate `ci:look-walk`. Boot fix: `readSkySlopeMirrorFreshness` extracted so `loop-brief` can import signals without `server-only`.
- Accept proof: probe `cma.look=ok` verdict WORKING slug `cma-19496-tumalo-reservoir` (17 pages, cover is the house, range $955,000–$1,060,000); `lookWalk.status=ok` publicRoutes 8 / publicOk 8. Production HTTP 200 both viewports. Verdicts: listing + about WORKING; homes-browse + sell PARTIAL; home / Bend / Tetherow / market TRAIL. Residual punches stay on the baseline (grade wave only — no page redesign).
- Ledger `2a5054ac-1608-4343-872a-322e705973c6` (public-ux, class `look-walk-baselines`). VERSION-1 G9 **DONE 2026-08-16**. R-092 coverage note updated. No schema migration.
- Planes: dal-stat (`lib/data/loop/look-walk.ts` + signals), public-site (walked, not redesigned), reporting (packet §1b + probe). Admin-crm / ads / alerts / identity unchanged.
- Ship: `ci:gates` 210/210; `origin/main` includes `8a847a8e7`; production deploy success. Same-session factory hygiene: `check-vercel-deploy.mjs` falls back to documented project ids + GitHub Vercel commit status when `.vercel/project.json` / `VERCEL_TOKEN` are missing (cloud-agent ship path).

**Do not:** redesign public pages in this residual (TRAIL punches are named, not this node's class). Do not SMS, publish, spend, or OAuth. Do not claim G10 (`/join` conversion). G6 stays blocked (live SMS). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, COMPANY_SCOREBOARD §1b, VERSION-1 G9, PAGE-GRADE v2.4 (first-screen rubric), look-walk baseline, git-commit, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-0369d0e1) — G8 SkySlope mirror ops shipped

**Surface:** Cursor cloud agent `bc-0369d0e1-5c3f-43e2-9a78-9cddc20f2c4c`. **Time:** 2026-08-16 ~09:45 UTC. Brief served **G8** (transactions). One node only. **`main` @** `8bb2c6327`. Vercel Production **READY** (GitHub deployment `5929663437`, inspector `3LKLi3cQjgcKFvhLEXyU7N4AGPx8`).

**Done**
- G8 SkySlope mirror re-sync ops (`05980864-bfd1-4556-8145-0ddac4fbb0d1`) **done**. Accept: latest `synced_at` current **or** the blocker named on the packet.
- Class: inbound Files refresh cron `/api/cron/skyslope-mirror-refresh` (HMAC login POST + GET folder list/detail only; no PUT/PATCH/DELETE). DAL `getSkySlopeMirrorFreshness` / `refreshSkySlopeMirrorInbound`. Closings VerdictLine. Heartbeat `evalSkySlopeMirror` from `loop-health-check`. Scoreboard uses DAL `rowCount`. Gate `ci:skyslope-mirror` 12/12. Vault `tc_deals` stays SoR.
- Accept proof: production route live — unauth JSON **401**; missing sibling path **404** (same dpl). Probe `scripts/loop-probe-g8.ts`: 33 rows (= `tc_deals`), newest `synced_at` **2026-06-10T00:35:10Z**, age **1617h**, `current=false`. Named blocker: this VM's injected `CRON_SECRET` is a 12-char stub (production 401); no `SKYSLOPE_*` keys here. First refresh = Vercel cron `20 6 * * *` or a session with the real secret.
- Ledger `1b9367f1-908a-4902-890d-c34d981a9a80` (transactions, class `skyslope-mirror-ops`). INT-017 ops KEEP; freshness residual. R-190 LOCKED. R-191 stays PARTIAL (M2 cutover). No schema migration.
- Planes: dal-stat (mirror DAL), admin-crm (`/admin/closings`), reporting/heartbeat (`evalSkySlopeMirror`). Public-site / ads / alerts / identity unchanged (mirror is not a public number).
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `8bb2c6327`; production deploy success.

**Do not:** mutate SkySlope files (no PUT/PATCH/DELETE). Do not treat SkySlope as transaction SoR. Do not SMS, publish, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, tc-builder, oregon-orea-principal-broker, skyslope-api, TC_SYSTEM, COMPANY_IMPROVEMENT blast-radius, VERSION-1 G8, INT-017, R-190/R-191, DEVELOPMENT_PROCESS, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-311e4201) — G7 westside backlog shipped

**Surface:** Cursor cloud agent `bc-311e4201-0cc8-4ade-b44d-879873938822`. **Time:** 2026-08-16 ~08:35 UTC. Brief served **G7** (seo-aeo). One node only. **`main` @** `d8a401d68`. Vercel Production **READY** (GitHub deployment `5929208475`, inspector `739vhk2QJQx35X2vnuFzwcy5NCL7`).

**Done**
- G7 Westside backlog (`f10b9c7c-c4ad-4d55-bdbe-3294000a8e62`) **done**. Accept: no backlog row without a disposition; shipped items carry ledger rows.
- Class: #10 luxury money-surface links (`/luxury-homes-bend` on city popular-searches, Bend `/cities` row via `CityFeaturedLinks`, `/communities` hero). #9 review-ask drafts on CRM close + daily TC 14-day scan — stages `crm_message_drafts` only, never sends, never overwrites a broker draft. `upsertDraft` insert-or-update (expression unique index). #2/#5 RE-RANKED → G22. #7/#8 GATED (spend / outbound).
- Accept proof: fleet-test person **61945** review-ask draft `already` (body has `GBP_REVIEW_URL`). Westside audience `120244510092910698` last LIVE 2026-08-15 `add_would_upload` 13588. Live `/cities` + `/communities` 200 with `href="/luxury-homes-bend"`. Newest TC close 2026-05-15 (outside 14-day window — first cron stages 0 real-client drafts). Gate `ci:westside-backlog` 14/14.
- Ledger `c058cfdf-0a1a-4c6e-a35b-a4a90ae092e4` (seo-aeo). CAP-030 maturity 3 (PARTIAL residual: crawl/depth G22, paid/expired Matt-gated). R-125 VERIFIED. R-124 PARTIAL. R-150 PARTIAL. No schema migration.
- Planes: dal-stat (`stageReviewAskDraft`, `stageReviewAsksForRecentCloses`, `upsertDraft`), public-site (luxury links), admin-crm (restage → draft), identity (`crm_people.id`), reporting (CAP-030 / register). Ads unchanged. Alerts/newsletters none (never sends).
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `d8a401d68`; production deploy success.

**Do not:** SMS anyone. Do not publish, spend, or OAuth. Do not invent an approval stamp. Do not overwrite a broker email draft. Do not mass-enroll or send expired/FSBO. Do not prune sitemaps without GSC indexed-count evidence (R-122). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, GOAL_10X_EXECUTABLE, WESTSIDE_BACKLOG, CAP-030, REQUIREMENTS R-124/R-125/R-150, COMPANY_IMPROVEMENT blast-radius, VOICE.md, local-seo (review-ask context), git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-95a666b5) — G6 blocked on live marketing-line SMS

**Surface:** Cursor cloud agent `bc-95a666b5-6588-4122-88d5-60cbe9ba54d8`. **Time:** 2026-08-16 ~07:50 UTC. Brief served **G6** (broker-tools). One node only. **`main` @** `b278e28f5` at claim. No product ship this node.

**Blocked**
- G6 Broker SMS agent DoD (`c8bbccaa-84ef-492c-8ce8-9af437833e31`) **blocked**. Accept: end-to-end broker text → agent reply → approval stamp on the marketing line (+15412245025).
- Hard limit: no outbound messages to real people. Completing the accept would `sendAgentSms` to Matt `+15412136706`. DoD 3 (live IG post) is public posting. DoD 10 (Matt-only pilot ≥1 week) needs calendar time after a live APPROVE.
- Environment (probed, no sends): `sms_agent_enabled` matt=true / paul=false / rebecca=false. Sessions=2 (last 2026-08-03). Turns=5, all 2026-08-02 in-process Redmond Q&A smoke (`SMe2e*`), not a webhook APPROVE. `generated_by=broker_sms_agent` rows=2 (`d4711088`, `7fc5fa8b`), both `killed`, `approved_by` null — thin-payload approval-gate tests (S6 missing `editorial_subhead`/`hero_photo`; city:Bend missing template). Zero SMS-agent approval stamps ever. CAP-035 stays 2. R-180 stays PARTIAL. No ledger row (no class shipped).
- Residual class when unblocked: `create_action` from SMS does not hydrate listing/template/hero fields, so IG rows never reach `ready` and APPROVE cannot stamp. No admin surface lists agent sessions.
- Unblock: Matt texts APPROVE on the marketing line against a ready draft, or authorizes one smoke text to his cell that includes APPROVE (still no live publish).

**Do not:** SMS Matt/Paul/Rebecca. Do not publish. Do not set Paul/Rebecca `sms_agent_enabled`. Do not invent an approval stamp. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, admin-product-os, DEVELOPMENT_PROCESS, BROKER_SMS_AGENT plan DoD, REQUIREMENTS R-180, CAP-035, BROKER-OPERATING-SYSTEM-PLAN, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-36c5e37a) — G5 broker day-one + own-book shipped

**Surface:** Cursor cloud agent `bc-36c5e37a-973a-4b3c-8198-8085b9dca744`. **Time:** 2026-08-16 ~07:35 UTC. Brief served **G5** (recruit-retain). One node only. **`main` @** `7de1b6252`. Vercel Production **READY** (GitHub deployment `5928709859`, inspector `8AhizwMJsKnZ8J6RucBM32mhXi1X`).

**Done**
- G5 Broker platform 2→3 (`468febf9-3e86-46d1-96cc-a327061bcae0`) **done**. Accept: a non-Matt broker walks day-one; own-book scoping verified signed-in.
- Class: `scopeBroker` fail-opened unmapped brokers to the company book (`null`). Slug came only from `CRM_BROKER_BY_EMAIL`. Fix: unmapped → `UNMAPPED_OWN_BOOK`; slug from `admin_roles.broker_id` → `brokers.crm_slug`; Today/People/Messages/CMAs/batch-emails use `scopeBroker`; day-one checklist; `content.marketing` unlocked; public social URLs on My settings.
- Accept proof: signed-in `paul@ryan-realty.com` on https://ryan-realty.com/admin/today (Day one: socials still open) and /admin/people (recently-touched all `assigned paul`). DB: slug `paul`, people 71 vs company 23009, sentinel 0. Gate `ci:broker-own-book`.
- CAP-022 maturity 3 (PARTIAL; OAuth residual). R-198 stays PARTIAL. R-175 stays PARTIAL (Today ready-approvals still company-wide). No new recruit-retain ledger row. No schema migration.
- Planes: dal-stat (`resolveCrmSlugForAccess`, `getDayOneChecklist`, scoped `listCmasForAdmin`), admin-crm (Today/People/settings/broker-links), reporting (market-report subscribers), alerts-newsletters (marketing unlock; company letter list), identity (`admin_roles.broker_id`). Ads/public-site unchanged.
- Ship: `ci:gates` 207/207; `origin/main` includes `7de1b6252`; production deploy success.

**Do not:** connect personal social OAuth (Matt-gated). Do not send, post, spend, or write fake socials onto Paul's row. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, admin-product-os, DEVELOPMENT_PROCESS, REQUIREMENTS R-175/R-198, CAP-022, BROKER-OPERATING-SYSTEM-PLAN, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-57e943fb) — G4 alerts enrollment shipped

**Surface:** Cursor cloud agent `bc-57e943fb-edb5-4a4a-bc9b-9fc6a7ee1a36`. **Time:** 2026-08-16 ~06:10 UTC. Brief served **G4** (nurture). One node only. **`main` @** `60de1bee0`. Vercel Production **READY** (GitHub deployment `5928216460`, inspector `7rfmRDpzVR8CtAGa2X9vQqVfGffm`).

**Done**
- G4 Alerts coverage (`6ac2ce94-131d-47a6-8788-f8ae5c17a6cb`) **done**. Accept: a real saved search creates an active `listing_alerts` row with `crm_person_id`.
- Class: account / guest / buyer-LP writers treated `sendEvent.personId` (native `crm_people.id`) as `fub_legacy_id`. Account path upserted before the person existed. Fix: `nativeCrmPersonId` + `upsertListingAlert({ crmPersonId })`; account captures the person first then stamps. Send engine never reads `saved_searches`.
- Accept proof: fleet-test person **61945** / alert `047ddf18-239e-4043-b8ee-152f8ffa5a6c` (`g4-accept-fleet-test@example.com`, active, `crm_person_id=61945`, all-channel suppressed). Prior live guest save 2026-08-15 `pjmlikesgolf@yahoo.com` already had `crm_person_id=61854`.
- Packet-eligible (ex-fleet-test): **7 active / 7 with crm_person_id** (seed said 6). Gate `ci:listing-alert-enroll`. R-152 VERIFIED. No new nurture ledger row: G3 window `2371813a` is still open (one-open-per-domain).
- Planes: dal-stat (`listingAlerts.ts`), public-site (SaveSearchButton / account / buyer LP), admin-crm (bulk assign), alerts-newsletters (cron/engine), identity (`crm_person_id`), reporting (packet counts). Ads audiences unchanged (same `crm_people`).
- Ship: `ci:gates` 206/206; `origin/main` includes `60de1bee0`; production deploy success. No schema migration.

**Do not:** mass-enroll the historical book (would send to real people). Do not send, post, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3. R-153 / R-154 / R-164 remain MISSING (engine completeness, Flexmls, subscriptions panel).

**Skills read:** growth-loop, crm-e2e, CRM_REPLACEMENT_BLUEPRINT, REQUIREMENTS R-152..R-164, COMPANY_IMPROVEMENT blast-radius, DEVELOPMENT_PROCESS.

# Prior — 2026-08-16 (Grok) — Loop ARMED; first post-arm agent launched

**Matt 2026-08-16 21:52 PT: "Arm the loop."** That is the R-211 word.

**Live proof (2026-08-16 ~22:28 PT):**
- `origin/main` @ `4966f126` — Vercel production **READY** (`dpl_BKWKk2h85ZEqQp1KP3NnGgD2AKDk`)
- Dry-run: `{"action":"dry-would-launch","openNodes":25}` (kill switch no longer blocks)
- Live launch: `{"action":"launched","agentId":"bc-57e943fb-edb5-4a4a-bc9b-9fc6a7ee1a36","openNodes":25}`
- Follow-up dry-run: skipped — `boot guard (launched within 15 min)`
- `/admin/loop` on ryan-realty.com: sentinel **ARMED**; last launch **just now** `bc-57e943fb…`; 2 of 12 today; verdict still "Armed and dormant" until this agent claims. Shots: `out/loop-status-armed/` (gitignored). Zero console errors.

**Watch:** `/admin/loop` (Phase 2 Step 4). Healthy = this agent claims one node, ships, handoff curls the next. Disarm = "disarm the loop". Bots still Phase 3. No sends / posts / spend / OAuth.

1. **`/admin/loop` status page** — superuser (`settings.system`, same gate as /admin/sync), linked from Oversight's All tools. Verdict line (armed/disarmed + running/dormant), Version-1 progress, running-now, stale claims, queue-next (fleetNodePriority order), blocked, recent done with evidence first-lines, fleet findings inbox, ledger windows with expiry, sentinel launches (n/12 cap) + orphan releases. Auto-refreshes every 60s. Renders ONLY from the rows agents mutate (`lib/data/loop/status.ts` aggregator) — no self-reported status exists. Screenshots (desktop 1400 + mobile 390, real graph data, zero console errors) verified.
2. **One-node-per-session chaining** — sentinel LOOP_PROMPT now: claim the ONE served node, finish or block it, final-act handoff curl, STOP. Fresh context per node; the chain carries continuity.
3. **Orphan auto-release** — sentinel releases in_progress claims whose cloud-agent owner's newest run is TERMINAL (10-min grace so a mid-write completion is never raced; human sessions still age out via 3-day staleness). Pure rules `isCloudAgentSession`/`shouldAutoRelease` in work-node.ts, 6 new tests; releases logged to sync_logs `loop_sentinel:orphan-release` and shown on the page.

**What ALSO happened tonight (report honestly):** the chain proved itself twice before the disarm finished baking. G2's agent (bc-13c50db8, 02:20) completed G2 and its final-act handoff at 02:50:55 launched bc-7b28f874 — UNLOGGED, because the then-deployed sentinel still had the create-response parser bug (fixed in `176bf5e7`, now live): launch succeeded, parse failed, no sync_logs row, endpoint even said "launch failed". That successor completed **G3** (Lead journey entry, commits `6454203c`..`1843c028`) at 03:39 and its own handoff hit the now-live kill switch — chain severed exactly as designed. Both agents' runs terminal; leftover branch deleted; zero claims on the graph; graph 25 open · 3 done (G1 G2 G3).

**Build hygiene:** `tmp` added to tsconfig excludes (scratch files could fail the Next typecheck — class fix; two stray scratch scripts moved to tmp/). Screenshot tool for this page: `scripts/_loop-status-shot.mjs` (magic-link pattern).

**Watch:** `/admin/loop`. Runbook Phase 2 Step 4. Disarm = "disarm the loop". Bots still Phase 3.

# Prior — 2026-08-16 (loop-sentinel bc-7b28f874) — G3 shipped; successor launch refused by kill switch

**Surface:** Cursor cloud agent `bc-7b28f874` (unlogged successor of G2 `bc-13c50db8`). **Time:** 2026-08-16 ~03:39 UTC. **`main` @** `1843c028d` (G3 product) then `92c59bbe` (this handoff + DISARMED scoreboard).

**Done**
- G3 Lead journey entry (`4622fb28-55d5-4382-a3f2-48a88e8d072a`) **done**. Accept: every `crm_people` row has an `origin` and a `crm_journey_events` `lead.created` row from `ensureNativeLead`.
- Proof: persons `61917` / `61920` / `61921` (source `website`) each have `origin=inbound_web` and `lead.created`. Ledger `2371813a-e700-4c99-8583-71d006a3cc7f` accepted.
- Product: `lib/crm/ensure-native-lead.ts` writes `lead.created` after insert (idempotent). `lib/crm/lead-origin.ts` + tests. `scripts/crm-lead-origin-backfill.mjs` + hosted apply (`crm_people` 16,581 origin-null → 0; 16,581 `lead.created` events).
- Successor launch at this agent's final-act `?handoff=1` hit live `LOOP_SENTINEL=off` — chain severed as designed. Graph: G1–G3 done, ~25 open, 0 in_progress.

**Do not:** revert G2/G3. Do not arm the loop. Do not treat silence as approval.

# Prior — 2026-08-15 (Grok) — Verification fleet: Grok Bots wired as the external Auditor (v1.6.0)

**Matt:** Wants self-feeding external verification — grok bots browse like users after each iteration, output returns to the loop. Product confirmed installed (`/Applications/Grok Bot.app`, beta 2026-08-11; own cloud computer + browser per bot, routines, parallel threads; conversational setup, no public API).

**Done (THE LOOP v1.6.0):**
- **Pipeline live end-to-end (bots pending Matt's paste):** `fleet_findings` table (migration `20260815220000`, applied hosted) → POST `/api/fleet/findings` (`x-fleet-secret` = CRON_SECRET interim; validates expected/observed/url, fingerprint-deduped) → `scripts/fleet-intake.ts` (info→baseline; minor/major/p0→OPEN work node tagged `fleet:<fp>`, FIRST step reproduce-or-reject) → normal loop brief serves it.
- **Case packs generate from durable state:** `scripts/fleet-test-cases.ts` → out/fleet/cases: core 7 (money paths incl. MoS verdict-match, LOOK-never-touch rails), regression 1 (from DONE nodes' accepts — grows automatically), preflight 9 (open browsable gaps).
- **5 paste-ready bot briefs** in `ENTERPRISE_MAP/VERIFICATION-FLEET.md`: Walker Mobile/Desktop (daily), Money Path (2×daily, p0 on funnel breaks), Stats Truth (page-internal §0 contradictions), Regression Certifier (on-demand; **clean pass now required for version certification** per canon). Phase-2 Matt-gated: Analytics Reader (OAuth), Form E2E (test-identity lane), R-206 scheduling.
- R-207 (PARTIAL→G29), G29 seeded (graph 29 nodes), Max pins G29/R-207, scoreboard fleet row, canon v1.6.0 + pointers, G44/G56/G57 green, 56 tests.

**Matt's one setup step:** open Grok Bot app → create 5 bots → paste each brief → replace `<FLEET-SECRET>` (a session prints it on request) → run once supervised → save as skill → schedule per the six-point routine checklist.

**Self-starter (same day — Matt GO on R-206, then caught the timer flaw: "1-hour node must not sit 3 hours"):** `/api/cron/loop-sentinel` every **10 min** (deterministic, token-free; vercel.json, G53 green). STATE-BASED: relaunches the moment the last agent's newest run is terminal (GET /v1/agents/{id}/runs — CREATING/RUNNING = stand down; last agent id kept in sync_logs `loop_sentinel:launch`.sync_cycle_id). Guards: kill switch `LOOP_SENTINEL=off`, fresh-activity standdown (<3h in_progress claim), 15-min boot guard, **12 launches/day cost cap**, fail-toward-launch on unreadable status (bounded by boot guard + claim mutex). Launch: POST api.cursor.com/v1/agents (Basic CURSOR_API_KEY — in Vercel prod env) with the canonical grind-until-blocked prompt (hard limits: no sends/posts/spend/OAuth/SkySlope). Dry `?dry=1`. **Zero-gap chain (Matt: "fire as soon as the other is complete"):** the loop prompt's FINAL ACT is `curl loop-sentinel?handoff=1` with RR_CHAIN_SECRET (injected per-agent via envVars — beta, prompt falls back to heartbeat if absent); handoff mode waives busy check + boot guard (caller vouches completion), keeps kill switch/standdown/cap. Human sessions: same curl with CRON_SECRET (growth-loop skill updated). Max dormancy: ~0 on clean finishes, ≤10 min on crashes. Lib: `lib/data/loop/sentinel.ts`. R-206 VERIFIED.

**Co-evolution wire (same day — Matt: findings flow through the steering verbs, everything grows together):** (1) intake runs at EVERY loop boot (`fleet-intake-core.ts` called by loop-brief — findings become nodes before work is picked); (2) fleet p0/major nodes outrank gap order in the queue (`fleetNodePriority`); (3) regression findings (caseId regress-Gn) inherit the original node's domain + carry the CHANGE duty (restore accept, correct register rows) in their contract; (4) FULL briefs served live at `/api/fleet/briefs/[bot]` from `fleet-briefs.ts` (secret substituted at serve time) — the app holds only a 3-line bootstrap per bot; loop edits brief code → every bot follows next heartbeat. Spec's six full-brief sections excised (code is single source; table summary remains). R-210 VERIFIED, pin R-210.

**Event-driven fleet (same day — Matt: no downtime, no rough timers, packs must update every iteration):** packs now served LIVE from the work graph at `GET /api/fleet/cases/{core,regression,preflight,flows}` (x-fleet-secret; `lib/data/loop/fleet-cases.ts`; script stays local-preview). First line RUN-TOKEN = hash(pack, deploy SHA, graph stamp) — changes only when something shipped. All 6 briefs rewritten: fetch pack at run start, token match → end in seconds ("no changes"); heartbeat cadences (Walkers 2h alternating, Money Path hourly :30, Stats 4h, Flow Prover 2×day). Loop-inline verification remains the ship gate — the loop NEVER waits on bots; they trail and only add work. Briefs now point at ryan-realty.com (live canonical domain). R-209 VERIFIED, Max pin R-209.

**Deploy-verify repair (same day):** VERCEL_TOKEN went invalid mid-day; script now flips to Vercel CLI auth fallback on 401/403 (`ab2795f0`, scripts-only → remote build correctly skipped/CANCELED by ignoreCommand; prod serves `23ab136c` with all runtime code). KNOWN SMALL BUG for next runtime push: error-branch log fetch reads `deployment.id` but v6 list returns `uid` → fix `d.uid ?? d.id` in check-vercel-deploy.mjs. Also: rotate VERCEL_TOKEN when convenient (M-adjacent, dashboard).

**Flows lane (same day — Matt: "use the system like a human, catch all use cases"):** designated fleet test identity (`fleet-test` local-part marker + phone 500-555-0106, `lib/crm/fleet-test-identity.ts`) wired at four chokepoints: ensureNativeLead tags `fleet:test` + all-channel suppression on create; createNativeTask skips (no broker wake); autoEnrollPerson refuses; packet counts exclude (crm/newsletter/alerts). ALL PROVEN LIVE — fixture person 61855. **Bot 6 Flow Prover** (8 PM PT) may SUBMIT the four flow cases (newsletter, /sell valuation, listing contact, alert save) with that identity ONLY; `scripts/fleet-flow-verify.ts` proves backend effects after runs (all PASS). Admin-side = loop-verified; Admin Walker bot stays Matt-gated (viewer credential). G30 DONE, R-208 VERIFIED, pins G30/R-208, packs now 4 (flows added).

**X-research mesh (same day):** harvested xAI's canonical operating model + field practice into the spec — skill-before-routine (never automate unproven), six-point routine checklist (owner/schedule+TZ/input/result/approval-boundary-as-sentence/no-data policy), re-paste packs after significant ships (regenerator is the re-sync), memory-is-not-a-source (in Stats Truth brief), do-not-rely-on-Auto-Review (rails are the fence), staggered schedules for usage limits (7a/9a/11a+5p/2p PT), Teach-a-Task = optional draft. Practitioner signal: "test apps" is a top validated Grok Bot use case.

**Do not:** put the fleet secret in any committed file; let bots touch forms/admin; treat a bot finding as verdict (reproduce-or-reject); certify a version without the fleet pass.

# Prior — 2026-08-15 (Grok) — First adversarial pass: the machine found 17 defects, teeth hardened

**Matt:** "When I catch things you haven't, I worry this is all prose." Correct instinct — R-040 (adversarial verify, LOCKED since July) was being violated by self-graded verification. ESCAPE `6c980ad6`.

**Audit (3 fresh-context breakers, claims only):** 17 defects, zero found by Matt.
- Gates: G56/G57 blind to TAIL-row deletion (proven: delete G25/R-206 → green). FIXED: `**Max:** G28 · M6` / `**Max:** R-206` pins, cross-checked both directions; M-rows now need DONE dates too. Re-proven: tail delete now FAILS.
- Enforcement: work-graph state machine was DAL-only (raw update flipped killed→done) + TOCTOU race; ledger freeze had zero executable callers and failed OPEN on read error; one-open-per-domain unenforced. FIXED: DB triggers `loop_work_nodes_guard` + `site_improvement_ledger_guard` (migration `20260815210000`, applied hosted), optimistic `.eq('state', from)` in transition(), DAL guard fail-closed + full one-open rule.
- Register truth (12 rows attacked): 8 survived. R-025 (pulse counts INCLUDE Coming Soon — Bend 487 had 4), R-095 (town doors are static scenics not live MLS), R-137 (four untracked email paths: sequence fallback, home-valuation delivery+ack, admin one-off, CMA request confirm), R-203 (inboundFeePct write-only, never reaches tc_commissions). All demoted VERIFIED→PARTIAL; product gaps **G26/G27/G28** opened + seeded (graph 28 nodes).
- Stale claims: 8 in packet/manifest — including a REVIVED OAuth reconnect ask in §5 (the cb7699f1 class) and "13 nodes" vs live 24. All corrected; counts now live in ONE place each.
- Canon v1.5.1: step 5 mandates the adversarial pass for high-stakes classes (fresh subagent, claims only, never self-graded). All pointers bumped; G44 green.

**Verified survivors worth knowing:** R-057 private-key diversion (anon probes clean), R-179 delivery observability (real events), R-121 sitemaps (7,668 listing URLs live), R-066 concessions math, transitions refuse illegally at DB level now.

**Next:** G2 identity stitch via "Run the loop" (brief serves it with leads-domain reads). G26 (email tracking) and G27 (Coming Soon count truth — may need Matt's definition pick) are strong next candidates; G27 is §0-adjacent.

# Prior — 2026-08-15 (Grok) — Requirements register: all of Matt's asks, dispositioned and unshrinkable

**Matt:** Bring every requirement from every session together; the system fills gaps automatically; never "five things so forget the 120 others"; he is done being the memory.

**Done (THE LOOP v1.6.0):**
- **`docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md`** — five parallel readers harvested the FULL corpus (handoff history, master goals, brain dumps, Broker OS plan, public locks, PROGRAM decisions, canon, rules, memory): 572 raw directives → **203 dispositioned rows** (91 LOCKED · 41 VERIFIED · 39 PARTIAL · 25 MISSING · 6 GATED · 1 PARKED) grouped by the 12 animals, each with source + coverage. Dispositions inherit source claims; certification re-verifies.
- **Gaps filled automatically:** the 25 MISSING rows drove **G15–G25** onto VERSION-1 (search completeness, CMA/pricing residual, prospecting product, reporting collapse, one person surface + SendPanel, buyer packet build, public IA/mobile residual, SEO/AEO residual, email residue kill, admin dark mode, social fan-out calendar) + 11 seeded work nodes (graph now 24 nodes, G1 done).
- **G57 `ci:requirements-register`** (in ci:gates + MECHANICAL_GATES): R-IDs contiguous (rows leave only as SUPERSEDED in place), closed disposition set, MISSING must cite an existing manifest gap. Namespace note: only MISSING rows' G-refs validate against the manifest (G44/G56 in evidence cells are mechanical gates).
- Loop-brief now prints the demand line (register counts). Canon v1.5.0; pointers bumped; G44 green (263 docs).
- **New-directive rule (canon):** a new Matt directive lands as a register row in the same delivery that acts on it.
- **Same-day follow-up (versioning Q&A):** expertise routing shipped — `DOMAIN_REQUIRED_READS` in domains.ts (existence-tested) printed by the brief under the next node; §How Matt steers (ADD/CHANGE/STOP; blocked ≠ stopped) in COMPANY_IMPROVEMENT; R-204 (expertise, VERIFIED) R-205 (steering, LOCKED) R-206 (scheduled unattended iterations — GATED, Matt undecided). Register 206 rows. Second-brain research done: we independently match Karpathy's LLM-Wiki pattern (raw→wiki→schema, ingest/query/lint); lint = our gates + weekly packet + certification.

**Next:** "Run the loop" → brief serves G2 identity stitch. New gaps are scored alongside old ones; Learn stays first where windows expire.

**Do not:** delete or renumber R-rows (SUPERSEDE in place). Do not treat VERIFIED-per-source as re-verified — certification does that. Sends/posts/spend/OAuth stay Matt-gated.

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, ENTERPRISE_MAP handoff + matrices.

# Prior — 2026-08-15 (Grok) — Durable Company Loop: work graph, loop-brief, G56, first MEA iteration

**Matt:** Long sessions lose context; objectives fall off the plate; wants the recursive plan runnable with graph engineering, everything remembered, no shortcut assumptions.

**Done (THE LOOP v1.6.0, plan `durable_company_loop`):**
- **Durable work graph:** `public.loop_work_nodes` (migration `20260815190000`, applied hosted via `scripts/analytics/apply-analytics-migration.mjs` — psql absent, pg driver used). Contract per node (objective/output/accept), audited transitions (done/killed terminal, evidence required), DAL `lib/data/loop/work-graph.ts`, pure rules + tests `work-node.ts`. Seeded G1–G13 from VERSION-1 (`scripts/seed-work-graph.ts`, idempotent upsert on version_gap).
- **Session boot is a command:** `npx tsx scripts/loop-brief.ts` — handoff Current + scoreboard headline + stranded windows + work graph + next node contract. Matt's prompt is now "Run the loop."
- **G56 anti-shortcut gate:** `scripts/check-version-manifest.mjs` (`ci:version-manifest`, in ci:gates + MECHANICAL_GATES). Below-floor CAPs / red INTs must be accounted in VERSION-1; G/M numbering contiguous; DONE needs a date; CERTIFIED needs a SHA. First run caught CAP-033 dropped — fixed into M6.
- **Canon v1.4.0:** memory hierarchy (chat = disposable; graph/ledger/manifest/handoff/ADR = durable), MEA mapping (Manager = brief+scores · Executor = session · Auditor = accept+gates), additive-updates rule. All pointers bumped; G44 green (262 plan docs).
- **Graph waves GO recorded** in AGENTIC_GRAPH_ENGINEERING (infra only): `.claude/workflows/{verify-figures,adversarial-audit,scoreboard-sweep}.md`; codebase-memory ADR written (PURPOSE/STACK/…/TRADEOFFS incl. token self-renew + FUB dead + one identity spine); `detect_changes` verified (91 files vs index at `85d13209`).
- **First MEA iteration (G1) COMPLETE:** claimed → `scripts/loop-learn-close-windows.ts --domain seo-aeo` closed all 11 expired windows with §0 traces (1 win: Tetherow LCP p75 60,768→4,156ms · 1 loss: overlay engagement 0.144→0.119 · 1 flat: llms.txt +3 vs +10 · 8 inconclusive: GSC page series not live in June — G.2 lesson) → probe `expiredUnlearned=0`, seo-aeo unfrozen → node done with evidence (`bcde58b9`). Brief now auto-serves **G2 identity stitch** as next.
- Prior deliveries confirmed: `1641a156` + `85d13209` both READY on production.

**Next:** "Run the loop" → brief serves G2 (identity stitch, 1/164). ba3435dd factory window Learns 2026-08-29. Matt moves M1–M6 in VERSION-1.

**Do not:** re-add reconnect asks (tokens self-renew; LinkedIn parked). Do not treat chat todos as the source of record — the graph is. Do not open a class in a domain with expired unlearned windows (guard refuses anyway).

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, AGENTIC_GRAPH_ENGINEERING, ENTERPRISE_MAP SESSION_HANDOFF, TDD.

# Prior — 2026-08-15 (Grok) — Company v1: versions over the map, Learn made mechanical

**Matt:** Fast answers keep leaving ad-hoc drift; the whole product never reaches "a new version" together. Wants the comprehensive, granular, holistic process.

**Done (THE LOOP v1.3.0):**
- **`docs/plans/ENTERPRISE_MAP/VERSION-1.md`** — Company v1 manifest: six-layer plain-language census over CAP/INT matrices, the 7-condition floor, 14 agent gaps (G1–G14) + 7 Matt moves (M1–M7), certification pass. Versions close on conditions, never dates.
- **Learn mechanical** in `lib/data/loop/`: `closeImprovementLedgerRow` (writes actual_delta+verdict+measured_at); `insertImprovementLedgerRow` refuses a domain with expired unlearned windows; `listExpiredUnlearnedWindows`; pure `windowEndsAt`/`isExpiredUnlearned` + tests (30 pass). Probe/packet now counts `expiredUnlearned` per domain.
- Canon v1.3.0 §Company versions + changelog; pointers bumped (CLAUDE, TEMPLATE, producer-output-class, addendum, scoreboard, SESSION_HANDOFF, growth-loop SKILL, domains.ts). G44 green, 262 plan docs registered.
- Live probe 2026-08-15T15:3xZ: **11 of 12 open windows expired-unlearned, all `seo-aeo` → domain frozen until Learn closes them.** TikTok token expires 2026-08-16T12:00Z (G14). Meta audience heartbeat first green 14:03Z (G11).

**Correction same day (Matt: "knock it off" on reconnect asks) — ESCAPE `cb7699f1`:** the "4 red integrations, Matt must reconnect" claim was FALSE for 3 of 4. Verified live: GBP/YouTube/X/TikTok auto-refresh via the daily 12:00Z token-heartbeat (refresh tokens on file; scheduled run 2026-08-15T12:00:03Z all ok; on-demand trigger rolled expiries to 19:09/20:09Z). Only LinkedIn lacks a provider refresh token → **PARKED, never a reconnect ask**. Fixed everywhere: signals.ts TokenHealth (`refreshTokenPresent`, `auto-refresh`/`needs-reauth` statuses), VERSION-1 (no OAuth Matt move; 6 Matt moves; G14 DONE), INTEGRATIONS (red 4→0, RECONNECT 5→0), SOCIAL-PARKS, CAP-019, ALL-OPEN, ADVANCEMENT_PLAN, REMAINING, DUAL-PASS, SESSION_HANDOFF, scoreboard §0, EVIDENCE-LOG 2026-08-15 entry. **Rule: liveness authority is heartbeat `sync_logs`, never `expires_at` alone. Do not re-add reconnect asks.**

**Next:** G1 (close the 11 seo-aeo windows from GSC actuals) unfreezes SEO. Then the scored queue: G2 identity stitch (1/164), G3 Lead stage 0, G4 alerts coverage. Matt moves listed in VERSION-1 §M.

**SHA:** see this commit. Prior `649c0a79`, `7d4a7256` on origin.

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, ENTERPRISE_MAP SESSION_HANDOFF + matrices, TDD.

# Prior — 2026-08-15 (Grok) — finish the place-family indexes

**Matt:** The restore stopped at an invented cutoff. Neighborhood and subdivision indexes were still 404. Finish the place doors. No seventh pattern.

**SHA:** `68988f0b` on `origin/main`. Indexes landed in `ccc0f62b`. This SHA publishes subdivision hero counts from the community plat set. Parent restore `d2208216`. Production READY.

**Done this land:**
- `/neighborhoods` LIVE: 13 Bend districts, 355 active SFR, doors to `/cities/bend/{slug}`. Production walk 200, kb-root, Awbrey Butte $1,385,000.
- `/subdivisions` LIVE: featured community plats + A-to-Z of those plats, doors to `/subdivisions/{slug}`. Areas nav / Menu+ / both footers / sitemap / site-index all open both indexes.
- Neighborhood and plat `generateStaticParams` are no longer empty stubs.
- Hero on `/subdivisions` now publishes snapshot counts for the community plat set it actually lists. County-wide `getIndexableSubdivisions` stays on the sitemap, not this page.
- Production READY for `ccc0f62b`. Screenshots in `out/looks/2026-08-15-place-indexes/` (gitignored).

**Do not:** `git add -A`. Do not commit LOOK-PLAN / RESTORE / page-grade leftovers / recapture PNGs / `_sunstone-cma-summary.ts`. Do not stamp Public Product OS grains LIVE. Do not page-grade.

**Named stops (still hold):** looking-at SMS / buyer-packet send. Ad spend. I6. Page-grade. New Public Product OS. Tremor npm. PropXYZ purchase. Do not publish 1990. Ban new UI components.

**Skills read:** endtoend, git-commit.mdc, CROSS_AGENT_HANDOFF, deployments-cicd, verification.

# Prior — 2026-08-15 (Grok) — company loop v1.2.1 blast-radius

**Matt:** Search, saved searches, granular filters, listing alerts, CMA look, stat accuracy + one verification process, all polygons, Vercel/Supabase, analytics/GBP/social/reporting, CRM ease. Holistic: a change in analytics must land on the site, reporting, newsletters, and ads. Spark is ingest-only. Do not lose identity stitch (opens, clicks, Google, ads).

**SHA:** `2ac16199` on `main`. Parent company ingest `7c2bca5c`..`b163a2f6` on `origin/main`.

**Done this land:**
- THE LOOP **v1.2.1**. Same 12 domains. Named surfaces + `COMPANY_BLAST_RADIUS` (7 planes).
- Probe now reads `listing_alerts`, `boundaries`, `search_areas`, `visitor_identity_map`, `email_events`, `visitor_events`, `cmas`, `meta_audience_log`.
- Packet refresh 2026-08-15T14:45:03Z. Identity stitch **1/164**. Alerts **6** active. Boundaries **3,312**. `search_areas` **0**.

**Do not:** `git add -A`. Do not mix place-index or LOOK leftovers. Do not send, post, spend, or OAuth. Do not invent a 13th domain or a second stats engine.

**Skills read:** growth-loop, crm-e2e, database-canonical-reference, SESSION_HANDOFF, CROSS_AGENT_HANDOFF.

# Prior — 2026-08-15 (Grok) — company improvement process (THE LOOP v1.2.0)

**Matt:** Develop a process that continually improves the whole company. No new OS. No product UI.

**SHA:** `7c2bca5c` on `main` (local through `b163a2f6`). Hosted `site_improvement_ledger.domain` applied 2026-08-15. Ledger row `ba3435dd`.

**Done this land:**
- THE LOOP bumped to v1.2.0. Ingest is company-wide. Five standing loops unchanged.
- Addendum `docs/plans/COMPANY_IMPROVEMENT.md` (domain → signal → diagnose).
- Weekly packet `docs/plans/COMPANY_SCOREBOARD.md` (overwrite, not a dated novel).
- `site_improvement_ledger.domain` (12 closed domains). DAL `lib/data/loop/`. Probe `npx tsx scripts/company-scoreboard-probe.ts`.
- Start ritual: SESSION_HANDOFF + COMPANY_SCOREBOARD.

**Do not:** `git add -A`. Do not mix LOOK-PLAN / RESTORE / page-grade leftovers. Do not send, post, spend, or OAuth.

**First packet filled** 2026-08-15T14:14:00Z. 11 open seo-aeo windows plus this factory row. Next cycle can score a non-SEO class (nurture Lead=0 is the highest-reach rotting row).

**Skills read:** TDD, database-canonical-reference, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, growth-loop, git-commit.mdc.

# Prior — 2026-08-15 (Grok) — restore the photographed public site

**Matt:** Revert the public site the page-grade pass flattened. Keep going /endtoend. Not another OS. Not a new UI component.

**SHA:** `d2208216` on `origin/main`. Vercel production READY. Custom domain https://ryan-realty.com serves kb-root + photographed home/Bend. Parent: `0ccad3b0`.

**Done this restore:**
- Homepage is KB again: KbHero, towns, communities, featured, region map, ticker, sell, reviews, team, market HUD, plus ArrivalIntent. D11 lead locked.
- City / neighborhood / community / zip / cities+communities indexes: photographed KB + PlaceMapListSplit dual-pane, not cream ledger.
- Listing: full KB stack (hero, gallery, facts, map popup with photo/href) plus HouseMe LivePricingRead.
- About stayed HEAD (faces + Call/Text). Mission sentence stays out of How it started.
- Plat sales-history / schools kept the photographed table and re-wired year doors + DAL school constants so `ci:subdivision-stats-integrity` holds.
- Gates: mockup-parity 28/28, public-ui re-seeded to the restore (205/8/44), tests 11356 pass. Screenshots in `out/looks/2026-08-15-restore/` (gitignored).

**Kept (not flattened):** ArrivalIntent, sentence search, HouseMe/pricing read, map popup facts, about phones, cube, CMA, admin, chart grammar, D109 no-recharts.

**Named stops (still hold):** looking-at SMS / buyer-packet send (CLAUDE.md §1). Ad spend. I6. Page-grade. New Public Product OS. Tremor npm. PropXYZ purchase. Do not publish 1990. Ban new UI components.

**Do not:** `git add -A`. Do not commit `LOOK-PLAN.md`, `RESTORE.md`, `looks/2026-08-14-page-grade-v24-regrade/`, recapture PNGs, or `scripts/_sunstone-cma-summary.ts`. Do not stamp neighborhood/subdivision grains LIVE.

**Left on disk, not shipped:** recapture PNGs. Page-grade leftover folder. `LOOK-PLAN.md` / `RESTORE.md`.

**Next after push:** `npm run deploy:verify`, then walk production home/Bend/listing. Neighborhood and subdivision *indexes* still 404. That is a later product job, not this revert.

**Skills read:** endtoend, git-commit.mdc, CROSS_AGENT_HANDOFF, SESSION_HANDOFF.

# Prior — 2026-08-14 (Grok) — public look: stop inventing, use an existing system

**Matt:** Page-grade flattened the live site. "Restore" is the wrong word. Do not write product UI until he stamps a look. Then: find a system that already exists (GitHub + reviews + trending), incorporate something beautiful. Do not spin another rubric/OS.

**GitHub hunt (done this session). There is no beautiful open-source brokerage frontend.** Highest RE stars:
- `microrealestate/microrealestate` 1,166 — landlord/PM ops, not a public MLS site
- `AleksNeStu/ai-real-estate-assistant` 293 — live demo is a cold Render splash, not a look
- Niche Next/shadcn RE templates: 0–6 stars, student clones

**What is actually trending and looks good (2026 reviews):**
1. **Tremor Blocks** — 16k stars on tremor-npm, Vercel acquired, 300+ blocks now free MIT. Philosophy: show the data, hide the chrome. Demo: https://blocks.tremor.so and https://tremor.so/blocks
2. **Origin UI → COSS** — 10.4k stars, now Cal.com's system at https://coss.com/ui. Primitives, not a brokerage look.
3. **Magic UI** — 20.8k. Landing-page motion. Wrong job.
4. **PropXYZ** (Shadcn Studio, Jun 2026, $79) — only RE-shaped Next 16 + shadcn + TW v4 template. Cards already draw photo + beds/baths/sqft + price + map split. Demo: https://shadcn-nextjs-propxyz-admin-template.vercel.app/ — rental/PM, not MLS, but the card/map language is the one that looks finished.
5. **HouseMe.ai** — best live AI-RE *product* (Intelligence Report). Not OSS. Copy the report structure, not their code.

**THE PICK (Matt stamped the 3 UIs 2026-08-14 evening):**
- Browse/map/cards: PropXYZ card + map-split language.
- Market / analysis: Tremor Blocks (free MIT). Skin navy/cream.
- Listing intelligence: HouseMe report shape on *our* stamps. No invented 5-year %.

**Plan of record:** `docs/plans/PUBLIC_PRODUCT/PRODUCT.md`. Includes the Aug 10 sales cube (shipped as `analytics_mart_*`, 2016–2025; remaining: 1998 backfill, kill live_aggregate, weekly full rebuild, place/listing/CMA reads). `LOOK-PLAN.md` is display only. `DATABASE_FOR_AI_AGENTS.md` lookup now routes size/composition/feature/share to the marts.

**Do not:** page-grade, new Public Product OS, Magic UI, treat look as the whole job.

**Next:** Matt stamps PRODUCT.md, then execute PRODUCT §1 (arrival and memory), then §2 (Field cards). Recapture the ten-page strip after any `V3Field` change.

**Skills read:** frontend-design, design_system/ryan-realty, CROSS_AGENT_HANDOFF.

# Current — 2026-08-14 (Grok, imagery canon) — local, not pushed

**Track:** Kill the prohibitive "AI never renders real life" lock. We are better at this now.

**Wired:**
- Creative-brain law 1 is now: reference-conditioned Central Oregon place work is allowed. Prompt-only scenic slop is refuse. Do not invent a listing, a room, or the view from an address. No people-as-residents. Charts render in code.
- CLAUDE.md banned-content #2, D38, design-system imagery, market-video i2v, producer hard-fails updated to the same use-class.
- July Reality Law stays in LESSONS.md as history (why unconstrained photoreal failed). It is not a live ban.

**Next leftover:**
- Place bible + reference packs + image resolver. Banner table is still 0 rows.
- Form catalog leftover: paste SkySlope JSON from the Mac Mini, then one-click PDF pull.

**Not this land:** Do not `git add -A`. Page-grade / public-product-os / SESSION_BOOT dirty files stay out. No generated banners shipped this session.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, creative-brain, public-product-os (orient), git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, CMA use + pricing pages) — READY `11f78637`

**Track:** Make the CMA document beat the packet Chris actually sent. Sample: RPR 30-pager for 56628 Sunstone Loop (Caldera Springs), 2026-08-12.

**SHA:** product `11f78637` on `origin/main`. Production READY. No schema.

**RPR vs live cache (same day, verified):**
- RPR: ZIP 97707, 8.68 MoS labeled seller's, AVM $2,423,333, stale CMA $2,499,000 (2026-03-17), 4 AVM "comps" + 1 close, $0 adjustments.
- Caldera Springs cache: 39 closed / 365d, median $1,790,000, 22.15 MoS, buyer's. Listing city is Bend (3.62 MoS, median $722,000). Old CMA builder would have used Bend.

**Wired:**
- `resolveCmaMarketTargets` — resort neighborhood cache first, city fallback.
- Phase suffix on resort aliases (`Caldera Springs Phase One`).
- Cover + pricing: closed MLS sales only, automated estimates not used, market is the community not the ZIP.
- Market board (`render-market-page.ts`): these sales / this market / under contract / for sale now. Trend chart only when six priced months exist.
- Zoning / rental boards and pricing explanation from `78ed727e` stay.

**Do not `git add -A`.** Imagery Current / page-grade / chrome-seller-ask / admin inbox stay out.

**Leftover:** existing stored CMAs keep old HTML until rebuilt. Do not rebuild the hand-crafted 3480 row. Sunstone draft built 2026-08-14: slug `cma-56628-sunstone`, status draft, not sent. Recommended $1,730,000. Audit fail (3 findings). Local HTML `out/cma-56628-sunstone/cma.html`. Looks `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-sunstone-cma/`. Production PDF was 500: Chromium rendered, then `assertPdfPageSafety` could not load `pdfjs-dist/legacy/build/pdf.worker.mjs` on Vercel. Fix is local (pdfjs-node + tracing include), not in this handoff commit.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, VOICE.md, frontend-design, CMA producer SKILL.md, PAGE_CONTRACT, DATABASE_FOR_AI_AGENTS §3a, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, public pricing product) — READY `68a1123d`

**Track:** Roll the matcher into one public product. Not another matcher-geography pass.

**SHA:** product `68a1123d` on `origin/main`. Production READY. Hosted `listing_pricing_reads` + `listing_pricing_reads_due` applied (`20260814171000`, SFR-only due `20260814174600`). 11 stamp rows after two cron drains.

**Wired:**
- `lib/pricing/public-contract.ts` — listed over/under, unlisted range, refuse (thin-set / new-construction / builder-phase / facts-not-ready / no-gla). Range band 0.09.
- CMA `build_summary.public_listing_read` from the same contract. Document can still price new construction. Page must not.
- Listing page reads the stamp only. Published CMA wins. CTA is `PublishedCmaDownload` mode=request → `crm_people` tagged `source:listing-pricing-read`. No second form.
- Terms mention the listing-page market read.
- Due function is SFR only. Condos / TICs / manufactured no longer starve the stamp queue.

**Prod check (numbers match the stamp):**
- Listed: 2533 Pine Terrace, Bend (`/listing/20210502210640934980000000`) — $1,089,000 to $1,305,000, 3% over the ask, n=3.
- Refuse thin-set: 21483 Bunchgrass, Bend.
- Refuse new construction: 620 Sprout, Sisters.
- Looks: `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-listing-pricing-read/`

**Do not `git add -A`.** Imagery Current / page-grade / chrome-seller-ask stay out.

**Leftover:** builder-phase $/sqft (Walnut / Kiesow class) only. Public page refuses those addresses. Cron still drains facts (`done: false`) and stamps 6 SFR per run until facts are done, then 24.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, VOICE.md, DATABASE_FOR_AI_AGENTS §2b, git-commit.mdc.

# Prior — 2026-08-14 (Grok, form catalog T2.1b) — LIVE `caa92e2a`

**Track:** Transaction forms. Know when OREF, Oregon Data Share, or Oregon Realtors revise a form, and when a new published form exists, without downloading every blank.

**SHA:** `caa92e2a` on `origin/main`. Production READY. Hosted `20260814140000` recorded on `dwvlophlbvvygjfxcrhm` (`tc_form_catalog_items` / `tc_form_catalog_checks` already present). OR + ODS free with membership; OREF paid subscription.

**Wired:**
- Three SkySlope libraries: OREF `1340`, ODS `1528`, Oregon Realtors `1837`. Engine is generic; RR house forms stay local.
- Metadata-only catalog check. Console script copies published JSON. Paste on `/admin/forms` or `POST /api/admin/forms/catalog-check`.
- Diff matches `source_form_id`, then form number (samples still pair). Empty library lists are refused.
- Persist `tc_form_catalog_items` + `tc_form_catalog_checks`. Held rows get `update_available` + `pending_source_version_id`.
- `/admin/forms` filters: updates / new / retired. OREF packet warns when 001 is stale.
- PDF ingest of a new version is still the existing loader. Do not send a stale layout to a client.

**Next leftover:**
- Run the check from the signed-in Mac Mini SkySlope Forms tab, then paste JSON.
- `updateFormVersion` one-click PDF pull is not built. Re-run ingest for the new `sourceVersionId`.

**Not this land:** SkySlope write, client send, Partnership API cron. Do not `git add -A`. Dirty CRM deals paths stay out.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, skyslope-form-compliance, oregon-real-estate-oref, oregon-orea-principal-broker, document-external-api, skyslope-file-organization, tc-builder, admin-product-os (orient), git-commit.mdc.

# Prior — 2026-08-14 (Grok, inbound agent referral) — LIVE

**Track:** New revenue desk. Out-of-area brokers send a Central Oregon buyer or seller to `/refer-a-client`. Destination-market GCI after a 25% referral. No outbound SMS/email. No drip. No ad spend.

**SHA:** referral `b4bf6b8d` on `origin/main`. Tip `104c01cc` (seller-net stacked after). Production READY `dpl_6v6xZDp114abhCEYmroiY98r5zbq`. No new referral migration. Hosted `sale_pricing_facts` already present (149,402 rows).

**Wired:**
- Public `/refer-a-client` — v3 Stage → Ledger → Sheet (9 steps, choice intent) → Quiet
- Client → `crm_people` tagged `referral:inbound` + `source:agent-referral`. Sending broker → `role:referring-agent`. Both blocked by `geoReferralEnrollBlock`
- Internal only: 240-min task + `queueBrokerAlert` to Matt. Same-email rejected. Shared phone omitted on the second person
- Admin `/admin/crm/referrals` — Incoming from other agents above the outgoing handoff queue
- Nav / sitemap / llms map / page-inventory. Sign-in modal excluded on `/refer-a-client` and `/join`

**Looks:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-refer-a-client/` local 390+1280 hero/ledger/form plus prod-390 and prod-1280. No OAuth modal.

**Next leftover:**
- After a real inbound lands, write the referral agreement by hand (Matt §1). Do not contact the client first
- LIVE `/llms.txt` already lists the path

**Not this land:** Seller-net is on this tip (`3f8ad2a2` + `104c01cc`), not in a stash. Older stashes still hold sell-film / SellerLPForm. Do not `git add -A`. Do not push `wt/*`. Did not send a referral or a message.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, growth-loop (orient), admin-product-os (orient), public-product-os (orient), frontend-design, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, leftover-todo pass) — READY `caa92e2a`

Agent leftovers that do not need Matt. CRM Pipeline islands deleted (redirects stay). Seller-net cells page past the 1,000-row cap. `pricing_index_window` hosted. Form-catalog gates fixed so the stack could land. Production READY on `caa92e2a`.

**Still Matt-gated:** Yes on Today, C taste, Email to Matt, publish, referral agreement after a real inbound.

**Still open, not Matt-gated:** other OREF maps (need measured blanks), SkySlope live file, `crm-deals` mutations with no UI, pre-2024 YN drain (cron), one-click form PDF pull.

# Concurrent — 2026-08-14 (Grok, pricing audit leftovers) — READY `67207069`

1–5 LIVE `4701a30e`. Leftovers LIVE `67207069` (production READY). Hosted `20260814152953` already applied. Matcher holes closed:

1. Quality stop is tight GLA only. `subdivision-*-wide` (±30%) does not stop the ladder.
2. `plausibleListedClose` drops a close over 10× last ask, not only under 10%.
3. A mile-ring sale with no coordinates is dropped.
4. Mapped vs unmapped is a different market. Highway 20 does not fail-open into Boyd Acres.
5. 1-acre Redmond / Sisters / Prineville / Madras / La Pine / Culver is not rural. Ranch (5+) in those towns still is. Unmapped Bend on an acre or more stays rural.
6. `matchToCompSelection` diagnostics now carry the resolved market area and rural flag.
7. Same-neighborhood subdivision $/sqft cut is 15%. Debron is Awbrey Woods tract ($382, n=7) vs Awbrey Butte custom ($457, n=86) — the 30% citywide cut let them mix.

**Do not `git add -A`.** Page-grade / public-product-os / chrome-seller-ask / V3 chrome dirty files stay out.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, database-canonical-reference, DATABASE_FOR_AI_AGENTS §0/§2b/§4, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, seller net) — READY `104c01cc`

ClosePrice is the contract price. Seller concessions come off that number before commission. `lib/pricing/seller-net.ts` + view `sale_pricing_seller_net`. Production READY on `104c01cc`. Hosted YN column and view already applied.

**Next:** 400-sale as-of backtest on ClosePrice and seller net. No accuracy claim without a printout. Pre-2024 YN drain is leftover.

# Prior — 2026-08-14 (Grok, Track 2 P3 leftovers /endtoend) — READY `7392b788`

**Track:** 2 P3 leftovers that do not need Matt. A broker does not work a second send path or a second deal board. No outbound SMS/email. No SkySlope write.

**SHA:** P3 tip `7392b788` on `origin/main`. Production READY (`dpl_3fJ7uEWJfrcLTW4UpGuubtcL6yWY`). Stamp `587dbe97`. P2 tip `6f32f9b3` already READY.

**Hosted migration** `20260814010000_tc_deal_people.sql` already applied on `dwvlophlbvvygjfxcrhm`. 0 rows. P3 has no new migration.

**Wired:**
- Dead `sendExpiredIntroAction` / FSBO send / `send-doc` refuse with “Send from /admin/prospecting.”
- Visitor hot-lead cron: 5-minute call task for identified sessions. `visitorEscalateEmailEnabled()` is false. No Resend.
- `/admin/crm/deals`, `/pipelines`, `[id]`, reporting/deals → `/admin/closings`. Pipeline child gone from People nav. Closings footer no longer links the old board.
- Packet hero stays `buildThisHomeMarketingPlan`.

**Looks:** `docs/plans/ADMIN_PRODUCT/looks/2026-08-14-track2-p2/` signed-in local 390+1280.

**Plan:** `docs/plans/ADMIN_PRODUCT/TRACK2-RANKED-PLAN.md` (P3 leftover block)

**Next leftover:**
- Matt taste on C first-touch copy + packet
- Empty OREF maps on other form versions (overlay locked to 15-page 01/2026 sample)
- SkySlope remains the live file until cutover
- Unused CRM kanban islands still on disk under `app/admin/(protected)/crm/deals/`
- Yes on Today, Email to Matt, and publish stay Matt-gated. Do not send.

# Prior — 2026-08-14 (Grok, Track 2 P2 /endtoend) — P2 READY on origin

**SHA:** `6f32f9b3` READY. Person↔deal (`tc_deal_people`), Today approval Yes, inbound valuation C-bar, OREF 001 overlay. Hosted migration applied (0 rows). No live send.

# Prior — 2026-08-13 (Grok, Track 1 Open houses) — Open houses Look GREEN on production

**Open houses Look:** GREEN at 390 and 1280 on `/open-houses` and `/open-houses/bend`. First screenful is photographed open houses that open the listing. When/calendar stays on the card. Instrument (count + median) sits under the Field. Chrome CTA stays Value my home. v3 chrome kept.

**SHA:** feat `96a26b1b`. Production READY on `96a26b1b`. Docs evidence `73ea1d56`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-open-houses/` (390/1280 local + prod).

# Prior — 2026-08-13 (Grok, Track 1 Places) — Places Look GREEN on production

**Places Look:** GREEN at 390 and 1280 on `/cities`, `/cities/bend`, `/communities/tetherow`. First screenful is photographed MLS homes that open listings. Instrument sits below the Field. Chrome CTA stays Value my home. v3 chrome kept. No AI houses.

**SHA:** feat `f2652459`. Production READY on `f2652459`. Docs evidence `8c79aa07`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-places/` (390/1280 local + prod).

# Prior — 2026-08-13 (Grok, Track 1 listing detail) — listing Look GREEN

**Listing URL:** `/homes-for-sale/bend/20172-soft-breeze-220222292` (Active SFR, Spark photo, marketing video). Brookside `/homes-for-sale/bend/19305-brookside-220221862` is photo-only and still live.

**Listing Look:** GREEN at 390 and 1280. Real MLS aerial of this house (Spark CDN). UNMUTE is top-right of the hero, not on beds/baths/sqft. Poster stays until Vimeo/YouTube actually signals ready (blocked embed no longer covers the house). Gallery opens (1 of 50). Chrome CTA stays Value my home. v3 chrome kept.

**SHA:** feat `8040a829`. Production READY on `8040a829`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-listing/` (390/1280 local + prod).

**Not this land:** `stash@{0}`. Do not `git add -A`. Track 2 not started.

**Skills read:** public-product-os (quarry + locks), frontend-design, PUBLIC_PRODUCT/decisions.md.

# Prior — 2026-08-13 (Grok, Track 1 `/sell`) — E-SELL-WORTH Look GREEN

**SHA:** feat `52f74fae`. Token fix `702cff04`. Production READY on `702cff04`. Piece A leftover LP CTAs `76f6a996`.

**`/sell` Look:** GREEN at 390 and 1280, local and production. Worth-question gone. Address-only step 1. Screenshots in `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-e-sell-worth/`.

# Prior — 2026-08-13 (Grok, Track 1 `/`) — E-HOME-JOBS Look GREEN

**SHA:** `a241f1ae` homepage feat. Production HEAD `10f26536` READY (includes the feat). Later `44a3fbe7` is docs/screenshots.

**`/` Look:** GREEN at 390 and 1280, local and production. Search/inventory door (`See homes for sale`), six D11 town doors, three-plus live MLS photographs. Chart on Instrument L2. Chrome CTA Value my home.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-e-home-jobs/` (`home-390.png`, `home-1280.png`, `home-390-prod.png`, `home-1280-prod.png`).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.14

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
`docs/plans/ADMIN_PRODUCT/EXECUTION.md` is the only "where we are."
**D1–D11 locked.**

**Go** = autonomous envelope to completion, max parallel per the waves, serial
land. Does not send, post, mutate SkySlope, or declare a packet beautiful.
Closings cutover is not in Go.

**Wave 0:** E-CHROME · A3 · E-VOICE · V1 · G5 wrappers.
**Then:** public families, A4+A1, chart atom, cuts, P10.

**Still Matt:** say go; then only the hard stops (send, post, OAuth, license,
taste, money).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.13

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
`docs/plans/ADMIN_PRODUCT/EXECUTION.md` is the only "where we are."
**D1–D11 locked.** Ready to execute when Matt says **go**.

**Fold-in:** Claude session “Site pages organization and navigation” is Loop E,
quarry not a second OS. Process/IA/visual locks stay. Implementation is not
final. 73 legacy / 527 imports / 399 chrome / 11 mixed / 0 v3-only.
Chrome = layout `PublicNav` → `V3Chrome`. Then family leases.

**How we run:** build parallel (file leases, worktrees). Land serial (one push
to `main` at a time). No `git add -A`. Evidence or it is not done.

**On go:** conductor fans out from the board. First land E-CHROME. Broker A3
may build in parallel (admin files). Mixed Market/Places pages get looked at
and reworked if clunky.

**Still Matt:** say go; money/ads; license; named-artifact taste.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.12

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**D1–D11 locked.** Ready to execute when Matt says go.

**Merge:** Claude session “Site pages organization and navigation” **is** Public
Product OS (`docs/plans/PUBLIC_PRODUCT/`), Loop E, phase P9_ROLL. Market + Places
on v3. Not a second redesign.

**Loop E remaining (Claude stop, matches `scripts/public-ui-baseline.json`):**
73 legacy pages, 527 non-v3 imports, 399 of them kb chrome. Chrome primitives
exist; they are not yet on leftover pages. Pickup: **chrome unit first**, then
Homes (search, listing detail, open houses, price drops), then trust/content.
Claude **stopped** rather than start another wave (two sessions committing;
last collision broke a build). That stop was correct.

**D11:** never name virtues except the About mission sentence. Only virtue words
are dead. Three registers (public / personal thank-you / admin simple). MLS
remarks never rewritten.

**Two tracks (do not mix files):**
- Public: remaining P9, chrome first. Owns `app/` public + `components/site/v3` + PUBLIC_PRODUCT.
- Broker: A3 person header, A4 wake **with** A1 queue.

**Still Matt:** say go (which track); money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`. Do not start a public wave from a broker session
unless Matt says **go public** and the other session is clearly stopped.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.11

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**D1–D11 locked.** Ready to execute when Matt says go.

**Merge:** Claude session “Site pages organization and navigation” **is** Public
Product OS (`docs/plans/PUBLIC_PRODUCT/`), Loop E, phase P9_ROLL. Market + Places
on v3. Remaining: Homes, Sell, chrome, homepage. Not a second redesign.

**D11:** never name virtues except the About mission sentence. Only virtue words
are dead. Three registers (public / personal thank-you / admin simple). MLS
remarks never rewritten.

**Two tracks (do not mix files):**
- Public: remaining P9. Owns `app/` public + `components/site/v3` + PUBLIC_PRODUCT.
- Broker: A3 person header, A4 wake **with** A1 queue.

**Still Matt:** say go (which track); money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.10


`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D10 locked. **D11 (public voice) pending Matt.**

**Third audit:** A46 voice machine already failed (beige gates, corny rule-3 quotes).
A47 closed person labels. A48 A4 ships with A1. A49 buyer packet sections named.
A51 Imagine wrappers still old names; listing-tour still Replicate. A55
`/admin/social` is a traffic report.

**D11 partial:** three registers. Public never names virtues and does not thank
on listing posts. Personal notes always thank. Admin is a different, simpler
voice. Boutique = size fact. MLS remarks never rewritten; property-type codes
may display as Residential. About sentence pending (names authentic). Do not
rewrite `VOICE.md`.

**First build (when Matt says go):** A3 person header, A4 wake rewrite **with** A1
queue. Voice rewrite is a separate slice after D11 closes.

**Still Matt:** D11 remaining dialogues; say go; money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.9

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D10 locked.

**D10:** Grok Imagine is the only generative image/video stack (`XAI_API_KEY`,
`grok-imagine-video-1.5` + `grok-imagine-image-quality`). Park Kling/Veo/Hailuo/
Luma/Wan/Seedance/Fal/Synthesia. Keep Remotion + list-kit compositors + FFmpeg.
Listing motion = image-to-video of the real MLS photo. Produce canon: §7f.

**First build (when Matt says go):** A3 person header, A4 wake rewrite, A1 queue.
G5 (Imagine i2v of one listing still) when we produce, not before the copilot.

**Still Matt:** say go; money/ads; license; named-artifact taste (packets + first
Imagine clip).

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.8

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D9 locked. Plan itself audited (A31–A42).

**Complete as meaning. Not a finished OS.** Further constitution is the failure mode.

**First build (when Matt says go):** A3 person header (who / next / now with sources),
A4 rewrite `queueReturnVisitAlert` to `{name} is looking at {address}.`, A1 queue.

**Agent this pass:** lead ask names the home, does not say we watched them. Buyer
packet ≠ lender BPO. Cutover = checklist. Unidentified = no SMS.

**Still Matt:** say go; OAuth reconnects; money/ads; license; named-artifact taste
(C1 packet, A5 packet).

**Loop E:** Places/Market `_v3/` landed in `16f0361f` (mixed). Remaining public WIP
is uncommitted — do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.7

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D9 are locked.

**Matt this pass:** D2 SkySlope is primary TMS until in-house Closings is dialed,
then cut over (not a second vendor). D3 looking-at-a-home **wakes the phone** like
a new lead. Person page must show next step + what they're doing now + who they
are (expired etc.) without notes. SMS: clear, transparent, concise.

**Agent this pass:** D1 = ask first (short text), then a **buyer** packet if they
want it — never a seller CMA. Wake SMS: `{name} is looking at {address}.` Identified
person + specific home, one per person+listing per session (not every scroll).

**Still Matt:** OAuth reconnects, money/ads, license, named-artifact taste.

**Loop E:** public P9 still in flight. Do not `git add -A`.

**Next:** A1 queue, A3 person header, A4 wake, A5 buyer ask — when Matt says go.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.6 (who-decides)

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** Matt: technical questions are the agent's call
toward the goals. Recorded in the plan. Do not stop the grind to ask atom-vs-pattern.

**Agent-locked this pass:** D9 chart **atom** inside Instrument (not pattern 7);
D4 newsletter capture; D5 worth-language in title/meta only; D6 GBP+IG+FB+LI live
(YT/X reconnect; Threads/ND/Pin parked); D7 first week per-item then 7-day grant.
**Matt-locked:** D8 (his IG primary; brokers connect their own).
**Still Matt:** D1 buyer packet, D2 "Parallel", D3 wake vs Today; OAuth clicks;
money/ads; license; named-artifact taste.

**Loop E:** public P9 still in flight. Do not `git add -A`. Public session may add
the v3 chart atom (D9 locked).

**Next:** V1 inventory; G1 when Matt reconnects tokens. Do not mix with 11F or `_v3/`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.6

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.6: charts + look. A series displayed as a
number/table/dead polyline is a defect. Visual inspection in a real browser at
390 and 1280 is law — code review is not the look. v3 barrel has no chart atom;
admin 11C dropped sparklines. D9: recommend a v3 atom inside Instrument, not
pattern 7. Public chart work stays with the public session.

**D8 locked:** Matt's IG is primary; brokers connect their own IG/FB/LI.

**Loop E (the other process), live:** unchanged. Public Product OS `P9_ROLL` in
flight on this tree. **Do not `git add -A`. Do not migrate public families.**

**Next:** Matt audits + D1–D7 and D9 (D8 locked). V1 chart inventory can run as
evidence. V2 public waits on the other process. G1 when tokens are live.

**Blocked on Matt:** D1–D5; D6 live social set; D7 week-grant; D9 chart atom vs
7th pattern; **OAuth reconnect for brand GBP + Matt's primary IG**.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.5

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.5: Loop G is a self-running calendar, not a
one-off post button. Copilot: "Hey Paul, want me to set up some ideas?" Brokers
connect their own OAuth. Today is the broker home (do / socials / deals / modify).
Draft-first stays — yes on the calendar, then it posts, times, and learns.

**Loop E (the other process), live:** unchanged. Public Product OS `P9_ROLL` in
flight on this tree. **Do not `git add -A`. Do not migrate public families.**

**Loop G quarry:** `content-approve` → publisher-sweep → `/api/social/publish`;
`getFormatPerformance` already has `best_hours` / `best_topics` but measured=0
starves it; `content-calendar.md` mix is stealable, Sheets/FUB door is not; auth
tables are brand-level (G4 is per-broker OAuth). Last census 2026-08-08: GBP/LI/X/YT
EXPIRED. Paid ads parked. Threads/Nextdoor/Pinterest parked.

**Next:** Matt audits + D1–D7 (D8 locked). Slices G1 (tokens, including Matt's primary IG)
→ G2 (one live post) → G3 (calendar week) → G4 (Paul/Rebecca connect their own
IG/FB/LI). Do not mix with 11F or public `_v3/`.

**Blocked on Matt:** D1–D5 as before; D6 live social set; D7 standing week-grant vs
per-item; **OAuth reconnect for brand GBP + Matt's primary IG**. D8 is locked
(Matt's IG primary; brokers connect their own IG / Facebook / LinkedIn).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.4

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.4 adds Loop G (GBP + organic social) and
records live Loop E status so we do not fight the public-product session.

**Loop E (the other process), live:** Public Product OS is `P9_ROLL`. `/housing-market`
is on v3 on main (`b076e15b`). `state.json` / `work-queue.json` are stale (still name
the reverted Market attempt). This working tree has an uncommitted Places + rest-of-Market
migration (`app/**/_v3/`, migration-recipe staged). **Do not `git add -A`. Do not
migrate public families from a broker session.** E1 is already in flight.

**Loop G:** process exists (`content-approve` → `/admin/approval-queue` →
`publisher-sweep` → `/api/social/publish`, GBP included). Last census 2026-08-08:
GBP/LI/X/YT OAuth **EXPIRED**; measured=0; ready ~397 mostly not posts. Production-ready
= Matt reconnects tokens + one generate door + one yes + a live permalink. Paid ads
stay parked. Threads/Nextdoor/Pinterest stay parked.

**Next:** Matt adversarially audits the prompt + answers D1–D6. Then slices
A1 / C1 / D1 / G1 (G1 the day tokens are live). Dedicated public session keeps E.
Do not mix commits with 11F inbox or public `_v3/`.

**Blocked on Matt:** D1 buyer packet; D2 "Parallel"; D3 looking-at-home wake vs Today;
D6 production-ready social set (recommend GBP+IG+FB first); **OAuth reconnect for GBP**.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record for
the stacked brief: copilot, Closings/forms, expired+FSBO first packets, newsletter
buyers + site behavior, Value my home voice, beauty bar. **No product code this
session.** Skills read: admin-product-os, crm-up-to-snuff, crm-e2e, tc-builder,
skyslope-api, skyslope-form-compliance, oregon-real-estate-oref, cma producer,
prospecting/cma-deliver/newsletter-run/listing-alert-care/visitor-escalate/
inbound-respond/broker-alert PDS, TC_SYSTEM, TC_FORMS_LOADING_HANDOFF,
getContactBehaviorSummary, visitors/track.

**Next:** Matt adversarially audits the prompt + answers D1–D5 in the plan.
Implementation amnesia is in: existing code/process is a quarry, not a freeze.
Loop E: public giant push = `run public product` (P9 grind), not a new OS.
Loop F: funnel + SEO/GSC/analytics/AI citation; ads parked; one-generation versioning.
Then first slices A1 / C1 / D1 / E1 / F1. Dedicated public session for E+F.
Do not mix commits with 11F inbox.

**Blocked on Matt:** D1 buyer packet = BPO vs CMA vs ask-first; D2 what
"Parallel" is; D3 is "looking at this home" a wake SMS or Today-only.

# Prior — 2026-08-08 (Claude Code, local) — 11F UNIT 1

`main` @ `ad56f804`, pushed; code commit `4c0186e1` deployed READY (`cli-4c0186e`) and
probed on production. Disk is the source of truth:
`docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`.
Read `progress.txt` from the bottom — the last entry is this one.

**Phase stays `P12_CORRECTNESS`.** All four locks stand; nothing this session reopened one.
11F is the P11 tail and runs alongside P12, not instead of it.

## What 11F actually is, because the name hides it

Phase 11 drove `ci:admin-ui` rule B (legacy pages) to 0 — every admin page imports the
v2 barrel. That is the SHELL. Many of those pages still **mount legacy client islands**,
which the token gate's rule 3 blacklists, so those pages were never inside
`ci:admin-v2-tokens` at all. **Two gates, two different questions:**

| gate | asks |
|---|---|
| `ci:admin-ui` | is the page migrated? (legacy pages · raw elements · widths) |
| `ci:admin-v2-tokens` | inside the *scanned* paths: any raw color, brand leak, legacy import? |

A page can pass the first and be invisible to the second. That gap is 11F.

| | before | now |
|---|---|---|
| admin pages inside the token gate | 86 / 170 | **102 / 170** |
| real pages still outside (excl. 26 redirect stubs) | 58 | **42** |

Ratchets unmoved and unre-seeded: 106 raw elements · 12 widths · 0 legacy pages.

## What the gate was hiding

`#102742` — the **public brand navy**, blacklisted as admin design input since
2026-08-04 — was hardcoded in the agent-activity chart (7 places) and the properties
map (markers, map style, InfoWindow). Every one of those pages *looked* migrated. Both
now resolve `--a-*` off the document at runtime, which recharts and the Google Maps API
both require since neither takes `var()` where it counts.

## Two things to carry forward

1. **Pick the next family by pages-per-shared-island, not page count.** One component
   (`ReportingTabStrip`) blocked 15 pages; migrating it alone unlocked all 15.
   Remaining, largest-first: crm/settings 17 · crm/inbox 12 (one page, twelve islands) ·
   operations 9 · crm 8 · crm/deals 5 · crm/sequences 5.
2. **"This is duplicate nav" is a claim about the RAIL — go read `lib/admin/nav.ts`.**
   The 14-item reporting strip looked exactly like the chrome §5 amnesia exists to kill.
   The rail exposes that family as ONE child; the other 14 reports have no second door.
   Deleting it would have stranded 14 working pages.

## Filed, not fixed

**Dark mode is unreachable.** `ADMIN_UI.md` §6 and the P6 lock both say "ship both from
day one". Nothing in the codebase sets `data-theme` — the attribute appears only in the
two `tokens.css` files. Forcing it pre-hydration proves the admin tokens flip correctly
**and** that `document.body` stays white, so every dark token would paint light-on-white.
`ci:admin-contrast` passes because it computes token *pairs*, not what the body paints.
Queued as `11f-admin-dark-mode-unreachable`.

## One process note

Green gates plus clean `tsc` shipped a phone view that landed with its active tab
scrolled off-screen. It was caught by loading all 15 routes at 375 and asserting the
**active state**, not the status code. Worth keeping in the verification recipe.

# Prior — 2026-08-07 (Claude Code, local) — PHASE 11 COMPLETE

`main` @ `7e6c8cfe`, pushed, deployed READY and spot-checked on production. Disk is the
source of truth: `docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`.
Read `progress.txt` from the bottom — the last three entries are 11C, 11D and 11E.

**Phase is now `P12_CORRECTNESS`.** All four locks stand; nothing this session reopened one.

## The number that mattered

`ci:admin-ui` rule B — a `page.tsx` under `app/admin` that does not import
`@/components/admin/v2` — was the counter the whole phase was built to drive:

| | 11A seed | session start | now |
|---|---|---|---|
| legacy pages | 131 | 86 | **0** |
| raw elements | 251 | 207 | **106** |
| distinct widths | 21 | 19 | **12** |

**86 pages migrated today across 14 families and 32 singletons**, in five waves of
fenced parallel builders, one commit per fence.

## What this surfaced, and it is the real product of the session

Thirteen-plus false claims were living in admin copy. Not typos — statements a
licensed broker would act on:

- **Two named cron jobs that do not exist** (`compute-broker-stats`,
  `compute-market-stats`), each cited as the source of the figures beneath it.
- **Three phantom components** — `LiveTable`, `ApprovalQueueRealtime`, and a "Help
  button" removed two days earlier — each describing behaviour to the broker that
  nothing in the repo provides.
- **An unsourced "industry benchmark of 0.5%–2%"** on the page ad spend is judged from.
- **A count labelled "Active listings" that was off by 2.16×** (a top-50-city
  snapshot sum presented as all active inventory), and **another off by 2.1×** on
  the listing detail page.
- **"Published 87 · Drafts 0"** derived from the wrong column; the real split is
  55 published / 28 archived / 3 draft / 1 pending.
- **A green health tile claiming "FUB leads are flowing"** when `getFubApiKey()`
  has returned `undefined` unconditionally since the June decommission.

And three things that had **never worked**: the BPO preview iframe (a global
`X-Frame-Options: DENY` overrode the route's own `SAMEORIGIN`), the CSV import
status page (Next 15 `params` read as a plain object, so it sat on "Loading…"
forever under a heading reading "Job #"), and a compliance health board
**under-reporting blocked contacts by 3.2×** because a bare `.select()` hit
PostgREST's 1,000-row cap — it would have sailed past its own 25% warn band
without changing colour.

## The lesson to carry into P12

**Builders refused my instructions seven times and were right every time.** All
seven were formatter swaps I had asked for that would have moved a §0 figure.
`formatPrice` rounds to the nearest $1,000 ($332.49 of ad spend → `$0`).
`formatDate` re-projects a date-only string from UTC into Pacific, moving a
printed calendar day back one — twice on a **legal document's** record. And on the
money pages even `formatPriceExact`, which I recommended all session, is wrong:
`financials` branches on `net >= 0`, and on negatives `Math.round` and `Intl`
halfExpand disagree by $1 and move the sign.

The single instruction that caught all seven was **"prove the swap before you make
it."** Write briefs a builder is able to refuse.

Two verdicts also deliberately ship **without counts**, which is that rule
extended rather than broken: `TasksView` completes optimistically without a
`router.refresh()`, and `GlobalActivityFeed` refetches without touching the URL —
so a server-rendered count would be wrong within seconds of the first tap. Do not
state a fact the page cannot keep true.

## A gate was retired, and this is the item to review

`ci:console-kit` encoded Matt's 2026-06-15 directive: every broker-facing console
surface assembled from the shared kit. Over 11C–11E every page on its list moved
to the v2 language, whose acceptance bar forbids `ConsoleSection`, until the list
asserted **nothing**. A gate with an empty list passes trivially and reads green,
which is worse than no gate because it looks like coverage.

**The directive is not retired — its mechanism is.** `docs/MECHANICAL_GATES.md`
gains a *Retired gates* section mapping each clause to the gate that now carries
it, more strictly. Reverse it if you disagree; the reasoning is written down.

## Open, ranked, each with why it was not fixed inline

1. **SECURITY — person/deal scope on entity READERS is a class, three instances.**
   `crm/deals/[id]` fixed; `people/[id]/portal` and `/admin/deals/[key]` open. The
   second is not a one-liner — `getTcDeal` returns only a display name, so it needs
   a decision on what *owns* a TC transaction. `ci:crm-scope` cannot see any of
   them; it inspects writes only. → `task_84b647c1`
2. **Blog edit silently publishes archived posts** — the editor prefills status
   from the wrong column, so saving any of 28 archived posts pushes it live. →
   `task_16114f83`
3. **The audit log renders zero rows to a superuser** (RLS on a cookie-scoped
   read), on a compliance surface. → `task_ff0a4e2c`
4. Readers that swallow errors and return empty, so a failed read is
   indistinguishable from an empty one — a class, ~7 functions.
5. Hydration mismatch traced to `SiteHeader` under `HideChrome`. → `task_af3d76b5`

**Not verified and not claimed:** the populated row paths on
`/admin/signing/[envelopeId]` and `/admin/crm/approvals` (both tables legitimately
empty; inserting a fixture into a legal-document table was the wrong trade), and
`/admin/setup`'s own markup (it redirects here because setup is complete).

## Two process errors of mine, recorded so they are not repeated

- `git commit` commits the **index**, and a parallel builder had staged its own
  files — one commit swept in seven pages under a message that did not describe
  them. Caught pre-push and split.
- `git commit --only <paths>` does **not** pick up untracked files, so one commit
  landed importing two files it did not contain. With parallel builders creating
  files, `--only` needs an explicit `git add` of the new paths first.

## Next

Queue top is `12-person-scope-class`. `scripts/_admin-v2-verify.mjs` is the
harness the next session inherits — it mints its own magic-link session and
asserts 200 / exactly one `<main>` / no page-level horizontal scroll at 375 and
1280, and it reports a redirecting route instead of dying on it.

# Prior — 2026-08-07 midday (Claude Code, local) — 11C + 11D

`main` @ `2843c492`, pushed. Last CODE commit `e8871f2a` deployed READY (the tip is
docs-only and correctly skipped by `vercel.json`'s `ignoreCommand`). Disk is the
source of truth: `docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`
plus the plan of record `PHASE-11-PLAN.md`. Read `progress.txt` from the bottom.

**All four locks stand.** Nothing in this session reopened one. The one IA change —
a third tab on `geo/layout.tsx` — is interior nav inside a single family, flagged in
its commit for post-hoc review, and no cut-list route was resurrected.

## What shipped: 18 commits, `104a459b..2843c492`, three deploys READY

| ratchet | start | now |
|---|---|---|
| legacy pages | 86 | **32** |
| raw elements | 207 | **138** |
| distinct widths | 21 | **17** |

**54 pages across 14 families.** Every MULTI-PAGE family is now on v2 — media,
newsletters, brokers, crm/import, geo, crm/deals, bpo, cmas, reports (11D),
crm/sequences, email, signing, people portal+tools, sync, help, listings, visitors.
The 32 that remain are all singletons.

Two pieces of architecture landed before the migration, both to stop drift:
- **One tabular reader.** Three had accumulated (one per already-migrated family) and
  every queued family was tables too, so migrating as-is would have produced readers
  four through eight. `ReportGrid` moved into `components/admin/v2` and is now the
  admin's only one; analytics' `DataGrid` + `kit` are the remaining third (queued).
- **`EntityTitle`.** ADMIN_UI rule 1 bans page-title chrome but grants an exception
  for an entity page's own name, and that exception had no home — every entity page
  was hand-rolling a raw `<h1>`.

## Defects this found (all pre-existing, all proven so before being touched)

- **`/admin/crm/deals/[id]` had no broker-scope guard** — a restricted broker could
  walk sequential ids and read any deal's GCI, commission percent and split rows.
  FIXED. It is one instance of a CLASS; see the open item below.
- **`/admin/crm/import/[id]` had never shown a job** — Next 15 `params` Promise read
  as a plain object, so every visit sat on "Loading…" under "Job #" with no number.
- **The BPO preview iframe had never rendered** — the route sets `SAMEORIGIN` but
  `next.config.ts`'s global `DENY` overrode it; `/cma/` had the exception, `/bpo/`
  did not. Confirmed fixed on production.
- **Thirteen false claims in page copy**, including two named cron jobs that do not
  exist, an unsourced "industry benchmark" on the page ad spend is judged from, a
  "Help button" removed two days earlier, a "LiveTable" component that is not in the
  repo, and a count labelled "Active" that was off by 2.1× (top-50-city snapshots
  vs. all Active rows). Figures unchanged; the words now match the query.
- **Phone bugs:** a 496px overflow on broker-edit, a 6px overflow on `/admin/audiences`
  (a P9 destination, fixed in the shared primitive), and an email toolbar that
  `ConsoleSection`'s `overflow-hidden` was silently clipping so its buttons were
  unreachable at 375.

## The lesson worth carrying into 11E

**Builders refused my instructions four times and were right every time** — all four
were formatter swaps I had asked for that would have moved a §0 figure. `formatPrice`
rounds to the nearest $1,000; `formatDate` re-projects a date-only string from UTC
into Pacific, moving a printed calendar day back one and, on one instant, the year.
Two were on a legal document's record. The instruction that caught them was *prove
the swap before you make it*. Write briefs a builder is able to refuse.

**And a process error to not repeat:** `git commit` commits the INDEX, and a parallel
builder had staged its own files, so one commit swept in seven pages under a message
that did not describe them. Caught before pushing and split. Use
`git commit --only <paths>` whenever builders share a tree.

## Open, and why each was not fixed inline

- **SECURITY — person-scope on entity READERS is a class, not an instance**
  (`task_84b647c1`). `people/[id]/portal` gates only on `requireAdminPage('people.view')`
  and that capability includes `broker`, so any broker reads any contact's saved and
  hidden homes, named areas, alert recipients and site activity. The `people/[id]`
  identity header is also unscoped. `ci:crm-scope` cannot see either — it inspects
  WRITES only. Needs a DAL reader, a shared guard, a sweep, and an AST gate.
- `getCmaAdminRowBySlug` swallows its Supabase error, so a transient failure renders
  as "this CMA does not exist" — ~20 callers on send/publish paths (`task_cc5d6fc3`).
- The navy `MobileCrmHeader` violates §5 amnesia on three CRM phone surfaces
  (`task_b5a50db5`).
- The intermittent admin hydration mismatch is TRACED to `SiteHeader` under
  `HideChrome` (`task_af3d76b5`) — it fires on already-v2 surfaces this session never
  touched.

**Not verified and not claimed:** `/admin/signing/[envelopeId]`'s rendered identity
header. `tc_envelopes` holds zero rows, and inserting a fixture into a legal-document
table was the wrong trade. Its `notFound()` path and Next 15 `params` signature were
verified.

## Next unit: `11e-singletons` (queue top)

32 pages, no family structure left. Batch by RISK, not directory: the
send/compliance-adjacent ones (`crm/inbox`, `crm/approvals`, `approval-queue`,
`sign-off`, `crm/tasks`, `crm/calendar`) apart from the read-only ones. Look at
`access-denied`, `login` and `setup` before migrating them — they are auth-flow pages
and may not want the console shell at all.

Tooling the next session inherits: `scripts/_admin-v2-verify.mjs` mints its own
magic-link session and asserts 200 / exactly one `<main>` / no page-level horizontal
scroll at 375 and 1280. It was validated in both directions before use.

# Prior — 2026-08-07 earlier (Claude Code, local) — P11 11A + 11B

`main` @ `4efbebca`, pushed, production READY. Disk is the source of truth:
`docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`
plus the plan of record `PHASE-11-PLAN.md`.

**All four locks granted** (process 08-04, IA 08-05, visual 08-05, litmus re-timed
08-07). Phase `P11_INTERIOR`. P1–P10 shipped the spine: 11 destinations, v2
primitives, the §5 chrome. P11 is the interior — making that spine the ONLY admin.

Shipped since the last handoff:
- `82e14a42` — CMA/BPO signing: the lead's ASSIGNED broker signs, Matt is the
  fallback. Every document had been signing as Matt (the join is `brokers.crm_slug`,
  not `slug`). Compliance-adjacent; 3-lens adversarial panel caught 4 more defects.
- `1f0f537e` — 11A gates: `ci:admin-ui` (G65) AST ratchet (251 raw elements, 131
  legacy pages, 21 widths — shrink-only), axe WCAG 2.2 AA across 148 admin routes
  (`e2e/axe-baseline.json`, 51 routes with violations), visual regression per
  destination.
- `f7fbf72d` — 11B: the person workspace folded onto `/admin/people/[id]` (Messages
  + canonical composers, Send, Details, Tasks, Homes, Notes); legacy workspace
  relocated to `/admin/people/[id]/tools`; `/admin/crm/[id]` is a query-preserving
  bridge; ~45 deep-link producers repointed; admin chrome de-branded (phone wordmark
  bar removed, desktop navy top bar replaced with the locked 216px left rail).
- `4efbebca` — litmus re-timed on production: 4.4s broker-action, ONE tap, address
  auto-prefilled, idempotency proven on a real double-tap. Fixtures cleaned to zero.

**Next unit: `11c-crm-tree`** (queue top). 57 remaining `/admin/crm` pages, ordered by
the weekly-use evidence in `decisions.md`, one family per commit. FIRST item: restyle
the two deliberate 11B holdouts — ContactSendCenter's black send bar and the
quick-action FAB. Both are send chokepoints mounted as-is; restyle WITHOUT touching
the send path.

To run it: fresh session, `/model claude-fable-5`, paste
`docs/plans/ADMIN_PRODUCT/PHASE-11-EXECUTE-PROMPT.md`. It orients from disk.

Do not reopen a lock. Do not resurrect a cut-list route. Amnesia covers SHAPE
(naming, nav, groupings), not just pixels.

# Prior — 2026-08-04 (Claude Code, local) — Admin Product OS

`main` @ `36df337f`, pushed. The Admin Product OS ran BOOT → P1 → all of P2 in one
day. State lives on disk, chat is disposable:

- `docs/plans/ADMIN_PRODUCT/state.json` — phase `P3_PROCESS_LOCK`, `awaiting_lock: process`
- `docs/plans/ADMIN_PRODUCT/decisions.md` — **the P3 decision package awaiting Matt**
  (verdict table 15 KEEP / 4 MERGE / 1 thin / deal-track = his call, 7 fix-the-class
  improvements, 5 open questions). A lock counts ONLY when written into this file.
- `docs/plans/ADMIN_PRODUCT/processes/` — 21 complete PDS files, file:line-cited
- `docs/plans/ADMIN_PRODUCT/SESSION_BOOT.md` — resume ritual for any agent/tool

Next unit (any tool): NOTHING until Matt writes the process lock into decisions.md;
then advance state to P4_DATA and build the data atlas for KEEP processes only.
Do not start IA (P5) or visuals (P6) — locks do not exist yet.

# Prior — 2026-08-03 (Claude Code, local)

Every item on the 2026-08-02 website-audit roadmap is now closed or explicitly
blocked on Matt. `main` @ `03f2f5d6`, full `ci:gates` chain green, deployed.

## The sitemap P0 is finally closed, and why four passes missed it

Production, sequential, measured after deploy:

```
core.xml      200    0.96s     159 urls
geo.xml       200  106.22s   2,728 urls   <- the one cold universe build
content.xml   200    0.23s      56 urls
listings.xml  200    0.60s   7,555 urls
matrix.xml    200    0.18s     296 urls
```

Before: four of five returned 504 at the 300s ceiling.

The cause was never caching. `buildAllUrls` reached
`get_subdivision_status_counts` (an unindexable `TRIM("City") ILIKE`, 104.7s for
eight cities) through THREE separate paths, and each earlier pass fixed a subset:

1. the browse-pair loop
2. `getIndexableSubdivisions()`, called 15 lines later
3. `getSearchMatrixSitemapEntries` -> `getSearchMatrix` -> `getSearchMatrixInventory`

All three now read `listing_tile_mv` on the indexed `city_lower`. Equivalence was
proven against production for each, not assumed: the indexable set is 502 both
ways with symmetric difference 0, and the search-matrix path matches on 2,205 of
2,210 shared keys with every divergence individually traced.

**A separate and more serious bug surfaced doing it.** Concurrent `range()`
pagination with no `ORDER BY`. Postgres guarantees no stable row order across
separate OFFSET/LIMIT queries. Measured on Bend's 129,192 MV rows:

```
ORDERED     129,192 rows, 129,192 unique, 0 duplicates
UNORDERED   129,192 rows, 106,000 unique, 23,192 duplicates
```

18% of rows returned twice, so an equal number were never seen. Against a
lifetime-sales floor that means a subdivision near the threshold was admitted or
dropped at random per build, silently. Both readers now order by
`(address_slug, listing_key)`.

## Items 9, 10, 11 — the content program

- **11:** all 27 configs rewritten. 4,900 words to **18,859**, median 181 to 708,
  **0 sources to 285**. Not one market figure in the prose: live components own
  every number, static copy owns only durable facts, and **G33b enforces that**
  rather than trusting it. Four frozen market claims were removed from tetherow
  that had been live, including "Active inventory today: 15 homes from $759K to
  $4M".
- What the authors REFUSED to write is the best part: a disputed 1989-vs-1991
  course opening cut entirely, a different Three Rivers in Jefferson County
  caught and excluded, an acreage dropped because the source's own numbers do not
  add up, school attendance zones cut for lack of a boundary document.

## Everything else

| # | State |
|---|---|
| 1-8 | closed 2026-08-02 |
| 9, 10 | dated citable pages + answer-shaped headings, shipped |
| 12 | `/data/market/[geoType]/[geoSlug].json`, live, cross-checked against the HTML |
| 13 | Dataset coverage measured and filled |
| 14 | outbound citations via one shared `MarketSources` component |
| 15 | `/faq` emitted NO FAQPage JSON-LD at all. Fixed, plus 11 standalone child pages |
| 16 | payload ratchet gate wired beside route-smoke |
| 17 | `docs/press/` artifact + generator + pitch draft. **NOTHING SENT** (§1 class 1) |
| 18 | `/months-of-supply` as a DefinedTerm with live figures |
| 19 | `PROFILE_CONSISTENCY_2026-08-03.md` + correction packet. **NO OAuth** (§1 class 4) |
| 20 | `/housing-market/annual-review`, Dataset + Article schema |
| 21 | closed 2026-08-02 |

## Open for Matt

1. **Send the press pitch** (`docs/press/pitch-email-draft.md`). It uses
   placeholders deliberately: no verified reporter contact exists in the repo and
   inventing one is a §0 violation. Look up the real byline first.
2. **The GBP / Zillow / Yelp corrections** in the profile packet. Each needs an
   OAuth grant, which is yours alone.
3. **Promote Lighthouse perf/LCP from warn to error** after 2-3 real PR runs. The
   thresholds carry an estimated CI-hardware allowance no local run can validate.
   A11y/SEO/CLS/best-practices already block.

## Known gaps

- **A cold `geo.xml` still costs 106s.** One build instead of three RPC sweeps,
  well inside the 300s ceiling, but the universe build itself is still heavy.
  Making a single build cheap is the next real improvement.
- **Best Practices is pinned at 0.74 sitewide** by the AdSense script, which loads
  from the root layout on every page while only `/activity` and `/resources`
  render an ad unit. Named, not fixed: scoping it is revenue-touching.
- `tetherow`'s `amenities` array had a restaurant that closed (Solomon's became
  Coorie in 2026). Fixed here, but it suggests other configs carry stale
  amenity entries that no gate checks.
- `scripts/check-listing-detail.mjs --json` throws on an undefined `listingKey`.
- CrUX and PageSpeed APIs are now enabled on the `ryanrealty` project, so field
  Core Web Vitals are reachable for the first time. Nobody has pulled them yet.

> **Superseded: audit follow-through — sitemap P0 actually fixed, CI root-caused, GSC/GA4 measured (2026-08-02, Claude Code local).**
> Picks up and closes the "Open for Matt" list from the cloud session below.
> Prior: website audit + remediation + CI unblock (2026-08-02, cloud); CMA/report depth (2026-07-30).

# Current — 2026-08-02 (Claude Code, local session)

| Field | Value |
|---|---|
| Surface | Claude Code, local, in a git worktree at `.claude/worktrees/audit-e2e` |
| Branch | `claude/ryan-realty-website-audit-sybjq3`, 24 commits ahead of `main` |
| Why a worktree | `main`'s working tree had a **live sibling session** with 53 uncommitted paths, two files touched 2 minutes before this session opened. Checking out or stashing there would have destroyed work in flight |
| Credentials | Supabase service role, GSC (`siteOwner`), GA4 (`527333348`) — the three the cloud container lacked |

## Three things the cloud session could not know

**1. The sitemap P0 fix did not work.** It was the highest-value unverified item.
Measured against a real production build:

```
core.xml   http=200  234.7s  159 urls
geo.xml    http=000  280s    0 bytes    <- requested immediately after
```

The shared-universe memo stamped freshness when the build **started**, with a 60s TTL against
a 115–235s build. It expired before it ever resolved, so every sequential request rebuilt from
scratch. It was verified against five *concurrent* cold requests, where single-flight genuinely
works — but Googlebot fetches children sequentially and the warmer loops. Now stamped on
resolve, extracted to `lib/sitemap-universe-memo.ts` with 6 regression tests. Verified:

```
core.xml     200  127.8s     159    <- the one universe build
geo.xml      200    0.014s  2566
content.xml  200    0.007s    56
listings.xml 200    0.016s  7574    <- had NEVER served
matrix.xml   200    0.006s   296
```

**2. The three-month CI failure has a root cause.** `middleware.ts` `BAD_BOT_RE` blocks
automation User-Agents and contains `axios`. `start-server-and-test` waits via `wait-on`, which
is axios-based. Every readiness probe got 403, `wait-on` accepts only 2xx, so it timed out after
five minutes printing "Timed out waiting for". The app was healthy throughout. The replacement
probes went green only because Node's `fetch` sends `User-Agent: node` and someone picked
`rr-smoke/1.0` — neither on the block list, by coincidence. Gate **G60** (`ci:probe-ua`) now
reads the live regex out of `middleware.ts` via the TypeScript AST and fails if it would ever
screen the probe UA. It found 12 more CI probes riding the same accident.

The screen itself is correct: every AI crawler `robots.txt` invites returns 200 in production.
This was never a discoverability defect.

**3. Two of the audit's conclusions do not survive real data.** See
[`MEASURED_METRICS_2026-08-02.md`](../audits/MEASURED_METRICS_2026-08-02.md).

- **The sitemap's stated impact was wrong.** Search Console shows all five children downloaded
  with zero errors, `listings.xml` carrying **7,660 URLs on 2026-08-01**. Google was never
  missing listing pages. The defect was real; the impact claim was not.
- **"Zero non-brand discoverability" is the wrong diagnosis.** GSC over 28 days: **35,451
  impressions, 467 clicks, CTR 1.32%, average position 14.5**, across 1,776 named queries of
  which 1,769 are non-brand. The site is not absent, it is on page two — **83.4% of named-query
  impressions sit at position 11 or worse**. (Coverage caveat: those 9,523 impressions are 27%
  of the total; Google withholds rare queries.)
- **And one finding that argues FOR the audit, harder than the audit did:** 7 of the top 20
  pages are blog posts, holding positions 4.5–8.9 against 14.5 site-wide. The single best URL is
  long-form editorial about a named community. That is audit items 9–11 evidenced from Ryan
  Realty's own traffic instead of from competitor inference.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **CI root cause + gate G60** | `c6defa1b` | Verified 4 ways: passes at 15 probes, fails when a probe drops the UA, fails when `BAD_BOT_RE` is tightened onto it, keeps a known false positive out |
| **GSC + GA4 measured (item 21)** | `3f3e1072` | `scripts/measure-search-and-analytics.mjs` reproduces every figure in the doc |
| **Sitemap P0, actually fixed** | `aa56d308` | Sequential sweep above. 6 tests, negative-tested |
| **`/admin/media/banners` 38.2s → 0.5s** | `ae42b045` | 277,415 rows → 3,344; 284 round-trips → 14. Output deep-compared byte-identical across 13 cities / 789 subdivisions. Back in the smoke set: **277/277, zero skips** |
| **pa11y 0/8 → 8/8** | `a7451039` | Real rebuild, 0 errors on all 8 URLs. Three causes separated: contrast, map markers, third-party iframes |
| **Lighthouse thresholds calibrated** | `a7451039` | 40+ real passes. Perf ≥0.90 was unachievable on 7 of 8 routes; SEO and CLS could never fail |
| **§0: Coming Soon counted as "for sale"** | `f4763138` | Bend 1,288 shown vs 1,272 correct. 16 pre-marketing listings on a public surface |

## Phase 2 (evening) — items 1-4 and the §0 formula violation

Matt: "Yes on 1-3 and do number 4."

| Item | State |
|---|---|
| **§0 wrong formula, live** | **FIXED.** `components/site/CityComparisonTable.tsx` footnoted a 30-day-doubling months-of-supply method beside a number computed with the 6-month formula, on every subdivision market page. Now renders `MOS_METHODOLOGY_CLAUSE`. `ci:market-formula` scanned only `app/` + `lib/`, which is exactly how the string its own docblock names got shipped; it scans `components/` as of this commit |
| **1. Coming Soon migration** | **APPLIED and verified in production.** Bend Hot-communities for-sale sum **1,266 → 1,251**, exactly the 15 Coming Soon rows removed, and the post-apply sum equals an independently computed corrected predicate (1,251 = 1,251) |
| **2. CrUX** | **ENABLED and measured.** CrUX + PSI APIs on the `ryanrealty` project, key restricted to those two, in `.env.local` as `GOOGLE_CRUX_API_KEY`. CLS **0.00** good, TTFB **292 ms** good, LCP **2,692 ms** needs work |
| **3. Blocking gates** | **DONE.** Lighthouse + pa11y drop `continue-on-error`. A11y/SEO/CLS/BP at error, perf/LCP at **warn** until real runner samples validate the estimated CI headroom. Proves out on the next PR |
| **4. Items 9 + 10** | **DONE.** Answer-shaped H2 and a real freshness stamp on every geography page |
| **4. Item 11** | **NOT STARTED.** 27 long-form editorials. See below |

### The LCP finding, and the fix that came out of it

CrUX did not just give a score, it named a cause: **1,239 ms of the 2,692 ms LCP
is image resource LOAD DELAY** — 46% of the metric elapsing before the hero
request even starts. TTFB is 292 ms, so never a server problem.

Root cause: `app/layout.tsx` preloaded `/images/hero-poster.webp` at
`fetchPriority=high` on every route, and **nothing renders that file as a hero**
(it is a pulse brand card, 12 KB). The hero the site actually paints is
`poster="/images/hero/hero-old-mill-master-4k.jpg"`, **685 KB, with no preload
at all**, discovered only when the parser reaches the `<video poster>`
attribute. Top priority went to an image the browser would never display.

Fixed: dead layout preload removed, `KbHero` preloads its OWN `posterSrc`
(per-route, so the shared layout cannot know which hero a route paints). The LCP
number can only be re-measured after CrUX accumulates a new 28-day window, so
the improvement is deferred by design, not skipped. **685 KB is still heavy for a
poster** — named, not fixed, because the measured defect was load DELAY not load
DURATION.

### Items 9 + 10, verified in rendered HTML

`KbMarketHud` gained a `geoName` prop. Every geography section heading is now the
question a reader types, with the answer directly beneath:

```
/cities/bend              "Is Bend a buyer's or seller's market?"
                          -> Seller's market -> 3.7 months of supply   (3.7 <= 4, canon)
/communities/tetherow     "Is Tetherow a buyer's or seller's market?" -> Buyer's market
/cities/bend/awbrey-butte "Is Awbrey Butte a buyer's or seller's market?"
                          all three: "Updated 9:19 PM" from the pulse row
```

`buildMarketFaq` already generated that exact question but only as an h3 far down
the page in the FAQ block. It falls back to the old heading when there is no
verdict, because a question with no answer under it is worse than a label.

Only the homepage passed `asOf` before; the other six showed a ticking wall clock
over a 10-15 minute cache. `/zip` is a deliberate exception: no pulse binding in
scope, so it gets the heading and no stamp rather than a fabricated one.

### Item 11 — not started, and why

27 pieces (13 Bend neighborhoods, 14 content-configured resort communities). This
is authored content, every figure needing a §0 trace, landing on public marketing
surfaces under a principal broker's license. Starting it at the tail of a long
session would produce filler. Three things a future session should know first,
from the recon:

- **13 Bend neighborhoods, not 14** (`lib/neighborhood-areas.ts:24-38`). 19 resort
  communities registered, 14 with content configs; the other 5 are the G33 backlog.
- **55 published blog posts, not 12.** Ten are Community Spotlights covering the
  same geographies, so item 11 collides with them unless canonicalized or repurposed.
- **The two pages you would extend are frozen**: `housing-market/[...slug]` (898)
  and `communities/[slug]` (923) are pinned by the file-size ratchet.
- Existing prose is 113-298 words per community in `data/resort-community-*.json`,
  rendered by `KbResortOverview`, gated by G33 (`ci:community-content`).

## Open for Matt

1. **Apply migration `20260802120000_subdivision_status_counts_exclude_coming_soon.sql`.**
   Committed but NOT applied — it needs the migration channel. Until it runs, `/cities/[city]`
   still shows the inflated for-sale count. This is the only §0 item outstanding.
2. **Enable the Chrome UX Report API** (or PageSpeed Insights API) on the `ryanrealty` Google
   Cloud project. Core Web Vitals field data is the last audit metric still unmeasured — CrUX
   403s on the Maps key and the anonymous PSI quota is exhausted. Both are free.
3. **Flip Lighthouse and pa11y to blocking?** Recommendation, with measurements behind it:
   accessibility, SEO, CLS and best-practices are safe to block now. Performance and LCP should
   watch 2–3 real PR runs first, because their headroom is an estimate against CI hardware that
   could not be timed from here.
4. **Audit items 9–11 still need your go-ahead** — dated citable market pages, answer-shaped
   H2s, long-form editorial for the 14 Bend neighborhoods and 14 resort communities. Deliberately
   not started: they are content programs, every figure needs a §0 trace, and they land on public
   marketing surfaces under your license. The GSC data above is now the strongest argument for
   them.
5. **AdSense caps Best Practices at 0.74 on every page** — the script loads sitewide from the
   root layout but only `/activity` and `/resources` render an ad unit. Scoping it is a
   revenue-touching product call, so it is named, not changed.

## The sitemap P0 is improved but NOT closed in production. Read this before touching it.

Three passes have now been made at this, two of them by me, and **all three treated a symptom.**
The real cause was measured at the end and is recorded here so the fourth pass starts in the
right place.

**What is fixed and proven:** the memo TTL bug (freshness stamped at build start against a
60s TTL), and the warmer, which fetched the five public URLs over HTTP on the stated theory that
the in-flight dedupe would collapse them onto one build. It cannot: each fetch is a separate
lambda invocation with its own module scope, and sequential calls have no in-flight overlap
anyway. The warmer now calls `getClassRows()` in-process, where the memo genuinely applies.

**Production state right now, measured on the deployed commit, sequential, cold:**

```
core.xml      504  300.6s
geo.xml       504  300.6s
content.xml   200  146.7s   <- one build fit, on a warm instance
listings.xml  504  300.2s
matrix.xml    504  300.6s
```

**The actual cause: `get_subdivision_status_counts`.** `buildAllUrls` calls it once per report
city. Timed directly against production:

```
Bend        41,254ms      Prineville   1,410ms
Redmond     14,644ms      Madras       4,685ms
Sisters     31,959ms      Terrebonne   3,534ms
La Pine      4,317ms      Sunriver     2,940ms
                          TOTAL 8 cities: 104.7s
```

That is 104.7s for eight cities before the paginated listings scan, zips, blog and reports are
added, and there are more cities than eight. The RPC does
`WHERE TRIM("City") ILIKE TRIM(p_city)` over a 589K-row table — an unindexable expression, the
same class of defect commit `5bc16122` fixed for search (11.1s to 1.4s) by letting the planner
reach the city index.

**No amount of cache engineering fixes a 100s+ build.** The fourth pass should make the build
cheap, not cache it better: source the subdivision list from `listing_tile_mv` (already indexed
and already used elsewhere) instead of this RPC, or give the RPC an index the planner can use.
Until then, `core.xml` will keep hitting the 300s ceiling on a cold lambda.

Worth noting the audit recommended "build per class directly instead of building-all-then-
filtering" and PR #28 dropped it. That recommendation was right.

## Known gaps
- **`fetchAllRows()` swallows per-page errors** (`lib/supabase/paginate.ts` destructures only
  `{ data }`). A mid-pagination timeout silently truncates the result for every caller, with no
  error surfaced anywhere. Found while fixing the banners page; not fixed, blast radius is wide.
- **`scripts/check-listing-detail.mjs` references an undefined `listingKey`** in its `--json`
  path — `node scripts/check-listing-detail.mjs --json` throws. Pre-existing.
- **`npm run ci:lighthouse` never invokes `scripts/pick-lhci-listing.mjs`** despite that file's
  comment claiming it does; there is no `preci:lighthouse` hook. The hardcoded fallback listing
  currently resolves, so it has not bitten.
- **A sign-in modal auto-opens on page load** on `/team` and listing detail. Outside WCAG2AA so
  pa11y did not flag it; its focus management is unexamined.
- **`includeWarnings: false`** in `.pa11yci.json` suppresses every WCAG warning-level notice.
  Nobody has looked at what is in that set.
- **`ci:css-layers`'s baseline is keyed by `path:line selector`, so it is line-drift fragile.**
  Adding a comment above an existing offender shifts its line number and the ratchet reports it
  as a NEW violation. That happened here: the `.topbar` scrim comment shifted 10 identical
  pre-existing rules by 2 lines and failed the push, with the offender count unchanged at 11.
  Regenerating was correct (diff is line numbers only, same selectors, same count) but every
  future edit above line 76 of `kb.css` pays the same tax. G56 already solved this class with
  per-file counts described as "line-drift-proof"; this baseline should adopt the same keying.

# Superseded — 2026-08-02 (Claude Code, cloud session)

| Field | Value |
|---|---|
| Surface | Claude Code on the web (remote container) |
| Branch | `claude/ryan-realty-website-audit-sybjq3` @ `57907d7`, 17 commits, pushed |
| PR | [#28](https://github.com/RyanRealty/RyanRealty/pull/28) — **draft, not merged** |
| CI | `lint-and-build` **green** — first green PR check in this repo in ~3 months |
| Base | branched from `main` @ `db53778` |

**To pick this up locally:**

```bash
git fetch origin claude/ryan-realty-website-audit-sybjq3
git checkout claude/ryan-realty-website-audit-sybjq3
npm ci
```

Read `docs/audits/WEBSITE_AUDIT_2026-08-02.md` (the audit) and
`docs/audits/AUDIT_REMEDIATION_PROGRESS.md` (what was fixed, what was deliberately not, and
why). Those two files are the durable record; this section is the summary.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Independent website audit** | `8b981a9` | Full report. Core finding: ryan-realty.com appears in **0 of 4** high-intent non-brand queries while 8 competitors with slower, less structured sites occupy every slot. Technically the site is ahead of all of them (TTFB 0.25–0.64s vs 2.0–2.4s; 2 JSON-LD blocks vs 0–1). The gap is distribution, not engineering. Three premises in the original brief were tested and disproven (the site is SSR, not CSR; the brief's URL list was stale; NAP is consistent) |
| **Sitemap P0** | `fbf512e` | 3 of 5 child sitemaps returned HTTP 000 / 0 bytes after 100s, reproduced 4×. `unstable_cache` keys per class, so a cold cache meant 5 independent `buildAllUrls` fan-outs contending on the same tables. Fixed with `maxDuration`, an in-flight promise collapsing them to one build, and an hourly cron warmer. **NOT yet verified in production — needs the merge** |
| **Broker canonicals P0** | `fbf512e` | 5+ alias URLs per broker, each self-canonicalising. `generateMetadata` built the canonical from the requested slug; the page body had the same bug feeding JSON-LD |
| **Titles / descriptions / redirects / preconnect / AggregateRating** | `fbf512e` | Descriptions were hard-cut mid-word at 155 chars (`/sell` ended "Request a fr"). `/buyers` 404'd while `/sellers` redirected. Self-serving `AggregateRating` dropped, `Review` nodes kept |
| **Punctuation rule actually enforced** | `e7580a8` `bb9fd37` | `VOCAB.PUNCTUATION` was exported and referenced **zero times** by the gate. CLAUDE.md §6 listed it as gated; nothing checked it. That is how an em dash reached the layout title template and shipped on all 20 page titles |
| **Dash rule scoped to prose** (Matt, 2 corrections) | `c2b9a5e` `ae19c3f` `6bf30b1` | "Em dashes are fine in page titles for SEO", then "the rule only applies to text users read that might seem AI-written". Now: 8+ words with a 4+ word clause after the dash that **starts lowercase** (a continuing sentence is the tell; a capitalised or numeric start is a separator). Exempt: SEO metadata, short labels, alt/aria, ranges, reviews, debug, embedded CSS/JS |
| **CI unblocked** | `7cd86a5` `b326fd3` `6fe2668` `a2e60d0` `45552a0` `57907d7` | Five independently broken things, each hidden behind the one before it. See below |

## The CI story — five layers, none caused by this work

`lint-and-build` had failed on **every** pull request since at least 2026-07-25 (verified on
unrelated branches). `main` looked green only because the route-smoke step is gated on
`github.event_name == 'pull_request'` and never runs on push.

1. **`start-server-and-test` hung 5:02 with no diagnostics** — its entire failure output was
   "Timed out waiting for". Replaced with explicit start / wait / smoke;
   `scripts/wait-for-server.mjs` reports what it saw on each probe. The app was never the
   cause: a production build serves `/` in 0.55s and passes 277/277 routes.
2. **The route-inventory generator threw on every run** — it regexes `lib/cities.ts` for a
   `PRIMARY_CITIES` literal, which now only re-exports from `lib/data/geo/report-cities.ts`.
   So `docs/ROUTE_INVENTORY.md` was 2 weeks stale with 2 dead admin routes in it
3. **`ci:lighthouse` and `ci:a11y` never existed** as npm scripts. Both quality gates had
   never executed once. Tooling and configs were always present; only the script names were
   missing
4. **Admin pages exceeding the smoke timeout** on a cold cache. Budget now splits public (15s)
   vs admin (60s); `/admin/media/banners` is skipped and printed as `[SKIP]` every run
5. **The bundle report lacked `pull-requests: write`** — no `permissions` block, so the token
   was read-only

Two of those rounds were my own errors, recorded so nobody repeats them: a per-route timeout
that made things *worse* (274/277, down from 276/277), and a teardown step that killed the
runner (`kill -- -$PGID` — background jobs inherit the runner's process group).

## Open for Matt — what finishing needs

1. **Merge PR #28.** The sitemap P0 fix is unverified in production. Logic and gates pass, but
   `listings.xml` / `matrix.xml` returning real XML can only be proven after the merge. Highest
   value item still unconfirmed — it is what makes listing pages discoverable.
2. **Credentials the cloud container did not have:**
   - `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — needed to measure and fix
     `/admin/media/banners`, which takes **>60s on a cold cache**. That is what a broker hits,
     not just CI. The fix belongs in `listMissingBanners` / `getSubdivisionsInCity`; it was
     deliberately not attempted blind
   - **GSC + GA4** — converts the audit's proxy metrics (indexation, backlinks, traffic,
     CWV field data) to measured, and is how the roadmap gets proven
3. **Three decisions:** flip Lighthouse + pa11y to blocking? Investigate pa11y's
   **`0/8 URLs passed`** on its first real run? Restore `/faq`'s double em dash or leave it?
4. **Go-ahead on audit items 9–11** — dated citable market pages, answer-shaped H2s, long-form
   editorial for the 14 Bend neighborhoods + 14 resort communities. This is the work that
   actually moves LLM discoverability. Items 17–20 (press outreach) and 19 (GBP/Zillow/Yelp
   OAuth) need per-action approval under §1 regardless

## Known gaps

- **pa11y reports `0/8 URLs passed`** — real WCAG2AA signal or untuned config, unread. Surfaces
  as a step success only because it is `continue-on-error`
- **Lighthouse ran to completion but its thresholds are unvalidated.** Non-blocking, so a
  threshold failure would look like success in the step list
- **`/admin/media/banners` >60s cold**, skipped in the smoke rather than fixed
- **Audit items 9–21 untouched.** Content and authority programs, not coding tasks. Reasoning
  per item is in `AUDIT_REMEDIATION_PROGRESS.md`
- The regenerated route inventory drops 5 live-but-catch-all routes (`/cities/tumalo`,
  `/cities/crooked-river-ranch`, `/housing-market/explore`, `/reports/explore`, `/guides`) from
  the smoke set. None has its own `page.tsx`. Widening the generator's slug sources would
  change what the inventory means — left as Matt's call


# Current — 2026-07-30 (Claude Code)

| Field | Value |
|---|---|
| Surface | Claude Code |
| `main` @ | `1e647e67` pushed, 190 gates green, 340 test files / 4257 tests passing |
| Prior plan | [`PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md`](PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md) — the 18 Brain Dump 2 items, all closed |

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Zoning, development, rental, income sections** | `9f061b0b` | Every CMA/audit/BPO now answers: what zone the property is in, whether the lot can be subdivided, whether additional units or an ADU are allowed, what a buyer could develop, HOA and CC&Rs, and long-/mid-/short-term rental rules with income potential. Five legally wrong facts were corrected during the build, including the Deschutes WA overlay (40/160/320 acres, independently verified) which would otherwise have told a seller a 160-acre parcel supports 4 divisions when it supports 1 or zero. |
| **Report rebuild + truncation fix** | `9f061b0b` | `.page` was fixed at 11in with `overflow:hidden`, so any section taller than a page was silently cut — the rental page measured 196% of its page. Long sections now chunk ("Renting It Out 1 of 3"). 922 Ogden renders 29 sections / 237,313 bytes. |
| **Published CMA on listing pages** | `618754b8` | Broker-operated publish control on the review page. Three states; the confirm dialog splits what becomes public from what stays private. **The recommended list price and every sold comp stay private.** Verified as matt@ against the real DB: publish → listing page renders the range with the ODS §7-3 period notice → take-down removes it and kills outstanding download tokens. Left `published_now = 0`. |
| **Comps must match product type** | `83a50f89` `6354d87f` | `PropertyType='A'` is the SFR convention but it is a *bucket*. Measured on 1,000 closed Bend sales: 818 Single Family Residence, 75 Townhouse, 43 Manufactured On Land, 22 Condominium, 3 Tenancy in Common. **14.3% of the pool offered to a detached subject was a different product and the selector took it.** On 922 Ogden that put two townhomes into a 4-comp detached analysis behind a $640,000 recommendation the auditor called indefensible. Now a hard exclusion at every tier, fail-open on unknown, locked by tests. |
| **A degraded read must not publish a zero** | `1e647e67` | `/cities/bend/southeast-bend` showed "0 homes for sale" beside a real $810,000 median. Operator precedence: `??` binds looser than `>`, so `pulse?.activeCount ?? pins.length > 0 ? … : …` made the pulse count a truthiness test and the answer was always `pins.length`. **Six more pages had the same class**, including `/zip` fabricating the 0 inside the Dataset JSON-LD Google reads. `withTimeoutFallbackResult` now returns `{ value, ok }`; counts are `number \| null`; consumers suppress rather than print 0. Gated by `ci:count-degraded-read` (AST). |

## The CMA corpus, as of now

227 documents. **22 archived** (17 were `zztest`/`zz-test` residue from integration tests writing to production — 5 of them sat in `delivered` status and were inflating the delivered count). **205 live.**

- **178 rebuilt successfully** on the new pricing, comp ladder, and section set.
- **23 could not be priced**: 18 lacked 3 qualifying comps, 5 have no matching MLS row. No exceptions, no bugs — these are honest data limits. Verified that product type is *not* the binding constraint (one failing subject had 84 same-product candidates citywide); the binding constraints are the market-area and lot-character rules that predate this session.
- **7 deliberately untouched** — 5 `finalized`, 2 `delivered`. Rebuilding a document a client already has would silently reprice it.
- Judge spend for the whole rebuild: **$4.06** over 178 builds.

## Open for Matt — one real decision

**164 of 198 rebuilt documents (83%) carry `needs_review`.** The adversarial auditor is doing its job, but at that rate the flag does not discriminate, and because `needs_review` blocks publishing, only ~17% of documents can feed the listing-page funnel.

The findings cluster as: narrative mismatch 90%, price unsupported 63%, condition/quality tier 51%, location/subdivision 41%, product type 13% (down from the pre-fix state), too few comps 7%. **53% of flagged documents sit at exactly 3 comps**, the bare minimum — with three comps, one questionable comp makes the price unsupportable.

Findings already carry `[critical]` / `[major]` / `[minor]` severity, but the publish gate is binary on the verdict. **A severity-aware gate — block on `critical`, flag `major`, ignore `minor` — would be the obvious fix.** It was deliberately NOT applied unilaterally: loosening what goes public under a principal broker's license is Matt's call, and the strict default blocks nothing that matters while it waits.

## Known gaps

- The comp trace is not persisted into `build_summary`, so tier-by-tier exclusion counts cannot be audited after a build. Add it before the next comp-logic change.
- Integration tests still write to production (`zztest` rows). Archiving is a cleanup, not a fix — the tests need their own teardown or a non-production target.
- Three page files (neighborhood 598, city 695, community 1029 lines) sit exactly at their file-size ceilings. The next addition needs a real extraction, not comment trimming.
