# Process: compare-homes — side-by-side home comparison (/compare)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a visitor-built shortlist triggers it; no cron owns any step.
  Upstream freshness: `sync-delta` every 15 min feeds `listings`, `refresh-mvs` hourly
  rebuilds `listing_tile_mv`, the DAL caches 60s)
- Verdict: **PROPOSAL — MERGE→find-a-home.** This is the shortlist-decision utility inside
  find-a-home's browse loop, not a distinct visitor process: every inception is a find-a-home
  surface (compare toggles on search tiles and listing detail, the global tray), the primary
  completion is a listing-detail click-through (find-a-home step 7, where every capture
  lives), and the process owns zero durable server writes — no CRM row, no account artifact,
  nothing but GA4 events and a client download. Its one genuinely distinct output — the
  shareable link/PDF for a co-decider — is an exit contract, not a process: find-a-home's own
  deepened PDS already demands exactly this disposition ("`/compare` either earns a place as
  an in-graph utility with an exit contract or dies",
  `docs/plans/PUBLIC_PRODUCT/processes/find-a-home.md:279-280`) and classifies `/compare` as
  "a mid-process tool, not an entry or completion" (`find-a-home.md:223-224`). No SEO equity
  blocks the merge (noindex + absent from the sitemap); the shared-link URL is the only
  external contract to preserve. Proposal only; the verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A buyer who has shortlisted two to four homes while browsing puts them side by side —
price, beds, baths, square feet, price per square foot, lot, year built, days on market,
location — with the best value in each row flagged, so the shortlist resolves into a decision
they can also hand to whoever is deciding with them (link or PDF). (b) The machine outcome is
an advanced find-a-home inspect→commit step: the winning home gets clicked through to its
listing detail page — where the tour/save/alert captures live — produced because a visitor
whose comparison just crowned a winner is one click from acting on that specific listing, and
the page's only listing-level exits point there.

## 2. Inception (what starts it)

Trigger: a visitor with a shortlist (or a shared link) opens `/compare?ids=...`.
Preconditions: none — fully anonymous; the shortlist lives in localStorage
(`ryan-realty-compare`, max 4, `contexts/ComparisonContext.tsx:5-6,52-57`).

| Channel | Entry | Evidence (opened this run) |
|---|---|---|
| Internal (primary) | Compare toggles build the shortlist: top-right toggle on every `ListingTile` (search grids, curated lenses; disabled at 4) and the Compare buttons on listing detail (desktop sticky bar + mobile) | `components/ListingTile.tsx:492-506`; `components/listing/ListingActions.tsx:155-167,187-188` |
| Internal (primary) | The fixed-bottom **ComparisonTray** appears on every public non-LP page once ≥1 item is shortlisted; "Compare Now" enables at ≥2 and links `/compare?ids=<joined>` | `components/comparison/ComparisonTray.tsx:13,15,69-81`; mounted in `components/layout/PublicClientLayer.tsx:34,65-67` (inside `HideOnLP`); provider mounted globally in `components/site/providers/RootProvider.tsx:27` via `app/layout.tsx:135` |
| Internal nav | "Compare homes" in all four nav projections: Buy menu, KB menu groups, KB footer, portal footer | `lib/site-nav.ts:105,199,275,339` |
| Internal (cross-page) | Resources hub card "Property comparison" | `app/resources/page.tsx:56-60` |
| Referral (shared link) | The Copy Link artifact makes the URL an entry channel — a co-decider opens `/compare?ids=...` in a fresh browser; the server renders entirely from the query, no localStorage needed | `app/compare/page.tsx:89-95` (server parse); `components/compare/CompareClient.tsx:98-102` (the copy) |
| Direct (bare URL) | `/compare` with no ids: a client effect rebuilds `?ids=` from the localStorage shortlist via `router.replace` | `components/compare/CompareClient.tsx:89-96` |
| Organic search | **Structurally suppressed** — `robots: index:false, follow:true` (`app/compare/page.tsx:52`), deliberately removed from the sitemap (`app/sitemap.ts:144-147` comment), and absent from the internal site-search index (grep `lib/search/site-pages.ts` this run: zero hits) |

Inception is partially telemetered: `compare_add`/`compare_remove` fire from the
listing-detail toggles (`components/listing/ListingActions.tsx:94,97`) but the `ListingTile`
toggle fires **no event** (`components/ListingTile.tsx:198-203` — no `trackEvent` call;
defect 7). On the page itself, `KbSectionTracker pageType="compare"`
(`app/compare/page.tsx:154`) dual-sinks `section_view` + scroll depth to GA4 and the internal
`/api/visitors/track` store (`components/site/kb/KbSectionTracker.client.tsx:7-27,38-45`).

## 3. Actors

- **Buyer with an active shortlist** — the addressee of every surface: toggles live only on
  buy-side browse surfaces, the empty state says "Add listings from the search page"
  (`components/compare/CompareClient.tsx:136-138`), and both nav placements sit under Buy
  (`lib/site-nav.ts:95-110,190-205`).
- **Co-decider (shared-link recipient)** — spouse, co-buyer, parent. The Copy Link + PDF
  artifacts exist for this actor. Their session is degraded by design of the storage model:
  with an empty localStorage the tray never renders and the remove control is a no-op
  (`CompareClient.tsx:89-96,127-129`; defect 1) — they can read and click through, not edit.
- **Device reality:** mobile 390 is Matt-locked product truth (`decisions.md` 2026-08-11
  absorbed decisions). A GA4 device split for `/compare` was NOT queried this session and is
  not stated (§0); it is a P4/P8 gap item. Code-level posture: the photo row and table are
  CSS-grid/overflow-x responsive (`CompareClient.tsx:180,207`).
- **Automated actors:** none own a step of this process. Upstream data maintenance only:
  `sync-delta` every 15 min (`3,18,33,48 * * * *`, `vercel.json:225-226`, opened this run),
  `refresh-mvs` hourly at :08 rebuilding `listing_tile_mv`
  (`vercel.json:196-199`; `app/api/cron/refresh-mvs/route.ts:57-60`).
- **Accountable for completion:** the visitor self-serves end to end. No broker touches this
  process; a broker enters only after the listing-detail hand-off (find-a-home's captures).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Listing facts (price, beds, baths, sqft, lot, year, garage, DOM, status, type, subdivision, coords) | `listing_tile_mv` via `getListingTiles` — the only listing read on the page | `app/compare/page.tsx:100-103`; `docs/DAL_INDEX.md:2337-2349` (tables: `listing_tile_mv`); TTL `CACHE_WINDOWS.listingTile = 60` (`lib/data/cache/unstable-cache.ts:22`; applied `lib/data/listings/getListingTiles.ts:423`) |
| Hero photo per listing | `listing_photos` via `getListingDetailPhotos` (`is_hero` first, else first photo) | `app/compare/page.tsx:113-121`; export listed `docs/DAL_INDEX.md:2299` |
| The shortlist | **localStorage only** (`ryan-realty-compare`, cap 4). Never synced to an account, never written server-side — anonymous, device-local, unrecoverable | `contexts/ComparisonContext.tsx:5-6,22-50` |
| The shareable comparison | **The URL itself** — `?ids=` is the whole state; stateless and permanent as long as the route and ids resolve | `app/compare/page.tsx:89-95` |
| The PDF | Generated on demand from the same DAL and streamed to the client; **never stored** | `app/api/pdf/comparison/route.ts:23-73`; `lib/pdf/comparison-pdf.tsx:39-63` |
| Behavioral trail | GA4 events (`compare_add/remove/share/pdf_download` in the taxonomy, `lib/tracking.ts:38-42`) + the internal visitor store | `components/site/kb/KbSectionTracker.client.tsx:7-27` |
| **NOT a SoR** | The best-in-class flags (derived per render, `CompareClient.tsx:69-81,231-244`); price/sqft (computed in the view, `:232`); the HOA and Taxes rows (hardcoded `null` at `app/compare/page.tsx:140-141` — no source feeds them); any record that a comparison happened (no table anywhere holds one) | — |

## 5. End-to-end path (inception → completion)

1. **Build the shortlist** · visitor · taps compare toggles while browsing · click · listing
   key added to context state + localStorage, cap 4 (toggle disables at cap) ·
   `ComparisonContext` (`contexts/ComparisonContext.tsx:52-57,43-50`);
   `components/ListingTile.tsx:492-506`; `components/listing/ListingActions.tsx:155-167` ·
   failure: localStorage unavailable → state is session-only, silently (try/catch
   `ComparisonContext.tsx:24-34,45-49`) · both.
2. **Tray affordance** · visitor · the fixed tray shows `Compare (N/4)` with per-slot remove
   and Clear; "Compare Now" enables at ≥2 and links `/compare?ids=...` · click · navigation ·
   `components/comparison/ComparisonTray.tsx:13,26-56,61-81`; rendered site-wide (non-LP,
   non-admin) via `PublicClientLayer.tsx:34,45,65-67` · failure: none (pure client) · both.
3. **Land** · visitor · server parses `ids` (comma list, `decodeURIComponent`, trim, cap 4)
   · URL · dynamic per-request render — the page awaits `searchParams`
   (`app/compare/page.tsx:84-95`), so the declared `revalidate = 60` (`:69`) cannot
   static-serve an ids-carrying request; caching lives in the DAL's 60s TTL · Next SSR +
   `app/compare/loading.tsx` skeleton · failure: an unhandled render error hits
   `app/compare/error.tsx:10-30` (Sentry capture + reset + browse exit) · both.
4. **Bare-URL rebuild** (variant of 3) · client · with no server listings and a non-empty
   local shortlist, `router.replace('/compare?ids=<joined>')` restores the query ·
   localStorage · a step-3 re-entry with ids · `CompareClient.tsx:89-96` · failure: empty
   shortlist → step 11 · both.
5. **Fetch + resolve** (system, inside 3) · DAL · two-arm fetch treats each id as EITHER an
   MLS ListNumber OR a listing key (`getListingTiles({listNumbers})` ∥
   `getListingTiles({listingKeys})`, `status:'all'`), dedup by key; then a parallel
   hero-photo fetch per survivor · ids · `CompareListingData[]` (address assembled from
   street parts + city + OR + zip) · `app/compare/page.tsx:100-149` · compliance in-query:
   `status:'all'` still excludes Coming Soon in the DAL
   (`lib/data/listings/getListingTiles.ts:303-306`), and the MV itself excludes IDX/internet
   opt-outs (`supabase/migrations/20260801053000_listing_tile_mv_no_detoast.sql:125-126`) ·
   failure: **both arms `.catch(() => [])`** (`page.tsx:101-102`) — a DB outage renders the
   same empty state as an empty shortlist (defect 2) · n/a — server.
6. **Read the header band** · visitor · navy KB band: breadcrumb, eyebrow "Side by side · up
   to 4 homes", Amboqia H1 "Compare homes", intro copy only when no ids ·
   scroll · orientation · `app/compare/page.tsx:170-204` · failure: none (static) · both.
7. **Read the comparison** · visitor · photo row (hero, address→detail link, price, remove
   X) + 14-row feature table with best-in-class checkmarks (low wins: price, price/sqft,
   HOA, taxes, DOM; high wins: beds, baths, sqft, lot, year built; unflagged: garage,
   status, type, community) + first-column sticky on horizontal scroll ·
   rendered HTML · a resolved ranking per row · `CompareClient.tsx:52-67,180-268` · known
   holes: HOA and Taxes render "—" for every listing always (nulls hardcoded,
   `page.tsx:140-141`, defect 3) · both.
8. **Prune** (broken) · visitor · X on a photo calls `removeFromComparison` — context/tray
   update, but the server-rendered table does NOT: the URL-sync effect bails whenever server
   listings exist (`CompareClient.tsx:89-96` first guard, `:127-129,188-195`), and for a
   shared-link recipient (empty localStorage) the X is a complete no-op · click · **nothing
   visible** (defect 1) · both.
9. **Locate** · visitor · Google Maps iframe section when any listing has coords · scroll ·
   spatial context · `CompareClient.tsx:271-289` · known hole: the comment says "Google
   Static Map with pins" but the code calls the **Embed API v1 `place` mode** with
   pipe-joined `lat,lng` pairs (`:281`) — place mode addresses a single location, so
   multi-pin rendering is doubtful; browser verification is an open gap (defect 4) · both.
10. **Complete — path A, inspect the winner** · visitor · address link on a photo card →
    `listingDetailPath(...)` → `/listing/*` — the hand-off into find-a-home step 7 where
    every capture (tour, save, like-this alerts) lives · click · navigation ·
    `CompareClient.tsx:197-199`; `lib/slug` import `:12` · failure: none this side · both.
11. **Complete — path B, share the link** · visitor · Copy Link writes `location.href` to
    the clipboard and fires `compare_share` · click · a co-decider entry channel (§2) ·
    `CompareClient.tsx:98-102,158-166` · failure: `navigator.clipboard` optional-chained —
    unsupported browsers silently copy nothing (no fallback UI) · both.
12. **Complete — path C, download the PDF** · visitor · POST `/api/pdf/comparison` with the
    listing keys; server re-fetches the same two-arm DAL + hero photos, renders a one-page
    A4 (navy bar, 4-up columns: photo, address, price, beds/baths/sqft, "Equal Housing
    Opportunity" footer) and streams it; client downloads `property-comparison.pdf` and
    fires `compare_pdf_download` · click · a portable artifact ·
    `CompareClient.tsx:104-125,167-175`; `app/api/pdf/comparison/route.ts:7-73`;
    `lib/pdf/comparison-pdf.tsx:39-63` · rate limit: `strict` = 10 req/60s/IP
    (`route.ts:8-9`; `lib/rate-limit.ts:43-51`) · failure: **silent catch** — a failed or
    rate-limited generation shows nothing but the button un-disabling
    (`CompareClient.tsx:120-123`, defect 10) · both.
13. **Empty-state exit** · visitor · no ids + no local shortlist: "No Listings to Compare"
    ("Loading your selected homes..." when the step-4 rebuild is pending) + "Browse Homes"
    → `/homes-for-sale` — re-entry into find-a-home · n/a · `CompareClient.tsx:131-147` ·
    failure: this same UI is what a swallowed DB failure renders (defect 2) · both.

## 6. Decision points

- **ids present vs bare**: server renders from the query (step 3) vs client rebuild from
  localStorage (step 4) vs empty state (step 13) — `app/compare/page.tsx:89-99`;
  `CompareClient.tsx:89-96,131-147`.
- **Identity duality**: every id is tried as ListNumber AND listing key, deduped — a shared
  link survives whichever identifier the sender's surface used (`page.tsx:100-111`).
- **Compliance gates in-query**: no public Coming Soon even at `status:'all'` — the DAL
  branch exists precisely because 'all' once leaked pre-marketing listings
  (`lib/data/listings/getListingTiles.ts:303-306` and its comment); IDX/internet opt-outs
  excluded at MV build (`supabase/migrations/20260801053000_...sql:125-126`); noindex keeps
  the surface out of the index (`page.tsx:52`).
- **OPEN compliance question 1 — sold display**: `status:'all'` means a Closed listing's id
  renders publicly (list price, not close price) for any anonymous visitor. ODS §5-4 A.4
  makes sold data VOW-only; the G54 gate asserts "no **indexable** public sold surface"
  (`scripts/check-ods-compliance.mjs:19-21`) and `/compare` is noindex but unauthenticated.
  Whether noindex satisfies the rule is a P3/Matt call — flagged, not asserted.
- **OPEN compliance question 2 — attribution**: G54 mounts `ListingAttribution` (firm,
  ODS source, disclaimers) on listing detail only (`check-ods-compliance.mjs:41-53`);
  `/compare` displays IDX listing data with zero attribution (grep of
  `components/compare/` + `app/compare/` this run: no attribution strings). Whether §5-3 P
  applies to this display form is a P3/Matt call — flagged, not asserted.
- **Best-in-class semantics are editorial**: "best price = lowest" rewards cheapest, not
  best value; year-built high, lot high, DOM low are all judgment calls embedded in
  `rows[]` (`CompareClient.tsx:52-67`). The page never states the rule to the visitor —
  contrast the motivated-sellers surface, which explains its ranking.
- **Failure vs true zero**: NOT distinguished — swallowed fetch errors render the empty
  state (`page.tsx:101-102`; defect 2, the swallowed-errors failure mode).
- **Voice/§0 in copy**: every rendered number is a per-listing MLS field via the DAL or a
  view-computed derivation from two such fields (price/sqft, `CompareClient.tsx:232`); the
  page carries no market stats, no counts, no claims needing a §0 trace beyond the DAL row.

## 7. Completion

Done when ONE observable exit occurs:

1. **Winner inspected** — navigation to `/listing/*` from a photo card
   (`CompareClient.tsx:197-199`); observable as a `view_listing` on the destination
   (find-a-home's telemetry).
2. **Link copied** — `compare_share` event (`CompareClient.tsx:101`).
3. **PDF downloaded** — `compare_pdf_download` event + the client-side file
   (`CompareClient.tsx:106,114-118`).

Artifacts at completion: the **URL** (stateless, shareable) and the **PDF** (client-side
only, never stored). **No durable server write exists anywhere in the process** — no CRM
row, no account linkage, no comparison record (verified across `app/compare/page.tsx`,
`CompareClient.tsx`, `ComparisonContext.tsx`, and the PDF route this run; the only POSTs are
telemetry and the PDF stream). Terminal states: **handed-off** (path A),
**artifact-exported** (B/C — the process ends without the machine learning who the
co-decider is), **abandoned** (telemetry only), **empty-exit** (step 13 back into
find-a-home). A process whose completions either hand into find-a-home or terminate in an
uncaptured artifact is the structural core of the MERGE proposal (§0).

## 8. Time & performance

- **Time-to-answer budget**: one server roundtrip — the table, checkmarks, and photos are in
  the initial HTML (server component fetch, `page.tsx:100-149`); the only post-load waits
  are the lazy map iframe (`CompareClient.tsx:279`) and the on-demand PDF. The page reads
  `searchParams` (`page.tsx:89`), so every ids-carrying request is a dynamic SSR render;
  `revalidate = 60` (`:69`) is effectively inert for them — the real shield is the DAL's
  60s `listingTile` TTL (`lib/data/cache/unstable-cache.ts:22`) and the ≤4-key fetch shape.
- **Freshness ladder (what "stale" means)**: a price change crosses `sync-delta` (≤15 min)
  → `listing_tile_mv` hourly refresh at :08 (`vercel.json:196-199`;
  `app/api/cron/refresh-mvs/route.ts:57-60`) → DAL cache ≤60s. Worst case a fresh MLS
  change shows here roughly 76 minutes later, dominated by the hourly MV refresh. No
  freshness claim appears on the page, so nothing overstates (contrast the
  motivated-sellers defect).
- **PDF latency + abuse budget**: each download re-runs the two-arm DAL + photo fetch +
  `renderToBuffer` per request, IP-limited to 10/60s (`lib/rate-limit.ts:43-51`); the 11th
  request within the window 429s with no user-visible message (defect 10).
- **Failure budget**: fetch arms fail-soft to the empty state (defect 2); render errors get
  the Sentry error boundary (`app/compare/error.tsx:17-21`).
- **Core Web Vitals reality**: NOT measured this session — no CWV number is stated (§0).
  Field CWV for `/compare` is a P8 litmus input; code posture is server-rendered content
  with `next/image` fills (`CompareClient.tsx:184`) and one lazy iframe. The loading
  skeleton mismatches the real layout (a 3-card browse grid vs a table,
  `app/compare/loading.tsx:1-19`) — cosmetic CLS risk noted, unmeasured.

## 9. Variants

- **Entry variants, one path**: tray CTA, nav links, resources card, bare-URL rebuild, and
  shared link all converge on step 3 with identical rendering. No split.
- **Owner vs co-decider** — the one material divergence: a shared-link recipient (empty
  localStorage) gets a read-and-click-through page — no tray, remove is a no-op, and adding
  more homes requires rebuilding a shortlist of their own (`CompareClient.tsx:89-96` guard;
  `ComparisonTray.tsx:13`). Same completion set, degraded controls; a defect to fix in the
  merged shape, not a process split.
- **id-form variant**: ListNumber ids vs listing-key ids resolve identically
  (`page.tsx:100-111`). Not a split.
- **Unwired variant-in-waiting**: `AICompare` (`components/compare/AICompare.tsx:38-124`) —
  a built AI-comparison card POSTing to `/api/ai/chat` — has **zero imports repo-wide**
  (grep this run: only its own file and the page's investigation note) and an unresolved
  HOLD note listing three preconditions: type adapter, brand-voice system prompt on the raw
  AI output, rate-limit/auth on cost (`app/compare/page.tsx:226-258`). Wire-or-delete is an
  explicit P3 decision item.

## 10. Current implementation map

- **Route**: `/compare` only (`app/compare/page.tsx` + `loading.tsx` + `error.tsx`); KB
  chrome match (`lib/site/chrome-routes.ts:32`); canonical self, noindex/follow, OG default
  image (`page.tsx:48-67`); breadcrumb JSON-LD (`page.tsx:156-164`).
- **Nav**: four projections (`lib/site-nav.ts:105,199,275,339`) + resources card
  (`app/resources/page.tsx:56-60`); NOT in sitemap (`app/sitemap.ts:144-147`), NOT in
  site-search (`lib/search/site-pages.ts`, zero hits).
- **Design registers (of the 4 surviving languages)**: mixed on one page — **kb** shell
  (`kb-root`, `KbBreadcrumb`, `KbFooter`, `SmoothScrollProvider`, `KbSectionTracker`,
  `kb.css`, `page.tsx:36-44,152-221`) wrapping a **product-register** core
  (`@/components/ui` Table/Button, `CompareClient.tsx:11-13`) that also imports
  **primitives** H1/H2/H3 (`CompareClient.tsx:14`). The register mixing inside one surface
  is the defect class the P9 ratchet exists to kill. Parity contract exists at
  `design_system/ryan-realty/ui_kits/compare/parity.json` (cited as inventory; blacklisted
  as design input).
- **Data/API**: `getListingTiles` + `getListingDetailPhotos` (`page.tsx:37,100-114`;
  `docs/DAL_INDEX.md:2299,2337-2349`); `POST /api/pdf/comparison`
  (`app/api/pdf/comparison/route.ts`); `ComparisonContext` mounted globally in
  `RootProvider` (`components/site/providers/RootProvider.tsx:27`) — including admin
  routes, where the tray is the only gated piece (`PublicClientLayer.tsx:45`).
- **Known defects / P3-P5 input** (all verified this run):
  1. **Remove doesn't remove** — the X updates context/tray but never the rendered table
     (URL-sync effect bails when server listings exist, `CompareClient.tsx:89-96,127-129`);
     total no-op for shared-link recipients.
  2. **Failure renders as empty shortlist** — both DAL arms `.catch(() => [])`
     (`page.tsx:101-102`); a DB outage shows "No Listings to Compare".
  3. **Two permanently dead rows** — HOA and Taxes are hardcoded `null`
     (`page.tsx:140-141`) yet carry `best:'low'` semantics in the table
     (`CompareClient.tsx:61-62`); every cell renders "—". `listing_search_mv` was built to
     carry HOA/taxes per the refresh route's own comment
     (`app/api/cron/refresh-mvs/route.ts:102`) — the data path exists and is unwired here.
  4. **Map comment/implementation mismatch** — "Static Map with pins" comment over an Embed
     v1 `place`-mode iframe with pipe-joined coords (`CompareClient.tsx:275-282`);
     multi-pin rendering unverified and doubtful.
  5. **AICompare zero-import orphan** with an unresolved wire-or-delete HOLD
     (`components/compare/AICompare.tsx`; `app/compare/page.tsx:226-258`).
  6. **Retained-unused `daysOnMarket` helper** awaiting a "listed date" row
     (`page.tsx:71-82`) — carried from find-a-home's defect list (`find-a-home.md:250-251`).
  7. **Asymmetric inception telemetry** — detail-page toggles fire `compare_add/remove`
     (`ListingActions.tsx:94,97`); the tile toggle fires nothing
     (`ListingTile.tsx:198-203`), so shortlist-building from search grids is invisible.
  8. **No ODS attribution on an IDX display** (§6 open question 2).
  9. **Anonymous sold-listing display via `status:'all'`** (§6 open question 1).
  10. **Silent PDF failure** — catch swallows errors and 429s alike
      (`CompareClient.tsx:120-123`).
  11. **Two H1s on one page** — the page's Amboqia "Compare homes" (`page.tsx:184-189`) plus
      CompareClient's own `<H1>` "Compare Properties" (`CompareClient.tsx:154`); duplicate
      heading roles and duplicated intent in two registers.
  12. **Shortlist is device-local only** — never synced to an account even when signed in
      (`ComparisonContext.tsx:22-50`); cross-device continuity fails, violating binding
      directive #5 (continuity) for this artifact.
  13. **Loading skeleton mismatches the layout** (`app/compare/loading.tsx:1-19`).

## 11. Target shape (process-level, not pixels)

**Should this exist? The job yes, the standalone process no.** Shortlist-decision support is
a real step of the buy journey — the co-decider artifact (link/PDF) is the part no other
surface produces, and household buying decisions are multi-party. But the job is an
in-browse utility with an exit contract, exactly as find-a-home's deepened PDS already
frames it (`find-a-home.md:279-280`). Target shape derives from the job:

- **A compare utility inside the find-a-home browse destination** — reachable from any tile
  or detail view once ≥2 homes are shortlisted; ideal step count 3: shortlist (in browse) →
  resolve (the table) → act (inspect winner / share out). The utility earns its place by
  fixing the two things that break the job today: **remove must work** (defect 1) and the
  **shortlist must survive** sign-in and devices (defect 12).
- **Capture belongs at the share moment**: the co-decider artifact is the process's only
  unique output and today it exits uncaptured. A shared comparison whose recipient can be
  (optionally, honestly) connected back — or whose sender can save the shortlist to their
  account — turns the one distinct artifact into a machine outcome. The machine objective
  is only ever achieved through the visitor objective (binding directive #3): the share
  must get better for the visitor (live prices for the recipient, a durable shortlist),
  not gated.
- **Data completeness before table growth**: wire HOA/taxes from `listing_search_mv` (the
  refresh route already builds it for exactly these fields,
  `app/api/cron/refresh-mvs/route.ts:102`) or cut the rows; resolve the sold-display and
  attribution questions (§6) before the merged utility inherits them.
- **Wire-or-delete `AICompare`** per its own HOLD conditions (`page.tsx:240-256`) — a P3
  line item, not a default.
- **SEO carve-out**: none needed — noindex + no sitemap entry means no earned search equity
  to protect (P5 confirms against GSC per the standing carve-out before renaming the path).
  The REAL external contract is every already-shared `/compare?ids=` link: the URL must
  keep resolving (301 if the path moves), because breaking it breaks artifacts in other
  people's hands.
- **Data gaps blocking correctness**: GA4 volumes for `compare_add/share/pdf_download`
  (never queried — is the tool used at all? the P3 merge package needs the number); device
  split; browser verification of the map embed (defect 4); GSC confirmation of zero equity;
  whether sold ids are actually hit in the wild (server logs/GA4, bears on §6 question 1).

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Put the homes you're deciding between side by side, see which one
  wins on each measure, and hand the comparison to whoever is deciding with you."
- `machine_objective`: "Advance a resolved shortlist into a captured buyer step — the
  winning listing inspected into a tour/save/alert — and make the shortlist durable (account
  or alert) so the comparison, and its recipient, stop exiting untracked."
- `exits`: listing detail for the winner (→ find-a-home step 7, where capture lives) ·
  share out — link/PDF (→ co-decider re-entry into this same surface) · back to browse
  (`/homes-for-sale`, today's empty-state exit → find-a-home) · the compared homes' place
  nodes (→ evaluate-a-place — required by the every-place-name-is-a-door rule; today city
  names live only inside unlinked address strings and the Community row is dead text —
  `app/compare/page.tsx:124-128`; `CompareClient.tsx:66,197-199`) · market
  context for "is the winner priced right" (→ explore-market-knowledge /
  get-home-value's buyer-side read — the natural trust edge for a comparison page, absent
  today).

**Destination implication (proposal, not a lock):** no standalone destination. The compare
utility folds into the find-a-home browse destination as its shortlist-decision tool; the
`/compare?ids=` URL survives as the share-artifact contract (kept or 301'd, never 404'd).
The nav's four "Compare homes" links stop pretending it is a destination; entry becomes the
shortlist itself.

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Route + robots contract**:
   `curl -s https://ryan-realty.com/compare | grep -o '<meta name="robots"[^>]*>'` →
   contains `noindex` (`app/compare/page.tsx:52`), and
   `curl -s https://ryan-realty.com/compare | grep -o '<link rel="canonical"[^>]*>'` →
   canonical `/compare` (`:51`).
2. **Sitemap absence**:
   `curl -s https://ryan-realty.com/sitemap.xml | grep -c '/compare'` → `0`
   (`app/sitemap.ts:144-147`).
3. **Populated render**: pick two live ids —
   `select "ListNumber" from listings where "StandardStatus" = 'Active' and "PropertyType" = 'A' and "PhotoURL" is not null limit 2;`
   — then `curl -s "https://ryan-realty.com/compare?ids=<a>,<b>"` → HTML contains
   `id="compare-table"` (`page.tsx:211`) and both street addresses.
4. **Identity duality**: re-run check 3 with the same homes' listing keys
   (`select "ListingKey" from listings where "ListNumber" in ('<a>','<b>');`) → identical
   two-column table (`page.tsx:100-111`).
5. **Cap enforcement**: request 6 ids → at most 4 columns render (`page.tsx:95` slice;
   `ComparisonContext.tsx:6` caps the client side).
6. **Coming Soon exclusion**: if
   `select "ListNumber" from listings where "StandardStatus" ilike 'Coming%' limit 1;`
   returns a row, `curl` its compare URL → that listing does NOT render
   (`getListingTiles.ts:303-306`). Zero rows is also a pass (§0: the counter-query IS the
   check).
7. **Sold-display posture (open question 1 evidence)**: for a Closed id
   (`select "ListNumber" from listings where "StandardStatus" = 'Closed' order by "CloseDate" desc limit 1;`),
   record whether the compare URL renders it. Today it DOES (status `'all'`,
   `page.tsx:101-102`) — this check documents current truth until P3 rules; flip the
   expectation if P3 rules sold-off.
8. **PDF artifact**:
   `curl -s -X POST https://ryan-realty.com/api/pdf/comparison -H 'Content-Type: application/json' -d '{"listingIds":["<a>","<b>"]}' -o /tmp/cmp.pdf -w '%{http_code}'`
   → `200`; `head -c 4 /tmp/cmp.pdf` → `%PDF` (`app/api/pdf/comparison/route.ts:66-72`).
9. **PDF rate limit**: 11 rapid repeats of check 8 from one IP → a `429` appears
   (`route.ts:8-9`; `lib/rate-limit.ts:43-51` — strict 10/60s).
10. **Tray inception (browser)**: on `/homes-for-sale`, toggle compare on two tiles → tray
    shows "Compare (2/4)", "Compare Now" enabled → click → lands on `/compare?ids=...`
    (`ComparisonTray.tsx:13,69-81`). Verify `localStorage['ryan-realty-compare']` holds
    both keys and survives a reload (`ComparisonContext.tsx:43-50`).
11. **Telemetry asymmetry (defect 7 regression marker)**: in the same session, a
    detail-page compare toggle pushes `compare_add` to `dataLayer`
    (`ListingActions.tsx:94-97`); the tile toggle pushes nothing
    (`ListingTile.tsx:198-203`). When the defect is fixed, update the expectation here.
12. **Shared-link re-entry**: open the ids URL in a private window → the full table renders
    server-side with no localStorage (`page.tsx:100-149`); the remove X is a no-op there
    (defect 1 — documents current truth until fixed).
13. **Empty state**: `/compare` in a private window → "No Listings to Compare" + "Browse
    Homes" linking `/homes-for-sale` (`CompareClient.tsx:131-147`).
14. **Best-in-class correctness (§0 trace)**: for the rendered pair,
    `select "ListNumber", "ListPrice", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", year_built from listings where "ListNumber" in ('<a>','<b>');`
    → the checkmarked cell per row equals min(price) / max(beds) / max(baths) / max(sqft) /
    max(year) per the `rows[]` directions (`CompareClient.tsx:52-67,69-81`), and the
    rendered Price/Sq Ft equals `round(ListPrice / TotalLivingAreaSqFt)` (`:232`).
15. **Dead-row marker (defect 3)**: rendered HTML shows "—" in every HOA/mo and Taxes/yr
    cell (`page.tsx:140-141`). When the rows are wired or cut, update this check.
16. **Freshness wiring**:
    `grep -A1 '"path": "/api/cron/refresh-mvs"' vercel.json` → `"8 * * * *"`;
    `grep -n 'listingTile: 60' lib/data/cache/unstable-cache.ts` → hit
    (`unstable-cache.ts:22`).
17. **Orphan watch (defect 5)**:
    `grep -rn "AICompare" app components --include='*.tsx' | grep -v 'components/compare/AICompare.tsx' | grep -v 'app/compare/page.tsx'`
    → empty (still unwired) until P3 rules wire-or-delete.
