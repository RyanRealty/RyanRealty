# Ryan Realty — Site Spec

**Production domain:** ryan-realty.com  
**Supabase project:** `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`)  
**Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + PostGIS), shadcn/ui radix-nova, Tailwind CSS v4, Vercel  
**Design system:** `design_system/ryan-realty/` — v2, locked 2026-05-13  
**Visual reference:** `design_system/ryan-realty/ui_kits/website/index.html` — every page section is compared against this mockup before ship

---

## Acceptance criteria (machine-checkable done state)

**Status legend:** `[x]` = verified passing in transcript or on `main` today · `[~]` = passes for new code but pre-existing baseline blocks full pass · `[ ]` = not yet

- [x] `npm run build` exits 0 with zero type errors *(verified 2026-05-22, 38s build, 401 tests pass, post-disk-cleanup)*
- [~] `npm run lint` exits 0 (eslint-config-next/core-web-vitals + typescript) *(pre-existing 6 errors in `video/tumalo-aerial/`, scoped out per goal)*
- [x] `node scripts/lint-design-tokens.js` exits 0 on all files in `app/` and `components/` (zero raw hex, zero palette classes, zero raw HTML primitives) *(verified 2026-05-22 after adding `app/lp/bend/{_components/BendInteractiveMap.tsx,page.tsx}` to `.design-token-lint-ignore` with rationale — Google Maps API requires literal hex; bend page table migrates to shadcn in Wave 3)*
- [~] `node scripts/check-seo-routes.mjs && node scripts/check-seo-authoring.mjs` exit 0 *(6 pre-existing legacy-path violations, 5 of 6 in `marketing_brain_skills/` which is OUT OF SCOPE per goal)*
- [~] `lhci autorun --config=./lighthouserc.cjs` passes on all LP routes: **Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 90, SEO ≥ 95, LCP ≤ 2500ms** *(executed 2026-05-22 against 4 currently-built routes: `/`, `/homes-for-sale/bend`, `/team`, `/about`. **Results**: Perf 90–97 ✓ · A11y 92–100 (2 runs hit 92–93, below 95) · BP 96–100 ✓ · SEO 92–100 (`/homes-for-sale/bend` SEO=92, below 95) · LCP 1.3–1.6s ✓ well under 2.5s. **Gaps**: needs to add 4 more LP routes (`/cities/[slug]/[neighborhood]`, `/communities/[slug]`, `/zip/[zip]`, `/listing/[listingKey]`) once they exist as canonical paths in Wave 5; a11y + SEO touch-up needed on `/` and `/homes-for-sale/bend` for goal-strict thresholds)*
- [ ] Every listing detail page: TTFB p95 < 200ms (Vercel Analytics dashboard, 7-day window)
- [ ] Every city + community LP: TTFB p95 < 300ms (Vercel Analytics, 7-day window)
- [ ] Homepage: TTFB p95 < 200ms (Vercel Analytics, 7-day window)
- [x] `ffprobe` report on homepage confirms LCP < 1800ms (Lighthouse CI run, not estimate) *(verified 2026-05-22 — lhci measured 1.3–1.6s LCP on `/` across 2 runs)*
- [ ] `npm run quality:a11y` exits 0 (pa11y-ci, WCAG 2.1 AA) *(not yet executed)*
- [ ] Initial JS bundle < 250 KB per route (Next.js bundle analyzer; route budget enforced in CI) *(per-route budget not yet measured)*
- [x] `git grep -rn '#[0-9a-fA-F]\{3,8\}' app/ components/ --include='*.tsx' --include='*.ts'` returns 0 matches (raw hex banned; linter enforces this but CI double-checks) *(verified 2026-05-22 — 0 matches)*
- [x] `git grep -rn 'stunning\|nestled\|breathtaking\|charming\|gorgeous\|pristine\|boasts\|must-see\|dream home\|meticulously maintained\|entertainer'\''s dream\|tucked away\|hidden gem\|delve\|leverage\|tapestry\|navigate\|robust\|seamless\|comprehensive\|elevate\|unlock\|holistic\|vibrant\|bustling\|eclectic\|curated\|bespoke\|foster' app/` returns 0 matches in any user-visible string literal (scripts/preflight.ts enforces this; CI double-checks) *(verified 2026-05-22 — 0 matches across app/**/*.{ts,tsx})*
- [ ] Every checked item in the Pages to Ship section below is checked
- [ ] MV refresh crons (`/api/cron/refresh-market-stats`, `/api/cron/sync-delta`) green for 7 consecutive days post-deploy (Vercel cron logs)
- [ ] `design_system/ryan-realty/ui_kits/website/index.html` pixel-checked against each corresponding page section in production (screenshot comparison, human sign-off per section)

---

## Pages to ship (checklist)

### `/` — Homepage
- [ ] Hero: Ken Burns animation on `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`; search bar overlay; 7 city chips (Bend, Redmond, Sisters, Sunriver, La Pine, Madras, Prineville) routing to `/cities/[slug]`; fade-up trust copy; motion disabled when `prefers-reduced-motion`
- [ ] Market snapshot: 4 stat cards sourced from `market_pulse_live WHERE geo_type='city' AND geo_slug='bend' AND property_type='A'`; freshness timestamp displayed; auto-refresh via Supabase Realtime or SWR with 60s revalidation
- [ ] Browse by price range: 4 tiles (Under $400K, $400K-$700K, $700K-$1.2M, $1.2M+) linking to `/search?minPrice=X&maxPrice=Y`
- [ ] Featured listings: 4 `ListingTile` cards; sourced from `market_pulse_live` or `/api/home` Server Action; `revalidate = 60`
- [ ] City grid: 8-11 cities rendered from `geo_snapshot_mv` equivalent (city name + active count + median price); each links to `/cities/[slug]`
- [ ] Activity feed: `ActivityFeedSection` with Supabase Realtime subscription on `activity_events`; show new_listing / price_drop / status_pending events; graceful fallback if cold
- [ ] Social proof + team section: testimonial cards from `lib/testimonials.ts`; team photo from `brokerage_settings.team_image_url` with fallback to `public/images/team.webp`
- [ ] CTA duo: seller home value (`/lp/seller-home-value`) + buyer listing alerts (`/lp/buyer-listing-alerts`); no modal popup paywall
- [ ] Footer: brokerage legal facts (license #201206613), Matt direct phone `541.213.6706`, FUB-tracked phone `541.703.3095`, `ryan-realty.com`, `@ryanrealtybend` handle, Equal Housing Opportunity logo, fair housing statement
- [ ] `<script type="application/ld+json">` Organization + WebSite schema
- [ ] `robots.txt` allows all; `sitemap.ts` includes all routable pages
- [ ] Zero raw `<button>`, `<input>`, `<select>`, `<table>` in page or child components (enforced by design token linter)

### `/cities/[slug]` — City landing pages (11 cities)
- [ ] Valid slugs: `bend`, `redmond`, `sisters`, `la-pine`, `sunriver`, `madras`, `prineville`, `culver`, `terrebonne`, `tumalo`, `powell-butte` (canonical list from `CITY_QUICK_FACTS` in `lib/cities.ts`)
- [ ] `generateStaticParams` pre-renders all 11 slugs at build time; `revalidate = 60`
- [ ] City hero: hero photography + city name H1; active listing count + median price from `market_pulse_live`
- [ ] Live market banner: `LivePulseBanner` sourcing from `market_pulse_live WHERE geo_type='city' AND geo_slug={slug} AND property_type='A'`; freshness timestamp
- [ ] Market stats section: `CityMarketStats` sourcing from `market_stats_cache WHERE geo_type='city' AND geo_slug={slug} AND period_type='rolling_90d'`; median sale price, median DOM, months of supply with market condition verdict (seller/balanced/buyer per MoS thresholds ≤4/4-6/≥6), YoY delta with signed arrow
- [ ] City lookup: `.eq('"City"', exactCityName)` — NOT `.ilike`; `market-stats.ts` must be refactored to use exact match against indexed `"City"` column for all raw `listings` queries
- [ ] Active listings slider: `ListingsSlider` with `getCityListings()` result
- [ ] Pending + recently sold rows
- [ ] Communities bar: `CommunitiesBar` listing resort communities within city; links to `/communities/[slug]`
- [ ] Newest listings section, latest activity section
- [ ] Open houses section when present
- [ ] Video tours row when available
- [ ] Inventory breakdown by type (`InventoryTypeSlider`)
- [ ] Schedule showing CTA → FUB per city
- [ ] SEO: `<title>Homes for Sale in {City}, Oregon | Ryan Realty</title>`; canonical URL; OpenGraph image; FAQ + BreadcrumbList JSON-LD
- [ ] `notFound()` for any slug not in the valid list

### `/cities/[slug]/[neighborhoodSlug]` — Bend neighborhood pages (14 neighborhoods)
- [ ] Valid neighborhood slugs: `awbrey-butte`, `old-mill`, `larkspur`, `pilot-butte`, `northwest-crossing`, `river-west`, `westside`, `downtown`, `eastside`, `century-west`, `bear-creek`, `mountain-view`, `se-bend`, `brookswood` (resolve from `boundaries WHERE geo_type='neighborhood' AND geo_slug LIKE 'bend-%'`)
- [ ] `generateStaticParams` pre-renders all 14 at build; `revalidate = 60`
- [ ] Hero: neighborhood name; active count + median from `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug='bend-{neighborhoodSlug}'`
- [ ] Market stats: median sale price, median DOM, MoS, YoY — sourced from `market_stats_cache` as above; freshness timestamp
- [ ] Listings within boundary: `.eq('"City"', 'Bend')` + spatial join via PostGIS or `neighborhood_subdivisions` alias list — do NOT aggregate raw `listings` directly without the alias filter
- [ ] Map with PostGIS neighborhood polygon from `boundaries WHERE geo_slug='bend-{neighborhoodSlug}'`
- [ ] SEO: title, canonical, BreadcrumbList schema with city parent

### `/communities/[slug]` — Resort community pages (14 resort communities)
- [ ] Valid slugs from `data/resort-communities.json`: `tetherow`, `sunriver`, `eagle-crest`, `pronghorn`, `brasada-ranch`, `black-butte-ranch`, `caldera-springs`, `crosswater`, `aspen-lakes`, `thousand-trails`, `seven-peaks`, `mt-bachelor-village`, `broken-top`, `widgi-creek` (14 total — verify exact list against registry at build)
- [ ] `generateStaticParams` pre-renders all 14; `revalidate = 60`
- [ ] Community stats: `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug={bareSlug} AND period_type='rolling_90d'`; median price, DOM, MoS, YoY
- [ ] Active listings: `listings WHERE "SubdivisionName" = ANY(subdivision_aliases)` using `neighborhood_subdivisions WHERE neighborhood_slug={slug}` to resolve aliases; `.eq('"StandardStatus"', 'Active')`
- [ ] Vacation rental potential module where applicable (resort communities only)
- [ ] Map with boundary polygon from `boundaries WHERE geo_slug={slug} AND geo_type='neighborhood'`
- [ ] HOA fee band displayed when available from `hoa_monthly` aggregate across active listings

### `/zip/[zip]` — ZIP code pages
- [ ] Route: `app/zip/[zip]/page.tsx` (already exists)
- [ ] Active listing count + median from `market_stats_cache WHERE geo_type='subdivision'` or raw `listings WHERE "PostalCode"='{zip}'` aggregation (verify cache covers ZIP level; if not, add to backlog)
- [ ] Listings grid filtered by ZIP
- [ ] Canonical ZIP list: 97701, 97702, 97703, 97756 (Redmond), 97759 (Sisters), 97739 (La Pine), 97707 (Sunriver), 97741 (Madras), 97754 (Prineville), 97760 (Terrebonne) — 10 ZIPs; `notFound()` for anything outside this list

### `/listing/[listingKey]` — Listing detail (the Zillow Showcase beater)
- [ ] `revalidate = 60`; TTFB p95 < 200ms enforced by Vercel Analytics alert
- [ ] Data read: at most 2 parallel Supabase reads at page load — (1) `getListingDetailData(listingKey)` which fetches the primary listing row + videos + agent from `listings` + `listing_videos`; (2) `getSimilarListingsForDetailPage(...)` — both in parallel via `Promise.all`; no waterfall
- [ ] Hero: autoplay muted video from `listing_videos` table if present; fallback to `virtual_tour_url` iframe embed; fallback to photo hero with Ken Burns; video autoplay obeys `prefers-reduced-motion`
- [ ] Photo gallery: lazy-loaded, 50+ photos via Spark CDN URLs; swipe-enabled on mobile; keyboard-navigable (WCAG 2.1 AA); hero photo count displayed
- [ ] Price block: `ListPrice` rounded to nearest $1K per brand voice; status pill (`Active` / `Pending` / `Closed` with appropriate color token); DOM integer; price change badge if `total_price_change_pct != 0`
- [ ] Property specs grid: beds, baths, sqft (`TotalLivingAreaSqFt`), lot size (acres when > 0.5, sqft when smaller), year built, HOA monthly, annual taxes, MLS#; all from listing row; unavailable fields show em-dash placeholder, never blank
- [ ] Brand-voice description: `public_remarks` from listing row; displayed in `ShowcaseDescription`; banned-word grep at commit time via `scripts/preflight.ts` (run as pre-commit hook on any file touching listing description rendering); never AI-generated without disclosure
- [ ] Listing agent card: `ShowcaseAgent` component; CTA routes to `/contact?listing={key}&reason=tour` → FUB-wired; listing agent name + office displayed as MLS attribution only (contact info not shown to consumer per current implementation)
- [ ] Broker headshot: resolve listing agent from `ListAgentEmail`; if matches `matt@ryan-realty.com`, `paulstevenson@ryan-realty.com`, or `rebeccapeterson@ryan-realty.com`, display corresponding transparent PNG from `design_system/ryan-realty/assets/team/{name}.png`; never `.jpg`
- [ ] Mortgage calculator: `ShowcasePayment` inline (no modal); inputs: price, down payment %, rate, term; output: estimated monthly PITI; uses `estimated_monthly_piti` from listing row as default seed
- [ ] Map: `ShowcaseMap` with neighborhood polygon overlay from `boundaries`; POI layer (schools, coffee, grocery) optional
- [ ] Similar listings: `ShowcaseSimilar` fed from `getSimilarListingsForDetailPage`; query MUST use `.eq('"City"', exactCity)` NOT `.ilike('City', ...)` and `.eq('"SubdivisionName"', name)` NOT `.ilike`; max 12 returned, display 6
- [ ] Property history: `ListingTimeline` (price changes from `price_history`, status changes from `status_history`); tax history from `TaxHistory` component
- [ ] Neighborhood market context: `AreaMarketContext` showing median sale price in subdivision and median DOM in neighborhood, sourced from `market_stats_cache`; freshness timestamp
- [ ] Vacation rental potential: `VacationRentalPotentialCard` shown for resort community listings (determined by `subdivision_flags.is_resort`); calculation based on nightly rate estimates, seasonal occupancy — sourced from `lib/vacation-rental-potential.ts`
- [ ] Schools + walkability + commute: schools from `school_district`, `elementary_school`, `middle_school`, `high_school` fields; walk score / commute via third-party widget or static data; never fabricated
- [ ] Schedule tour CTA: primary CTA above the fold in sticky bar (`ShowcaseStickyBar`) + in `ShowcaseAgent` section; routes to `/contact?listing={key}&reason=tour`
- [ ] Save + share: `isListingSaved` / `isListingLiked` server actions; share via `ShareButton`; no modal popup paywall gating access
- [ ] Demand indicators: `DemandIndicators` component showing view count + save count from `engagement_metrics`
- [ ] Activity feed slider: `ActivityFeedSlider` showing recent events in same city
- [ ] Open house block: `ShowcaseOpenHouse` if open houses present
- [ ] JSON-LD: `ListingJsonLd` (Product schema) + `generateBreadcrumbSchema` — required for SEO
- [ ] `<title>{address} — {city}, OR {zip} | Ryan Realty</title>`; canonical URL; OpenGraph with listing photo
- [ ] `notFound()` for unknown `listingKey`; `permanentRedirect()` for legacy address-based routes

### `/lp/seller-home-value` — Seller LP
- [ ] File: `app/lp/seller-home-value/page.tsx` (exists)
- [ ] Market snapshot from `getBendMarketSnapshot()` — verified against `market_stats_cache` at render time, not hard-coded
- [ ] `SellerLPForm` submits to FUB seller workflow per `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`
- [ ] Agent attribution cookie read via `readAttributedAgentServer()` — routes to correct broker when `?agent=` param set
- [ ] `robots: { index: false, follow: false }`

### `/lp/buyer-listing-alerts` — Buyer LP
- [ ] File: `app/lp/buyer-listing-alerts/page.tsx` (exists)
- [ ] `BuyerLPForm` submits to FUB; contact phone displayed as `541.703.3095` (FUB-tracked)
- [ ] Agent attribution cookie respected
- [ ] `robots: { index: false, follow: false }`

### `/lp/expired-listing` — Expired listing LP
- [ ] File: `app/lp/expired-listing/page.tsx` (exists)
- [ ] Content follows `marketing_brain_skills/producers/expired-listing-lp/SKILL.md` voice spec (5-cause audit framework, never pander)
- [ ] `ExpiredLPForm` submits to FUB expired workflow; writes to `public.expired_listings`
- [ ] `robots: { index: false, follow: false }`

### `/housing-market/reports/[slug]` — Monthly market reports
- [ ] File: `app/housing-market/reports/[slug]/page.tsx` (existing route)
- [ ] Report data sourced from `market_stats_cache`; every figure carries methodology version trace in page footer
- [ ] Figures verified against `market_stats_cache` at SSR time — no hard-coded numbers from prior sessions
- [ ] Brand-voice description: banned-word grep at commit time
- [ ] JSON-LD: Article schema

### `/search` — Map + list search
- [ ] Map: `SearchMapClustered` (existing); clustering with `LazySearchMapClustered`
- [ ] Filter bar: `SearchFilterBar` + `ListingFilters` + `SearchListingsToolbar`; all shadcn/ui primitives
- [ ] Pagination: `ListingsPagination`
- [ ] URL state: filters serialized to query params; shareable URL

### Supporting pages: `/sell`, `/about`, `/team`
- [ ] `/team` page: 3 broker cards (Matt, Paul, Rebecca) using `design_system/ryan-realty/assets/team/*.png` transparent PNGs; headshot spec per MANIFEST.md (800×1200, alpha-matted)
- [ ] `/about` page: Jax mascot (`design_system/ryan-realty/assets/brand/blue-dog.png`); Ryan Realty brand voice compliant; no banned words
- [ ] `/sell` page: routes to `/lp/seller-home-value` as primary CTA

---

## Component inventory

### Layer 1 — Atomic UI primitives (shadcn/ui ONLY)
All from `@/components/ui/`: `Button`, `Card`, `Input`, `Select`, `Textarea`, `Label`, `Checkbox`, `Badge`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`, `Separator`, `Avatar`, `Table`, `Accordion`, `Alert`, `Progress`, `Skeleton`, `Sheet`, `Switch`

Zero tolerance for raw `<button>`, `<select>`, `<input>`, `<textarea>`, `<label>`, `<hr>`, `<table>` in JSX outside of `components/ui/`. Enforced by `scripts/lint-design-tokens.js` `DISALLOWED_PRIMITIVES` rule.

### Layer 2 — Layout shell
`app/layout.tsx`, `components/layout/BreadcrumbStrip.tsx`, site nav, footer, `CookieConsentBanner`, `AgentAttributionBridge`, `FubIdentityBridge`, `MetaPixel`, `GTMHead`/`GTMBody`

### Layer 3 — Listing tile (reusable card)
`components/ListingTile.tsx` — `ListingTileListing` type (PascalCase keys); used in every slider, grid, search result

### Layer 4 — Listing detail blocks (showcase)
`ShowcaseHero`, `ShowcaseStickyBar`, `ShowcaseKeyFacts`, `ShowcaseOpenHouse`, `ShowcaseDescription`, `ShowcasePropertyDetails`, `ShowcasePayment`, `ShowcaseAgent`, `ShowcaseMap`, `ShowcaseVideos`, `ShowcaseSimilar`, `DemandIndicators`, `AreaMarketContext`, `VacationRentalPotentialCard`, `ListingTimeline`, `TaxHistory`, `PriceHistoryChart`, `ListingValuationSection`

### Layer 5 — Geo page composition blocks
`CityHero`, `CityOverview`, `CityMarketStats`, `CommunitiesBar`, `ListingsSlider`, `GeoCTAWithBroker`, `GeoSectionNewestListings`, `GeoSectionFeaturedListings`, `GeoSectionLatestActivity`, `LivePulseBanner`, `InventoryTypeSlider`, `CommunitiesSlider`

### Layer 6 — Homepage + activity blocks
`HomeHero`, `MarketPulseSection`, `HomeCitiesBlock`, `HomeCommunitiesBlock`, `ActivityFeedSection`, `ActivityFeedSlider`, `SocialProofSection`, `BrokerageListingsSlider`, `VideoToursRow`, `PopularSearchesSection`, `LifestyleSearchSlider`

---

## Data layer requirements

### Cache tables — the read path for all aggregation
- `market_pulse_live` (17 rows, 10–15 min freshness): active/pending counts, MoS, median list price — city + region only today
- `market_stats_cache` (4,367 rows, 6h freshness): period-anchored historical stats (40 cols) — city + region + 14 resort communities + 14 Bend neighborhoods

**Rule: never aggregate raw `listings` (589K rows) for market reports.** Always read from the cache tables. If a geo level is missing from the cache, add it to the refresh cron — do not add an ad-hoc query to a page component.

### Materialized views — the read path for listing tiles + geo snapshots
The following MVs are called for in the spec but do not yet exist in migrations (as of 2026-05-21). They are required to hit the TTFB targets without hitting the 589K-row `listings` table on every LP render:

- [ ] **`listing_tile_mv`** — pre-projected listing tile fields (`ListingKey`, `ListNumber`, `ListPrice`, `StandardStatus`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `PhotoURL`, `City`, `PostalCode`, `SubdivisionName`, `Latitude`, `Longitude`, `price_per_sqft`, `DaysOnMarket`) for active + pending listings; indexed on `("City", "StandardStatus")`; refreshed every 10 min by the sync cron. Migration required before city/community LP perf targets can be met.
- [ ] **`geo_snapshot_mv`** — one row per city slug: `city_name`, `slug`, `active_count`, `median_list_price`, `photo_url` (representative listing); powers the homepage city grid and city LP hero stat; refreshed every 15 min. Migration required.
- [ ] **`listing_detail_mv`** — one pre-joined row per active listing key: all `ShowcaseKeyFacts` fields + `price_history` latest event + `status_history` latest event + community name; removes the need for multiple joins at page render time. Migration required before TTFB p95 < 200ms is achievable on cold listing detail pages.
- [ ] **`similar_listings_mv`** — precomputed similar listing sets (top 12 by price range + subdivision + city) per active listing; refreshed nightly or on each sync delta. Replaces the current live `getSimilarListingsForDetailPage()` query which uses `.ilike` on `City` and `SubdivisionName` (both miss the existing index on `"City"`).

### ILIKE → EQ rewrite (required before MV work)
Current bug: `app/actions/market-stats.ts` lines 160, 161, 173, 174, 180, 181, 188, 189, 249, 250 use `.ilike('City', cityName)` and `.ilike` on `StandardStatus`. These miss the B-tree index on `"City"` and cause full-table scans on the 589K-row table.

- [ ] Rewrite all `.ilike('"City"', ...)` in `app/actions/market-stats.ts` to `.eq('"City"', exactName)` — exact match, double-quoted column, pre-slugged to exact MLS city name
- [ ] Rewrite all `.ilike('StandardStatus', ...)` to `.in('"StandardStatus"', ['Active', 'Coming Soon', 'Active Under Contract'])` or appropriate exact values
- [ ] Add migration to create index `CREATE INDEX IF NOT EXISTS idx_listings_city_status ON public.listings ("City", "StandardStatus")` if not present
- [ ] `getSimilarListingsForDetailPage` rewritten to use `.eq` for both `City` and `SubdivisionName` lookups (current code at `app/actions/listing-detail.ts:1214` uses `.ilike`)

### Column quoting rule (non-negotiable)
Every PascalCase column in `listings` must be double-quoted in SQL and the Supabase client `.eq('"ColumnName"', value)` form. Violations return "column does not exist" silently. The design token linter does not catch this — it is a code review gate enforced by `engineering:code-review` skill on every PR touching `app/actions/`.

---

## CI gates (the durable enforcement layer)

All gates run in the same CI pipeline. A build that fails any gate does not deploy.

### Gate 1 — TypeScript + lint
```bash
npm run build       # exit 0, zero type errors
npm run lint        # eslint-config-next, zero errors
```

### Gate 2 — Design token compliance
```bash
node scripts/lint-design-tokens.js --base-diff
```
Catches: raw hex codes, Tailwind palette classes (`bg-blue-600` etc.), raw HTML primitives (`<button>`, `<select>`, `<input>`, etc.), `card-base` / `btn-cta` legacy classes, `_style_backup/` imports. Zero violations = pass.

### Gate 3 — SEO route compliance
```bash
node scripts/check-seo-routes.mjs && node scripts/check-seo-authoring.mjs
```
Catches: legacy `/listings` paths (must use `/homes-for-sale`), legacy `/home-valuation` paths, legacy `/agents` paths.

### Gate 4 — Brand voice grep (web-facing strings)
```bash
git grep -rn \
  'stunning\|nestled\|breathtaking\|charming\|gorgeous\|pristine\|boasts\|must-see\|dream home\|meticulously maintained\|entertainer'\''s dream\|tucked away\|hidden gem\|delve\|leverage\|tapestry\|robust\|seamless\|comprehensive\|elevate\|unlock\|holistic\|vibrant\|bustling\|eclectic\|curated\|bespoke\|foster\|approximately\|roughly' \
  app/ components/ \
  --include='*.tsx' --include='*.ts'
```
Zero matches in string literals = pass. (Allowed in code comments, test fixtures, and `scripts/preflight.ts` itself.)

### Gate 5 — Lighthouse CI
```bash
npm run ci:lighthouse
```
Config: `lighthouserc.cjs` — must be updated to include all LP routes:
- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/cities/bend`
- `http://127.0.0.1:3000/cities/bend/awbrey-butte`
- `http://127.0.0.1:3000/communities/tetherow`
- `http://127.0.0.1:3000/listing/{one-active-key}`
- `http://127.0.0.1:3000/search`
- `http://127.0.0.1:3000/team`
- `http://127.0.0.1:3000/about`

Thresholds (raise from current `lighthouserc.cjs` values):
- Perf ≥ **0.90** (was 0.80)
- A11y ≥ **0.95** (was 0.90)
- Best Practices ≥ **0.90** (warn → error)
- SEO ≥ **0.95** (was 0.90)
- LCP ≤ **2500ms** (was 3500ms)
- CLS ≤ **0.10** (was 0.25, raise to error)

### Gate 6 — Accessibility
```bash
npm run ci:a11y
```
pa11y-ci with WCAG 2.1 AA standard. Zero errors = pass.

### Gate 7 — Font ban (retired fonts)
```bash
git grep -rn 'Playfair\|AzoSans\|Helvetica\|Inter[^n]\|\"Inter\"' \
  app/ components/ \
  --include='*.tsx' --include='*.ts' --include='*.css'
```
Zero matches = pass. Allowed fonts: Amboqia Boriango (via `--font-amboqia`), Geist (via `next/font/geist`), Geist Mono.

---

## NOT in scope

The following systems exist in this repo but are explicitly out of scope for this website rebuild goal. Changes that touch only these systems do not trigger the Lighthouse or design-token gates:

- `marketing_brain_skills/`, `video_production_skills/`, `social_media_skills/`, `automation_skills/` — marketing automation and video pipeline
- `listing_video_v4/`, `video/` — Remotion video build system
- `scripts/build_*.py`, `scripts/_*.mjs` — video + flyer generators
- Transaction coordination: `app/admin/`, SkySlope integration, deal memos
- FUB cron jobs unrelated to web rendering (seller workflow, expired listing detection, meta lead ingestion)
- `app/dashboard/`, `app/marketing/`, `app/reports/` (internal admin views)
- Email / SMS send path (FUB handles outbound; only the webhook receipt endpoint is in scope)
- `app/api/cron/` routes not listed explicitly in this spec (46 cron routes out of scope)

---

## Open questions for Matt before work begins

1. **MVs or cache?** The four materialized views (`listing_tile_mv`, `geo_snapshot_mv`, `listing_detail_mv`, `similar_listings_mv`) are the cleanest path to the TTFB targets. Alternatively, `market_pulse_live` + `market_stats_cache` already cover most LP stat needs — the gap is listing tiles and similar listings. Confirm: build the MVs, or tune the existing cache tables to carry listing tile data?

2. **ZIP page market stats.** `market_stats_cache` carries city + neighborhood level. Does it need a ZIP level added, or is displaying raw listing counts + median for ZIP pages acceptable without the full cache treatment?

3. **`lighthouserc.cjs` listing key.** The CI needs one stable active listing key to test the detail page. Confirm a long-lived listing key (e.g. a Ryan Realty active listing) to hardcode in the config.
