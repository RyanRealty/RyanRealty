# Process: find-a-home — search + browse live MLS inventory to a buyer-intent artifact

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (organic + paid + direct traffic, 24/7; the alert-delivery cron that consumes its output runs hourly)
- Verdict: **PROPOSAL — KEEP.** This is the site's core buyer process: ten live surfaces, three
  distinct CRM/account completion paths, and the highest-traffic page on the site all belong to
  it. P1's split hypothesis was tested and rejected — every hinted surface deep-links into
  `/listing/*` and shares the identical completion set. Two internal consolidations are proposed
  for P3/P5 (video-browse duplication, `/compare` disposition) but they are sub-page calls, not
  process splits. Proposal only; the verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor finds the Central Oregon homes that match what they can spend and how they want to
live — filtered, mapped, compared, and inspected down to a single listing — from live MLS
inventory that is honest about counts, freshness, and failure. (b) The machine outcome is a
durable buyer-intent artifact (a tour/contact lead in `crm_people`, a `listing_alerts` row with
a captured email, or a `saved_listings` row on an account), which is produced precisely because
serving (a) well surfaces the natural next step — "tell me when homes like this appear,"
"schedule a tour" — at the moment the visitor has just proven that intent by browsing.

## 2. Inception (what starts it)

Trigger: a visitor lands on any listing-browse surface and starts filtering, panning, or
browsing live inventory. Preconditions: none — every entry is anonymous-capable; signed-in
state only enriches (saved/liked/hidden hydration).

| Channel | Entry routes | Evidence (opened this run) |
|---|---|---|
| Organic search | `/homes-for-sale` (canonical; SEO title/description/canonical built per-filter) | `app/search/page.tsx:183-208`; rewrite `/homes-for-sale` → `app/search` at `next.config.ts:299-300` |
| Organic (legacy equity) | `/search`, `/listings`, `/properties`, old AgentFire IDX paths — all 301 to `/homes-for-sale` | `next.config.ts:211-214, 249-250`; `/sold` → `/homes-for-sale?status=Sold` at `next.config.ts:210` |
| Organic (curated intents) | `/open-houses` (Event JSON-LD), `/price-drops` (Dataset JSON-LD), `/luxury-homes-bend` (built for a GSC page-2 ranker), `/videos` | `app/open-houses/page.tsx:37-44,64-87`; `app/price-drops/page.tsx:69-75`; `app/luxury-homes-bend/page.tsx:4-7,33-43`; `app/videos/page.tsx:59-70` |
| Paid | Listing detail directly — "the #1 ad-landing surface"; 5-min ISR warm window sized for ad traffic | `app/listing/[listingKey]/page.tsx:107-111` (revalidate comment), `:191-193` (ad-landing comment) |
| Direct / internal | Homepage + city featured rails; `/activity`'s "View all listings" / "Search on map" CTAs; `/feed`, `/our-homes` | `app/activity/page.tsx:152-168`; `app/feed/page.tsx:76-81` (detailHref); `app/our-homes/page.tsx:13` (browse CTA) |

Inception is telemetered: `TrackSearchView` fires `search_view` + `view_search_results` once per
mount on every search/geo surface (`components/tracking/TrackSearchView.tsx:12-24`;
`lib/tracking.ts:320,327`), mounted at `app/search/page.tsx:382-386`, `app/open-houses/page.tsx:32`,
`app/price-drops/page.tsx:56`.

## 3. Actors

- **Buyer** — the primary segment; every completion artifact is tagged `audience: 'buyer'`
  (`app/actions/search-alert-capture.ts:113-126`; `app/contact/actions.ts:25-29` defaults
  inquiries to buyer).
- **Dreamer/researcher** — same surfaces, longer dwell; the mid-process telemetry
  (scroll/time milestones, `components/listing/ListingTracker.tsx:48-80`) exists to grade this
  segment's warmth in the CRM.
- **Investor** — served in-process by `RentalAnalysis` and `MortgageCalculator` on detail
  (`app/listing/[listingKey]/page.tsx:417-421`).
- **Device reality:** mobile-first is Matt-locked product truth ("390 is truth",
  `decisions.md` 2026-08-11); the split view is built as a viewport-fit app frame with a body
  lock for exactly this reason (`app/search/page.tsx:367-377`). A GA4 device-split number was
  NOT queried this session and is therefore not stated (§0) — pulling it is a P4/P8 gap item.
- **Automated actors:** the `saved-search-alerts` cron (hourly, `vercel.json:213-214`) delivers
  what this process captures — it is the downstream `deliver-alerts` machine process, not part
  of this one. `createNativeTask` puts a 5-minute-due reminder on a broker for every alert
  signup (`app/actions/search-alert-capture.ts:129-135`).
- **Accountable for completion:** the assigned broker (tour leads and alert-signup tasks land
  in their CRM queue); the visitor completes save/alert themselves.

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Inventory browsed | Supabase `listings` + `listing_tile_mv` behind the DAL (`getViewportSearch`, `getSearchListings`, `getListingTiles`, `getPriceDrops`, `getOpenHousesWithListings`, `getBrokerageListings`, `getActivityFeed`) | `app/search/page.tsx:10`; `app/actions/search.ts:246`; `app/luxury-homes-bend/page.tsx:11`; `app/price-drops/page.tsx:31`; `app/our-homes/page.tsx:29`; `app/activity/page.tsx:106` |
| Guest alert | `public.listing_alerts` (the unified table; the old dual saved_searches + guest_search_alerts split is gone) | `app/actions/search-alert-capture.ts:141-143`; `app/api/cron/saved-search-alerts/route.ts:1-8` |
| Lead identity | `public.crm_people` via `sendEvent` → `ensureNativeLead` (FUB decommissioned) | `app/actions/search-alert-capture.ts:101-111`; `app/contact/actions.ts:93-130` |
| Broker follow-up | `public.crm_tasks` | `app/actions/search-alert-capture.ts:129-135` |
| Signed-in saves | `public.saved_listings`, keyed by canonical RETS ListingKey | `app/actions/saved-listings.ts:42-55` (write), `:24-40` (canonical-key resolution rationale) |
| Behavioral trail | GA4 events + first-party event store (`fireFirstPartyEvent`) + per-listing view counter (`POST /api/listings/<key>/track`) | `components/listing/ListingTracker.tsx:27-45,57-64` |
| **NOT a SoR** | The URL query string (search state lives in the URL but is ephemeral until captured into an alert); client component state; GA4 (a mirror, never the lead record — the CRM row is) | `components/search/SearchAlertCapture.tsx:28-31` (URL as live-state source, captured at submit) |

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives on an entry route (§2) · URL (+ any filter params) · SSR page
   with live inventory; `search_view` fires · Next ISR (`revalidate 60`,
   `app/search/page.tsx:210`) + DAL · failure: DB timeout — the settled-timeout wrapper marks
   the render **degraded** instead of painting "0 homes" (`app/search/page.tsx:78-113,266-286`)
   · mobile + desktop.
2. **Scope** · visitor · picks/keeps a place scope; split view defaults to Bend with bounds from
   the authoritative city boundary bbox · city/subdivision params · seeded viewport
   (`app/search/page.tsx:221-226,238-253`) · `boundaries` table via `getBoundaryGeoJSON` ·
   failure: boundary timeout (2s) falls back to `BEND_DEFAULT_BOUNDS` · both.
3. **Filter** · visitor · applies field-registry filters; every registry param round-trips
   through the URL with zero page edits per new field · query params · re-fetched result set +
   shareable URL (`app/search/page.tsx:131-171,324-359`) · DAL · failure: unparseable values are
   dropped, not errored · both.
4. **Pan / draw** · visitor · moves the map or draws include/exclude shapes; one viewport fetch
   seeds BOTH list and markers so they can never diverge; drawn shapes encode into `?shapes=`
   (legacy `?poly=` read forever) so a reload or shared link reproduces the identical post-draw
   result set · map gestures · updated result set + URL
   (`app/search/page.tsx:229-232,255-266`; `components/search/MapSearchView.tsx:10-23,41-48`;
   SuperCluster pins via `@googlemaps/markerclusterer`, `components/SearchMapClustered.tsx:6-10`)
   · failure: Maps JS load failure leaves the list view functional · both (draw is
   desktop-leaning).
5. **Signed-in personalization** (conditional) · system · hydrates saved/liked keys into the
   result set and subtracts hidden homes from list AND map pins · session · badged tiles, no
   hidden-pin reappearance (`app/search/page.tsx:245-251,405-414`;
   `components/search/MapSearchView.tsx:22-23`) · `saved_listings` / likes / hidden-listings
   actions · failure: 1.5s timeout degrades to unbadged tiles · both.
6. **Curated-intent browse** (alternate mid-path) · visitor · browses `/open-houses`,
   `/price-drops`, `/luxury-homes-bend`, `/videos`, `/feed`, `/activity`, `/our-homes` — each a
   different lens over the same inventory, each deep-linking every tile to `/listing/*` via
   `listingDetailPath`/`listingTileHref` (`app/open-houses/page.tsx:75-80`;
   `app/price-drops/page.tsx:34`; `app/luxury-homes-bend/page.tsx:67-70`;
   `app/feed/page.tsx:76-81`; `app/activity/page.tsx:170-180`) · route · listing-detail
   navigation · per-page ISR (60/1800/900/300) · failure: honest empty states
   (`app/activity/page.tsx:181-199`) · both; `/feed` is mobile-shaped.
7. **Inspect a listing** · visitor · opens listing detail (raw key, pretty address URL, or
   legacy `odsmls` path — resolver routes `by-address`, `by-key`, `odsmls` verified in
   `app/listing/` this run; pretty-URL rewrites at `next.config.ts:293-298`) · listing key ·
   full composition ordered to the buyer decision sequence: hero → price/CTA strip → specs →
   description → alerts capture → tours/map → market context → schools/parks → history →
   mortgage + rental math → attribution (`app/listing/[listingKey]/page.tsx:77-103,345-434`) ·
   every data arm timeout-guarded so one pooler stall cannot hang the #1 ad-landing surface
   (`:191-257`) · failure: per-section independent degradation · both.
8. **Mid-process telemetry** · system · `view_listing`, scroll-depth 25/50/75/100, time
   30/60/120/300s, first-party mirror, and `POST /api/listings/<key>/track` · page behavior ·
   CRM-visible warmth trail (`components/listing/ListingTracker.tsx:27-45,48-80`;
   mounted `app/listing/[listingKey]/page.tsx:540-548`) · failure: fire-and-forget, never
   blocks the page · both.
9. **Complete — path A, tour/contact lead** · visitor · "Schedule a tour" routes to
   `/contact?listingKey=<key>&intent=tour` (`components/site/listing-detail/TextMattCTA.tsx:53-54`;
   primary CTA in `PriceCtaStrip`, `components/site/listing-detail/PriceCtaStrip.tsx:17-27`) ·
   name/email/phone/message + listingKey · `submitContactForm` resolves the property so the
   lead names the home, classifies referral geo, sends `sendEvent` → `ensureNativeLead` →
   `crm_people`, with a direct `ensureNativeLead` fallback so a capture blip never loses the
   lead (`app/contact/actions.ts:31-72,93-130`) · failure: fallback path; error surfaced to
   the visitor only if both fail · both.
10. **Complete — path B, guest alert** · visitor · submits email on `SearchAlertCapture`
    (all `/homes-for-sale` views, `app/search/page.tsx:397-401`) or on listing detail's
    `ListingLikeThisAlerts` (wraps `KbCommunityAlerts`, which calls the same action —
    `components/site/listing-detail/ListingLikeThisAlerts.tsx:1-2`;
    `components/site/kb/KbCommunityAlerts.client.tsx:8,66`) · email + live URL filters ·
    `submitSearchAlertSignup`: honeypot → per-IP rate limit (fail-closed in prod) → email
    validation → narrowing-filter guard (no "every home" alerts) → native lead + canonical
    buyer tagging → `crm_tasks` reminder → durable `listing_alerts` row → GA4 `lead_generated`
    mirror (`app/actions/search-alert-capture.ts:41-67,70-93,101-136,141-155`) · failure:
    CRM capture is best-effort; the durable row is the must-succeed write (`:142-143`) · both.
11. **Complete — path C, signed-in save/like** · visitor · saves from the price strip
    (server action `saveListingFromStrip`, `app/listing/[listingKey]/page.tsx:173-179`) or a
    tile · listing key · insert into `saved_listings` keyed canonically + save-count increment +
    first-party save event (`app/actions/saved-listings.ts:42-67`) · failure: signed-out returns
    `needsAuth` and routes to sign-in; the post-auth resume is add-only so stale client state
    can never silently unsave (`app/actions/saved-listings.ts:69-80`) · both.
12. **Handoff** · system · the hourly `saved-search-alerts` cron scans `listing_alerts` and
    emails matches (`vercel.json:213-214`; `app/api/cron/saved-search-alerts/route.ts:1-15`) —
    the boundary where this process ends and `deliver-alerts` begins · n/a — machine step ·
    failure: cron-owned, out of scope here.

## 6. Decision points

- **View branch** (`?view=` split | list | map): split is the app-frame default; list keeps
  document flow so the MLS-reciprocity footer stays reachable (`app/search/page.tsx:219,371-377,459-466`).
- **Signed-in vs guest capture**: guests get the alert-capture strip; signed-in users get
  save-search instead (`app/search/page.tsx:392-401`; `components/search/SearchAlertCapture.tsx:24-27`).
- **Drawn shape supersedes place pin**: a draw (or `?shapes=`/`?poly=` on load) strips the geo
  scope so the shape is the search (`app/search/page.tsx:255-273`).
- **Degraded vs true-zero**: timeout/error renders "couldn't load," never "0 homes"
  (`app/search/page.tsx:78-113`). §0 unknown-is-not-zero, mechanized.
- **Compliance gates in-path**: ODS/IDX attribution on every listing page
  (`ListingAttribution`, `app/listing/[listingKey]/page.tsx:427-432`; G54); media suppression
  honored in page + JSON-LD (`:449-455,523-525`); confidential CMAs render only when
  Matt-published AND audit-passed (`:422-426`); no-public-Coming-Soon holds because inventory
  reads come from the DAL's filtered tile path; referral-geo classification fail-closes to
  manual review on unresolvable listings (`app/contact/actions.ts:47-72`); alert capture is
  spam-hardened and fail-closed in prod (`app/actions/search-alert-capture.ts:41-67`); A2P/TCPA
  consent is an explicit checkbox, fail-closed (`app/contact/actions.ts:38-39`); voice canon +
  §0 traces apply to all rendered copy/counts.

## 7. Completion

Done when ONE observable buyer-intent artifact exists:

1. **Tour/contact lead** — a `crm_people` row (+ event message naming the listing) from
   `submitContactForm` (`app/contact/actions.ts:93-130`).
2. **Guest alert** — a `listing_alerts` row + native CRM lead + `crm_tasks` reminder from
   `submitSearchAlertSignup` (`app/actions/search-alert-capture.ts:101-143`).
3. **Save/like** — a `saved_listings` row (`app/actions/saved-listings.ts:42-55`).

Artifacts at completion: the CRM person with canonical `audience:buyer` tags and origin
context; the durable alert filters + hash; the saved listing keyed canonically; the GA4
`lead_generated` mirror. Terminal states: **converted** (artifact exists), **abandoned**
(telemetry trail only — still valuable: the first-party trail feeds CRM warmth), **degraded
exit** (visitor left during a degraded render — observable via the degraded flag pattern).
No on-site RSVP completion exists for open houses: zero RSVP mechanism in the 282-line
`KbOpenHouses.client.tsx` (grep re-verified this run) — its done-state is the same
listing-detail click-through.

## 8. Time & performance

- **Time-to-answer budget**: the page's own code budgets answer this — inventory reads race a
  4s settled timeout, session-dependent hydration 1.5s, boundaries 2s
  (`app/search/page.tsx:71-76,86-113,242-250`); listing detail arms run 3-4.5s in parallel
  (`app/listing/[listingKey]/page.tsx:205-257`). The visitor's question ("what's for sale
  here?") must be answered by first paint of the seeded viewport — SSR-seeded so no
  client-fetch waterfall precedes the first result set (`app/search/page.tsx:229-232`).
- **Freshness windows** (what "stale" means): search 60s ISR (`app/search/page.tsx:210`),
  listing detail 300s + on-demand `cacheTag.listing` invalidation
  (`app/listing/[listingKey]/page.tsx:107-111`), price-drops 1800s, luxury 900s, videos 300s;
  `/our-homes` is `force-dynamic` — zero cache (`app/our-homes/page.tsx:57`).
- **What "slow" means and who sees it**: a pooler stall past the budget shows the degraded
  "couldn't load" state (anonymous ad-traffic sees it worst — listing detail is the #1
  ad-landing surface, which is why every arm is timeout-guarded, `:191-193`).
- **Core Web Vitals reality**: NOT measured this session — no CWV number is stated (§0).
  Pulling field CWV for `/homes-for-sale` and `/listing/*` (CrUX or GA4 web-vitals events) is a
  required P8 litmus input; L2 (cold visitor → alert with contact) times this exact process.

## 9. Variants

All confirmed as lenses over ONE process (identical completion set, all deep-link `/listing/*`):

- **Full search** (`/homes-for-sale` split/list/map) — the canonical variant.
- **Curated intent** — `/open-houses` (time-boxed events), `/price-drops` (motivated sellers),
  `/luxury-homes-bend` (price segment), `/our-homes` (brokerage-only inventory).
- **Media-first browse** — `/videos` (grid + city chips) and `/feed` (vertical autoplay feed):
  the browse modality changes, the outcome does not.
- **Ledger** — `/activity` (event stream: new/cut/pending/closed → deep links).
- **Utility** — `/compare` (noindex side-by-side, `app/compare/page.tsx:52`): a mid-process
  tool, not an entry or completion.
- **Paid direct-to-detail** — skips steps 1-6, lands at step 7.
No variant materially diverges in path or completion; none warrants a process split.

## 10. Current implementation map

- **Routes**: `/homes-for-sale` (+ city/community/neighborhood segments and pretty listing
  URLs via rewrites, `next.config.ts:293-300`), `/listing/[listingKey]` + resolvers
  `by-address` / `by-key` / `odsmls` (dir verified), `/open-houses`, `/price-drops`,
  `/luxury-homes-bend`, `/our-homes`, `/videos`, `/feed`, `/activity`, `/compare`, plus the
  legacy 301 set (`next.config.ts:210-216,249-250`).
- **Design registers (of the 4 surviving languages)**: this ONE process spans all of them —
  **kb** dominates (`kb.css` + Kb* on search footer, open-houses, price-drops, activity,
  videos, our-homes, compare, listing shell); **primitives** inside search/detail components
  (`components/search/MapSearchView.tsx:26`; `components/site/listing-detail/TextMattCTA.tsx:2-7`);
  **explore** on listing detail (`app/listing/[listingKey]/page.tsx:19-21`); **legacy flat**
  on `/feed` (`SiteFooter`, `app/feed/page.tsx:7`). The register mixing inside one visitor
  journey is the exact defect the P9 ratchet exists to kill.
- **Actions/API/crons**: `getViewportSearch`/`getSearchListings`/`countSearchListings`
  (`app/actions/search.ts:246`), `submitSearchAlertSignup`, `submitContactForm`,
  `saveListing`/`toggleSavedListing`/`resumeSaveListing`, `POST /api/listings/<key>/track`,
  hourly `saved-search-alerts` cron (`vercel.json:213-214`).
- **Known defects / duplicates that should die (P3/P5 input)**:
  1. `/videos` vs `/feed` — two overlapping video-browse surfaces over the same video-listing
     inventory (grid-with-chips, `app/videos/page.tsx:15-37`, vs vertical feed,
     `app/feed/page.tsx:59-85`). One should absorb the other.
  2. `/compare` carries a retained-but-unused `daysOnMarket` helper and an unresolved
     "AICompare wire-or-delete" investigation note (`app/compare/page.tsx:19-20,71-82`).
  3. `/our-homes` header comment claims `getListingsWithAdvanced` but the code imports
     `getBrokerageListings` — doc drift (`app/our-homes/page.tsx:7` vs `:29`).
  4. `/feed` renders the legacy-flat `SiteFooter` while every sibling surface wears
     `KbFooter` — register drift inside the process (`app/feed/page.tsx:7`).
  5. `/our-homes` is `force-dynamic` (`app/our-homes/page.tsx:57`) — the only surface in the
     process with zero caching; a cost/latency outlier with no stated reason in-file.
  6. `/activity`'s hero passes all-null stats (`app/activity/page.tsx:143`) — a stat band
     that renders nothing rather than live numbers.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — it is the buyer half of the site's reason to exist,** and the
exploration-graph north star names it pillar 1. Shape derives from the job (find → inspect →
commit to a next step), NOT from today's eleven routes; route names, groupings, and which
lenses survive are P5 calls under amnesia (with the SEO carve-out: `/homes-for-sale`,
`/listing/*` pretty URLs, and the curated SEO entries carry earned equity — GSC evidence per
route is mandatory before any P5 cut/rename, and cuts get 301s).

- **Ideal step count**: 3 visitor steps on the happy path — scope (place or intent lens) →
  inspect → commit (alert/save/tour). Everything else (draw, compare, video, filters) is
  optional depth inside step 1-2, never a required stage.
- **Device**: mobile 390 is truth (Matt-locked); the split app-frame and the vertical feed are
  the two modality poles worth keeping; desktop adds draw + compare depth.
- **Continuity (binding decision #5)**: the place/filter/intent context a visitor establishes
  must follow them across every lens — today the URL carries it within `/homes-for-sale` but
  drops at the curated surfaces (e.g. `/price-drops` has no city continuity with an
  established Bend search). P5 must specify what context persists across which edges.
- **Consolidations implied**: one video-browse surface, not two; `/compare` either earns a
  place as an in-graph utility with an exit contract or dies; every curated lens becomes a
  filtered view of one browse system rather than a hand-built page.
- **Data gaps blocking correctness**: GA4 device split + CWV field data (not queried this
  session); GSC equity per curated entry (P5 prerequisite); no per-surface conversion split
  (which lens actually produces alerts/saves/tours) — needed before P5 decides which lenses
  earn destinations.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Find the homes that match what I can spend and how I want to live,
  and know each one well enough to act."
- `machine_objective`: "Capture a durable buyer-intent artifact — an alert with an email, a
  saved home on an account, or a tour request — at the moment browsing proves the intent."
- `exits`: listing detail → place node (city/neighborhood/community pages — the
  `evaluate-a-place` process) · listing detail → market context (`explore-market-knowledge`
  via the market-context hub links, `app/listing/[listingKey]/page.tsx:318-324`) · alert/save
  → `save-and-return` · tour CTA → `contact-a-broker` · seller-curious browser →
  `get-home-value` (the valuation CTA on `/activity`, `app/activity/page.tsx:210-214`).
  Exact exit routes are P5 output; these are the graph edges the process requires.

**Destination implication (proposal, not a lock):** ONE browse destination (the full search
system, all lenses as filtered views) + ONE listing-detail destination (with its resolvers),
with `/compare` and the media lenses folded in as modes rather than standalone pages.

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Entry + canonical**:
   `curl -sI https://ryan-realty.com/search | grep -i '^location'` → `/homes-for-sale` (301);
   `curl -s https://ryan-realty.com/homes-for-sale?city=Bend | grep -o '<link rel="canonical"[^>]*>'`
   → canonical carries `/homes-for-sale` + params (contract at `app/search/page.tsx:195-199`).
2. **Pretty listing URL resolves**: pick a live key —
   `curl -s "https://ryan-realty.com/homes-for-sale/listing/<listingKey>" -o /dev/null -w '%{http_code}'`
   → 200 (rewrite `next.config.ts:293`).
3. **Inception telemetry**: load `/homes-for-sale` in a browser, confirm `search_view` in the
   GA4 DebugView / dataLayer (fires per `components/tracking/TrackSearchView.tsx:18-23`).
4. **Degraded honesty**: with the DB reachable, `/homes-for-sale?view=split` never shows
   "0 homes" alongside a map full of pins; kill the read (dev) and confirm the "couldn't load"
   state, not a zero (`app/search/page.tsx:86-113`).
5. **Alert completion (path B)** — submit a test email on the capture strip with `city=Bend`,
   then:
   `select email, name, filters_hash, created_at from listing_alerts where email = '<test>' order by created_at desc limit 1;`
   → one row; and
   `select id from crm_people where email = '<test>';` → lead exists; and
   `select name, due_at from crm_tasks where person_id = <id> order by created_at desc limit 1;`
   → the 5-minute reminder (`app/actions/search-alert-capture.ts:129-143`).
6. **Narrowing guard**: submit the capture with NO filters → rejected with the "add a filter"
   error, no row written (`app/actions/search-alert-capture.ts:86-88`).
7. **Save completion (path C)** — signed-in, save a listing, then:
   `select listing_key from saved_listings where user_id = '<uid>' order by created_at desc limit 1;`
   → canonical ListingKey (not a ListNumber) per `app/actions/saved-listings.ts:42-50`.
8. **Tour lead (path A)** — submit `/contact?listingKey=<key>&intent=tour` with a test email;
   confirm the `crm_people` row exists and the event message names the street address + MLS
   number (`app/contact/actions.ts:60-63,93-112`).
9. **Mid-process telemetry**:
   `curl -s -X POST https://ryan-realty.com/api/listings/<key>/track -o /dev/null -w '%{http_code}'`
   → 2xx (`components/listing/ListingTracker.tsx:45`).
10. **Alert delivery wiring**: `grep -A1 'saved-search-alerts' vercel.json` → schedule
    `0 * * * *`; route exists at `app/api/cron/saved-search-alerts/route.ts`.
11. **Compliance**: rendered listing page shows the ODS attribution line (listing agent +
    office, `app/listing/[listingKey]/page.tsx:427-432`); a media-suppressed listing's JSON-LD
    contains no photos (`:523-525`).
12. **Timed span (P8 litmus L2)**: on a real phone, cold `/homes-for-sale` → alert captured
    with email — record the seconds; a timing not measured this session is not a timing.
