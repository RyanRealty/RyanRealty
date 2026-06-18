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
- 2026-06-18 — Next wave (D): `/housing-market` hub + city-level reports `/housing-market/[...slug]`
  → KB (mirror the verified region report). Then search/buy/zip, about/team, sell.
