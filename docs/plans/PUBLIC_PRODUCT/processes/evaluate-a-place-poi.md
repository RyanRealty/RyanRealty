> **MERGED -> evaluate-a-place (P3 lock, Matt 2026-08-11).** This PDS is evidence for the survivor; do not build surfaces from it directly.

# Process: evaluate-a-place-poi — Evaluate around an anchor (schools, parks, golf, trails, venues, events, builders)

## 0. Meta

- Status: deepened
- Cadence: continuous
- Verdict (PROPOSAL — P3 decides, nothing here is a lock): **MERGE→evaluate-a-place** —
  the visitor question ("does life around this place fit me?"), the step skeleton
  (arrive → verify the anchor → see the real homes around it → exit deeper or capture),
  and the dual objective are identical to geography evaluation. What differs is the data
  plumbing (hand-verified in-repo registries + point/line/polygon anchors instead of
  market-cache geographies) and the entry query shape (amenity long-tail instead of place
  name). Per this OS's own §9 rule — split only if the path materially diverges — that is
  a **variant family**, not a second process. Keep "anchor-first" as a named variant of
  `evaluate-a-place` so P5 designs ONE explore-places destination with two node shapes
  (geography node, anchor node) instead of two parallel page families.
- Last evidence pass: 2026-08-11 (every file:line below opened/verified this session)

## 1. Purpose

(a) A visitor who cares about one concrete anchor of daily life — a school, park, trail,
golf course, music venue, recurring event, or home builder — gets verified facts about
that anchor plus the real active single-family homes for sale around it, answering
"could I live near this thing?" on one page. (b) The machine outcome is one advanced step
in the exploration graph — a listing opened, a city/community node entered, or a regional
SFR alert created — plus the earn-search-traffic moat that feeds the top of the funnel;
both are produced precisely BY serving (a), because an honestly-answered anchor question
makes the nearby-homes grid and its exits the natural next click rather than an
interruption (north-star rule, decisions.md 2026-08-11 directive 3).

## 2. Inception (what starts it)

**Trigger:** an amenity-intent question ("smith rock homes", "schools in Bend", "phil's
trail houses", "tetherow golf course", "hayden homes bend") — or a lifestyle click from
the Areas nav while already exploring.

**Entry channels + concrete routes (evidence per row, opened this run):**

| Channel | Route(s) | Evidence |
|---|---|---|
| Organic search — index pages | `/schools`, `/parks`, `/central-oregon/trails`, `/central-oregon/events`, `/central-oregon/venues` | sitemap emission `app/sitemap.ts:100-104` |
| Organic search — golf hub | `/lp/central-oregon-golf` (the ONLY golf index; `/central-oregon/golf/` has no `page.tsx` — verified by directory listing this run) | `app/sitemap.ts:139-140`; `app/central-oregon/golf/[slug]/page.tsx:117,141` breadcrumbs point at the LP |
| Organic search — detail pages | events `app/sitemap.ts:168-175`, venues `:176-183`, golf `:184-193`, trails `:194-201`, schools `:205-212`, parks `:213-220` — `lastModified` is the registry `lastVerified` date for events/venues/trails (honest freshness, `:167`) | `app/sitemap.ts:165-220` |
| Nav — Areas panel lifestyle rows | Schools, Parks, Trails, Events, "Live music and shows", Golf (→ LP) | `lib/site-nav.ts:124-129` (top bar), `:213-218` (mobile Menu+), `:290-293` (footer Areas column) |
| Internal cross-links | listing detail "More by this builder" rail → `/builders/[slug]` (`components/site/explore/BuilderExploreSection.tsx:26`); venue detail "On stage here" → event pages (`app/central-oregon/venues/[slug]/page.tsx:209-234`); every detail page's related-POI grid and index link |
| NOT discoverable | `/builders` + `/builders/[slug]` appear in NEITHER `app/sitemap.ts` NOR `lib/site-nav.ts` (grep returned zero hits this run) — internal-link + direct-URL only |

**Preconditions:** none — anonymous, no auth, no query params. The anchor registries are
compiled into the bundle, so every index and detail page renders even if the DB is down
(facts degrade to registry-only; homes degrade to an empty state). All detail families
except builders are fully prerendered: `dynamicParams = false` + `generateStaticParams`
over the registry (`app/schools/[slug]/page.tsx:42,62-64`, `app/parks/[slug]/page.tsx:46,59-61`,
`app/central-oregon/golf/[slug]/page.tsx:36,47-49`, `app/central-oregon/trails/[slug]/page.tsx:41,48-50`,
`app/central-oregon/venues/[slug]/page.tsx:37,50-52`). Builders is `dynamicParams = true`
with the top 40 prerendered (`app/builders/[slug]/page.tsx:22,24-27`).

## 3. Actors

- **Visitor segments (by anchor family):** relocating families (schools — the feeder
  framing is the whole page: "Homes that feed {school}", `app/schools/[slug]/page.tsx:242-244`);
  lifestyle/outdoor buyers and dreamers (parks, trails, golf); event- and
  nightlife-curious visitors and second-home dreamers (events, venues); new-construction
  buyers (builders, entered mid-funnel from a listing they already liked). Device reality
  per family was NOT pulled from GA4 this run — recorded as a gap in §11, not asserted.
- **Automated actors:** ISR revalidation (300s detail pages, 3600s indices —
  `app/schools/[slug]/page.tsx:43`, `app/schools/page.tsx:32`, `app/central-oregon/events/page.tsx:36`);
  the sitemap generator emitting all registry URLs (`app/sitemap.ts:165-220`);
  `KbSectionTracker` beaconing `section_view` + scroll-depth to GA4/Pixel AND
  `/api/visitors/track` on every route in the family
  (`components/site/kb/KbSectionTracker.client.tsx:1-40`).
- **Accountable for completion:** nobody human — the page is the operator. The contact
  CTA hands off to the broker line (`CONTACT.phoneDirectTel`, e.g.
  `app/schools/[slug]/page.tsx:468-470`); the alert band hands off to the
  `listing_alerts` delivery pipeline (deliver-alerts process). Builders detail hands off
  to no one (defect, §10).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Anchor facts (names, blurbs, amenities, dates, course specs, verified academic stats) | Hand-verified in-repo registries, each row citing a primary source: `data/co-schools.ts` (55 rows, `:874`), `data/co-parks.ts` (18), `data/golf/courses.ts` (26 — ONE registry shared with the `/lp/central-oregon-golf` hub, `app/central-oregon/golf/[slug]/page.tsx:6-9`), `data/co-trails.ts` (19), `data/co-venues.ts` (20), `data/co-events.ts` (48). Counts verified by evaluating the arrays with tsx this session. |
| Anchor geometry | `public.boundaries` for park polygons and school attendance areas (`geo_type ∈ {…, school_district, park, school}` — `docs/DATABASE_FOR_AI_AGENTS.md:100`; consumed at `app/schools/[slug]/page.tsx:119-128`, `lib/data/parks/getParkBoundaryGeoJSON.ts` per `docs/DAL_INDEX.md`); `public.trail_lines` (18 rows) for trail linework — trails are deliberately NOT a boundaries geo_type, a buffered corridor would be invented geometry (`docs/DATABASE_FOR_AI_AGENTS.md:101`) |
| Nearby homes + stat-band figures | live `listings` via the per-family DAL detail functions, each cached: `school-detail-v1`, `park-detail-v1` + `park-boundary-geojson-v1`, `golf-detail-v2`, `trail-detail-v1` + `trail-line-geojson-v1`, `venue-detail-v1`, `event-detail-v1`, all TTL `CACHE_WINDOWS.listingsByGeo` (`docs/DAL_INDEX.md`, sections read this run) |
| Builder anchor itself | the MLS `Builder` field on active listings — there is no builder registry; the anchor is derived from inventory (`lib/data/listings/getActiveBuilders.ts`, `app/builders/page.tsx:51-55` states the spelling-variance caveat on-page) |
| City market read on golf/trails/venues/events detail | market cache via `cityMarket` in the detail payload, rendered by `AreaMarketBand` (`app/central-oregon/golf/[slug]/page.tsx:315`) |
| Alert capture | `listing_alerts` via `KbCommunityAlerts` inside `RegionalSfrAlertsBand` (`components/site/kb/RegionalSfrAlertsBand.tsx:1-31`, `extraFilters={ propertyType: 'A' }`) |
| Engagement | GA4/Pixel + internal `/api/visitors/track` (`KbSectionTracker.client.tsx:1-40`) |

**Explicitly NOT a SoR:** venue calendars and event lineups (never scraped — the page
links OUT to the venue's own calendar, `app/central-oregon/venues/[slug]/page.tsx:5-9,190-195`);
live GreatSchools/NCES ratings (registry snapshot only, source-attributed at
`app/schools/[slug]/page.tsx:262-277`); the sitemap; anything in chat or prior renders.

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives from an amenity query or an Areas nav click · input:
   URL · output: prerendered page from the static/ISR cache · system: none on the
   request path (all detail pages prerendered, §2) · failure: page not in sitemap/nav
   (builders — §2 table) means this step mostly never fires for that family · mobile-first.
2. **Serve with degrade** · Next/ISR · registry lookup + DAL detail fetch wrapped in
   `.catch(() => null)`; a transient Supabase 57014 renders the anchor with zero homes
   instead of 500ing, and the registry-vs-DAL distinction keeps a real unknown slug a
   true 404 · `app/schools/[slug]/page.tsx:96-107`, `app/parks/[slug]/page.tsx:98-107`,
   `app/central-oregon/golf/[slug]/page.tsx:88-99`, `app/central-oregon/trails/[slug]/page.tsx:96-107`,
   `app/central-oregon/venues/[slug]/page.tsx:90-99` · failure: the degraded render is
   indistinguishable from a true zero (§10 defect D4).
3. **Orient on the anchor** · visitor · hero + verified facts, rendered ONLY where the
   registry carries a cited value: conditional academic stats (`app/schools/[slug]/page.tsx:163-176`),
   park amenities + agency attribution (`app/parks/[slug]/page.tsx:198-222`), course
   specs + tee-time outlink (`golf:166-215`), trail facts + `lastVerified` + land-manager
   outlink (`trails:177-227`), venue facts + calendar outlink (`venues:164-205`),
   confirmed event dates only (`app/central-oregon/events/page.tsx:9-16`) · device: all.
4. **Spatial proof** · visitor · a map placing the anchor against the real homes:
   school attendance polygon (fallback city frame) + feeding-home pins
   (`schools:114-159,322-333`), park boundary polygon + pins (`parks:114-129,256-282`),
   trail linework + trailhead + pins (`trails:100-101,230-251`), point + pins for
   golf/venues (`golf:218-237`, `venues:237-256`) · system: `boundaries`,
   `trail_lines`, DAL pins · failure: missing geometry degrades to point-only or no map.
5. **Read the numbers** · visitor · stat band: active-SFR count + median list price,
   computed live in the DAL from `listings`, labeled with its own definition
   ("active single-family homes within about 1.5 miles…") · `schools:297-319`,
   `parks:225-252`, `golf:240-257`, `trails:254-271`, `venues:259-276` · §0: the figure
   and its filter are stated together on-page.
6. **Browse the homes** · visitor · `KbFeatured` grid, max 12 cards (`MAX_CARDS`,
   `schools:58`, `parks:55`, `golf:39`, `trails:44`, `venues:40`; builders limit 14
   `app/builders/[slug]/page.tsx:54-60`) · output: **completion path A — a listing
   click-through** (`home.href` on every card) · schools detail uniquely hand-rolls its
   card markup instead of `KbFeatured` (`schools:347-373`, §10 defect D6).
7. **Overflow exit** · visitor · "See all/more homes in {city}" →
   `/search?city=…` (+`&keywords={school name}` on schools — a keyword hack because
   search has no school filter, `schools:178-183`; `parks:135`, `golf:106`, `trails:114`,
   `venues:106`) · **completion path B — hand-off into find-a-home**.
8. **Deepen into the graph** · visitor · community cross-link when the anchor sits in a
   resort community (`golf:294-312`, `trails:309-327`), city fact-row links
   (`golf:195-198`, `trails:207-212`, `venues:182-187`), live city market read via
   `AreaMarketBand` (`golf:315`, `trails:330`, `venues:313`,
   `app/central-oregon/events/[slug]/page.tsx:350`), FAQ + FAQPage schema
   (`golf:110,130,318-333`; `trails:119,139,333-348`; `venues:110,130,316-331`),
   related-POI grid + index link (every detail page) · **completion path C**.
9. **Capture** · visitor · `RegionalSfrAlertsBand` → free `listing_alerts`
   (regional, `propertyType 'A'`) on the five index/hub pages ONLY:
   `app/schools/page.tsx:164`, `app/parks/page.tsx:178`,
   `app/central-oregon/trails/page.tsx:155`, `app/central-oregon/events/page.tsx:198`,
   `app/central-oregon/venues/page.tsx:152` · **completion path D** · failure: NO detail
   page carries any capture (§10 defect D3).
10. **Contact** · visitor · CTA band → `/contact` + `tel:` on schools/parks/golf/
    trails/venues detail (`schools:449-474`, `parks:349-366`, `golf:368-385`,
    `trails:381-398`, `venues:364-381`) · **completion path E** · builders detail has no
    CTA at all (`app/builders/[slug]/page.tsx:62-123` — heading, grid, footer, nothing
    else; §10 defect D2).
11. **Measure** · system · `KbSectionTracker pageType=…` on every route fires
    `section_view` at 55% visibility per section + 25/50/75/100 scroll depth, dual-sunk
    to GA4/Pixel and `/api/visitors/track`
    (`KbSectionTracker.client.tsx:1-40`; mounted at `schools:223`, `parks:179`,
    `golf:135`, `trails:144`, `venues:135`, `events:100`, `builders:64` /
    `builders index:28`).

## 6. Decision points

- **Unknown slug vs transient DB error:** registry lookup arbitrates — real 404 vs
  degraded render with zero homes (`app/schools/[slug]/page.tsx:96-103` states the rule;
  same pattern all families, §5 step 2).
- **Geometry tiering:** school attendance polygon → city-frame fallback
  (`schools:114-128`); park `hasPolygon` → polygon vs point-only (`parks:118-120`);
  trail line present → route drawn vs trailhead point, with the map caption changing to
  match what is actually drawn (`trails:100-101,237-241`).
- **Homes present vs empty:** grid vs an empty state that still exits to city search
  (every family; e.g. `parks:298-317`, `trails:287-306` which honestly explains
  "much of the land around it is public forest").
- **Event JSON-LD gate:** the Event schema is emitted ONLY with a real
  `nextConfirmedDate` — never a guessed date
  (`app/central-oregon/events/[slug]/page.tsx:9-12`; hub shows recurrence text instead,
  `app/central-oregon/events/page.tsx:47-64`).
- **Community cross-link** only when the registry carries `communitySlug`
  (`golf:294`, `trails:309`).
- **Compliance gates:** §0 — a fact renders only when the registry carries a cited value
  (conditional stats `schools:163-176`; `lastVerified` printed on trails/venues
  `trails:219-225`, `venues:197-203`); no invented geometry (trail-corridor ban,
  `docs/DATABASE_FOR_AI_AGENTS.md:101`, enforced by `ci:boundary-provenance`); voice
  canon on all copy (gated, `ci:brand-voice`); no public Coming Soon — every homes query
  is Active-only by definition printed in the stat label (§5 step 5); ODS/IDX
  attribution rides the listing-detail pages the cards exit into, not these anchor pages.
- **Builders empty state** exits to `/search?newConstruction=1`
  (`app/builders/page.tsx:56-63`).

## 7. Completion

**Done-when (observable), any of:**

- A. Listing opened from the nearby-homes grid or a map pin (§5 step 6 — `home.href`).
- B. City inventory hand-off: `/search?city=…` overflow or empty-state exit (§5 step 7).
- C. Graph deepen: city page, community page, or market read entered (§5 step 8).
- D. Regional SFR alert created — a `listing_alerts` row (§5 step 9, indices only).
- E. Contact initiated — `/contact` or `tel:` (§5 step 10).

**Artifacts at completion:** `section_view`/`scroll_depth` rows via
`/api/visitors/track` + GA4 events (every path); a `listing_alerts` row (path D only).
No per-POI artifact persists for paths A/B/C/E — attribution continues on the
destination node.

**Terminal states:** bounce; deliberate outbound exit (tee times `golf:202-206`,
venue calendar `venues:190-195`, official trail page `trails:215-217`) — these are
designed trust-building exits, not defects; empty-state exit to city search.

## 8. Time & performance

- **Time-to-answer budget:** the anchor's identity and verified facts sit in the first
  viewport (hero + facts, §5 step 3); the "can I live near it" number lands one scroll
  later at the stat band. Because every detail page is prerendered
  (`dynamicParams=false`, §2) the DB is never on the request path — TTFB is static-serve
  and the answer speed is a scroll-depth question, not a query-latency question.
- **Freshness contract:** homes are as stale as the last successful revalidate — up to
  300s on detail pages, 3600s on indices (§3). "Slow" here means STALE, and the visitor
  who sees it is the one relying on the count ("3 homes near Smith Rock") — acceptable
  at these windows for a browse surface, but a degraded revalidate silently freezes the
  zero-homes state until the next attempt (defect D4).
- **Core Web Vitals reality:** NOT measured this run — no field data pulled for these
  routes. Recorded as a §11 gap; asserting numbers here would violate §0.

## 9. Variants

Seven anchor families share the single §5 path; none diverges enough to split:

| Variant | What varies (only) | Evidence |
|---|---|---|
| Schools | feeder framing ("homes that feed"), attendance polygons, district grouping, keyword-hack overflow exit | `schools:242-244,119-128,178-183` |
| Parks | authoritative boundary polygon, amenities list | `parks:114-129,198-222` |
| Golf | registry shared with the `/lp/*` hub; community cross-links; FAQ; breadcrumb parents at the LP | `golf:6-9,117,294-312` |
| Trails | authoritative linework, "moat" framing, land-manager outlink | `trails:100-101,215-217` |
| Venues | outbound calendar as the primary action; `eventsHere` cross-sell of our event pages | `venues:190-195,209-234` |
| Events | time-anchored (confirmed dates only), hub ItemList schema, category chips | `events:47-64,95,136-174` |
| Builders | anchor derived from listing data itself — no registry, no facts, no map, no stats, no CTA, no capture; the thinnest variant by far | `app/builders/[slug]/page.tsx:49-124` |

Channel variants (organic long-tail, Areas nav, internal cross-link, direct) all join
the same path at §5 step 1 — no split.

## 10. Current implementation map

- **Routes today:** 5 index/hub routes in-family (`/schools`, `/parks`,
  `/central-oregon/trails`, `/central-oregon/events`, `/central-oregon/venues`) +
  `/builders` (undiscoverable, §2) + 186 registry-prerendered detail pages
  (55 schools + 18 parks + 26 golf + 19 trails + 20 venues + 48 events — counts
  evaluated from the registries this session) + top-40-prerendered builders details.
  The golf index lives OUTSIDE the family at `/lp/central-oregon-golf` (arrive-from-ad's
  namespace) — `app/sitemap.ts:139-140`, `golf:117,141`.
- **Register:** KB (kinetic-brutalist) throughout — `kb.css`,
  `SmoothScrollProvider`/`KbBreadcrumb`/`KbHero`/`KbFeatured`/`KbFooter`/`KbSectionTracker`
  (imports at the head of every file cited in §5); golf/trails/venues/events also share
  `events.css` (`golf:34`, `trails:39`, `venues:35`). One of the five design languages —
  shape is NOT inheritable under amnesia; behavior and data are.
- **Data/actions:** all reads through `@/lib/data` (G8); DAL cache keys per family (§4);
  no server actions, no crons owned by this process; capture delegates to
  `KbCommunityAlerts`; tracking delegates to `/api/visitors/track`.
- **Known defects (all verified this run):**
  - **D1 — golf spine is split across process namespaces:** detail pages in-family, hub
    is an `/lp/*` route; breadcrumbs on 26 pages point into ad-owned territory
    (`golf:117,141`; `app/sitemap.ts:139-140`).
  - **D2 — builders detail is a stub:** no facts SoR, no map, no stat band, no market
    read, no CTA, no capture (`app/builders/[slug]/page.tsx:62-124`); index states the
    spelling-variance caveat on-page (`app/builders/page.tsx:51-55`); neither route in
    sitemap or nav (grep zero-hit this run).
  - **D3 — zero capture on every detail page:** alerts exist only on the 5 indices
    (§5 step 9); the highest-intent page in the family (the anchor detail) relies solely
    on click-through or a phone call.
  - **D4 — degraded render lies:** a revalidate-time DB timeout renders "None nearby
    right now" indistinguishable from a true zero (`schools:96-107` and siblings) — a
    swallowed-error honesty defect against the §0 spirit.
  - **D5 — three parallel map components** implement "anchor + home pins":
    `KbListingMap` (schools :34,323), `NeighborhoodMap` (parks :35,268), `VenueMap`
    (golf :22, trails :27, venues :23) — duplicate paths that should converge.
  - **D6 — schools detail hand-rolls its listing cards** (`schools:347-373`) while every
    sibling uses `KbFeatured`; schools/parks carry route-scoped style blocks (~35 lines
    `schools:489-525`, ~65 lines `parks:380-446` — ~100 combined) whose card-grid rules
    duplicate each other near-verbatim (`schools:507-516` vs `parks:425-434`).
  - **D7 — schools overflow exit is a keyword hack** (`/search?…&keywords={name}`,
    `schools:178-183`) because search has no school filter.
- **Duplicate/parallel paths that should die:** the three map components (D5); the
  hand-rolled schools card markup (D6); the golf hub duplication question (one registry,
  two page shapes — LP hub vs absent family index) resolves at P5.

## 11. Target shape (process-level, not pixels)

- **Should this exist?** The CAPABILITY, emphatically yes — verified anchors paired with
  live MLS inventory is a moat no local competitor reproduces, and it feeds
  earn-search-traffic with 186+ honest long-tail pages. As a REGISTRY ENTRY, no —
  propose MERGE into `evaluate-a-place` as its anchor-first variant (§0 rationale). The
  job derives the shape: one "evaluate a place" process whose nodes are either
  geographies (market-cache-backed) or anchors (registry-backed), with identical exits.
- **Ideal step count/device:** mobile 390 first (decisions.md). Land → anchor answered
  in viewport 1 → homes proof by scroll 2 → one exit or capture; ≤3 interactions from
  landing to an open listing. Builders either rises to the family's floor (facts, map,
  stats, CTA, capture, discoverability) or is cut to a listing-detail rail only — P3/P5
  call, not code's.
- **Data gaps blocking correctness (✗ statements, not designs):**
  - ✗ No per-anchor capture primitive exists ("alert me on homes near {anchor}") — only
    the regional band on indices; `listing_alerts` geography capture never receives the
    anchor.
  - ✗ A degraded render is not distinguishable from a true zero anywhere in the payload
    (D4) — the page cannot be honest about staleness because the DAL does not surface it.
  - ✗ Builders has no facts SoR at all; the MLS `Builder` field's free-text variance is
    disclosed but unresolved (no alias table).
  - ✗ No GA4 device/traffic split per POI family pulled this run; no GSC query evidence
    tying these URLs to amenity-intent impressions. Both are REQUIRED at P5 before any
    URL cut/rename (SEO carve-out: these URLs' equity is data amnesia must protect).
  - ✗ School attendance-area coverage in `boundaries` is unquantified (which of the 55
    schools actually have polygons vs city-frame fallback was not counted this run).
- **Destination implication + dual objective stamp:**
  - Destination: NO standalone destination. Anchor pages are leaf nodes of the
    explore-places destination (whatever P5 names it — naming derives from the job, not
    from today's `/central-oregon/*` route shapes). The golf spine's home moves in-family
    with the merge; `/lp/central-oregon-golf` keeps its ad job under arrive-from-ad, with
    GSC evidence deciding which URL carries the organic equity (301 discipline applies).
  - `visitor_objective`: "Decide whether life around {anchor} could work — verified
    facts about it, and the real homes for sale near it."
  - `machine_objective`: "Advance one graph step: a listing opened, a city or community
    node entered, or an SFR alert created — while the page itself earns amenity search
    traffic."
  - `exits`: listing detail (grid + pins) · `/search?city=…` inventory ·
    city node · community node (golf/trails) · market read · sibling anchor + family
    index · alert capture · contact. A P5 candidate consistent with the locked global
    CTA: the valuation spine (`/sell#get-value`) as a quiet exit for owner-segment
    visitors — offered, never interrupting (KPI is E2; decisions.md).

## 12. Acceptance checks

Persist; never delete. (The live-site checks use a browser UA because the WAF blocks
default curl UAs.)

1. **Registry ↔ prerender parity** (proves the anchor universe is what ships):
   ```bash
   npx tsx -e "
   import {CO_SCHOOLS} from './data/co-schools'; import {CO_PARKS} from './data/co-parks'
   import {GOLF_COURSES} from './data/golf/courses'; import {CO_TRAILS} from './data/co-trails'
   import {CO_VENUES} from './data/co-venues'; import {CO_EVENTS} from './data/co-events'
   console.log(CO_SCHOOLS.length, CO_PARKS.length, GOLF_COURSES.length, CO_TRAILS.length, CO_VENUES.length, CO_EVENTS.length)"
   # expected today: 55 18 26 19 20 48 (re-baseline when registries grow)
   ```
2. **Sitemap emission per family:**
   ```bash
   UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
   curl -sA "$UA" https://ryan-realty.com/sitemap.xml > /tmp/sm.xml
   for p in '/schools/' '/parks/' '/central-oregon/golf/' '/central-oregon/trails/' '/central-oregon/venues/' '/central-oregon/events/'; do
     printf '%s %s\n' "$p" "$(grep -o "ryan-realty.com${p}[a-z0-9-]*" /tmp/sm.xml | sort -u | wc -l)"; done
   # expected ≥ registry counts above; /builders MUST appear here once D2 is resolved
   ```
3. **Route liveness + degrade contract:** every index 200s; one detail per family 200s;
   a garbage slug 404s:
   ```bash
   for u in /schools /parks /central-oregon/trails /central-oregon/events /central-oregon/venues /builders \
            /schools/$(npx tsx -e "import {CO_SCHOOLS} from './data/co-schools';console.log(CO_SCHOOLS[0].slug)") \
            /schools/not-a-real-school-xyz; do
     printf '%s %s\n' "$(curl -so /dev/null -w '%{http_code}' -A "$UA" https://ryan-realty.com$u)" "$u"; done
   # expected: 200 for all real routes, 404 for the garbage slug
   ```
4. **§0 stat-band trace** (one anchor per run; example: a park's ~1.5-mile box): pull
   the rendered count off the page, then reproduce it with the DAL's own filter shape
   against `listings` (quoted mixed-case columns) and compare — the two numbers must be
   equal at the same cache window:
   ```sql
   SELECT count(*) FROM listings
   WHERE "StandardStatus"='Active' AND "PropertyType"='A'
     AND "Latitude"  BETWEEN <park.lat - 0.0217> AND <park.lat + 0.0217>
     AND "Longitude" BETWEEN <park.lng - box>    AND <park.lng + box>;
   ```
   (Read `lib/data/parks/getParkDetail.ts` first and mirror ITS exact box/radius —
   the check is "page equals its own query", not "page equals my guess".)
5. **Capture E2E (path D):** in a real browser, submit the alerts band on
   `/schools#get-alerts` with a test email, then:
   ```sql
   SELECT id, email, filters FROM listing_alerts
   WHERE created_at > now() - interval '10 minutes' ORDER BY created_at DESC;
   ```
   Expect one row with `propertyType 'A'` filters. Clean up the test row.
6. **Measurement E2E:** load one detail page per family in a browser, scroll to bottom,
   and verify `section_view` + `scroll_depth` beacons hit `/api/visitors/track` (network
   panel) with full `location.href` page URLs (the bare-path regression documented in
   `KbSectionTracker.client.tsx:10-14` is the thing being guarded).
7. **Exit integrity:** on one detail per family, assert every rendered exit href
   resolves 200: listing card href, `/search?city=…`, city link, community link (golf/
   trails), related-POI links, index link, `/contact`. A dead exit is a graph defect
   (north star: no dead ends).
8. **JSON-LD honesty:** `curl -sA "$UA" <event detail URL> | grep -c '"@type":"Event"'`
   must be 0 for any event whose registry row lacks `nextConfirmedDate`, and ≥1 when a
   confirmed date exists (`app/central-oregon/events/[slug]/page.tsx:9-12`).
