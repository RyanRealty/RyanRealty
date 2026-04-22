# Ryan Realty Unified Master Plan

**Status**: Active — workstream plan (scope + ownership). NOT a status tracker.
**Phase status**: See `docs/plans/task-registry.json`. Run `npx tsx scripts/orchestrate.ts next`.
**Branch**: `main`
**Last content update**: 2026-04-05

> Naming note: "Phase 1" in this file refers to the original baseline Reporting
> Data Layer phase (T2-006). "Phase 1" in `docs/plans/data-architecture-plan.md`
> refers to the schema-foundation phase tracked as BL-009. These are not the
> same thing. When in doubt, refer to the task ID (T-*** or BL-***).

This document merges the three canonical plan files (Market Data Platform, Comprehensive Page Optimization, Monetization Strategy) into a single phased execution plan. All conflict resolutions, gap mitigations, and new requirements (R1-R10) from the unified plan brief are incorporated.

---

## Guiding Principles

1. **SEO is a gate, not a feature.** Every phase must pass SEO verification before shipping (R1).
2. **File ownership is enforced.** See the ownership matrix below. Violating ownership causes merge conflicts and regressions.
3. **Each phase has a brief.** Agents work from the current phase brief (`docs/plans/phase-N-brief.md`), not this document directly.
4. **Fallbacks for dependencies.** Every feature has a fallback if its upstream dependency isn't built yet.

---

## File Ownership Matrix

| File / Area | Owner | Others May... |
|---|---|---|
| `supabase/migrations/*_market_stats*` | Reporting | Not touch |
| `app/actions/market-stats.ts` | Reporting | Import and call |
| `app/api/cron/sync-full/route.ts` | Reporting | Not touch |
| `components/reports/*` | Reporting | Import and render |
| `app/housing-market/` | Reporting | Monetization adds AdUnit slots |
| `app/search/[...slug]/page.tsx` section order | Engagement | Monetization adds ad slots + route segments |
| `app/page.tsx` section order | Engagement | Monetization adds ad slots |
| `app/listing/[listingKey]/page.tsx` sections | Engagement | Monetization adds ad slots |
| `app/actions/activity-feed.ts` | Engagement | Not touch |
| `components/PageCTA.tsx` | Engagement | Not touch |
| `components/AdUnit.tsx` | Monetization | Others don't touch |
| `app/layout.tsx` (site-wide banner) | Monetization | Engagement doesn't add global UI |
| `app/sitemap.ts` | Monetization | Reporting may add report URLs |
| `app/guides/*` | Monetization | Not touch |
| `lib/followupboss.ts` | Shared | Extend carefully, don't break existing |
| `components/ShareButton.tsx` | Shared | Extend carefully |
| `app/admin/*` | Admin | Only superuser changes |

---

## Conflict Resolutions (10 Resolved)

### CR-1: Three plans modify `app/search/[...slug]/page.tsx`
Engagement owns section ordering. Reporting provides data layer + stats components. Monetization adds ad placements and programmatic route segments as a layer on top. Execute order: Reporting data → Engagement restructure → Monetization ads/routes.

### CR-2: Duplicate market pulse/stats components
Reporting builds LivePulseBanner, FreshnessBadge, StatCard, MiniSparkline, MarketHealthGauge (and the data layer they consume). Engagement uses these components; does NOT create its own MarketPulseBanner.

### CR-3: Duplicate lead capture components
Monetization's SiteLeadCaptureBanner is site-wide sticky (`layout.tsx`). Engagement's PageCTA is contextual mid-page (per page). StickyMobileCTA must not stack with SiteLeadCaptureBanner -- suppress one when the other is visible.

### CR-4: Both modify `app/layout.tsx`
Monetization owns `layout.tsx` changes for the site-wide lead banner. Engagement keeps additions page-specific.

### CR-5: Market stats data layer
Reporting's `market_stats_cache` and `market_pulse_live` are the single source of truth. Engagement uses `getLiveMarketPulse()` and `getCachedStats()` from Reporting's `app/actions/market-stats.ts`. Do NOT use old `getCityMarketStats()` functions.

### CR-6: Browse-by components vs programmatic filter pages
Monetization owns route creation (`/search/bend/under-300k`). Engagement builds the UI browse components but links to Monetization's routes, not query-param URLs.

### CR-7: `app/reports/page.tsx` modifications
Reporting owns data/content structure. Monetization adds AdUnit slots into the layout Reporting creates. `/reports/` will 301 redirect to `/housing-market/reports/` per Q3 decision.

### CR-8: Guides/Blog infrastructure
Monetization owns guides DB table, routes, admin UI. If using Reporting's narrative engine, auto-generated narratives feed INTO Monetization's guides infrastructure.

### CR-9: Listing detail page additions
Engagement owns content sections. Monetization slots ads between sections. Agreed order: existing sections → AreaMarketContext → AdUnit → Similar Listings → ActivityFeedSlider → RecentlySoldRow → Sidebar ad below CTA.

### CR-10: Post-sync hooks
Only Reporting modifies `app/api/cron/sync-full/route.ts`.

---

## New Requirements (R1-R10)

### R1: SEO as a Foundational Constraint
Every page, URL, and component must follow SEO best practices. Violations are treated as bugs with highest priority. Known bugs: listing URL canonical inconsistency, sitemap 5,000 cap, missing OG/Twitter images on many pages.

### R2: Social Sharing Excellence
Every shareable page must produce beautiful previews. Missing OG images, no Instagram sharing, missing `twitter:image` on many pages, ShareButton missing from several pages.

### R3: User Engagement Completeness
Viewing history broken (nothing writes `view_listing` to `user_activities`), recently viewed gone from home page, can't edit saved search filters, shared collections dropped, saved search email alerts have no email provider.

### R4: Video as a First-Class Feature
`listing_videos` table not populated by sync, video hover preview specced but not built, need "Video Tours in [City]" sections, two listing routes read video differently, need `og:video` tags.

### R5: Open House Surfacing Everywhere
Need dedicated sections on city pages, home page, neighborhood pages. Need `/open-houses/` and `/open-houses/[city]/` landing pages.

### R6: Vacation Rental Potential
Surface STR status on applicable listings. External API (AirDNA/Mashvisor) for rental income estimates is TBD.

### R7: Seller-Side Tools
Already built (`/home-valuation`, `/sell`, `/buy`). No additional work needed.

### R8: Admin and Broker Experience
4 placeholder dashboard panels, admin search bar non-functional, audit log incomplete, email campaigns broken, encoding bug. Broker self-service editing and performance dashboard needed.

### R9: Broker-Listing Auto-Mapping Fix
`SPARK_SELECT_FIELDS` missing `ListAgentStateLicense` and `ListAgentEmail`. Matching fails for bulk-synced listings.

### R10: Authentication & Identity Tracking
Nudge-to-sign-in UX strategy, cookie consent alignment, consistent FUB Registration event across all auth flows.

---

## Gap Mitigations

| # | Gap | Mitigation |
|---|---|---|
| 1 | No migration transition plan | Phase 1 builds new tables alongside old RPCs; Phase 2 switches consumers; deprecate old RPCs in Phase 3 |
| 2 | Cold start / empty cache | Backfill RPC runs before any page switch; fallback to old RPCs if cache is empty |
| 3 | Activity events readiness | Derive from `listing_history` table (solution confirmed) |
| 4 | No performance budget | Every new section lazy-loaded via Intersection Observer; max 3 eager sections above fold |
| 5 | No loading/error states | Every new data-dependent section gets a `loading.tsx` skeleton and `error.tsx` boundary |
| 6 | Content creation plan | AI-generated with strict quality constraints (Q2 resolved) |
| 7 | No A/B testing plan | Defer formal A/B; use GA4 event comparison between lead capture surfaces |
| 8 | SEO transition plan | `/reports/` → `/housing-market/` with 301 redirects (Q3 resolved) |
| 9 | Sitemap scaling | Sitemap index splitting in Phase 0 |
| 10 | No rollback strategy | Feature flags via env vars; each phase is a deployable unit |
| 11 | No env var tracking | Each phase brief lists required new env vars |
| 12 | No monitoring plan | Defer Sentry to Phase 4; use Vercel Analytics + GA4 until then |
| 13 | No testing plan | Build verification (`npm run build`) is the minimum gate; E2E deferred to Phase 4 |
| 14 | FUB event taxonomy | Document in each phase brief which FUB events each new component sends |
| 15 | GA4 event taxonomy | Document in each phase brief which GA4 events to fire |
| 16-18 | Lead routing, attribution, broker notification | Resolved via Q1 (agent cookie + UTM + FUB native) |
| 19 | Listing URL canonical | Fix in Phase 0 |
| 20 | Viewing history broken | Fix in Phase 0 |
| 21 | Email alerts no provider | Defer email provider integration to Phase 4 |
| 22 | `listing_videos` not populated | Fix in Phase 0 |
| 23 | `SPARK_SELECT_FIELDS` missing fields | Fix in Phase 0 |
| 24 | OG images/tags incomplete | Fix in Phase 0 |
| 25 | Video card hover preview | Build in Phase 2 |

---

## Phase 0: Critical Fixes (SEO Bugs, Sync Gaps, Broken Features)

**Goal**: Fix data integrity and SEO issues that undermine everything built on top.

### 0.1 Listing URL Canonical Consistency (R1)
- **Status**: Being replaced by Data Architecture Optimization plan (`.cursor/plans/data_architecture_optimization_*.plan.md`, Phase 3)
- **Updated decision (2026-04-05)**: Canonical listing URLs use MLS number (ListNumber) + full address slug: `/homes-for-sale/{city}/[{neighborhood}/]{community}/{address-slug}-{mlsNumber}`. Fallback: `/homes-for-sale/listing/{mlsNumber}`. This replaces the earlier `/listing/{key}-{slug}` spec. Old ListingKey-based URLs 301-redirect to canonical.
- **Files**: `lib/slug.ts`, `app/sitemap.ts`, `components/ListingTile.tsx`, `app/listing/[listingKey]/page.tsx`, `next.config.ts`, plus 12 additional test/config files that form an atomic URL change unit (documented in the Data Architecture plan Part K).
- **Verify**: All 16 files in the atomic URL unit are consistent. `npm run quality:full` passes.

### 0.2 Add Missing Spark Select Fields (R9)
- **Files**: `lib/spark-odata.ts`
- **Change**: Add `ListAgentStateLicense` and `ListAgentEmail` to `SPARK_SELECT_FIELDS`.
- **Verify**: After next sync, spot-check `listing_agents` table for non-null `agent_license` and `agent_email`.

### 0.3 Fix `listing_videos` Population (R4)
- **Files**: `app/actions/sync-spark.ts` or the sync pipeline that processes Spark listings
- **Change**: When processing a listing's `details.Videos` array, upsert rows into `listing_videos` table. Align the two listing routes (`/listing/[listingKey]` and `/listings/[listingKey]`) to read from the same source.
- **Verify**: After sync, `SELECT count(*) FROM listing_videos` returns non-zero for listings with videos.

### 0.4 Fix Viewing History (R3)
- **Files**: `lib/activity-tracker.ts`, the component that tracks listing views (e.g., `TrackListingView`)
- **Change**: Call `logActivity('view_listing', ...)` to write a row to `user_activities` when a logged-in user views a listing. This makes `/dashboard/history` functional.
- **Verify**: Sign in, view a listing, check `/dashboard/history` shows it.

### 0.5 Fix OG Images and Twitter Tags (R1, R2)
- **Files**: Metadata/`generateMetadata` in: `app/sell/page.tsx`, `app/buy/page.tsx`, `app/blog/page.tsx`, `app/feed/page.tsx`, `app/reports/page.tsx`, `app/reports/explore/page.tsx`, `app/listings/page.tsx`, community pages, city pages, agent pages
- **Change**: Add `og:image` and `twitter:image` to all pages missing them. Wire existing `/api/og` routes for blog and broker pages. Create a generic fallback OG image if `og-home.png` doesn't exist in `public/`.
- **Verify**: Use `curl -s <url> | grep 'og:image'` on each page type. All return a valid image URL.

### 0.6 Sitemap Index Splitting (Gap 9)
- **Files**: `app/sitemap.ts` (or convert to `app/sitemap/[id]/route.ts`)
- **Change**: Split sitemap into multiple files when listing count exceeds 5,000 (Google's limit per sitemap file). Use sitemap index.
- **Verify**: `curl localhost:3000/sitemap.xml` returns a sitemap index with multiple `<sitemap>` entries.

---

## Phase 1: Reporting Data Layer + Sync Hooks

**Goal**: Build the data foundation that all market intelligence features depend on.

**Owner**: Reporting

### 1.1 Database Migration
- **Files**: `supabase/migrations/YYYYMMDD_market_stats_cache.sql`
- **Change**: Create `market_stats_cache` table (period stats with sold_count, median/avg price, volume, DOM, speed percentiles, ppsf, sale-to-list, price bands, bedroom/property breakdown, market health score, YoY comparisons). Create `market_pulse_live` table (real-time snapshot per geography). Create `market_narratives` table (auto-generated text with overview, analysis sections, FAQ JSON).
- **Verify**: `supabase db push` succeeds. Tables exist with correct columns and indexes.

### 1.2 Data Investigation
- **Files**: New admin utility or script
- **Change**: Scan `details` JSONB on closed listings for `ClosePrice`, `OriginalListPrice`, `SoldPrice`. Test Spark Market Statistics API endpoints for accessibility (200 vs 403).
- **Verify**: Log output shows which price fields are available. API test returns status code.

### 1.3 Computation RPCs
- **Files**: `supabase/migrations/YYYYMMDD_market_rpcs.sql`
- **Change**: Create `compute_and_cache_period_stats` RPC (all metrics for one geography + period). Create `refresh_market_pulse` RPC (single scan, upserts all geography rows). Create `refresh_current_period_stats` RPC (recomputes current unfrozen periods).
- **Verify**: Call each RPC manually; check `market_stats_cache` and `market_pulse_live` populate correctly.

### 1.4 Market Health Score
- **Files**: Part of `compute_and_cache_period_stats` RPC
- **Change**: Implement 0-100 score from: absorption rate (0-25), speed/inverse DOM (0-20), price competition (0-15), supply tightness (0-20), price momentum (0-10), new-vs-closings ratio (0-10). Labels: 80-100 Very Hot, 60-79 Hot, 40-59 Warm, 20-39 Cool, 0-19 Cold.
- **Verify**: Score computed for Bend returns a plausible number with correct label.

### 1.5 Narrative Generation Engine
- **Files**: `supabase/migrations/YYYYMMDD_narrative_engine.sql` or `lib/market-narrative.ts`
- **Change**: Create `generate_market_narrative` function that produces overview (150-250 words), price/speed/inventory analysis, buyer/seller outlook, and FAQ Q&A pairs using conditional template logic with data thresholds. Store in `market_narratives` table.
- **Verify**: Generated narrative for Bend reads naturally and includes real numbers.

### 1.6 Backfill + Post-Sync Hooks
- **Files**: New `backfill_all_historical_stats` RPC, `app/api/cron/sync-full/route.ts`
- **Change**: Backfill RPC iterates all cities + subdivisions + region, computes stats for each historical month/quarter/year, freezes completed periods. Hook `refresh_market_pulse` and `refresh_current_period_stats` into the sync-full cron (every 15 min after sync completes).
- **Verify**: After running backfill, `market_stats_cache` has 12+ months of data per city. After a sync cycle, `market_pulse_live.updated_at` is fresh.

### 1.7 Server Actions
- **Files**: `app/actions/market-stats.ts`
- **Change**: Create `getCachedStats`, `getStatsTimeSeries`, `getLiveMarketPulse`, `getMarketNarrative`, `getMarketOverview`, `getHottestCommunities` server actions.
- **Verify**: Each action returns expected data shape. Import works from page components.

### 1.8 Reporting Components
- **Files**: `components/reports/StatCard.tsx`, `LivePulseBanner.tsx`, `FreshnessBadge.tsx`, `MiniSparkline.tsx`, `MarketHealthGauge.tsx`, `PriceBandChart.tsx`, `TrendLineChart.tsx`, `CommunityLeaderboard.tsx`
- **Change**: Build reusable components consuming server actions from 1.7. StatCard shows value + YoY arrow. MarketHealthGauge shows 0-100 gauge. LivePulseBanner shows active/pending/new counts with freshness badge.
- **Verify**: Components render with mock data. `npm run build` passes.

---

## Phase 2: Engagement Page Restructuring

**Goal**: Redesign page content using Reporting components. Surface video, open houses, and sharing improvements.

**Owner**: Engagement (uses Reporting components)

### 2.1 Activity Feed Wiring
- **Files**: `components/ActivityFeedSlider.tsx` (new), `app/actions/activity-feed.ts` (extend), `app/page.tsx`, `app/search/[...slug]/page.tsx`, `app/listing/[listingKey]/page.tsx`
- **Change**: Build `ActivityFeedSlider` wrapping `ActivityFeedCard` in horizontal scroll. Extend `getActivityFeed` with subdivision filter and event_type filter. Add `status_expired` and `back_on_market` events. Wire into Home (after Homes for You), City (after market pulse), Community (after About), Listing Detail (after Similar Listings).
- **Verify**: Each page type shows activity feed with real data. Subdivision filter works.

### 2.2 Market Pulse on Pages
- **Files**: `app/search/[...slug]/page.tsx`, `app/page.tsx`
- **Change**: Replace basic market snapshot on city pages with Reporting's `LivePulseBanner` + `FreshnessBadge`. Add stats strip to home page. All stats sourced from `getLiveMarketPulse()` and `getCachedStats()` (NOT old `getCityMarketStats`).
- **Verify**: City pages show live pulse data. Freshness badge shows "Updated X minutes ago."

### 2.3 Recently Sold Sections
- **Files**: `components/RecentlySoldRow.tsx` (new), `app/actions/recently-sold.ts` (new)
- **Change**: Build slider of recently closed sales with photo, "Sold" badge, sale price, original list price (strikethrough), % over/under, DOM, beds/baths/sqft. Wire into City and Community pages.
- **Verify**: Shows recently closed listings with accurate sale data.

### 2.4 Demand Indicators on Listing Pages
- **Files**: `components/listing/DemandIndicators.tsx` (new), `app/actions/listing-views.ts` (new)
- **Change**: Show "X people viewed this home" (from `listing_views`), "X people saved this home" (from `getSavedListingCount`), "Trending" badge if in trending results. Add DOM context: "This home has been on the market for X days. The average in {City} is Y days."
- **Verify**: Listing detail pages show view count, save count, and DOM comparison.

### 2.5 Price History Chart
- **Files**: `components/listing/PriceHistoryChart.tsx` (new)
- **Change**: Replace or augment plain `ListingHistory` list with a visual timeline/step chart showing price changes and status events. Use lightweight chart approach (Recharts or SVG).
- **Verify**: Chart renders for listings with price history data.

### 2.6 Area Market Context
- **Files**: `components/listing/AreaMarketContext.tsx` (new)
- **Change**: New section on listing detail showing: price/sqft vs area median, price positioning (% above/below median), list-to-sale ratio for the area, current inventory count. Data from `getCachedStats()`.
- **Verify**: Component renders with comparative metrics for the listing's city/subdivision.

### 2.7 Video Surfacing (R4)
- **Files**: `components/ListingTile.tsx` (enhance), city/home page files, listing detail pages
- **Change**: Video hover/auto-play on listing cards (crossfade to video preview on mouseenter). Add "Video Tours in [City]" sections on city and home pages. Add `og:video` tags for listings with videos. Unify video reading between `/listing/` and `/listings/` routes.
- **Verify**: Hovering a listing card with video shows preview. OG meta includes `og:video` when video exists.

### 2.8 Open House Sections (R5)
- **Files**: City page, home page, community page files, `app/open-houses/page.tsx` (new), `app/open-houses/[city]/page.tsx` (new)
- **Change**: Add "Open houses in [City] this week" sections on city pages. Add open house highlight on home page. Create dedicated `/open-houses/` and `/open-houses/[city]/` landing pages.
- **Verify**: Open house sections show listings with upcoming open houses. Dedicated pages render.

### 2.9 Sharing Improvements (R2)
- **Files**: `components/ShareButton.tsx`, metadata across all page types
- **Change**: Add Instagram sharing option. Add stats-enriched share text for Twitter/LinkedIn. Add WhatsApp and SMS sharing. Place ShareButton on home page, feed page, blog pages, sell/buy pages where missing. Wire existing `/api/og` routes to pages that have them but aren't connected.
- **Verify**: ShareButton shows on all major page types. Each share platform gets appropriate preview text.

### 2.10 Home Page Restructure
- **Files**: `app/page.tsx`
- **Change**: Add sections in order: "What's Happening" ActivityFeedSlider, "Discover by Lifestyle" FeatureCollectionRow (links to Monetization's filter pages), "Browse by Price Range" PriceRangeBrowse, "Find Your Perfect Match" PageCTA, "Your Local Team" broker row. Enhance existing sections: trending badges with view counts, community tiles with median price, city tiles with median price.
- **Verify**: Home page has all new sections. Section order matches spec. Mobile responsive.

### 2.11 City Page Restructure
- **Files**: `app/search/[...slug]/page.tsx` (single slug paths)
- **Change**: Add: About {City} section from `city-content.ts`, MarketPulseBanner, ActivityFeedSlider, RecentlySoldRow, FeatureCollectionRow (city-scoped), PriceRangeBrowse (city-scoped), BedroomBrowse links, PageCTA ("Get notified"), ExploreNearbyCities, AgentCard. Enhance: communities list with median price + count.
- **Verify**: City pages have all new sections with city-scoped data.

### 2.12 Community Page Restructure
- **Files**: `app/search/[...slug]/page.tsx` (two slug paths)
- **Change**: Add: CommunityQuickFacts strip (HOA range, price range, lot size, year built), MarketPulseBanner (subdivision-scoped), ActivityFeedSlider (subdivision-scoped), RecentlySoldRow (subdivision-scoped), "What Makes {Community} Unique" feature highlights, PageCTA (agent-personalized), CommunityCompare table. Enhance: nearby communities with metrics.
- **Verify**: Community pages show subdivision-specific data. Compare table renders for resort communities.

### 2.13 Listing Detail Enhancements
- **Files**: `app/listing/[listingKey]/page.tsx`
- **Change**: Add DemandIndicators to key facts strip. Add PriceHistoryChart. Add AreaMarketContext section. Add ActivityFeedSlider ("What's happening nearby"). Add RecentlySoldRow ("Recently Sold Nearby"). Enhance cost breakdown with tax + HOA. Enhance community section with quick stats. Enhance similar listings with grouping. Section order per CR-9.
- **Verify**: Listing detail shows all new sections. Ad slots positioned per agreed order.

---

## Phase 3: Monetization Layer

**Goal**: Add revenue-generating infrastructure. Programmatic pages, ads, lead capture, blog/guides.

**Owner**: Monetization

### 3.1 AdUnit + InFeedAdCard Components
- **Files**: `components/AdUnit.tsx` (new), `components/search/InFeedAdCard.tsx` (new)
- **Change**: AdUnit renders AdSense `<ins>` tag, checks `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and cookie consent, calls `adsbygoogle.push` on mount. InFeedAdCard matches ListingTile dimensions. Returns null when unconfigured.
- **Verify**: Component renders placeholder in dev. Returns null without AdSense ID.

### 3.2 Ad Placement on Existing Pages
- **Files**: `app/listing/[listingKey]/page.tsx`, `app/search/[...slug]/page.tsx`, `app/page.tsx`, other pages
- **Change**: Place ads per CR-9 agreed order. Listing detail: after description, after community section, between similar/floor plans, sidebar below CTA. Search: after market pulse, InFeedAdCard every 6-8 tiles, after nearby communities. Home: after AffordabilityRow, before Browse by City.
- **Verify**: `npm run build` passes. Ads render in correct positions.

### 3.3 Programmatic Filter Pages
- **Files**: `lib/filter-pages.ts` (new), `app/search/[...slug]/page.tsx` (extend routing), `supabase/migrations/YYYYMMDD_filter_page_content.sql`
- **Change**: Define ~17 filter types (price ranges, property types, bedroom counts, features). Detect filter slug in `slug[1]`. Generate unique metadata per city+filter. AI-generate intro content via Grok, store in `filter_page_content` table. ~120-170 new indexable pages.
- **Verify**: `/search/bend/under-300k` renders with correct filters applied and unique metadata.

### 3.4 Lead Capture Surfaces with FUB Attribution (R1 Q1)
- **Files**: `components/HomeValuationCta.tsx` (new), `components/ExitIntentPopup.tsx` (new), middleware or hook for agent cookie, `lib/followupboss.ts` (extend)
- **Change**: Build agent tracking cookie system (detect `?agent=slug`, store in cookie with FUB agent name/ID). Extend `FubEventPerson` with `assignedTo`, `assignedUserId`, `tags`. Extend `sendEvent()` to support `campaign` object (UTM data). Build HomeValuationCta (seller leads to FUB Seller Inquiry). Build ExitIntentPopup (email capture, once per session). Build report lead gate (email for full content).
- **Verify**: Lead submissions arrive in FUB with correct event types. Agent attribution cookie persists. UTM data appears in FUB campaign object.

### 3.5 Blog/Guides Infrastructure
- **Files**: `supabase/migrations/YYYYMMDD_guides.sql`, `app/guides/page.tsx` (new), `app/guides/[slug]/page.tsx` (new), `app/admin/guides/page.tsx` (new)
- **Change**: Create guides table (slug, title, meta_description, content_html, category, city, status, published_at). Build index page with category grouping. Build detail page with AdUnit placements and lead CTAs. Build admin CRUD following existing admin pattern.
- **Verify**: Admin can create/edit/publish guides. Published guides render at `/guides/{slug}`.

### 3.6 Guide Content Generation
- **Files**: Content in `guides` table
- **Change**: Generate 33-40 articles using Grok: "Moving to [City]" x7, "Best Neighborhoods in [City]" x7, "[City] Real Estate Market [Year]" x7, buyer education x5, lifestyle x7. AI-generated with real data grounding, 150-250 word min per section, unique per page, FAQ schema markup.
- **Verify**: Each guide has unique content. FAQ schema validates. No duplicate content across guides.

### 3.7 Sitemap Expansion
- **Files**: `app/sitemap.ts`
- **Change**: Add filter pages (priority 0.80), ZIP code pages (priority 0.70), guide pages (priority 0.65). Only include filter pages that have listings. Respect sitemap index splitting from Phase 0.
- **Verify**: Sitemap includes new page types. No 404s from sitemap URLs.

### 3.8 Internal Linking Section
- **Files**: `app/search/[...slug]/page.tsx` (city-level)
- **Change**: Add "Browse by" section below communities list with links to filter pages: by price, by type, by size, by feature. Each link goes to corresponding filter page route.
- **Verify**: Links render on city pages. All link targets are valid routes.

### 3.9 FUB Event Coverage
- **Files**: `lib/followupboss.ts`, all new lead capture components
- **Change**: Map all new lead capture to FUB events: PageCTA → General Inquiry, HomeValuationCta → Seller Inquiry, Report gate → Registration, Exit popup → Registration, Lender referral → General Inquiry (tagged), Broker form → Property Inquiry. Propagate `fubPersonId` to components that don't receive it yet.
- **Verify**: Each lead capture type creates correct FUB event. No lead capture surface is silent.

---

## Phase 4: Advanced Features

**Goal**: Housing market hub, email alerts, broker tools, admin cleanup.

### 4.1 `/housing-market/` Hub Pages
- **Files**: `app/housing-market/page.tsx` (new), `app/housing-market/[...slug]/page.tsx` (new), middleware for 301 redirects
- **Change**: Build hub page with Central Oregon overview + city cards grid. Build city market pages with full content template (13 sections from Reporting plan). Build community market pages. Set up 301 redirects: `/reports/` → `/housing-market/reports/`, `/reports/[slug]` → `/housing-market/reports/[slug]`, `/reports/explore` → `/housing-market/explore/`.
- **Verify**: All `/housing-market/` pages render. 301 redirects work. Internal links point to new URLs.

### 4.2 Dynamic OG Images for Market Pages
- **Files**: `app/housing-market/[...slug]/opengraph-image.tsx` (new), `app/search/[...slug]/opengraph-image.tsx` (new)
- **Change**: Generate 1200x630 OG images using Next.js ImageResponse. Dark gradient background, logo, freshness date, title, 4 stat cards, mini bar chart. Schema markup: FAQPage, Dataset, BreadcrumbList, Article, Place.
- **Verify**: Share a market page URL on Twitter/Facebook card validator. Preview shows data-rich image.

### 4.3 Saved Search Email Alerts (R3)
- **Files**: Email provider integration (Resend/SendGrid/Postmark TBD), Inngest job enhancement
- **Change**: Integrate email provider for user-facing emails. Connect existing Inngest saved-search matching job to email delivery. Users with saved searches receive notifications when new matching listings appear.
- **Verify**: Save a search, list a matching property, receive email notification.

### 4.4 Broker Experience (R8)
- **Files**: `app/admin/broker/*` or `app/team/[slug]/edit/page.tsx` (new), `app/admin/broker-dashboard/page.tsx` (new)
- **Change**: Broker self-service: edit bio, photo, social links, intro video without superuser. Broker performance dashboard: listing count, views, saves, video views, DOM, sold volume. Brokerage-wide listings view (superuser).
- **Verify**: Broker can log in and edit their profile. Dashboard shows real performance data.

### 4.5 Admin Cleanup (R8)
- **Files**: `app/admin/page.tsx`, `app/admin/email/compose/page.tsx`, various admin pages
- **Change**: Replace 4 placeholder panels with real data or honest "not yet available" states. Wire admin search bar to search listings/brokers/users. Fix email compose encoding bug ("Sendingâ€¦"). Wire email compose to `email_campaigns` table. Complete audit log coverage for site pages, brokerage settings, banners.
- **Verify**: No placeholder text visible on admin dashboard. Search returns results. Email compose shows correct UTF-8.

### 4.6 Monthly Report Snapshots
- **Files**: `app/housing-market/reports/[slug]/page.tsx` (new)
- **Change**: Build monthly snapshot pages with frozen historical data + auto-generated narrative + shareable OG image. Link from evergreen city pages and reports index.
- **Verify**: `/housing-market/reports/bend-march-2026` renders with correct frozen data.

### 4.7 Regional Hub
- **Files**: `app/housing-market/central-oregon/page.tsx` (new)
- **Change**: Build regional hub aggregating all cities. This is the competitive moat page no national portal has.
- **Verify**: Page renders with data from all Central Oregon cities.

---

## Phase 5: Future Differentiators

**Goal**: Features that create lasting competitive advantages.

### 5.1 PDF/Excel Export for Market Reports (Q4)
- **Files**: `app/api/reports/export/route.ts` (new)
- **Change**: Generate downloadable PDF and Excel versions of market reports. Agents share with clients. Include branded header, stats, charts, narrative.
- **Verify**: Download button produces valid PDF with correct data.

### 5.2 Semantic Search with pgvector (Q4)
- **Files**: `supabase/migrations/YYYYMMDD_pgvector.sql`, `app/actions/semantic-search.ts` (new)
- **Change**: Enable pgvector extension. Generate embeddings for listing descriptions. Natural language search: "3 bedroom with mountain view near downtown Bend."
- **Verify**: Semantic search returns relevant results for natural language queries.

### 5.3 Vacation Rental Potential (R6)
- **Files**: Listing detail enhancement, external API integration
- **Change**: Surface STR status from HOA rental restrictions. Integrate AirDNA or Mashvisor API (TBD) for rental income estimates. Show estimated income on listings in vacation-rental-friendly areas.
- **Verify**: Applicable listings show rental potential data.

### 5.4 Revenue-Generating Tools
- **Files**: `app/compare/page.tsx` (new), `app/tools/appreciation/page.tsx` (new), `app/activity/page.tsx` (new), `app/resources/page.tsx` (new)
- **Change**: Community comparison tool (side-by-side stats). Appreciation calculator (historical value growth). Live activity feed as standalone page. Vendor marketplace directory.
- **Verify**: Each tool renders with real data and includes ad units + lead capture CTAs.

---

## Phase 6: Later Backlog

### 6.1 Google Search Console API Integration
Automated SEO tracking at scale. Feed into admin dashboard.

### 6.2 Realtime Likes/Saves via Supabase Realtime
Live engagement signals. Social proof updates without page refresh.

### 6.3 Partnership Revenue Structures
Lender referrals ($200-500 per funded loan), relocation referrals (25% commission), annual comprehensive market report (sponsored), vendor marketplace fees ($50-200/month per vendor).

### 6.4 Revenue Tracking Dashboard
Admin panel tracking ad revenue (GA4 AdSense data), lead volume by type/source, estimated lead value, blended revenue per page cluster.

---

## Deferred Indefinitely

- Auto-optimization cron (too vague)
- Infinite scroll feed (pagination better for SEO)
- Voice search (almost nobody uses it)
- Admin audit log expansion (not a growth driver)

---

## SEO Verification Checklist (Every Phase Gate)

Before any phase ships:
- [ ] URL canonicalization consistent (sitemap = internal links = canonical tag)
- [ ] Sitemap accurate and within 5,000 per file
- [ ] Structured data / JSON-LD on every new page type
- [ ] `og:title`, `og:description`, `og:image` on every new page
- [ ] `twitter:image` on every new page
- [ ] Breadcrumbs consistent
- [ ] Internal linking: new pages link to parents and siblings
- [ ] No new Core Web Vitals regressions (lazy load below-fold)
- [ ] 301 redirects for any URL changes
- [ ] `npm run build` passes with zero errors
