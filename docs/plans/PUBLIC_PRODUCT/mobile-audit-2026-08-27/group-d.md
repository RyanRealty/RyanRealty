# Mobile audit — Group D — 2026-08-27

390px iPhone UA, Chrome headless capture (--window-size, virtual-time-budget 15-18s,
--run-all-compositor-stages-before-draw) + sips band crops, cross-checked against a live
Chrome pane (mcp Claude Browser, real 390x844 viewport) for anything that looked wrong.

**Capture-pipeline caveat (read before trusting a "missing" finding below):** the
headless-Chrome `--screenshot` CLI path in this environment intermittently fails to paint
`.v3-ledger__value` (bold, `font-variant-numeric: tabular-nums`) text and occasionally
mis-wraps paragraph text, reproducibly, across repeated captures at increasing
virtual-time-budgets (15s/18s) and with `--run-all-compositor-stages-before-draw`. Confirmed
via live DOM query (getBoundingClientRect + textContent) in a real Chrome tab that the
underlying page renders correctly (e.g. communities index "100 for sale" / "13 for sale"
etc. all present and un-clipped). Any apparent missing/clipped bold value in a headless band
below was cross-checked live and is noted FINE, not a product bug. Also found and fixed a
`sips --cropToHeightWidth` bug: cropping to a band that lands exactly on the source image's
bottom edge silently no-ops and returns the full image; band.sh now backs off 1px on the
last band.

---

## Cross-page fix: photoSrc + card-address on lifestyle/community/team rows (Matt addendum)

Two addenda from Matt mid-audit, both addressed:

**1. Thumbnails on trail/golf/venue/event/park/school nearby-home rows.**
`components/site/v3/V3Field.tsx` already renders a `.v3-field__thumb` on any row whose
`V3FieldItem` carries `photoSrc` — the barrel was never touched. The gap was
`app/central-oregon/_v3/nearby-field-items.ts`: `NearbyHomeTile` had no photo field, so
`nearbyFieldItems()` dropped it even though every DAL type that feeds it
(`TrailHomeTile`, `GolfHomeTile`, `VenueHomeTile`, `EventHomeTile`, `ParkHomeTile`,
`SchoolHomeTile` — all in `lib/data/**/getXDetail.ts`) already carries `photoUrl: string | null`
straight off `PhotoURL`. Fix: added `photoUrl?: string | null` to `NearbyHomeTile` and wired
`photoSrc` through in `nearbyFieldItems()`. No DAL changes needed (structural typing covers
the six callers). Verified live via DOM query on `/central-oregon/trails/peterson-ridge` and
`/central-oregon/golf/tetherow-golf-club` — every row now carries a thumb.

**2. City on every home-row title ("714 Wrangler, Sisters", not "714 Wrangler").**
Matt added `publishCardAddress()` to `lib/listing/publish-street-line.ts` (street + ", City",
no OR/zip). Adopted it in three places, all in fix authority:
- `app/communities/[slug]/_v3/community-opening.ts` — `communityFieldItems()` row title now
  calls `publishCardAddress` directly (raw street+city fields were already on `ListingTile`).
- `app/central-oregon/_v3/nearby-field-items.ts` — the six lifestyle-detail DAL types only
  expose a pre-joined `addressLine` (street, no city) and `cityLine` ("City, OR zip"), not raw
  parts, so `publishCardAddress` itself doesn't fit; added a `cityFromCityLine()` helper that
  extracts the bare city from `cityLine` via the ", OR" marker and splices it onto the title.
  (Proper long-term fix: have the six `rowToHome()` functions in `lib/data/{trails,golf,venues,
  events,parks,schools}/getXDetail.ts` expose a `city: string | null` field directly instead of
  only the joined `cityLine` — out of fix authority here, recorded for the DAL owner.)
- `app/team/[slug]/_v3/sale-rows.ts` — `addressLine()` now calls `publishCardAddress` (city was
  already fetched as `tile.City`); `detailParts` dropped the now-duplicate bare city, keeping
  only the subdivision. Updated `sale-rows.test.ts` (`row?.what` assertion) to match; `npx
  vitest run` green on both `sale-rows.test.ts` and `community-opening.test.ts`.

Verified live (DOM query, 390px) on `/communities/tetherow` ("19167 Cartwright Court, Bend"),
`/central-oregon/trails/peterson-ridge` ("714 Wrangler, Sisters" etc.),
`/central-oregon/golf/tetherow-golf-club`, and `/team/matthew-ryan` (ledger `what` now
"20702 Beaumont, Bend", `detail` now just "Northpointe" — no duplicate city).

## Real bug found + fixed: listing-page coach bar covering the hero MAP chip / photo strip

`components/site/listing-detail/ListingAlertCoach.client.tsx` — the "Next step: get alerts"
bar is `position: fixed; bottom: 0`, shown after a flat 5s dwell timer with no regard for
scroll position. On a fresh listing-page load at 390px the visitor is still looking at the
hero (photo, price, MAP chip, photo strip) when the 5s timer fires, so the fixed bar lands
directly on top of the MAP chip and the photo strip below the hero — both interactive.

Fix: `ListingHero.tsx`'s outer wrapper (hero band + photo strip, the two elements Matt named)
now carries `id="listing-hero-visual"`. `ListingAlertCoach` gates showing on BOTH the existing
5s dwell AND the hero band having scrolled fully out of the viewport
(`getBoundingClientRect().bottom <= 0`), re-checked on `scroll`/`resize`. First attempt used a
second `IntersectionObserver` (mirroring the existing `#listing-like-alerts` one) but that
observer's callback never fired in this dev environment (confirmed via console instrumentation
— reproducible across 4 effect mounts under React 18 Strict Mode); replaced with a plain
`getBoundingClientRect()` check on scroll/resize, which has no such race. Along the way caught
and fixed an inverted first draft of the check (`rect.bottom <= viewportH`, true for nearly
everything on screen) before landing on the correct `rect.bottom <= 0`.

Verified live at 390px: coach stays hidden at scrollY=0 past 7s dwell (hero still on screen),
appears within ~1s of scrolling to y=1200 (hero scrolled out), sits cleanly above the mobile
broker CTA bar with no overlap on "Get the full analysis" or "Schedule a tour" above/below it.

## Non-issue: the floating "N" circular badge

Bottom-left circular "N" badge seen in nearly every capture (including covering the price on
first load in earlier screenshots) is the **Next.js dev-mode tools indicator**
(`<nextjs-portal>` custom element, confirmed via its shadow root: `data-nextjs-dev-tool-style`
style block). It only exists under `next dev`; it will not render in production. Not a
`components/site/listing-detail` element, nothing to fix. Matt should ignore this badge when
reviewing dev-server screenshots and re-check the equivalent moment against a production build
or deployed preview if he wants to confirm there's truly nothing there.

## For the orchestrator: the two "known floating overlaps" flagged in STATE.md

- **"'N' bubble over price"** — resolved as a non-issue, see above. This is the Next.js dev
  toolbar, confirmed via shadow-root inspection (`document.querySelector('nextjs-portal')
  .shadowRoot` carries `data-nextjs-dev-tool-style`). It is not a Ryan Realty component and
  will not appear in a production build or deployed preview. Recommend re-verifying against
  prod before spending more cycles on it.
- **"Coach bar over MAP chip"** — real bug, fixed. See `ListingAlertCoach.client.tsx` +
  `ListingHero.tsx` above. Both files are in my exclusive `components/site/listing-detail`
  authority.
- **"Cookies pill over content (bottom-right)"** — not reproduced on any of my 8 routes across
  ~35 live screenshots. The component is `components/CookieConsentBanner.tsx:244`
  (`fixed bottom-4 end-4 z-[90]`, a floating pill) and `:268` (a full-width fixed bottom bar
  variant). It's global chrome outside my fix authority (not under app/communities, app/sell,
  app/about, app/buy, app/team, app/central-oregon, app/listing, or
  components/site/listing-detail) — recording file:line for whoever owns it. If it's only
  visible pre-consent-decision, my repeat page loads in the same browser profile may have
  already dismissed it before I could see it.

---

# Per-page findings

## /communities (index)

**FIX-NOW:** none.
**IMPROVE:** the "OTHER PRODUCT TYPES" market-data block (condos/townhomes/manufactured/lots/
etc., each a dense multi-stat paragraph) reads as a wall of small caps text on 390px — same
shared pattern also on `/sell` and the listing page's neighborhood-market section. Not broken,
just dense; a card-per-type or accordion would scan faster on a phone. Likely a shared
component under `lib/data/market-truth` or `components/site/v3` — not confirmed which, not in
my fix authority to touch blind.
**FINE:** hero, `V3Ledger` community rows (photo optional by design, price/median list clean),
"Homes for sale, community by name" link list, A-Z index (606 entries, functional, decent tap
targets), footer. `.v3-ledger__value` ("100 for sale" etc.) initially looked clipped/missing in
headless captures — confirmed live as a capture artifact, not real (see caveat at top).
Band paths: `bands/communities-band0..11.png` (this was the 12000px capture; the 7000px one
that first caught the artifact is `bands/communities-v3-band*.png`, kept for the record).

## /communities/tetherow

**FIX-NOW:** photoSrc thumbnails + city-in-title were both missing before my fix — now
present on every row (`community-opening.ts`). See cross-page fix section above; before/after
verified via live DOM (`19167 Cartwright Court, Bend` etc., every `.v3-field__row` carrying a
`.v3-field__thumb`).
**FINE:** hero (Tetherow gate photo, address CTA, breadcrumb — heading wraps cleanly to two
lines at 390px, no clipping despite how it looked in the headless capture), Field map+list
(trail-style map, "PLOT_DISCLOSURE" line present), Instrument figures, market-truth blocks for
each property type (townhomes/lots/etc., same dense-but-not-broken pattern as `/communities`),
"Master-plan communities" cross-link list, A-Z-style community index, footer. 22345px total —
by far the longest of my 8 pages; sampled roughly every 1500-2300px live plus the full headless
band set.

## /homes-for-sale/bend/lakes-at-tanager-pud/63435-palla-220225078 (listing page)

**FIX-NOW (fixed):**
1. Coach bar covering the hero MAP chip + photo strip on fresh load — fixed, see above.
2. `SchoolsBlock.tsx` — a 3-item grid (Elementary/Middle/High) with
   `gridTemplateColumns: repeat(auto-fit, minmax(180px,1fr))` leaves a bare navy-tinted empty
   cell at 390px (2 columns fit, 3rd item alone on row 2, 4th grid cell empty but still painted
   with the container's tint). Switched to flexbox (`flex: 1 1 180px` per card) so a lone
   trailing card stretches to fill its row instead of leaving a hole. Verified live:
   "Summit High" now spans full width, no empty tile.

**IMPROVE:**
- The "OTHER PRODUCT TYPES" market-data block (same shared pattern as `/communities`, `/sell`)
  is dense on this page too, inside `NeighborhoodMarketContext` or similar — not in my fix
  authority to confirm the exact file blind.
- The coach bar, once past the hero, still floats over the tail end of the page (footer legal
  text) when a visitor is at the very bottom and hasn't dismissed it. Low severity — it's only
  ever over non-interactive text, and "Not now" is one tap away — left as-is rather than adding
  more scroll-gating logic for a footer-only edge case.

**FINE:** breadcrumb, CTA row (Schedule a tour / Ask a question / Save / Share), Property
Details grid, Systems/Financial/Listing detail grids, Description, "Get new Bend listings"
capture strip (this is `#listing-like-alerts`, confirmed it also correctly hides the coach when
scrolled into view), AI "Imagine this room" tool, location map with popup card, Bend market
context (dense but readable), Trails/Golf nearby list, Listing History, Mortgage calculator,
broker attribution + "Talk to a broker" card, "On the market" related listings (24 cards,
addresses show city, prices/beds/baths clean), "This home sits inside" city crosslink, footer.
One related-listing card (`18780 Macalpine Loop`) showed a navy placeholder instead of its
photo on one load — `ListingFeaturedHomes.client.tsx` already has an `onError` → placeholder
fallback (graceful, on-brand, not a broken-image icon); confirmed the underlying image URL
loads fine on retry, so this reads as a one-off network hiccup this session, not a code bug.
No action taken.
Band paths: `bands/listing-fixed-band0..18.png` (post-fix capture, 18200px).

## /sell

**FIX-NOW:** none.
**IMPROVE:** same dense "OTHER PRODUCT TYPES" stats block as above.
**FINE:** hero + "Home address" valuation form (full-width input, clear CTA), Bend market
snapshot, "The 3% listing plan" (what's included / pricing / media / marketing lists), Selling
FAQ, closed-sales stat, Google reviews, footer. One methodology note: the giant single-shot
headless capture (11100px window-size) duplicated the FAQ+reviews block at the TOP of the
capture (band0) as well as its real position (band5, confirmed via live `scrollIntoView` at
y=5702) — a rendering/compositing glitch specific to very tall single-shot Chrome headless
screenshots in this environment, not a real page bug. Verified real page has each FAQ heading
exactly once (`document.body.innerText.match(...)` counts = 1). Treat any band on a page taller
than ~6000px that looks like it repeats earlier content as suspect until cross-checked live —
I hit this on `/sell` and `/about` both; live spot-checks below confirm both are clean.
Band paths: `bands/sell-band0..11.png` (band0 is the glitched one, ignore it).

## /about

**FIX-NOW:** none. **IMPROVE:** none noted. **FINE:** full re-verified live via 5 real
390x844 scroll+screenshot passes (not the giant single-shot capture, given the /sell glitch
above) — broker headshot hero (Matt, full-bleed, then Rebecca/Paul rows with Call/Text),
"How it started" narrative + jump links, "Verified record" license facts, "Where we work"
city-by-city stat rows, "Working with Ryan Realty" FAQ, broker directory rows, footer. No
overlaps, no dead space, no broken images.

## /buy

**FIX-NOW (fixed):** the "Get listing alerts" email input (`BuyAlertsSheet.client.tsx`,
`ASK_STEP.field`) had no `placeholder`, unlike every other alert-sheet in the codebase
(`open-houses`, `communities/[slug]`, `price-drops`, `home-valuation`, `app/_v3`,
`cities/[slug]/[neighborhoodSlug]`, `cities/[slug]`, `central-oregon` regional sheet,
`oregon/[city]` — all use `'you@email.com'`). Added the same placeholder for consistency.
Verified live: input now shows the placeholder.
**FINE:** hero (mountain/lake photo, "Search homes" CTA), city quick-filter chips, "1,749 homes
for sale" sample set (map + 12 cards, address+city+beds/baths/sqft all correct, photos load),
"Buyer guides" FAQ (process steps, timelines, buyer-broker comp), the fixed email capture form
(now with placeholder), footer.

## /team

**FIX-NOW:** none.
**FINE:** "The brokers" hero photo rows (Matt/Rebecca/Paul, Call/Text — all three headshots
load correctly on a settled page; a first-paint gray box for Rebecca/Paul was confirmed as
normal local-image decode timing, not a bug, on recheck a second later), "Who you work with"
license-numbered broker cards, Google reviews, "Working with a Bend broker" FAQ, footer.
Also spot-checked `/team/matthew-ryan` (a broker detail page, not in my route list but shares
`sale-rows.ts` which I edited) — ledger rows correctly show `"20702 Beaumont, Bend"` etc. with
no duplicate city in the detail line.

## /central-oregon/trails/peterson-ridge

**FIX-NOW:** photoSrc thumbnails + city-in-title were missing before my fix, now present
(`nearby-field-items.ts`). See cross-page fix section.
**FINE:** hero + Instrument figures, Field (trail-line map with real USFS trail-data linework,
trailhead pin, "The line is the Peterson Ridge Trail route..." disclosure line, 12 home rows —
all now with photos + "714 Wrangler, Sisters" style titles), FAQ, related-trails cross-links,
footer.

## /central-oregon/golf/tetherow-golf-club

**FIX-NOW:** photoSrc thumbnails + city-in-title were missing before my fix, now present
(`nearby-field-items.ts`). See cross-page fix section.
**FINE:** hero + Instrument figures, Field (course-location map, 12 home rows all with photos +
city), FAQ (course facts, Bend market snapshot folded in), related-courses cross-links, footer.

---

# Files changed (all within stated fix authority)

- `app/central-oregon/_v3/nearby-field-items.ts` — photoSrc + city on trail/golf/venue/event/
  park/school nearby-home rows.
- `app/communities/[slug]/_v3/community-opening.ts` — `publishCardAddress` for row titles.
- `app/team/[slug]/_v3/sale-rows.ts` + `sale-rows.test.ts` — `publishCardAddress` for ledger
  `what`, dropped duplicate city from `detail`.
- `app/buy/_v3/BuyAlertsSheet.client.tsx` — email placeholder.
- `components/site/listing-detail/ListingAlertCoach.client.tsx` — coach bar no longer covers
  the hero MAP chip / photo strip.
- `components/site/listing-detail/ListingHero.tsx` — added `id="listing-hero-visual"` for the
  coach bar's visibility check.
- `components/site/listing-detail/SchoolsBlock.tsx` — flexbox instead of grid, no more empty
  tile on a 3-card row at 390px.

Verification run: `node scripts/check-page-purpose.mjs` → OK (20 contracts). `node
scripts/check-brand-voice.mjs` → 2 violations, matches baseline (did not grow).
`npx vitest run` on `sale-rows.test.ts` and `community-opening.test.ts` and
`components/site/__tests__/listing-detail-a11y.test.tsx` → all green.
`npx tsc --noEmit --incremental false` (NODE_OPTIONS=--max-old-space-size=8192, the default
heap OOMs on this repo) → 10 pre-existing errors, all in `scratch/pre-rebase-backup/` (stale,
unrelated to anything touched here); zero errors in any file I changed.

Did not commit or push, per instructions.
