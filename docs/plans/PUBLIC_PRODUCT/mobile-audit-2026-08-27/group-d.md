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
