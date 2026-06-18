# KB SITE CONVERSION — master goal (locked 2026-06-18)

> **GOAL (end-to-end, not next-step):** Every user-facing page on ryan-realty.com is
> rebuilt in the KB (kinetic-brutalist) design system — navy/cream, Amboqia display,
> hard `--edge` borders, GSAP/Lenis motion, scoped `kb.css` — reusing the single-source
> `components/site/kb/*` sections (never forked). Each page carries the PAGE CONTRACT
> (SEO for Google + LLMs, full tracking, JSON-LD, §0-verified data). Subdivisions inside a
> neighborhood / planned community / resort link directly to their own KB page.
>
> **DONE =** every page-class at 100% — production-grade, a real user can walk in and use
> it on desktop + mobile, all gates green, browser-verified on the live prod deploy. Not
> "it compiles" — it looks and works to the bar of the mockups in
> `design_system/ryan-realty/ui_kits/<route>/`.

## Hard constraints (non-negotiable)

- **Single checkout, `main` only. NO git worktrees, NO feature branches.** Parallel agents
  therefore MUST edit **disjoint files** (one page-class per agent + its own parity.json).
  Shared KB components/`kb.css`/gates are built in a coordinated step, never by two agents at once.
- **Reuse, never fork** KB sections (G50 `ci:kb-single-source`). Parameterize via props.
- **PAGE CONTRACT** every page (G52 `ci:kb-page-contract`): metadata, canonical, JSON-LD,
  breadcrumb, tracking, §0-verified figures with a verification trace.
- **§0 Data Accuracy** outranks everything. Every figure traces to a live source.
- **Brand voice** gate clean. **Mobile-first.** **Mockup parity** where a parity.json exists.
- Verify on the **live Vercel prod deploy** (local dev is Windows-only here); Playwright with a
  browser UA, desktop + iPhone viewport.

## Process per increment (THE LOOP)

1. Convert / build → 2. real-time browser test the real thing (desktop + mobile screenshots) →
3. auto-review (gates + tsc + 637 vitest) → 4. commit verified increment (`Approved-by: matt`) +
push → 5. update this doc's progress log.

## Wave plan

> Filled from the live inventory sweep (agent `a9be3d9c`). Each wave = parallel agents on
> DISJOINT page files. Order by traffic/SEO/conversion value.

Inventory (agent a9be3d9c): 3 KB pages live (home, city, community). ~109 OLD pages.
Subdivision route = `app/subdivisions/[slug]/page.tsx` (OLD, **@no-parity** → no gate friction).
Parity gates exist for ~25 routes (city/community/home are KB; about/sell/team/search/zip/
neighborhood/market-report/listing-detail still point at OLD site-v2 sets — rewrite to KB set
per the city-page migration pattern). NOT migrating: account/dashboard/auth/legal (custom app).

- [x] **Chart fix shipped + verified live** (`326e8a0a`): completed years span Jan→Dec;
      current year ends clean at "as of <month>" (no dashed tail); community chart falls back to
      labeled city trend. Verified on live `/cities/sunriver`.
- [~] **Wave A — Subdivisions** (in flight): `KbResortOverview` subdivision chips now LINK to
      `/subdivisions/{slugify(alias)}` (hover-invert). Agent `abb5b27` is converting the
      subdivision page to KB + making it robust (no 404 for any registry alias). Ship chips +
      page together (no broken links).
- [~] **Wave B — Bend neighborhood page** (`/cities/[slug]/[neighborhoodSlug]`): agent `ae5941fd`
      → KB mirror of community page + subdivision links + parity.json rewrite.
- [~] **Wave C — Region market report** (`/housing-market/central-oregon`): agent `a95bbe86` →
      KB + preserve Dataset/FAQPage JSON-LD + parity.json rewrite.
- [ ] **Wave D+** — search/buy/zip, sell, about/team, blog, tools, remaining housing-market,
      reference pages, lp/* (highest value first: search → market hub → brokerage → sell).
- [ ] **Final review pass** — one dedicated sweep: every converted page, desktop+mobile, gates,
      §0 traces, cross-page consistency, no broken links.

## Progress log

- 2026-06-18 — Shipped market-chart fix (`326e8a0a`): completed years span full year, current
  year ends clean (no dashed tail), community chart falls back to labeled city trend when
  neighborhood sales are too sparse. 637 tests + gates green, browser-verified.
- 2026-06-18 — Launched site inventory + subdivision-structure sweep (agent a9be3d9c).
- 2026-06-18 — **Waves A/B/C shipped + verified live** (`49eed2fa`): subdivision chips link to
  `/subdivisions/{slug}` + subdivision page → KB (no-404 contract holds — `/subdivisions/sunrise-village`
  renders 200, not a 404, for an alias with no GIS boundary); Bend neighborhood page → KB
  (`/cities/bend/old-bend`); region market report → KB (`/housing-market/central-oregon`).
  Browser-verified all 4: KB chrome present, chips link out, JSON-LD intact (region keeps
  WebPage+Dataset+FAQPage+BreadcrumbList). §0 trace: region $741,000 = market_pulse_live
  median_list_price; 1818 active; 6.91 MoS → "6.9 · buyer's market"; 16 days to pending — all exact.
- 2026-06-18 — **Wave D shipped + verified live** (`8c0d0a02`): `/housing-market` hub → KB
  (BreadcrumbList+WebPage only, city tiles link to reports) and `/housing-market/[...slug]` city
  reports → KB (`/housing-market/bend`: Dataset+FAQPage+WebPage+BreadcrumbList intact; §0 exact —
  $780,450 list = market_pulse_live, 4.68 MoS → "4.7 · balanced"). 2-segment subdivision-report
  case preserved on legacy render (no wave covers it). **8 KB pages now carry the contract.**
- 2026-06-18 — **Wave E shipped + verified live** (`358a2d5b`): `/zip/[zip]` → KB. §0: ZIP
  KPIs are ZIP-level (getZipListings); the trend chart is the parent-city series labeled
  `chartScopeLabel="Bend (city)"` (caught + fixed before ship — never read as the ZIP's own).
- 2026-06-18 — **CROSS-CUTTING FIX + Wave F** (`f7ce9da5`): `HideChrome` only excluded
  `/cities/<slug>` + `/communities/<slug>`, so EVERY other KB route shipped this session was
  double-rendering the global SiteHeader+SiteFooter on top of KbNav+KbFooter (confirmed live:
  `/zip/97701` had 2 `<header>`/2 `<footer>`). Added all KB route families to `HideChrome`
  (subdivisions, 2-seg neighborhood, zip, open-houses, price-drops, housing-market hub+region+
  city-reports; excludes not-yet-migrated explore/reports + legacy 2-seg report). Plus
  open-houses (index+city) and price-drops (index+city) → KB; removed price-drops' hidden
  parity-shim slop and rewrote its parity.json to the KB set.
  **LESSON: every new KB route MUST be added to `HideChrome` in the same change** (else double chrome).
- 2026-06-18 — **Wave F verified live**: single chrome (1 header/1 footer) confirmed on
  zip, subdivisions, housing-market hub + bend, open-houses, price-drops, neighborhood.
- 2026-06-18 — **Trust tier shipped + verified live** (`6f2f8773`): `/about` + `/team` +
  `/team/[slug]` → KB. Broker profile keeps per-broker review filtering (reviewBelongsOnPage),
  getBrokerSales, and RealEstateAgent+AggregateRating+breadcrumb JSON-LD; brand-voice 0; single
  chrome confirmed (`/team/matt-ryan` 1 header/1 footer, h1 "Matt Ryan"). HideChrome updated
  (/about, /team, /team/<slug>; /team/<slug>/edit keeps default chrome).

### Converted to KB this session (all live-verified, gate-green, §0-checked) — ~16 KB pages

home, city, community (pre-session) + subdivision, neighborhood, housing-market hub, region
report, city reports, zip, open-houses (×2), price-drops (×2), about, team, team/[slug].
Plus: market-chart fix + the HideChrome double-chrome fix (see [[ryanrealty-kb-route-hidechrome]]).

### Remaining (design-led — NOT a mechanical pass; do with direct attention / new KB sections)

- **/sell + /sell/[intent] + /sell/valuation** — seller funnel; needs KB sell sections (value
  props, process, commission) the library doesn't have yet.
- **/search + /search/[...slug] + /buy + /buy/[intent] + /compare** — needs new KB search/filters/
  results components (biggest lift; #1 traffic).
- **/blog + /blog/[slug] + /guides + /guides/[slug] + /area-guides** — needs a KB article-body layout.
- **/listing/[listingKey]** — custom PDP, large.
- **Reference/feed**: /schools, /parks, /videos, /resources, /reviews, /motivated-sellers, /faq,
  /our-homes, /activity, /pulse, /contact, /reports/*.
- **Each new KB route: add to HideChrome in the same change** (single-chrome) + async generateMetadata + rewrite its parity.json to KB (no hidden shims).
- NOT in scope: account/dashboard/auth/legal (the authenticated app).

## 2026-06-18 — SITE-WIDE MIGRATION SHIPPED + FINAL REVIEW

**~47 KB routes now (from 3 at session start).** Site-wide restyle-in-place (content preserved),
fidelity restore (market reports + neighborhood resort overview + subdivision video rail re-added),
testimonials → compact card grid, HideChrome covers all 47 routes, broker photo → contained portrait.
Final review (live): `/team/matt-ryan` contained portrait + compact reviews; home compact reviews;
market reports chart + Dataset JSON-LD; `/cities/bend/old-bend` resort overview restored. All single
chrome, tsc 0, ci:gates 0-new, 637 tests green.

### Remaining — needs design decisions, NOT a mechanical restyle (left FULLY FUNCTIONAL):
- **/search + /search/[...slug]** — incompatible with the full KB shell: Lenis hijacks the map's
  scroll-to-search; `kb.css .kb-root *{margin:0;padding:0}` strips the shadcn search controls;
  `html.lenis{height:auto}` breaks the full-viewport `.map-search-shell`; the fixed transparent KbNav
  overlaps the sticky filter bar on a hero-less page. Needs a search-specific KB chrome (solid KbNav
  variant, NO kb-root shell, NO Lenis).
- **/sell/[intent] + /buy/[intent]** — share `components/landing/LeadLandingPage` (Phase 8). KB that
  shared component once (preserving the FUB lead form); both inherit.
- **/housing-market/explore + /housing-market/reports* + /reports/[slug]/[geoName]** — data-heavy
  report sub-pages, left intact this pass.
- **/listing/by-address + /listing/by-key** — thin resolvers to the KB /listing/[listingKey].

## 2026-06-18 (later) — lead-landing + report routes DONE; search is the last item

- `/sell/[intent]` + `/buy/[intent]` → KB via the shared `LeadLandingPage` (FUB form + all
  sections preserved; ContentPageHero untouched since it's shared by 11 pages). Verified live 1/1.
- `/housing-market/explore` + `/reports` + `/reports/[slug]` → KB chrome FIXED (pre-existing
  double-chrome; their KB bodies live in app/reports/* and were excluded from HideChrome). Verified 1/1.
- `/housing-market/reports/[slug]/[geoName]` + `/reports/[slug]/[geoName]` → redirect-only (no chrome).

### LAST REMAINING: /search + /search/[...slug]
Cannot take KB chrome via the current `HideChrome` mechanism — it removes the default SiteHeader
by CLIENT hydration-unmount, and the heavy search-map hydration interferes, leaving a double header
(verified, then reverted — would NOT ship double-chrome on the #1 page). Search is on its working
default chrome. The correct fix is a **KB route-group layout** (`app/(kb)/layout.tsx` that omits
SiteHeader/SiteFooter at the layout level) — no hydration dependency, kills the flash everywhere,
and is the clean home for search. This is a deliberate architectural change (route moves), NOT a
mid-flight patch. `KbNav solid` variant already exists for it.
