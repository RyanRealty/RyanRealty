# Mobile audit 2026-08-27 — COMPLETE (first haul shipped); open items below

SHIPPED AND VERIFIED ON PRODUCTION (390px, ffda7de5): scroll-jack dead (the
sell form's autoFocus dragged every phone visitor to the footer), maps paint
(the pending-placeholder clip), dead band gone, thumbnails + street-and-city
titles on rows site-wide, zip capped at a stated 24-of-total preview, 8-stop
monochrome composition ladder with cream seams, run-on stat tiles trimmed on
hub/region, booking fallback phone through CONTACT.

SECOND HAUL SHIPPED (same day): search guest-capture collapses on phones
(expands sm+), chip-row right-edge fade affordance, segment tiles trimmed to
top-3 in BOTH shared builders (geo-figures + publicSegmentItems — covers city
reports, communities, sell, seller LP), V3Instrument gained `foldAfter` (native
disclosure, Broadside chrome) and /cities/bend now leads with 5 figures over
"All 34 figures +", and the blog "For for buyers" heading is fixed in
blog_posts (one targeted UPDATE).

STILL OPEN:
1. Homepage brokers section opens on Matt's full-viewport headshot —
   contradicts the brand-first rule; MATT'S CALL, not unilateral.
2. Compare map 429/world-zoom — verify on a fresh session before treating as
   real (likely audit-session Maps quota).
3. /cities "every city, every door" 42-row link wall — product/SEO tradeoff,
   Matt's call.


Matt's directive: full visual audit of EVERY public page at 390px. Look at rendered
pixels, never grep alone. Every section judged: FIX-NOW / IMPROVE / FINE. The bar:
"be the best page." Matt reviews on a real iPhone.

## Shipped already (pushed, live)
- bed841d5 — THE GRAY MAP: .v3-field__map-pending was in flow at height:100%,
  pushing the real (fully loaded) map below the frame's overflow:hidden clip.
  Now absolute like the poster. Every posterless map was gray site-wide.
- bed841d5 — THE DEAD BAND: .v3-breadcrumb--below-nav carried 84px clearance
  for the DELETED fixed KB bar; V3Chrome is sticky (in flow). Now space-md.
- 75a026fc/6fb15841/255c522f — brand color enforcement: monochrome navy chart
  series (weight+dash), footer on cream, no ground token, gate scans v3 CSS
  hex against a sanctioned set (break-tested).

## In flight (uncommitted in this checkout)
- lib/listing/publish-street-line.ts: NEW publishCardAddress() — Matt's rule:
  every home card/row title carries ", City" (no OR/zip on cards). Builders
  must adopt (agents doing so in their routes).

## Four audit agents running (route-exclusive, may edit ONLY their routes)
- group-a: /, /homes-for-sale, /compare, /price-drops, /open-houses
- group-b: /cities, /cities/bend, neighborhood, /zip/97702, /oregon/salem, subdivision
- group-c: /housing-market family, annual-review, /blog + one post
- group-d: /communities(+tetherow), listing page, /sell /about /buy /team,
  trails/golf; owns components/site/listing-detail (coach-bar + N-button overlaps)
Findings land in group-{a..d}.md here. Shared-file findings (components/site/v3,
lib) are RECORDED for the orchestrator, not fixed by agents.
Both addenda sent to agents: (1) wire photoSrc thumbnails into all homes rows
(barrel already renders .v3-field__thumb), (2) adopt publishCardAddress for titles.

## Orchestrator's own lane (shared chrome) — status
- Mobile menu open-state: UNVERIFIED (pane stuck mid-test; retry: pane on
  localhost:3000, resize_window mobile, click header button ref, screenshot).
- Footer at 390px: verified cream + navy rule on /about earlier; fine.
- Known floating overlaps to resolve after agent D reports: 'N' bubble over
  price, Cookies pill over content (bottom-right), coach bar over MAP chip.
- Observed during HMR (recheck when dev settles): city-page map pins render
  as overlapping unreadable cluster BEFORE tiles paint; verify pin declutter
  after fitBounds on a clean load.

## Method (works, use exactly)
Headless: "$CHROME" --headless=new --disable-gpu --hide-scrollbars
  --user-agent="<iPhone UA>" --screenshot=x.png --window-size=390,844
  --virtual-time-budget=25000 URL   (844=true vh; tall 390,6000 for flow,
  vh-sections explode there = capture artifact, judge heroes only at 844)
Slice: sips --cropToHeightWidth 1000 390 --cropOffset <Y> 0 tall.png --out band.png
Console from page: add --enable-logging=stderr --v=0, grep CONSOLE.
Interactive states (menus, sheets): the Browser pane at resize_window mobile.

## After agents return (orchestrator TODO)
1. Read 4 group reports; fix all SHARED-file findings (v3 barrel/CSS, lib).
2. Personal look-pass over their band captures for key pages before shipping.
3. ci:gates + vitest, ONE ship-class commit + push, deploy:verify,
   then re-walk Matt's two original phone URLs live.
4. Update contracts (mobile items) + this file; hand off in CROSS_AGENT_HANDOFF.
