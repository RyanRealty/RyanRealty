# KB Convergence Roadmap — the locked program plan

**This is the durable, cross-session plan of record for the "make the whole site
match the kinetic-brutalist (KB) homepage, then converge CRM / tracking /
attribution / ads" program.** It supersedes the ephemeral orchestrator task list.
Every session reads this file before doing convergence work and updates the
status column as phases land. Process canon (how work happens) stays
[`docs/DEVELOPMENT_PROCESS.md`](DEVELOPMENT_PROCESS.md) (THE LOOP, G44); this file
is the *what's-left* ledger that runs inside THE LOOP's Experience loop.

Reference implementation (the immutable target every page copies): the live
homepage `app/page.tsx` + the reusable section library `components/site/kb/*`
(see `components/site/kb/README.md` — the no-fork reuse contract, enforced by
`ci:kb-single-source` G50 + `ci:kb-overlay-hidden` G51).

Last reconciled: 2026-06-17 (HEAD on `main` after the homepage polish wave).

---

## THE PAGE CONTRACT — hardcoded, non-negotiable on every page we build (Matt directive 2026-06-17)

Every page in the migration ships with ALL THREE baked in. None is optional; each
becomes a gate (prose is not enough — "this cannot be prose, it must be enforced").

1. **Design — KB brutalist, no slop.** Reuse the `Kb*` sections (no forks, G50). New
   sections match the kinetic-brutalist language we researched (navy/cream, Amboqia
   display, mono data, hard rules, scan-lines, kinetic reveals). A section that reads
   like a generic dashboard is a regression — redesign it, don't ship it. Sections
   must be **informative**: surface the real numbers and a verdict, not a thin strip.

2. **SEO for Google AND LLMs — hardcoded.** Every page renders: `pageMetadata()`
   (title/desc/canonical/OG), and the JSON-LD set via `MetadataBlock` —
   BreadcrumbList + the page's primary entity (City/Place, RealEstateListing,
   Neighborhood, Dataset for market stats) + FAQPage where Q&A exists. Headings are a
   real h1→h2 outline. Content is AI-citable: named facts, verified stats, dated. Gate:
   a per-page SEO/JSON-LD presence check (Phase 3).

3. **Tracking — hardcoded, dual-sink (GA4/Pixel + our internal store).** Every page
   fires a page-type view; every SECTION fires a view event when it enters the
   viewport; every key INTERACTION is recorded — view a home, open a calculator, play a
   video, map interaction, CTA click, scroll depth, save, share. Use the existing
   `lib/tracking.ts` `trackEvent()` taxonomy (GA4/GTM + Meta CAPI) AND post to the
   internal `/api/visitors/track` (session-stitched via `rr_session_id`). A reusable
   KB section/interaction tracker carries this so every section inherits it. Gate: a
   per-KB-page tracking-instrumentation check (Phase 5/3).

Phases 3 (gates), 5 (tracking), 6 (attribution) are therefore not "later" — their
per-page slice ships WITH each page in Phase 9. The roadmap below still tracks the
deeper platform work (identity graph, offline conversions) separately.

---

## Phase ledger (reconciled to what is actually shipped)

| # | Phase | Goal | Status | Remaining work · gate |
|---|---|---|---|---|
| 0 | Clean base | Clean base, GSAP/Lenis + KB assets restored | **DONE** | — · `ci:gates` green on `main` |
| 0.5 | Stabilize base | Fix the #418 hydration regressions | **DONE** | — · `ci:hydration-safety` |
| 1 | KB shell | Shared chrome: `SmoothScrollProvider` (Lenis+GSAP), scoped `kb.css`, `KbNav`/`KbFooter` | **DONE** | — · `ci:kb-overlay-hidden` |
| 2 | Reference homepage | Build the homepage for real = the reference impl | **DONE** | Decide the 9-width Amboqia clip gate: promote `out/concept/v2/shots/_cliptest.mjs` to `scripts/check-clip.mjs` in `ci:gates`, or strike it from the acceptance criteria |
| 3 | Structural gates | Lock the convergence behind regression gates | **IN PROGRESS** (5 shipped: `ci:kb-single-source`, `ci:kb-overlay-hidden`, `ci:tracking-policy`, `ci:crm-lead-integrity`, `ci:hydration-safety`) | Add: shared-shell-usage gate (KB pages render `KbNav`+`KbFooter` in `.kb-root`); per-page SEO+JSON-LD presence on KB pages; lead-forms-route-through-canonical-FUB-action; resolve the clip gate |
| 4 | CRM + lead/marketing | Canonical lead-create + audience tags + FUB hardening + lead scoring | **IN PROGRESS** (campaign stamping on all public forms; Meta Lead Ads webhook events-first) | Canonical `submitLead` contract + audience-tag taxonomy; FUB sync hardening; live visitor-intent on the CRM timeline; lead scoring. Extend `ci:crm-lead-integrity` |
| 5 | Tracking policy | First-party identity, consent, event shape | **IN PROGRESS** (Phase-0: email-click `_fuid` stitch + named-people feed) | `rr_vid` first-party cookie in `middleware.ts`; richer `/api/visitors/track`; `visitor_events`+`visitor_identity_map` tables; granular client tracker; anon→known backfill. Sub-plan: `docs/TRACKING_POLICY.md` + `docs/HANDOFF_TRACKING_AND_ADMIN_REDESIGN.md`. Extend `ci:tracking-policy` (G48) |
| 6 | Full-funnel attribution | CAPI/Pixel dedup, UTM/fbclid propagation, offline conversions | **TODO** (invariants crash-guarded by G48) | Finish CAPI/Pixel `event_id` dedup; UTM/fbclid ad→LP→form→FUB; creative-metadata stamping; offline-conversion upload to Meta |
| 7 | Auth + members | Login → identity graph (saved searches/homes, alerts, valuation tracking) | **TODO** | Verify login + member features on the Next site; Google One-Tap; Supabase Auth SSR; feed login into the Phase-5 identity graph |
| 8 | Landing-page restyle | `/lp/*` → KB look + ad↔LP scent-match | **TODO** | Restyle `/lp/*` to KB (not the `/lp` shell); Five-Laws voice; ad↔LP scent-match; new ad concepts. Gate: `ci:brand-voice` floor + scent-match parity |
| 9 | Page-class migration | Migrate every page-class onto KB sections | **IN PROGRESS** (only the city detail page is partly migrated: KB chrome wraps an old Experience body) | Migrate in order below; each ships draft-first and rewrites/retires its `parity.json` to the KB set in the same commit. Gate: `ci:mockup-parity` (re-pointed to KB) + `ci:kb-single-source` |

### Phase 9 migration order (page-classes)

**city → community → neighborhood → listing-detail → market-report → sell/buy →
search → zip → team/about → blog → account.** Never `/admin`, never the `/lp`
shell (those have their own rules).

---

## Sequence to the finish line

1. **Lock this roadmap** (this doc) + a project-memory pointer. (done when this file lands)
2. **Phase 9 wave 1 — the Bend city page** (build plan below). Closest page to done; landing it proves the migration recipe, forces the first `parity.json` re-point, and the first KB section parameterization (map/HUD/communities scope props) — which unblocks community + neighborhood.
3. **Phase 3 gate hardening, interleaved after wave 1** — write shared-shell-usage / KB-SEO-JSON-LD / canonical-FUB gates against the first real KB page-class; start `ci:dead-ui` to retire orphaned component sets.
4. **Phase 9 wave 2 — community + neighborhood**, reusing wave-1 scope props + the parameterized neighborhood-ledger DAL.
5. **Phase 9 waves 3+** — listing-detail → market-report (adopt the Beat-Beacon 7-chart plan) → sell/buy → search → zip → team/about → blog → account.
6. **Phases 4–7 (CRM / tracking / attribution / auth)** proceed in parallel — they touch `lib/crm`, `middleware.ts`, and migrations, not page bodies.
7. **Phase 8 (LP restyle + scent-match)** last among build phases — depends on a stable KB library + live UTM/fbclid propagation.
8. **Final decommission sweep** (see below).

---

## Decommission ledger (runs alongside Phase 9, `ci:dead-ui` after each wave)

- Orphaned homepage component sets: `HomepageHeroV3`, `HomepageV6*` (11 files), `HomepageCine*` (13 files).
- Unused `components/site/experience/*` module kit (FlyoverHero, LiveMarketBand, SectionNav, CommunityMapLedgerPane, ListingLedger, PriceHistoryScrubber, PaymentSlider, …) — only after no page imports them.
- Collapse the 9 competing `design_system/ryan-realty/ui_kits/homepage-*` mockup dirs to one.
- **`docs/EXPERIENCE_SYSTEM.md` is stale as the visual authority** (names `homepage-v6`/`HomepageHeroV3`, both superseded by the KB homepage). Before retiring it, fold forward its two useful pieces: the ~91-route archetype map (feeds Phase 9 ordering) and the Beat-Beacon 7-chart market-report plan (Phase 9 market-report class adopts it).

---

## Active work item — Bend city-page build plan (Phase 9 wave 1)

Rebuild `app/cities/[slug]/page.tsx` (Bend first) to mirror the homepage shape:
KB sections fed city-scoped DAL data. The page is a hybrid today — KB chrome
wraps an old Experience body (`FlyoverHero`, `LiveMarketBand`,
`CommunityMapLedgerPane`, `PriceHistoryScrubber`, …); this replaces the body
with KB sections, keeping the JSON-LD / FAQ / breadcrumb siblings.

**Section order:** `MetadataBlock` (breadcrumb+City+Dataset JSON-LD, sibling) ·
`KbNav` · `KbHero` (Bend reuses `hero-optimized.mp4`) · `KbFeatured` (city active
listings + video enrichment) · `KbListingMap` (city geojson) · `KbTicker` ·
`KbMarketHud` (city pulse + stats + price history + by-neighborhood ladder +
region county comparator) · `KbCommunities` (city communities, video from the
resolved manifest) · `KbTestimonials` · `KbTeam` · `KbSell` (city pulse) ·
`FAQBlock` (`buildMarketFaq`, sibling) · `KbFooter` (`towns={[]}`).

**Data per section (all timeout-guarded, one `Promise.all`):** `getMarketPulse({geoType:'city',geoSlug})`
(hero + sell + HUD core) · `getMarketStatsForCity` / `getMarketStatsCacheRowForGeo`
(sale-to-list, new30) · `getPriceHistory('city',slug,'monthly',13)` (HUD trend) ·
Bend neighborhood ledger via `getBendNeighborhoodStats` for wave 1 → generalize to
`getCityNeighborhoodLedger(citySlug)` for wave 2 (no-fork) · `getCityCommunitySnapshots`
+ resort registry filtered to the city (communities, with `data/city-hero-videos.resolved.json`
videos by slug) · `getCityListings(cityName,{status:'active',…})` (featured + map +
ticker) · `getListingVideos(listingKey)` per featured tile → `toTileBackgroundVideo`.

**Hero asset:** per-slug `CITY_HERO` map — Bend → `{videoSrc:'/videos/hero-optimized.mp4',
posterSrc:'/images/hero/hero-old-mill-master-4k.jpg'}`; other cities → `{videoSrc:null,
posterSrc: cityHero(slug).src}` (the verified-photo registry in `lib/geo-images.ts`).

**Chrome/layout:** `HideOnLP.tsx:54-56` already hides default chrome for
`^/cities/[^/]+$`. The structural change is to move the whole body INTO
`<main className="kb-root"><SmoothScrollProvider>…` so `kb.css` + Lenis apply.

**parity.json:** rewrite `design_system/ryan-realty/ui_kits/city/parity.json` to the
KB component set (it currently encodes the old Experience v3.2 archetype) IN THE
SAME COMMIT, so `ci:mockup-parity` passes. Do NOT `--write-baseline` without Matt's
approval — rewrite the contract itself.

**Data gaps to solve:** (1) neighborhood ledger — Bend uses the existing westside
stats; generalize to `getCityNeighborhoodLedger` before non-Bend cities. (2)
`KbMarketHud.new30` — `getMarketPulse` exposes 7-day `newThisWeek`, not 30-day;
read `new_count_30d` from the stats-cache row instead. (3) small-town pulse
completeness (`median_days_to_pending`, `months_of_supply` can be null for
La Pine/Terrebonne) — render honest em-dash placeholders; Bend is fully populated.
(4) community-card video — content config, not a query.

**Acceptance (before asking for approval):** `tsc` clean · `npm run build` clean ·
`npm run ci:gates` (esp. `ci:mockup-parity` against the rewritten KB parity,
`ci:kb-single-source`, `ci:page-dal`, `ci:brand-voice`, `ci:breadcrumb`) · visual
verify against the live Vercel prod deploy (dev is Windows-only) — KbHero plays the
video, the map renders the Bend polygon, the HUD trend shows ≥4 completed months,
communities rail scrolls · data-accuracy trace (§0) per stat surfaced. Draft-first:
surface the prod-preview + gate summary + trace, wait for explicit approval.
