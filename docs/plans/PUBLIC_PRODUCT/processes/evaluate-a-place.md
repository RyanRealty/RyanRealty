# Process: evaluate-a-place — Evaluate a Central Oregon place

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (every session; place pages are the largest URL family on the site)
- Verdict: **PROPOSAL — KEEP.** This is pillar 2 of the north star ("Explore places") and the
  widest organic entry surface the site has: six live grains, all sitemap-emitted, all carrying
  Place/Dataset JSON-LD, with a working capture path (listing_alerts) and hand-offs into
  find-a-home and get-home-value. Proposal only; the verdict locks at P3 in decisions.md.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor deciding *where* in Central Oregon they might live gets a truthful, live answer
about one specific place — what is for sale there, what it costs, how fast it moves, what the
place is like, and what sits above/below/next to it on the geography ladder — without leaving
the exploration graph. (b) The machine outcome is a durable identified interest: a place-scoped
`listing_alerts` row plus `crm_people` id (the strongest done-state), or a scoped hand-off into
find-a-home / get-home-value — produced precisely *because* the page answered the place question
well enough that "tell me when something lists here" or "show me every home here" is the obvious
next step, never an interruption.

## 2. Inception (what starts it)

Trigger: a person forms the question "should I live in / buy in {place}?" and lands on a
place-grain page. Precondition: none — every grain is publicly reachable, no auth, no state.

**Entry channels + evidence:**

1. **Organic search / LLM citation** — every grain is sitemap-emitted and carries pageMetadata
   plus Place/Dataset/FAQPage JSON-LD built from live figures:
   - City tier seeded statically in the sitemap (`app/sitemap.ts:255-263`) and re-emitted
     dynamically per MLS city (`app/sitemap.ts:313-319`); city JSON-LD at
     `app/cities/[slug]/page.tsx:418-449`; metadata at `app/cities/[slug]/page.tsx:143-153`.
   - Communities: ONLY the curated resort registry slugs are emitted
     (`app/sitemap.ts:342-349`) — the fix for ~31 junk subdivision slugs noted in the comment there.
   - Subdivision detail pages: only the indexable set (GIS polygon AND lifetime-sales floor),
     `app/sitemap.ts:388-404`.
   - Neighborhoods: emitted exactly from the `neighborhoods` table rows, recorded into an
     allow-set that `filterRogueCityUrls` enforces on the final URL list
     (`app/sitemap.ts:406-423`, backstop at `app/sitemap.ts:559-561`).
   - ZIPs: every 5-digit PostalCode present on active listings (`app/sitemap.ts:502-522`).
2. **Internal navigation** — the global "Areas" nav group links `/area-guides`, `/cities`, all 8
   city links, `/communities` plus 6 flagship communities, and the lifestyle registry pages
   (`lib/site-nav.ts:111-131`; link banks at `lib/site-nav.ts:42-68`; footer projections at
   `lib/site-nav.ts:266-328`). Cross-grain doors inside the pages themselves let the visitor
   climb and wander the ladder: city → neighborhood ledger (`app/cities/[slug]/page.tsx:531-537`),
   city → communities rail + golf ledger (`app/cities/[slug]/page.tsx:539-552`), neighborhood →
   subdivisions + peer neighborhoods (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:498-515`),
   subdivision → parent resort/city + peer plats (`app/subdivisions/[slug]/page.tsx:476-489,560-573`),
   zip → other ZIPs (`app/zip/[zip]/page.tsx:455-462`), every grain → other cities. The ladder
   itself is assembled by `resolvePlaceContextFromListing`
   (`lib/data/geo/resolvePlaceContext.ts:88-207`): city · neighborhood · curated community ·
   subdivision, with breadcrumb/parents/identityLine and MLS-noise suppression
   (`lib/data/geo/resolvePlaceContext.ts:17-25`).
3. **Direct/typed** — stable, guessable URLs per grain (below).

**Entry routes (the six grains + three indices):**

| Grain | Route | Resolution | Evidence |
|---|---|---|---|
| City index | `/cities` | static, revalidate 1800 | `app/cities/page.tsx:50` |
| City | `/cities/[slug]` | PRIMARY_CITIES SSG + dynamicParams, revalidate 60 | `app/cities/[slug]/page.tsx:112-118` |
| Neighborhood | `/cities/[slug]/[neighborhoodSlug]` | `neighborhoods` table only, else 404 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx:99-103,113-114` |
| Community index | `/communities` | static, revalidate 1800 | `app/communities/page.tsx:56-59` |
| Community | `/communities/[slug]` | registry SSG + dynamicParams, revalidate 60 | `app/communities/[slug]/page.tsx:126-133` |
| Subdivision | `/subdivisions/[slug]` | NO-404 3-path: GIS boundary → registry alias → active listings | `app/subdivisions/[slug]/page.tsx:160-239` |
| ZIP | `/zip/[zip]` | strict canonical set, `dynamicParams = false` | `app/zip/[zip]/page.tsx:61-70,117` |
| Drawn area | `/areas/[slug]` | broker-authored public saved areas only | `app/areas/[slug]/page.tsx:49-51,128-134` |
| Area-guides index | `/area-guides` | static ledgers of cities + communities | `app/area-guides/page.tsx:58-86` |

Boundary polygons come only from the `boundaries` table via the shared DAL
(`lib/data/geo/getGeoBoundaryMapData.ts:14-19`, G31 enforced), through the
`listings_in_boundary` PostGIS RPC (`lib/data/geo/getGeoBoundaryMapData.ts:66-70`), which
throws on error rather than caching an empty pin set
(`lib/data/geo/getGeoBoundaryMapData.ts:72-80`).

## 3. Actors

- **Visitor segments:** relocating buyers ("which town/neighborhood"), second-home and resort
  buyers (community grain — the STR note at `app/communities/[slug]/page.tsx:913-926` exists for
  them), local move-up/move-down buyers (neighborhood/subdivision grain), owners checking their
  own area (the KbSell block on every grain serves them), and dreamers/researchers (area-guides,
  lifestyle sections). Device split is mobile-first by program decision (390 is truth); the
  actual GA4 device mix for these routes was **not queried this session** — listed as a gap.
- **Automated actors:** ISR revalidation (60s on detail grains, 300s areas, 1800s indices —
  evidence in the table above); the hourly `saved-search-alerts` cron that consumes the
  `listing_alerts` rows this process creates (`vercel.json:213-215`, schedule `0 * * * *`) —
  delivery itself belongs to the `deliver-alerts` process; the near-due broker task created at
  capture time (`app/actions/search-alert-capture.ts:129-135`).
- **Accountable for completion:** the page itself (no human in the loop until an alert signup
  creates the crm_tasks follow-up for the assigned broker).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Active inventory tiles / counts | `listing_tile_mv` via DAL (`getListingTiles`, `getZipListings`, `getCityListings`) | `app/cities/[slug]/page.tsx:193`, `app/zip/[zip]/page.tsx:183-188` |
| Live market pulse (30-day) | `market_pulse_live` via `getMarketPulse` (city + neighborhood keys; NO zip rows, NO neighborhood rows for some scopes) | `app/cities/[slug]/page.tsx:171`, `app/zip/[zip]/page.tsx:248-268` |
| Closed-sale stats / trends | `market_stats_cache` via `getMarketStats` / `getPriceHistory` / `getCoreChartSeries` | `app/cities/[slug]/[neighborhoodSlug]/page.tsx:162-165` |
| Geo snapshot fallback | `geo_snapshot_mv` via `getGeoSnapshot` (always-present JSON-LD source) | `app/cities/[slug]/page.tsx:158,411-415` |
| Boundary polygons | `boundaries` table ONLY (City of Bend GIS / DIAL / Oregon GEO / TIGER) | `lib/data/geo/getGeoBoundaryMapData.ts:14-17` |
| Neighborhood identity | `neighborhoods` table | `app/cities/[slug]/[neighborhoodSlug]/page.tsx:113` |
| Resort/community identity + aliases | `data/resort-communities.json` registry | `app/subdivisions/[slug]/page.tsx:106-122`, `app/communities/[slug]/page.tsx:256-258` |
| Captured interest | `listing_alerts` (durable alert) + `crm_people` (lead) + `crm_tasks` (broker nudge) | `app/actions/search-alert-capture.ts:103-143` |
| Drawn areas | public saved-area rows via `getPublicAreaBySlug` (`is_public=true` only) | `app/areas/[slug]/page.tsx:14-18,130` |

**Explicitly NOT a SoR:** the stored community boundary polygon when the slug is in the
oversized-boundary baseline (`app/communities/[slug]/page.tsx:155-162` — Broken Top 11,496 acres
vs ~450 real); `community.activeCount` for unreliable boundaries
(`app/communities/[slug]/page.tsx:406-409`); the literal MLS SubdivisionName count for any resort
(alias-aware count wins, `app/communities/[slug]/page.tsx:393-402`); a curated `seo_description`
that trips the banned-cliché guard (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:124-132`);
`pulse.activeCount` for a resort page's FAQ/Dataset (`app/communities/[slug]/page.tsx:613-617,639-645`).

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives via channel (§2) · URL · request hits ISR page · Next.js
   route + DAL · failure: wrong/dead slug (subdivision grain absorbs via NO-404,
   `app/subdivisions/[slug]/page.tsx:160-239`; zip/neighborhood hard-404,
   `app/zip/[zip]/page.tsx:160`) · any device.
2. **Resolve identity** · system · resolve slug → place entity per grain: city geo snapshot
   (`app/cities/[slug]/page.tsx:158-164`, space-vs-hyphen slug normalization at 161-164),
   neighborhood table row (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:144-153`), community +
   canonicalization redirects (`app/communities/[slug]/page.tsx:216-252`), subdivision 3-path
   (`app/subdivisions/[slug]/page.tsx:160-239`), canonical zip set (`app/zip/[zip]/page.tsx:157-160`),
   public area (`app/areas/[slug]/page.tsx:129-134`) · slug · place entity or notFound/redirect ·
   DB/registry · failure: notFound.
3. **Fetch the truth in parallel** · system · one `Promise.all` of guarded DAL reads per page,
   every read wrapped in `withTimeoutFallback` with a named tag and 2.5–9s budget
   (`app/cities/[slug]/page.tsx:166-208`; `app/cities/[slug]/[neighborhoodSlug]/page.tsx:155-189`;
   `app/communities/[slug]/page.tsx:267-332`) · geo keys · pulse/stats/tiles/boundary/content ·
   Supabase caches · failure: individual read times out → §0 suppression (step 4), never a
   fabricated zero.
4. **Answer above the fold** · system · hero renders count/median/days with unknown-is-not-zero
   discipline: `activeCount: number | null` and figure suppression on degraded reads
   (`app/cities/[slug]/page.tsx:213-214`, `app/cities/[slug]/[neighborhoodSlug]/page.tsx:207-227`
   incl. the BOUNDARY_PIN_CAP guard, `app/subdivisions/[slug]/page.tsx:279-287`,
   `app/zip/[zip]/page.tsx:200-206`, `app/areas/[slug]/page.tsx:146-149`) · fetched figures ·
   rendered hero + CTAs · none · failure: all sources degraded → hero shows place identity
   without figures · mobile-first.
5. **Prove it with inventory** · system · dual-pane map+list (`PlaceMapListSplit`,
   `app/cities/[slug]/page.tsx:484-495`) or featured rail fallback (496-505); polygon drawn only
   when trustworthy (`app/communities/[slug]/page.tsx:509-524`, `app/subdivisions/[slug]/page.tsx:364-378`) ·
   tiles + boundary · interactive inventory proof · Google Maps · failure: zero pins → featured
   rail or honest empty state (`app/subdivisions/[slug]/page.tsx:528-539`).
6. **Offer capture mid-page** · visitor · `KbCommunityAlerts` email form scoped to the place the
   visitor is reading: city+SFR on city/neighborhood pages (`app/cities/[slug]/page.tsx:509-516`,
   `app/cities/[slug]/[neighborhoodSlug]/page.tsx:474-481`), city+subdivision on community pages
   (`app/communities/[slug]/page.tsx:890-894`), zip+SFR via `postalCode` filter
   (`app/zip/[zip]/page.tsx:433-442`), regional band on both indices (`app/cities/page.tsx:564`) ·
   email · submit → step 10 · client → server action · failure: validation/rate-limit error shown
   inline (`components/site/kb/KbCommunityAlerts.client.tsx:152-154`).
7. **Deepen** · visitor · about/rich overview, market HUD with honest scope relabeling when the
   local series is too sparse (`chartScopeLabel "{City} (city)"`,
   `app/cities/[slug]/[neighborhoodSlug]/page.tsx:340-341,493-497`;
   `app/communities/[slug]/page.tsx:579-586`; zip chart is always city-labeled,
   `app/zip/[zip]/page.tsx:405-409`), sales history + schools at plat grain
   (`app/subdivisions/[slug]/page.tsx:548-559`), lifestyle-near sections
   (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:516-522`), FAQ from live figures
   (`app/cities/[slug]/page.tsx:582-586`) · — · informed visitor · caches · failure: any missing
   source self-hides its section.
8. **Climb or wander the ladder** · visitor · grain-to-grain doors (§2 channel 2) plus
   breadcrumbs from `resolvePlaceContext` semantics · — · next place node · — · failure: none
   (exit links deliberately sit after the convert blocks, `app/cities/[slug]/page.tsx:574-581`).
9. **Convert or hand off** · visitor · hero primary CTA → scoped find-a-home
   (`homesForSalePath(city)`, `app/cities/[slug]/page.tsx:481`; `viewAllHref` on the split,
   484-495); hero ghost CTA + KbSell → get-home-value (`/sell/valuation`,
   `app/cities/[slug]/page.tsx:482,558-565`; `app/communities/[slug]/page.tsx:899-908`); buyer
   contact CTA on communities (`app/communities/[slug]/page.tsx:881-885`) · — · visitor leaves
   this process into find-a-home / get-home-value / contact-a-broker · — · failure: plain exit
   (still measured, step 11) · any device.
10. **Capture backend (machine)** · system · `submitSearchAlertSignup`: honeypot
    (`app/actions/search-alert-capture.ts:41-44`) → fail-closed per-IP rate limit (50-67) →
    email validation (69-73) → filter normalization + narrowing-filter requirement (75-88) →
    `sendEvent` creates/dedupes the native lead → `canonicallyTagLead` (buyer/warm/idx-registration)
    → `createNativeTask` broker nudge (103-136) → **durable `upsertListingAlert` row** (142-143)
    → GA4 `fireLeadGenerated` mirror (146-153); client fires `alert_create` + stores a guest-watch
    residual for return visits (`components/site/kb/KbCommunityAlerts.client.tsx:66-81`) ·
    email+filters · listing_alerts + crm_people + crm_tasks rows · Supabase/CRM/GA4 · failure:
    CRM capture is best-effort but a failed persist surfaces an error (143).
11. **Measure** · system · `CityPageTracker` + `KbSectionTracker` section/interaction telemetry
    (`app/cities/[slug]/page.tsx:453-460`; every grain mounts `KbSectionTracker` with its
    pageType — e.g. `app/zip/[zip]/page.tsx:373`, `app/areas/[slug]/page.tsx:229`) · scroll +
    clicks · GA4 events · analytics · failure: silent (telemetry only).

## 6. Decision points

- **Slug canonicalization (community):** compound city-prefixed slug → 308 to the bare registry
  slug (`app/communities/[slug]/page.tsx:232-239`); wrong-MLS-city slug → redirect to the
  canonical city's slug (249-252). Subdivision marketing-area slugs → `permanentRedirect`
  (`app/subdivisions/[slug]/page.tsx:176-179`).
- **NO-404 vs strict grains:** subdivision renders if ANY of boundary/registry/listings resolves
  (`app/subdivisions/[slug]/page.tsx:235-239`); zip and neighborhood are strict-404
  (`app/zip/[zip]/page.tsx:160`; `app/cities/[slug]/[neighborhoodSlug]/page.tsx:114`).
- **Indexability floor:** a plat below the lifetime-sales floor renders but carries noindex
  (`app/subdivisions/[slug]/page.tsx:139-150`); out-of-set zips get noindex metadata
  (`app/zip/[zip]/page.tsx:141-148`); a missing public area gets noindex metadata
  (`app/areas/[slug]/page.tsx:109-116`).
- **Count-source selection (§0):** resort → alias-aware count; else reliable boundary pins; else
  resolved tiles; else pulse; else snapshot; else null — with the median forced to pair with the
  same population (`app/communities/[slug]/page.tsx:393-431`, pairing rule comment 410-415).
- **Boundary trust:** baseline-flagged polygons never draw and never drive counts
  (`app/communities/[slug]/page.tsx:155-162,345-359`); plat-union boundary always draws when
  present (518).
- **Chart scope honesty:** sparse local series → parent-city series, relabeled
  (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:340-341`; `app/communities/[slug]/page.tsx:579-586`).
- **Voice/compliance gates:** banned-cliché guard on DB SEO descriptions
  (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:124-132`); ODS/IDX attribution via
  `MarketSources` on every stat-bearing grain (`app/cities/[slug]/page.tsx:589-591`,
  `app/zip/[zip]/page.tsx:474`); Census cited only when a population figure actually renders
  (`app/cities/[slug]/page.tsx:587-591`); STR note carries no invented rules or income figures
  (`app/communities/[slug]/page.tsx:909-926`); active-status-only tile pulls keep pre-marketing
  listings off these pages (every fetch passes `status: 'active'`, e.g.
  `app/cities/[slug]/page.tsx:193`).
- **Capture gate:** an alert must carry at least one narrowing filter or it is refused
  (`app/actions/search-alert-capture.ts:86-88`); honeypot pretends success (41-44); rate limit
  fails closed in production (50-67).
- **Private-area gate:** `/areas/[slug]` resolves `is_public=true` rows only
  (`app/areas/[slug]/page.tsx:12-14` docblock, 130).

## 7. Completion

**Done-when (observable, descending strength):**

1. **Place-scoped alert captured** — a durable `listing_alerts` row + `crm_people` id + broker
   `crm_tasks` row exist for this visitor's email with this place's filters
   (`app/actions/search-alert-capture.ts:103-143`); client confirms with the "Set. Watch your
   inbox." state (`components/site/kb/KbCommunityAlerts.client.tsx:88-106`).
2. **Hand-off into find-a-home** — click-through on the scoped inventory CTA
   (`app/cities/[slug]/page.tsx:481,484-495` and per-grain equivalents).
3. **Hand-off into get-home-value / plan-a-sale** — `/sell/valuation` ghost CTA or KbSell
   address capture (`app/cities/[slug]/page.tsx:482,558-565`).
4. **Informed exit** — visitor leaves knowing the place's live truth; section-depth telemetry is
   the only artifact (`app/cities/[slug]/page.tsx:453-460`).

**Artifacts at completion:** listing_alerts row (with filtersHash + name), crm_people +
canonical tags, crm_tasks near-due reminder, GA4 `alert_create`/`lead_generated` events,
guest-watch residual in the browser.

**Terminal states:** captured (1), handed off (2/3), exited (4), refused (bot/rate-limit/
no-narrowing-filter), 404/redirected (bad slug).

## 8. Time & performance

- **Time-to-answer budget:** the place question must be answered in the hero — count, median,
  days — on first paint. Every data read is individually time-boxed (2.5s content reads up to
  9s for the multi-city resort SFR pull, `app/communities/[slug]/page.tsx:294-301`); a slow read
  degrades to a suppressed figure, never a blocked render and never a fake zero
  (`app/cities/[slug]/page.tsx:213-214`).
- **Render economics:** detail grains are ISR revalidate 60 (`app/cities/[slug]/page.tsx:118`),
  areas 300 (`app/areas/[slug]/page.tsx:47`), indices 1800 (`app/cities/page.tsx:50`), so warm
  hits are static-fast; the worst case is a cold render whose ceiling is the sum of the longest
  parallel timeout group (~9s server-side on a resort community).
- **"Slow" means:** a cold mobile visitor from search watching a hero with suppressed figures —
  the §0-correct but experience-poor degraded state. Who sees it: long-tail dynamicParams slugs
  outside the SSG seed lists (`app/cities/[slug]/page.tsx:112-117`,
  `app/communities/[slug]/page.tsx:126-131`) on a cache-cold region.
- **Core Web Vitals reality:** field CWV for these entry routes was **not measured this
  session** — no number is stated (§0). Listed as a gap; P8 litmus timing and the growth-loop
  CWV ingest are the mechanisms that will produce real figures.

## 9. Variants

One process, grain variants sharing the same skeleton (hero-answer → inventory proof → capture →
depth → ladder → convert):

- **City** — fullest stack, only grain with hero video option + neighborhoods ledger
  (`app/cities/[slug]/page.tsx:218-221,531-537`).
- **Neighborhood** — boundary-driven counts, peer-neighborhood + lifestyle sections
  (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:218-227,507-522`).
- **Community/resort** — alias-aware counts, richContent overview, schools, STR note, buyer CTA
  (`app/communities/[slug]/page.tsx:393-431,770-775,859,881-926`).
- **Subdivision/plat** — NO-404 resolution, sales history + assigned schools, no market HUD
  (too thin to be honest at plat grain, header rationale `app/subdivisions/[slug]/page.tsx:4-9`).
- **ZIP** — all stats derived live from one tile fetch; no cached market rows exist at this
  grain (`app/zip/[zip]/page.tsx:183-206,248-276`).
- **Drawn area** — broker-authored shape, exact PostGIS search parity with the map tool, no
  market stats by design (`app/areas/[slug]/page.tsx:14-20,137-149`).
- **Indices** (`/cities`, `/communities`, `/area-guides`) — chooser variants: region pulse +
  editorial rows + regional alert band (`app/cities/page.tsx:113-200,564`).

Channel variants (organic vs internal vs direct) do not diverge in path — same page, same
completion set. No split warranted.

## 10. Current implementation map

- **Routes:** the nine in §2. All render the **kb register** (one of the five design languages;
  register facts here are behavior evidence, not design input): every grain imports
  `components/site/kb/*` + `kb.css`, with `components/site/explore/*` composites on top
  (`PlaceMapListSplit` at `app/cities/[slug]/page.tsx:80`, `PlaceInventoryMap` at
  `app/communities/[slug]/page.tsx:93`). Indices hand-roll KB-styled sections inline
  (`app/cities/page.tsx:294-345`).
- **Actions/API/crons:** `submitSearchAlertSignup` server action
  (`app/actions/search-alert-capture.ts:35`); hourly `saved-search-alerts` cron consumes the rows
  (`vercel.json:213-215`); reads go through `@/lib/data` DAL + `app/actions/{cities,communities,
  open-houses,activity-feed}` (`app/cities/[slug]/page.tsx:26-44`).
- **Known defects (evidence, not verdicts):**
  1. **Duplicate community URL fact:** the same physical resort is reachable at both the
     city-prefixed index slug and the bare registry slug; the city page dedupes its two
     community ledgers by NAME because hrefs never match
     (`app/cities/[slug]/page.tsx:368-375`). The detail page now 308s compound slugs to the bare
     slug (`app/communities/[slug]/page.tsx:232-239`), so the index-side link generation is the
     surviving half of the split-brain.
  2. **ZIP subdivision doors leave the graph:** the "Neighborhoods in this ZIP" cards link to
     `/search?keywords={name}` instead of place nodes (`app/zip/[zip]/page.tsx:286-295`) — a
     ladder edge that dumps into keyword search.
  3. **Other-ZIP cards fabricate a rendering-only zero:** `activeCount: 0` hardcoded on the
     cross-ZIP ledger items (`app/zip/[zip]/page.tsx:298-306`).
  4. **/areas is an empty family in practice:** `generateStaticParams` returns `[]` and the
     route depends entirely on broker-created public areas existing
     (`app/areas/[slug]/page.tsx:49-51`); no index page links into it and it is absent from the
     Areas nav (`lib/site-nav.ts:111-131`). Live row count not queried this session (gap).
  5. **Sub-index-floor plats render thin:** below the lifetime-sales floor a plat page still
     renders (noindex) with possibly nothing but a hero + empty state
     (`app/subdivisions/[slug]/page.tsx:139-150,528-539`).
  6. **Ladder assembly is duplicated per grain:** `resolvePlaceContext` exists as the one ladder
     builder (`lib/data/geo/resolvePlaceContext.ts:88-207`) but the place pages each hand-build
     their own parent/peer links (§2 channel 2 list) — drift risk, and the exact class of
     shape-duplication P5 exists to collapse.
- **Duplicate/parallel paths that should die (P3/P5 input):** the community index-slug vs
  registry-slug split (defect 1); `/area-guides` vs `/cities` + `/communities` — three chooser
  surfaces whose content is two ledgers each (`app/area-guides/page.tsx:58-86` vs
  `app/cities/page.tsx` vs `app/communities/page.tsx`); zip "neighborhood" doors bypassing the
  subdivision grain (defect 2).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** It is pillar 2 of the north star and the trust-front-door for
pillar 3 (market knowledge is always place-scoped here). No competitor in the market renders
live per-place truth at six grains; this is defensible ground.

**Ideal shape (derived from the job, not today's routes):** ONE place-node experience per
grain of the geography ladder, where the grain is a parameter, not nine separately-authored
pages. The visitor's question is identical at every grain ("what's here, what does it cost, how
fast, what's it like, what's nearby") — the target is one place-node contract with grain-scaled
depth: coarse grains add choosers, fine grains add plat history and schools, and every grain
carries the same four moves (answer → proof → capture → ladder). Step count for the visitor:
answer in 1 viewport, capture offered by viewport 3, a ladder move always ≤1 tap. Mobile 390 is
the truth device. Continuity (decisions.md 2026-08-11 §5): the place context a visitor
establishes must follow them across nodes instead of resetting per page — today each page
rebuilds context from its own slug and nothing persists but a guest-watch residual
(`components/site/kb/KbCommunityAlerts.client.tsx:70-78`).

**Data gaps blocking correctness (✗ statements, not designs):**

- ✗ No neighborhood rows in `market_pulse_live` (worked around per page,
  `app/cities/[slug]/page.tsx:176-181`); ✗ no ZIP-grain cache rows at all
  (`app/zip/[zip]/page.tsx:248-268`) — two grains answer "how fast" with weaker or
  city-relabeled figures.
- ✗ No per-sub-neighborhood counts in the registry (ledger deliberately omitted,
  `app/communities/[slug]/page.tsx:528-531`).
- ✗ Community boundary quality is a baseline of known-bad polygons rather than corrected
  geometry (`app/communities/[slug]/page.tsx:155-162`).
- ✗ GA4 device/segment split and field CWV per grain unqueried this session (§3, §8).

**Destination implication:** this process implies ONE "Places" destination in the P5 IA — an
exploration surface whose nodes are the grains — rather than the current three parallel index
pages plus six separately-shaped detail families. The duplicate community-slug family collapses
to one canonical URL space (GSC evidence required before any cut/rename, per the SEO carve-out).
`/areas/[slug]` folds in only if P4/P5 finds real usage; otherwise it is a cut candidate with a
301 plan.

**Dual objective stamped on this process's pages:**

- `visitor_objective`: "Decide whether {place} fits — see what's for sale, what it costs, how
  fast it moves, and what's around it, live."
- `machine_objective`: "Capture a place-scoped listing alert (email → listing_alerts +
  crm_people), or hand the visitor into find-a-home / get-home-value with the place context
  attached."
- `exits`: scoped find-a-home (`/homes-for-sale/{city}[...]`), get-home-value
  (`/sell/valuation`, `/sell#get-value`), ladder edges (parent/child/peer place nodes),
  place-scoped open houses (`/open-houses/{city}`), market knowledge (`/housing-market`),
  contact-a-broker (community grain).

## 12. Acceptance checks

Persist; never delete. Run against production (`https://ryan-realty.com`) unless noted.

1. **Every grain answers with 200 + Place JSON-LD:**
   ```bash
   for u in /cities/bend /cities/bend/awbrey-butte /communities/tetherow \
            /subdivisions/sunrise-village /zip/97703 /area-guides /cities /communities; do
     echo "== $u"; curl -s "https://ryan-realty.com$u" | grep -c 'application/ld+json'
   done   # every count ≥ 1; any 0 or non-200 fails
   ```
2. **Canonicalization:** `curl -sI https://ryan-realty.com/communities/bend-tetherow | head -3`
   → 308/301 with `location: /communities/tetherow` (`app/communities/[slug]/page.tsx:232-239`).
3. **Strict grains 404:** `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/zip/00000`
   → 404 (`app/zip/[zip]/page.tsx:160`).
4. **Indexability floor:** pick a slug NOT in the indexable set (compare against
   `getIndexableSubdivisions`, `app/sitemap.ts:396`) and confirm
   `curl -s https://ryan-realty.com/subdivisions/<thin-slug> | grep -i 'noindex'` hits, while an
   indexable slug does not.
5. **§0 no-fake-zero:** on any grain page HTML, a degraded state must show no `"0 homes for
   sale"` hero: `curl -s https://ryan-realty.com/cities/bend | grep -c '0 homes for sale'` → 0.
6. **Capture E2E (SQL, run after a test signup with a tagged address like
   `p2-accept+{date}@ryan-realty.com` through the KbCommunityAlerts form on /cities/bend):**
   ```sql
   select email, name, filters->>'city' as city, fub_person_id, created_at
   from listing_alerts where email like 'p2-accept+%' order by created_at desc limit 1;
   -- row exists, city='Bend', fub_person_id not null ⇒ crm_people capture succeeded
   ```
7. **Alert cron wired:** `grep -A1 'saved-search-alerts' vercel.json` → schedule `0 * * * *`
   (`vercel.json:213-215`).
8. **Sitemap emission per grain:**
   ```bash
   curl -s https://ryan-realty.com/sitemap.xml | grep -oE '/(cities|communities|subdivisions|zip)/[a-z0-9-]+' | sort | uniq -c | sort -rn | head
   # must include /cities/bend, /communities/tetherow, /zip/97701; must NOT include any
   # /communities/{city}-{resort} compound slug (app/sitemap.ts:342-349)
   ```
9. **Nav reachability:** `node scripts/check-nav-reachability.mjs` green (the gate named at
   `lib/site-nav.ts:15` — Areas group must reach every grain index).
10. **Ladder integrity (timed, real phone, P8 feeds this):** from /cities/bend, reach a
    neighborhood, a community, and a subdivision node each in ≤2 taps; from each, one tap back
    up. Record the timings; a timing not measured is not a timing.
11. **Boundary honesty:** `curl -s https://ryan-realty.com/communities/broken-top` must not draw
    the oversized stored polygon (verify in browser: no 11k-acre overlay; plat-union or pins
    only — `app/communities/[slug]/page.tsx:509-524`).
12. **Gates:** `npm run ci:gates` green (design tokens, brand voice, page-DAL, SEO routes, G54
    all cover these routes).
