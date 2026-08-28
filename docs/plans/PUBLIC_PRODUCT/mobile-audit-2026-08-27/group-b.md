# Mobile visual audit — Group B (2026-08-27)

Routes: `/cities`, `/cities/bend`, `/cities/bend/awbrey-butte`, `/zip/97702`,
`/oregon/salem`, one subdivision (`/subdivisions/broken-top` — see note on
redirect below).

Method: headless Chrome (390x844 top viewport + 390x6000 full-flow capture,
`sips` bands) per the prescribed method, cross-verified against a live
390x844 interactive browser (mcp Claude_Browser) whenever a finding looked
like a real defect. **The cross-check mattered**: several apparent defects in
the headless captures turned out to be capture-timing artifacts, not real
bugs — see "Methodology note" at the bottom before trusting any single
headless screenshot on this codebase again.

Captures saved under
`/private/tmp/claude-501/-Users-matthewryan-RyanRealty/5d0636e5-1da8-4cc4-bce2-90c713447180/scratchpad/audit-b/`.

---

## Required addenda (done before the rest of the audit)

### 1. Thumbnails on every home row

`V3Field`/`V3Ledger` already render a thumbnail whenever the row's item
carries `photoSrc`/`media.src` (components/site/v3, not touched). Checked
every route-owned row builder:

| Builder | photoSrc/media wired? |
|---|---|
| `app/cities/[slug]/_v3/city-field-items.ts` | already wired |
| `app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts` (`nbhFieldItems`) | already wired |
| `app/zip/[zip]/_v3/zip-constants.ts` (`zipFieldItems`) | already wired |
| `app/subdivisions/[slug]/_v3/subdivision-rows.ts` (`toFieldEntry`) | already wired |
| `app/oregon/[city]/page.tsx` (`listingRows`) | **was missing** — fixed |

Fix: `app/oregon/[city]/page.tsx` — added
`...(tile.photoUrl?.trim() ? { media: { src: tile.photoUrl.trim() } } : {})`
to the `listingRows.push(...)` call (the Ledger row builder for "The newest
Salem listings"). Live-browser proof: statewide-MLS out-of-area listings in
this feed mostly carry no `photoUrl` at all (real data absence, not a bug),
so the thumbnail slot renders but stays empty for most Salem rows — the
wiring is correct, the underlying photos just aren't in that feed.

Where thumbnails were already present but showed as gray placeholder boxes
in a scripted scroll+screenshot (e.g. `/zip/97702`), I confirmed via
`img.complete` / `img.naturalWidth` in the live browser that these are
lazily-loaded images (`loading="lazy"`) that simply hadn't entered the
viewport yet at the instant of the scripted screenshot — not broken images.
Not a bug; a real user scrolling normally sees the photo fade in.

### 2. City suffix on every card/row title

Added `publishCardAddress` (Matt's new helper in
`lib/listing/publish-street-line.ts`, not touched) to every route-owned
title builder, applied even on already-scoped pages per "consistency beats
brevity":

- `app/cities/[slug]/_v3/city-field-items.ts` — row `title`
- `app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts` — row `title`
- `app/zip/[zip]/_v3/zip-constants.ts` — `tileTitle()`
- `app/subdivisions/[slug]/_v3/subdivision-rows.ts` — `toFieldEntry().title`
- `app/oregon/[city]/page.tsx` — `listingRows` `what` (address)

Bonus fix: `app/oregon/[city]/page.tsx` built its address with a bare
`.filter(Boolean).join(' ')`, which does not strip a placeholder `"0"` street
number (the same "0 55th Avenue" defect already documented and fixed
elsewhere in this codebase). Switching to `publishCardAddress` fixes that too
— verified live: a real Salem land parcel now reads "55th Avenue, Salem"
instead of "0 55th Avenue, Salem".

Verified live at 390px, before/after:

- `/cities/bend`: "21134 Kayla Court" → **"21134 Kayla Court, Bend"**
- `/cities/bend/awbrey-butte`: "1596 Wild Rye Circle" → **"1596 Wild Rye Circle, Bend"**
- `/oregon/salem`: "251 Kingwood Avenue" → **"251 Kingwood Avenue, Salem"**; "0 55th Avenue" → **"55th Avenue, Salem"**
- `/zip/97702`: "18883 Sutherland Court" → **"18883 Sutherland Court, Bend"**

`tsc --noEmit` clean on all 5 touched files (0 new errors; the only repo-wide
errors are 10 pre-existing ones in `scratch/pre-rebase-backup/`, untouched).
`ci:page-purpose` and `ci:brand-voice` both still green (brand-voice
violations = 2, baseline unchanged).

Subdivision route note: `/subdivisions/broken-top` redirects server-side to
`/cities/bend/century-west`-style area resolution — actually to
`/communities/broken-top` in this case (breadcrumb: Home / Communities / Bend
/ Broken Top), which is `app/communities/[slug]/page.tsx`, **not my route**.
I could not find a subdivision slug that resolves to the raw
`app/subdivisions/[slug]/page.tsx` without hitting the registry-alias
redirect (every slug tried — `broken-top`, `century-west` — landed on
`/communities/...` or `/cities/.../...` instead). The `subdivision-rows.ts`
fix is applied and type-checks clean, using the identical
`publishCardAddress` call verified working on 4 other routes, but I have no
direct screenshot proof for this specific file. Flagging so a reviewer knows
to spot-check it once a genuinely-unaliased subdivision slug is found.

---

## /cities

- **IMPROVE** — Dense per-city detail line. `app/cities/page.tsx` lines
  ~339-346 (`featuredRows` bits) and ~374-388 (`otherRows`) join up to 5
  stats + a sentence into one small gray line per city
  ("Median list $939,000 · 303 pending now · 29 days to contract · 12
  months · 66 condos for sale · 78 townhomes for sale · Bend is the largest
  city..."). Reads as a data wall on a 390px row. Proposed fix (not applied —
  content-availability tradeoff, flagging for Matt): drop the condo/townhome
  `extras` from this row's detail line (median price + pending + days-to-
  contract + the description sentence carry the decision-relevant read; the
  sub-type counts are better suited to the city's own page). Band:
  `cities_band1000.png`, `cities_band2000.png`.
- **IMPROVE / product decision — do not cut unilaterally** — "Every city,
  every door" wall. `app/cities/page.tsx` (`cityDoors`) +
  `app/cities/CityFeaturedLinks.tsx`. All ~14 Central Oregon cities × 3 links
  (guide / homes for sale / open houses) = ~42 near-identical rows, roughly 3
  full viewport-heights of low-information scroll before the alert signup.
  Proposed: collapse to a compact chip/pill grid of city names (linking to
  `/cities/<slug>`) instead of one row per door, or fold behind a "Show all
  cities" disclosure. Flagging as a product call rather than fixing, since
  every row is a real internal link and SEO impact of removing them needs a
  decision, not a guess. Band: `cities_band3000.png`, `cities_band4000.png`,
  `cities_band5000.png`.
- **FALSE POSITIVE (verified, not shipped as a finding)** — Ledger `value`
  column ("None listed now", "739 for sale") appeared clipped at the
  viewport's right edge in the headless capture. Live-browser check:
  `.v3-ledger__value` right edge sits at x=355 of 390, fully visible, no
  clipping. `components/site/v3/V3Ledger.css:148-156` intentionally sets
  `white-space: nowrap` on that column (comment: "rows do not reflow when one
  value is wider than the rest") — a real design choice, not a bug at these
  string lengths.
- **Known pending** — floating N button, bottom-left, ~56px, present on
  every band; no new overlap found on this page beyond the already-known
  issue.

---

## /cities/bend — the ~26-figure stat wall

Special-attention section per the brief. Bands `cities_bend_band4000.png`
and `cities_bend_band5000.png` cover it start to finish (it sits between the
listings Field and the median-close chart).

**Inventory of the wall** (in on-page order): Median List Price, Detached
Homes for Sale, Pending Now, Closed 30 Days, New 30 Days, Sale to Original
List, Median to Pending 90 Days, Months of Supply, Sold 12 Months, Days
Median Age of Actives, Days to Contract 12mo, Median Close, Median Close/SqFt,
New Listings 12mo, Closed with Price Cut %, Median Price Cut %, Sale to
Final List %, Cash Closes %, Days to Close, YoY Median Close %, YoY Closed
Sales %, Garage %, Fireplace %, Cooling %, HOA %, New Construction %, Pool %,
Horse Property %, Conventional Closes % (detached), 2/3/4/5-Bed Closes %
(detached), All Property Types $ volume. **31 figures**, all in one
undifferentiated two-column grid, identical type weight throughout.

**Where I checked authority first:** the array is assembled in
`app/cities/[slug]/page.tsx` (mine) by concatenating
`leftoverMarketFigures(hud, ...)` (defined in
`app/cities/[slug]/_v3/city-sections.ts` — physically under my route, but
imported by `app/page.tsx` and `app/communities/[slug]/page.tsx` too, so
**not exclusively mine** — did not edit it), then `publicPaceItems(...)`,
then `buildPublicMixFigures(publicMix)`, then `placeMartFigures(mart, ...)`.
The push ORDER in `page.tsx` is mine to change; I did not change it because
it is already close to the right shape (core HUD figures — price, pending,
closed, supply — lead; the softer composition/mix percentages already trail
near the end). Reordering further would have been marginal.

**The actual problem is density, not order**, and the fix is a SHARED-
component capability I don't have authority to build
(`components/site/v3/V3Instrument.tsx`/`.css` — the figures grid has no
grouping or fold/disclosure primitive today, just one flat grid). Proposed
mobile hierarchy, for whoever owns that component:

1. **Lead strip (always visible, first fold)** — the 5 figures a buyer or
   seller actually needs: Months of Supply (already the verdict driver),
   Median List Price, Median Close Price, Days to Contract, Pending Now /
   New 30 Days.
2. **"Pricing & pace" group** (labeled sub-heading, visible without a tap) —
   Closed 30 Days, New Listings 12mo, Sale to Original List %, Sale to Final
   List %, Closed with Price Cut %, Median Price Cut %, Cash Closes %, Days
   to Close, YoY Median Close %, YoY Closed Sales %.
3. **"Property mix" group (collapsed behind a disclosure by default)** —
   Garage/Fireplace/Cooling/HOA/New Construction/Pool/Horse Property %, plus
   the 2/3/4/5-Bed Closes % breakdown and Conventional Closes %. This is 13
   of the 31 figures (42%) and is the least decision-relevant tier — the
   single biggest win available is folding this whole cluster behind "See
   property features in recent closes."
4. All Property Types $ volume stays where it is (closing figure, one-off).

This needs a new `V3Instrument` capability (labeled figure groups +
optional disclosure), which is out of my fix authority. Recording the
concrete grouping here so whoever builds it doesn't have to re-derive it.

Everything else on `/cities/bend` (listings Field with photos + map, the
median-close chart, the 5-year price trend) read cleanly — see bands
`cities_bend_band0`–`3000.png`.

---

## /cities/bend/awbrey-butte (neighborhood)

Same figure-wall pattern as the city page (confirmed at
`awbrey_butte_band1000.png`) — same recommendation applies, same shared-file
limitation. Below that: district ranking dot-plots (asking price, closed
price by Bend district) are clean and well-hierarchied — no notes. Field of
highest-priced listings with photos + city-suffixed titles reads well after
the fix. Page is 23,829px tall in the live browser; the prescribed 6000px
capture window covers roughly the first quarter (through the "highest-priced
listings" Field) — noting this so a reviewer knows the schools/sales-
history/documents sections further down were not visually audited in this
pass.

---

## /zip/97702

- **FIX-NOW, confirmed real (not a capture artifact)** — the map renders one
  unclustered marker per active listing. At 382 active listings the map is a
  solid mess of overlapping teal price-tag pins, illegible on a 333px-wide
  mobile map. Verified live: `.gm-style` contains 41+ overlapping marker
  buttons within the visible frame. Root cause and fix location:
  `app/central-oregon/_v3/PlaceFieldMapImpl.tsx:231-237`
  (`pins.map((pin) => <Marker .../>)`, no clustering) — **not my route**
  (shared by 12+ pages including mine). **Spawned as a background task**
  (`task_42647d4c`, "Cluster map pins on high-inventory place pages") rather
  than fixed here. Band: `zip_97702_top.png`; live proof in the transcript
  (map rect + marker count via `elementsFromPoint`/`querySelectorAll`).
- **FALSE POSITIVE** — the "Map" type-control dropdown looked clipped at the
  viewport's right edge in the headless capture. Live-browser check: the map
  container's right edge sits at x=354 of 390, and the actual
  `.gm-style-mtc` control sits at x=224–344 — fully inside the map, fully
  visible, not clipped. Capture-timing artifact (see methodology note).
- City-suffix + thumbnail fixes verified live (see addenda section above).

---

## /oregon/salem

- **Known pending, position noted** — the floating N chat button (fixed,
  bottom-left, ~56px) overlaps page content at this specific scroll
  position: when the "OUTSIDE OUR HOME MARKET / We don't work in Salem"
  section lands with its top edge near the viewport bottom, the button sits
  directly over the eyebrow text and the "W" of the heading, obscuring both
  ("...IDE OUR HOME MARKET" / partially-covered "We"). Not a new class of
  bug — matches the already-known floating-button-overlap issue, reported
  here only for its position on this specific page. Live-browser screenshot
  confirmed this is a real overlap (not a capture artifact) — the N button
  and the section content are both real, just colliding.
- Everything else on this page — the 3-figure Instrument (light, correctly
  proportioned for an out-of-market referral page), the multi-step broker-
  introduction form, the newest-Salem-listings Ledger, and the "More Oregon
  cities" list — read cleanly on mobile. No FIX-NOW or IMPROVE items beyond
  the addenda fixes (city suffix, thumbnail wiring) applied above. Bands:
  `oregon_salem_band0`–`3000.png`.

---

## Subdivision route

Could not get a direct screenshot of `app/subdivisions/[slug]/page.tsx`
itself — every slug tried resolves through `resolveSubdivisionAreaRedirect`
to either `/communities/<slug>` (resort communities, e.g. Broken Top) or
`/cities/<city>/<slug>` (Bend districts, e.g. Century West), neither of
which is my route. The `/communities/broken-top` page I did capture (not
mine to fix, but useful as a reference) already had both thumbnails and
city-suffixed titles working correctly before I touched anything — good
existing pattern to match. The `subdivision-rows.ts` fix (addenda section
above) mirrors that pattern exactly and type-checks clean; flagging that it
has no direct visual proof in this pass.

---

## Files changed

- `app/cities/[slug]/_v3/city-field-items.ts` — title now `publishCardAddress`
- `app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts` — same
- `app/zip/[zip]/_v3/zip-constants.ts` — `tileTitle()` now `publishCardAddress`
- `app/subdivisions/[slug]/_v3/subdivision-rows.ts` — same
- `app/oregon/[city]/page.tsx` — address now `publishCardAddress` (also fixes
  the "0 55th Avenue" placeholder-number defect as a side effect) + wired
  `media.src` from `tile.photoUrl` (was completely missing)

No changes to `components/site/v3/*` or `lib/*`. Not committed/pushed per
instructions.

---

## Methodology note (read before trusting a headless screenshot on this repo)

Three findings from the initial headless-CLI pass turned out to be false
positives once cross-checked in a live 390px interactive browser:

1. An H1 ("Awbrey Butte homes for sale") appeared to overflow past the
   viewport edge on one line in the headless capture. Live: it wraps
   correctly to two balanced lines (`text-wrap: balance` on
   `.v3-heading`), height matches a real 2-line box.
2. A Ledger `value` column ("None listed now") appeared clipped at the
   right edge. Live: fully visible, 35px of margin to spare.
3. The Google Maps "Map/Satellite" type-control dropdown appeared clipped
   at the right edge. Live: fully inside the map container, ~36px clear of
   the viewport edge.

All three share a signature: large/late-rendering elements (the Amboqia
display webfont, async Google Maps JS init) that hadn't finished
laying out at the instant `--screenshot` fired, even with
`--virtual-time-budget=40000` and `--run-all-compositor-stages-before-draw`.
The headless capture is still useful for a fast first pass and for anything
that doesn't depend on late-loading fonts/maps (spacing, missing sections,
broken images, data density), but any apparent text/marker clipping near
element edges should be spot-checked live before it ships as a finding. The
zip map-marker-overcrowding finding above is the control case: it reproduced
identically in both the headless capture and the live browser, which is why
it's reported as real.

One `sips` gotcha hit during this pass: `--cropToHeightWidth H W
--cropOffset Y X` silently returns the FULL uncropped image (no error) when
`Y + H` exactly equals the source image height. Use `H` one px short of the
remainder (e.g. 990 instead of 1000 for a 6000px-tall source cropped at
y=5000) rather than trusting the crop to fail loudly.
