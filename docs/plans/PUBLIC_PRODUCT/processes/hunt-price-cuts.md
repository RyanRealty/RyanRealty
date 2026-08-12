# Process: hunt-price-cuts — hunt price-cut / motivated-seller listings

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (SEO + nav traffic 24/7; the underlying price-signal sync runs every
  15 minutes, the page refreshes on a 600s ISR/cache ladder)
- Verdict: **PROPOSAL — MERGE→find-a-home.** This is a deal-hunting *lens* over the same live
  inventory find-a-home owns, not a distinct visitor process: identical actor (buyer), identical
  inventory (active SFR through the DAL), and an empty completion set of its own — every
  completion is another process's inception (listing-detail click-through → find-a-home step 7;
  closing CTA → contact-a-broker). find-a-home's PDS already carries the sibling lens
  `/price-drops` as a curated intent; today the same visitor job is implemented twice with zero
  cross-links. The 11 URLs carry SEO equity (sitemap'd daily, buyer-query metadata) — a merge
  keeps or 301s them per the P5 GSC carve-out; the score heuristic survives as the lens's
  ranking. Proposal only; the verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A deal-hunting buyer finds the active Central Oregon homes whose sellers are signaling on
price — documented MLS price cuts, motivation language in the remarks, long days on market —
ranked by signal strength instead of buried in the full search, with the scoring method stated
on the page. (b) The machine outcome is proven bargain-intent routed into a buyer-intent step —
a listing-detail inspection (where find-a-home's tour/alert/save captures live) or a broker
conversation about whether the cut lands near the comps — produced because a visitor who just
browsed a ranked list of cuts has self-identified as offer-ready, and "put the cut next to the
comps" is that visitor's natural next question.

## 2. Inception (what starts it)

Trigger: a visitor lands on the pillar or a per-city page. Preconditions: none — fully
anonymous, fully static (ISR 600s, `app/motivated-sellers/page.tsx:53`;
`app/motivated-sellers/[city]/page.tsx:53`). Exactly 10 city pages exist:
`generateStaticParams` over `SITE_CITY_SLUGS` with `dynamicParams = false`
(`app/motivated-sellers/[city]/page.tsx:54-58`; the slug list — bend, redmond, sisters,
sunriver, la-pine, madras, prineville, culver, terrebonne, powell-butte — at
`lib/central-oregon.ts:28-31`). Any other slug 404s (`notFound()` guards at
`app/motivated-sellers/[city]/page.tsx:142,163`).

| Channel | Entry | Evidence (opened this run) |
|---|---|---|
| Organic search | `/motivated-sellers` — metadata targets buyer queries ("motivated seller homes Central Oregon", "price reduced homes Oregon", "price cut homes Bend") | `app/motivated-sellers/page.tsx:58-73` |
| Organic search (city) | `/motivated-sellers/[city]` — "Price-cut and motivated seller homes in {City}, Oregon" + per-city keyword set | `app/motivated-sellers/[city]/page.tsx:140-157` |
| SEO index | Pillar + all 10 city URLs in the sitemap, `changeFrequency: 'daily'`, priority 0.8 / 0.75 | `app/sitemap.ts:238-252` |
| Internal nav | The **Sell** menu, labeled "Sell on a deadline" — in all three nav projections | `lib/site-nav.ts:156,242,315` |
| Internal search | Site-search page index entry "Sell on a deadline", keywords deadline/fast/relocation | `lib/search/site-pages.ts:28` |
| Internal (cross-page) | City filter chips on the pillar → city pages; sibling-city chips city → city | `app/motivated-sellers/page.tsx:254-301`; `[city]/page.tsx:303-335` |

Inception is telemetered: `TrackSearchView` fires `search_view` + `view_search_results` once per
mount with the results count (`components/tracking/TrackSearchView.tsx:13-24`; mounted at
`app/motivated-sellers/page.tsx:174`, `[city]/page.tsx:202`), and `KbSectionTracker`
(`pageType="motivated-sellers"` / `"motivated-sellers-city"`, mounted `page.tsx:173`,
`[city]/page.tsx:201`) records per-section views + scroll depth to GA4 AND the internal
`/api/visitors/track` store (`components/site/kb/KbSectionTracker.client.tsx:7-40`).

## 3. Actors

- **Buyer / deal-hunter** — the page's addressee throughout: "Before you write an offer",
  "A broker can set the new ask next to recent closed sales and tell you whether it still sits
  high" (`app/motivated-sellers/page.tsx:355-370`; `[city]/page.tsx:338-353`). Investors are
  the same segment here — the page draws no distinction.
- **Seller (mis-routed)** — the nav label "Sell on a deadline" (`lib/site-nav.ts:156`) and the
  site-search keywords "deadline/fast/relocation" (`lib/search/site-pages.ts:28`) send
  *sellers* to this buyer surface; the P1 mismatch note is confirmed by the page copy above.
  A seller who clicks it gets a page teaching other people how to buy their price-cut home.
- **Device reality:** mobile 390 is Matt-locked product truth (`decisions.md` 2026-08-11). A
  GA4 device split for these routes was NOT queried this session and is not stated (§0);
  pulling it is a P4/P8 gap item.
- **Automated actors:** the `sync-delta` cron every 15 minutes (`3,18,33,48 * * * *`,
  `vercel.json:225-227`) maintains the price signals — a price change writes a
  `price_history` row with `change_pct` plus a `price_drop`/`price_increase` activity event
  (`lib/sync/deltaSync.ts:177,309`); the Tier-3 `price_drop_count` column is attributed to the
  delta sync by its column comment (migration
  `supabase/migrations/20260414220000_listing_metrics_98_columns.sql:148,292`;
  `docs/DATABASE_FOR_AI_AGENTS.md:463`). The exact incrementer statement was not located this
  run — recorded in Gaps, not asserted. ISR + the DAL cache (both 600s) re-rank on read.
- **Accountable for completion:** the visitor self-serves the whole path; a broker enters only
  after the `/contact` or `tel:` exit (that follow-up is contact-a-broker's process).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Inventory + signals | Supabase `listings` read **directly** — deliberately NOT `listing_tile_mv`, which does not project `OriginalListPrice`, `largest_price_drop_pct`, or `public_remarks` | `lib/data/listings/getMotivatedListings.ts:15-17,354-356` |
| Price-cut signals | Tier-3 computed columns on `listings`: `price_drop_count`, `largest_price_drop_pct` (computed from `price_history`), plus `OriginalListPrice` vs `ListPrice` and `public_remarks` | migration `20260414220000_listing_metrics_98_columns.sql:148,292`; `docs/DATABASE_FOR_AI_AGENTS.md:463`; `getMotivatedListings.ts:134-146` |
| The motivation score | **No SoR — derived at read time.** `scoreListing` computes 0–100 in memory per fetch (reduction% ≤40 pts, cut count ≤25, remarks lexicon ≤20, DOM ≤15) and is never persisted | `getMotivatedListings.ts:150-225` |
| Behavioral trail | GA4 events + the internal first-party store via `/api/visitors/track` | `components/site/kb/KbSectionTracker.client.tsx:7-27`; `components/tracking/TrackSearchView.tsx:13-24` |
| **NOT a SoR** | The rendered rank order (a 600s cache artifact of a derived score); the "N homes on this list" headline (same); the reason badges (derived `reasons[]` strings) | `getMotivatedListings.ts:420-439` (cache), `:171-225` (derivation) |

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives on the pillar or a city page (§2) · URL · static HTML with the
   ranked grid already rendered; `search_view` fires with the results count · Next ISR 600s +
   `getMotivatedListings` (`app/motivated-sellers/page.tsx:144-147`;
   `[city]/page.tsx:167-172`) · failure: DAL throws on DB error (no poison-null caching,
   `getMotivatedListings.ts:380-382`), `makeResilientCached` retries once uncached then returns
   the empty fallback (`:430-438`), and the page's `.catch` maps any residual failure to the
   same empty state as true zero (`page.tsx:144-147`) — see defect 5 · mobile + desktop.
2. **Read the method** · visitor · reads "What gets a home on this page" — the four score
   inputs (price cuts / total drop / remarks / DOM) and the weighting order are stated in the
   page copy, matching the DAL's actual weights · page scroll · trust in the ranking ·
   `page.tsx:200-252` (pillar, with the score-inputs `<dl>`); `[city]/page.tsx:227-250` ·
   failure: none (static copy) · both.
3. **Scope by city** (optional) · visitor · picks a city chip on the pillar
   (`page.tsx:254-301`), hops sibling cities (`[city]/page.tsx:303-335`), or widens back via
   "View all Central Oregon" (`[city]/page.tsx:273-278,293-295`) · click · navigation within
   the 11-page family · static links · failure: none · both.
4. **Fetch + rank** (system, inside steps 1/3) · DAL · queries `listings` with: status in
   `PUBLIC_ACTIVE_STATUSES` (Active + Active Under Contract — Coming Soon structurally absent,
   `lib/listing-status-public.ts:29-35`), `PropertyType='A'` SFR, IDX opt-outs excluded
   (`permit_internet_yn` / `idx_participant` not false), photo required, beds ≥1, city `ilike`
   OR the `SERVICE_AREA_CITIES_PROPER` allowlist region-wide, and at least one signal
   (`price_drop_count > 0` OR non-null remarks); overfetches 500, scores in memory, drops
   score-0 rows, sorts desc, paginates 48 · query input · `{ listings, total }` ·
   `getMotivatedListings.ts:342-411` · failure: throw → resilient retry → fallback (step 1) ·
   n/a — server.
5. **Scan the ranked grid** · visitor · reads tiles: photo, top reason as a badge
   (`reasons[0]` — "Reduced $X" / "N price cuts" / "Seller motivated" / "N days on market"),
   full price via `kbMoneyFull`, address, city · postal · subdivision, beds/baths · rendered
   grid · candidate homes chosen · `page.tsx:95-139` (MotivatedTile), `:327-345` (grid + count
   headline); `[city]/page.tsx:90-134,254-300` · failure: honest empty state (step 8) · both.
6. **Complete — path A, inspect a listing** · visitor · clicks a tile; `listingDetailPath`
   builds the pretty listing URL from key + address + geo + MLS number · click ·
   navigation to `/listing/*` — the hand-off into find-a-home's step 7, where every capture
   (tour CTA, like-this alerts, save) lives · `page.tsx:98-113`; `[city]/page.tsx:93-108`;
   `lib/slug` import at `page.tsx:38` · failure: tiles with no key render nothing
   (`page.tsx:96-97`) · both.
7. **Complete — path B, broker contact** · visitor · closing CTA "Put the cut next to the
   comps" → `/contact` (contact-a-broker's inception) or `tel:` to the direct line · click ·
   contact-form navigation or a phone call · `page.tsx:355-382`; `[city]/page.tsx:338-368`;
   `CONTACT.phoneDirectTel` from `lib/brand/contact` (`page.tsx:41`) · failure: none on this
   side of the boundary · both (tel: is mobile-shaped).
8. **Empty-state exit** · visitor · zero-result branch renders "No listings currently match…
   The MLS updates throughout the day" with a real exit: pillar → `/homes-for-sale`
   (`page.tsx:333-344`), city → the pillar (`[city]/page.tsx:286-297`) · n/a · re-entry into
   find-a-home · failure: this state is also what a swallowed DB failure renders (defect 5) ·
   both.

## 6. Decision points

- **Region vs city scope**: city pages pass the display-case name to `ilike`; the region-wide
  pillar scopes to the Central Oregon service-area allowlist because the MLS feed is statewide
  (`getMotivatedListings.ts:366-373`).
- **Signal gate, then score gate**: the query requires at least one raw signal
  (`:376-378`), and scoring then drops anything that still nets 0 points (`:393-399`) — a
  listing appears here only with a demonstrable, §0-traceable reason.
- **Compliance gates in-query** (all mechanical, all in the DAL): no public Coming Soon
  (`PUBLIC_ACTIVE_STATUSES`, `lib/listing-status-public.ts:32-35`, gate-enforced per its
  header `:18-21`); ODS/IDX opt-outs excluded (`permit_internet_yn` / `idx_participant`,
  `getMotivatedListings.ts:359-361`); SFR-only `PropertyType='A'` (`:358`); photo required
  (`:362`); land parcels excluded via beds ≥1 (`:363`).
- **Unknown city → 404**: `dynamicParams = false` + `notFound()` in both `generateMetadata`
  and the page body (`[city]/page.tsx:54,142,163`) — no thin auto-generated geo pages.
- **Populated vs empty grid**: count-aware headline and lede vs the honest empty state
  (`page.tsx:312-345`; `[city]/page.tsx:194-197,259-297`).
- **Failure vs true zero**: NOT distinguished — the resilient fallback and the page `.catch`
  both produce the true-zero UI (`getMotivatedListings.ts:430-438`; `page.tsx:144-147`).
  Contrast `/homes-for-sale`, which renders a distinct degraded state. Recorded as defect 5.
- **Voice/§0 in copy**: every number on the page is either a live count of the rendered array
  (`listings.length`, `page.tsx:314`) or a per-listing MLS-derived figure (price, reduction,
  DOM) — the illustrative "two price cuts totaling 8 percent" sentence (`page.tsx:218-222`)
  describes the scoring rule, not a market stat. The freshness claim is the exception —
  defect 4.

## 7. Completion

Done when ONE observable exit occurs:

1. **Listing-detail click-through** — navigation to `/listing/*` via a tile
   (`page.tsx:98-113`); observable as a `view_listing` event on the destination (find-a-home's
   telemetry) following a `search_view` on this page.
2. **Broker contact started** — navigation to `/contact` or a `tel:` tap from the closing CTA
   (`page.tsx:371-381`); the resulting `crm_people` row is contact-a-broker's artifact.

Artifacts at completion: **none owned by this process** — no form, no capture, no durable row
is written from these pages (verified across both full files this run; the only POST is
best-effort telemetry). The behavioral trail (search_view with results count, section views,
scroll depth) is the sole trace. Terminal states: **handed-off** (path A or B), **abandoned**
(telemetry only), **empty-exit** (zero-state link followed back into find-a-home). A process
whose every completion is another process's inception is the structural core of the MERGE
proposal (§0 verdict).

## 8. Time & performance

- **Time-to-answer budget**: answered at first paint — both pages are statically generated
  (ISR 600s, `page.tsx:53`; `[city]/page.tsx:53`, `dynamicParams=false`), so the ranked grid,
  count headline, and reasons arrive in the initial HTML with zero client-fetch waterfall.
  "Slow" on this surface means *stale*, not laggy.
- **Freshness ladder (what "stale" means)**: a new MLS price cut crosses three layers —
  `sync-delta` every 15 min (`vercel.json:225-227`) → DAL cache 600s
  (`getMotivatedListings.ts:434-437`) → page ISR 600s (`page.tsx:53`). Worst-case, a fresh cut
  appears on the page ~35 minutes after it hits the MLS. The on-page copy claims "The score
  recalculates every 10 minutes" / "The list refreshes every 10 minutes" (`page.tsx:219-221`;
  `[city]/page.tsx:244-247`) — it names only the cache layer and understates the end-to-end
  worst case (defect 4).
- **Failure budget**: one uncached retry then fallback (`getMotivatedListings.ts:430-438`);
  no per-arm timeouts needed — a single DAL call feeds the page.
- **Core Web Vitals reality**: NOT measured this session — no CWV number is stated (§0).
  Static generation + `loading="lazy"` grid images (`page.tsx:117`) are the code-level posture;
  field CWV for `/motivated-sellers*` is a P8 litmus input alongside find-a-home's.

## 9. Variants

- **Pillar vs 10 city pages** — one path, one completion set; the city variant adds the
  sibling-chip hop and swaps the empty-state exit target (pillar → `/homes-for-sale`, city →
  pillar). Not a split.
- **Parallel implementation, not a variant**: the `/price-drops` + `/price-drops/[city]`
  family serves the same visitor job with a different metric window — a 7-day price-drop radar
  (`app/price-drops/page.tsx:2`, ISR 1800 `:65`, per-city `app/price-drops/[city]/`) vs this
  page's cumulative motivation score, on different DAL functions (`getPriceDropTiles` vs
  `getMotivatedListings`). Zero cross-links exist in either direction (grep both directories
  this run: no `/price-drops` in `app/motivated-sellers/`, no `/motivated-sellers` in
  `app/price-drops/`). Two implementations of one job is evidence for the merge, and
  find-a-home's PDS already claims `/price-drops` as its curated lens.
- No channel variant diverges: organic, nav, and internal entries all land on the same static
  pages.

## 10. Current implementation map

- **Routes**: `/motivated-sellers` + `/motivated-sellers/[city]` ×10 (`lib/central-oregon.ts:28-31`);
  all 11 in the sitemap daily (`app/sitemap.ts:238-252`); KB chrome route match
  (`lib/site/chrome-routes.ts:38`).
- **Nav**: Sell menu "Sell on a deadline" in all three projections (`lib/site-nav.ts:156,242,315`);
  site-search index entry with the same seller framing (`lib/search/site-pages.ts:28`).
- **Design register (of the 4 surviving languages)**: **kb** throughout — `SmoothScrollProvider`,
  `KbBreadcrumb`, `KbHero`, `KbFooter`, `KbSectionTracker`, `kb.css`, KB poster-grid tiles
  (`page.tsx:42-49,90-139`).
- **Data**: `getMotivatedListings` only (`page.tsx:35,144`; `[city]/page.tsx:35,167`;
  DAL indexed at `docs/DAL_INDEX.md:2359-2361`).
- **Known defects / parallel paths that should die (P3/P5 input)**:
  1. **Nav mislabel** — a seller-framed label ("Sell on a deadline") and seller keywords
     (deadline/fast/relocation) route sellers to a buyer surface (`lib/site-nav.ts:156,242,315`;
     `lib/search/site-pages.ts:28` vs the buyer copy at `page.tsx:355-370`). Whatever P3
     decides about the process, the label is wrong today; the seller-on-a-deadline *job*
     belongs to plan-a-sale and has no surface.
  2. **Duplicate job implementation** — the `/price-drops` family (§9), unlinked in both
     directions. One deal-signals lens should absorb the other.
  3. **Orphan component** — `components/site/MotivatedListings.tsx` (legacy-flat register:
     `ListingCard`, `primitives` imports, `MotivatedListings.tsx:5-6`) has ZERO imports
     anywhere (repo-wide grep this run matched only the DAL's own exports) — dead code from
     the pre-KB version of this surface.
  4. **Freshness copy overstates** — "every 10 minutes" (`page.tsx:219-221`;
     `[city]/page.tsx:244-247`) names one layer of a ~35-minute worst-case ladder (§8). A
     stated freshness number whose basis is one of three layers is a §0-adjacent defect.
  5. **Failure renders as true zero** — the resilient fallback plus the page `.catch`
     (`getMotivatedListings.ts:430-438`; `page.tsx:144-147`) make a DB outage
     indistinguishable from "no motivated listings right now" (the swallowed-errors failure
     mode; `/homes-for-sale` solved it with a degraded flag, this page did not).
  6. **All-null hero stat band** — both heroes pass
     `{ activeCount: null, medianListPrice: null, medianDaysToPending: null }`
     (`page.tsx:188`; `[city]/page.tsx:217`) — a stat component mounted to render nothing,
     same defect find-a-home logged on `/activity`.
  7. **No capture** — the natural machine artifact for this audience (a price-cut alert:
     "tell me when a home in {city} gets cut") does not exist here, while the sibling search
     surfaces carry `SearchAlertCapture`. The page proves offer-intent and then captures none
     of it.
  8. **Place names are not doors** — city names appear in heroes, eyebrows, and tile meta but
     never link to the city's place node (zero `/cities/*` hrefs in either file, grep this
     run) — violates the "every place name is a door" north-star rule.

## 11. Target shape (process-level, not pixels)

**Should this exist? The job yes, the standalone process no.** Deal-hunting over
price-softened inventory is a real, high-intent buyer job (the metadata's query targets and
the nav's three projections show the site already believes it). But the job is a *lens* over
find-a-home's inventory with find-a-home's completion set — target shape derives from that
job, not from today's two parallel route families:

- **One deal-signals lens inside the browse system** — one ranking that unifies the cumulative
  motivation score and the 7-day drop radar (today's two half-metrics), scoped by the same
  place context as every other lens. Ideal step count: 2 — scope (region/city, carried from
  whatever place context the visitor already established per binding continuity decision #5) →
  inspect/commit. The transparency copy (how the ranking works) survives — it is the lens's
  trust device.
- **Capture belongs in the lens**: the price-cut alert (defect 7) turns the lens into a
  machine-artifact producer — the highest-leverage single change, since this audience has
  already self-selected for offer-readiness.
- **The seller job gets rerouted, not lost**: "Sell on a deadline" (nav + search index) should
  point at plan-a-sale's answer for urgency-sellers; the P5 IA must not let the label die
  silently with the merge.
- **SEO carve-out**: the 11 URLs are indexed, sitemap'd daily at 0.8/0.75, with buyer-query
  metadata. GSC evidence per URL is mandatory before P5 folds or renames anything; folded
  routes 301 into the lens's canonical URL.
- **Data gaps blocking correctness**: GSC impressions/clicks for the 11 URLs (not pulled this
  session); GA4 device split and per-surface conversion (does this page's click-through
  convert downstream better than `/price-drops`? — needed to pick the surviving metric);
  the exact `price_drop_count` writer (attributed to delta sync by column comment only,
  §3) — confirm before the merged lens leans on it.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Find the active homes where the seller is signaling on price, and
  judge whether any cut makes the home worth an offer."
- `machine_objective`: "Convert proven bargain-intent into a durable buyer artifact — a
  price-cut alert with an email, or a listing inspected into a tour/save — at the moment the
  ranked list proves the intent."
- `exits`: listing detail (→ find-a-home step 7, where capture lives) · `/contact` + `tel:`
  (→ contact-a-broker) · `/homes-for-sale` (→ find-a-home full search, today's empty-state
  exit) · city place node (→ evaluate-a-place — required by the doors rule, missing today,
  defect 8) · market context for "how soft is {city} right now"
  (→ explore-market-knowledge — the obvious trust edge for a price-cut page, absent today).

**Destination implication (proposal, not a lock):** no standalone destination. This process
folds into the find-a-home browse destination as its deal-signals lens; `/price-drops` and
`/motivated-sellers` become one surface there (which URL survives is a P5 GSC-evidence call;
the loser 301s). The seller-framed nav entry re-homes to the plan-a-sale destination.

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Entry + canonical**:
   `curl -s https://ryan-realty.com/motivated-sellers | grep -o '<link rel="canonical"[^>]*>'`
   → canonical `/motivated-sellers` (contract at `app/motivated-sellers/page.tsx:58-64` via
   `pageMetadata`). Same per city:
   `curl -s https://ryan-realty.com/motivated-sellers/bend | grep -o '<link rel="canonical"[^>]*>'`
   → `/motivated-sellers/bend`.
2. **Static-params contract**:
   `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/motivated-sellers/tumalo`
   → 404 (`dynamicParams=false`, `[city]/page.tsx:54`; Tumalo is deliberately not an MLS
   city).
3. **Count honesty (self-consistency)**: on the rendered pillar, the "N homes on this list"
   headline equals the number of `.lst-card` tiles:
   `curl -s https://ryan-realty.com/motivated-sellers | grep -c 'class="lst-card"'` vs the
   headline number (`page.tsx:312-318` renders both from the same array).
4. **Every tile has a §0-traceable reason**: every rendered tile carries a `lst-badge`
   (score > 0 guarantees non-empty `reasons`, `getMotivatedListings.ts:171-225,396-399`);
   spot-check one badge's claim against the row:
   `select "ListPrice", "OriginalListPrice", price_drop_count, "DaysOnMarket" from listings where "ListNumber" = '<mls-from-tile>';`
   → the badge ("Reduced $X" / "N price cuts" / "N days on market") must be derivable from
   those columns.
5. **Compliance — IDX + status + type**: for the same MLS numbers scraped from the page:
   `select "ListNumber", "StandardStatus", "PropertyType", permit_internet_yn, idx_participant, "PhotoURL" from listings where "ListNumber" in (…);`
   → every row: status in ('Active','Active Under Contract'), `PropertyType='A'`, neither
   opt-out flag false, photo non-null (`getMotivatedListings.ts:357-363`). No 'Coming Soon'
   row can ever appear (`lib/listing-status-public.ts:32-35`).
6. **Click-through resolves (completion path A)**: take any tile `href` from the pillar HTML,
   `curl -s -o /dev/null -w '%{http_code}' "https://ryan-realty.com<href>"` → 200.
7. **Broker exit present (completion path B)**: pillar HTML contains `href="/contact"` and
   `href="tel:` inside the `#contact-cta` section (`page.tsx:355-382`).
8. **Inception telemetry**: load `/motivated-sellers` in a browser — `search_view` appears in
   GA4 DebugView/dataLayer with `resultsCount` (`components/tracking/TrackSearchView.tsx:13-24`),
   and scrolling fires `section_view` beacons to `/api/visitors/track`
   (`KbSectionTracker.client.tsx:7-27`).
9. **Freshness ladder wiring**: `grep -A1 '"path": "/api/cron/sync-delta"' vercel.json` →
   `"3,18,33,48 * * * *"`; `grep -n 'revalidate = 600' app/motivated-sellers/page.tsx
   app/motivated-sellers/\[city\]/page.tsx` → both hits;
   `grep -n 'revalidate: 600' lib/data/listings/getMotivatedListings.ts` → the DAL layer.
10. **Empty-state honesty**: visit the smallest-inventory city page (e.g.
    `/motivated-sellers/culver`); if zero rows, the page shows the "No listings in Culver
    currently match…" copy plus the working "View all Central Oregon" exit
    (`[city]/page.tsx:286-297`) — never fabricated tiles, never a fake count.
11. **Discoverability (until P5 changes it)**:
    `curl -s https://ryan-realty.com/sitemap.xml | grep -c 'motivated-sellers'` → 11;
    `grep -c "motivated-sellers" lib/site-nav.ts` → 3.
12. **Merge-prep regression guards**: `grep -rn "components/site/MotivatedListings" app
    components lib --include='*.tsx' --include='*.ts'` → still zero imports (defect 3 stays
    dead); `grep -rn "motivated-sellers" app/price-drops/` and
    `grep -rn "price-drops" app/motivated-sellers/` → still zero cross-links until the P5
    merge lands them as one surface.
