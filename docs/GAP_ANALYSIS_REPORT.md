# Platform Requirements vs Codebase — Gap Analysis Report

**Generated:** March 12, 2026
**Source:** PLATFORM_REQUIREMENTS_v25.md (52 sections + 3 appendices)
**Codebase:** RyanRealty (Next.js 16 / React 19 / Tailwind v4 / Supabase)

---

## Executive Summary

The RyanRealty codebase is substantially built. Out of 52 requirement sections, **32 are fully or mostly implemented**, **12 are partially built**, and **8 are missing or not started**. The core platform — MLS sync, listing display, search, community/city/neighborhood pages, admin backend, lead scoring, CRM integration, blog, open houses, market reports, and PWA — is production-ready. The primary gaps are in premium/differentiator features: the AI chat assistant, ARYEO integration, rate limiting, social publishing, comparison tray UI, and some third-party data integrations.

---

## Scoring Legend

| Rating | Meaning |
|--------|---------|
| **BUILT** | Feature is fully implemented and matches requirements |
| **MOSTLY BUILT** | Core feature works; minor enhancements needed |
| **PARTIAL** | Foundation exists but significant work remains |
| **MISSING** | Not implemented at all |
| **DEFERRED** | Explicitly deferred in requirements doc |

---

## Section-by-Section Assessment

### Foundation & Architecture (Sections 1–7)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Project Vision & Core Principles | **BUILT** | Design system, brand tokens, mobile-first approach all in place |
| 2 | Build Methodology & Developer Context | **BUILT** | Cursor rules, design docs, build-step docs all present |
| 3 | Tech Stack | **BUILT** | Next.js 16.1.6, React 19, Tailwind v4, Supabase, all confirmed in package.json |
| 4 | Integration Inventory & Env Vars | **MOSTLY BUILT** | Spark API, FUB, Resend, Sentry, GA4/GTM, Meta Pixel, Google Maps, Inngest, xAI Grok, OpenAI all integrated. Missing: Upstash Redis, Walk Score, SchoolDigger, Microsoft Clarity, ARYEO |
| 5 | Architecture Notes | **BUILT** | App Router, server actions, Supabase auth, RLS policies |
| 6 | Data Architecture & Geographic Hierarchy | **BUILT** | 86 tables across 95 migrations. Geographic hierarchy (city → neighborhood → community) fully modeled with PostGIS |
| 7 | Data Syncing Engine | **BUILT** | Full sync + delta sync via Inngest with step orchestration, retry logic, sync_state tracking, Spark API integration. 14+ Inngest background functions |

### Listing & Property Features (Sections 8–10)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 8 | Listing Data Model & Display | **BUILT** | Listing detail page at 49.2KB is fully featured — photo gallery, property details, map, mortgage calculator, nearby listings, open house banner, engagement buttons, breadcrumbs, JSON-LD |
| 9 | Enhanced Listing Pages (ARYEO) | **MISSING** | No ARYEO integration exists. No listing_enhancements table usage, no download center URL processing, no manual media upload for enhanced listings |
| 10 | Property Valuation Engine (CMA) | **MOSTLY BUILT** | CMA engine at `lib/cma.ts`, pre-computation via Inngest (`precomputeCMA`), PDF generation (`lib/pdf/cma-pdf.tsx`), API endpoint at `/api/cma/[propertyId]`. Missing: CMA as a Supabase stored procedure (currently in app code), AI-enhanced valuation refinement, gated shareable CMA URLs for lead capture |

### AI Features (Sections 11–15)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 11 | AI Features Layer | **PARTIAL** | **AI Search (11.1):** Not found — no `/api/ai/search` endpoint for natural language listing search. **AI Chat "Ask Ryan" (11.2):** MISSING — no floating chat button, no chat panel, no `ai_chat_sessions` usage. **AI Content Generation (11.3):** BUILT — AI text generation at `/api/ai/generate-text`, blog generation via Inngest, `ai_content` table, admin AI assist button |
| 12 | AI Optimization Agent | **PARTIAL** | Daily analytics agent exists (`inngest/functions/aiAnalyticsAgent.ts`), `agent_insights` table with priority levels, GA4 data API integration (`app/actions/ga4-report.ts`). Missing: GitHub Issues creation for code recommendations, Search Console integration, autonomous SEO meta regeneration |
| 13 | AI Video Pipeline | **DEFERRED** | Correctly deferred per requirements. Env vars reserved |
| 14 | AI Blog Engine | **BUILT** | Full blog generation via `inngest/functions/generateBlogPost.ts`, blog pages at `/blog` and `/blog/[slug]`, draft/publish workflow, AI content queue |
| 15 | Content Engine & Social Publishing | **MISSING** | No social media auto-posting (Facebook, Instagram, LinkedIn). Content engine trigger map exists as a doc (`docs/CONTENT_ENGINE_TRIGGER_MAP.md`) but no implementation |

### Site Structure & Pages (Sections 16–22)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 16 | Homepage & Site Structure | **BUILT** | 12 homepage sections: hero, featured homes, communities, trending, trust section, email subscribe, footer. All confirmed visually |
| 17 | Search, Filtering & Map | **BUILT** | Split view (list/map), advanced filters (beds/baths/price/community/city/status/acreage/fireplace/golf view), map pins with price badges, URL-driven filter state |
| 18 | Community, Resort & Neighborhood Pages | **BUILT** | Full community pages with hero, listings, market stats. Resort communities with amenity details. Neighborhood pages with market overview. City pages with full content |
| 19 | Broker & Brokerage Pages | **BUILT** | Broker detail pages at `/team/[slug]` with bio, headshot, stats, listings. Brokerage about page. Broker intro video support (migration exists) |
| 20 | Broker-Listing Association | **BUILT** | License matching logic links brokers to their listings via Spark API data |
| 21 | Broker Review Aggregation | **PARTIAL** | Google Business reviews mentioned in docs but no dedicated review aggregation API integration found. No Zillow/Realtor.com review scraping |
| 22 | Google Business Profile | **MISSING** | No GBP integration. No review syncing, no data consistency checks |

### User Features (Sections 23–27)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 23 | User Accounts & Dashboards | **BUILT** | Full auth via Supabase (Google/Apple/email), user dashboard at `/dashboard` and `/account`, saved listings, saved searches, buying preferences, notification settings |
| 24 | Social Engagement & Feed | **MOSTLY BUILT** | Feed mode at `/feed` with infinite scroll, like/save/share on listings, engagement_metrics and trending_scores tables, community_engagement_metrics. Missing: real-time "X people viewing" (requires Supabase Realtime), configurable trending thresholds in admin |
| 25 | Video & Media Strategy | **MOSTLY BUILT** | Video pages at `/videos` with TikTok/Reels-style mobile layout, video player component, MLS video URL extraction. Missing: ARYEO video import, video card hover-preview (Netflix effect) |
| 26 | Imagery & Unsplash | **PARTIAL** | Next.js `<Image>` with AVIF/WebP optimization, Unsplash configured in `next.config.ts` remote patterns. Missing: automated Unsplash hero image fetching per community/city, `page_images` table, Unsplash attribution display |
| 27 | Sharing & Social Distribution | **MOSTLY BUILT** | Dynamic OG images at `/api/og`, share functionality on listing cards, UTM parameter support. Missing: Web Share API on mobile, share modal with platform-specific buttons on desktop |

### Lead Generation & CRM (Sections 28–30)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 28 | Lead Generation & Scoring | **BUILT** | 16-activity-type lead scoring at `lib/lead-scoring.ts`, 4-tier system (cold/warm/hot/very_hot), weekly decay, FUB sync on tier changes, daily Inngest computation at 3 AM |
| 29 | Notification Architecture | **MOSTLY BUILT** | Dual-channel (Resend user-facing + FUB broker-facing), notification_queue with Inngest processing every minute, saved search match notifications, price drop alerts, open house reminders. Missing: React Email component library (using HTML strings), Resend webhook for bounce/unsubscribe handling partially implemented |
| 30 | Tracking & Analytics | **MOSTLY BUILT** | GA4 + GTM + Meta Pixel/CAPI all integrated. `trackEvent` utility, cookie consent banner, data layer events. Missing: Microsoft Clarity, complete GA4 custom dimension registration, admin analytics dashboard pulling GA4 Data API in real-time |

### Admin & Reporting (Sections 31–33)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 31 | Admin Backend | **BUILT** | 28 admin routes covering: dashboard, brokers, listings, email campaigns/compose, expired listings, geo management, optimization, query builder, reports (market/leads/brokers/custom), resort communities, site pages, sync management, users, audit log, banners |
| 32 | Reporting Engine | **MOSTLY BUILT** | Market stats pre-computed via `computeMarketStats` Inngest function, `reporting_cache` table, chart rendering with `SalesReportCharts.tsx`, city/community report pages, admin report builder at `/admin/reports/custom`. Missing: full CMA report sections (comp map, methodology narrative), report scheduling UI for recurring delivery, CSV/Excel export, blog-from-report one-click publish |
| 33 | Market Stats Pre-Computation | **BUILT** | Fully implemented via `computeMarketStats` stored procedure and Inngest trigger after each sync |

### Personalization & Third-Party Data (Sections 34–35)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 34 | Identified Personalization | **PARTIAL** | Buying preferences stored, feed accepts userId for future pgvector personalization. Missing: site-wide behavioral adaptation, personalized homepage sections, "recently viewed" recommendations |
| 35 | Third-Party Data | **PARTIAL** | Google Maps/Places integrated. Missing: Walk Score API, SchoolDigger API, US Census demographics, neighborhood amenity data caching |

### Seller & Comparison Tools (Sections 36–37)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 36 | Seller Experience / What's My Home Worth | **PARTIAL** | Seller landing page exists at `/sell/valuation`. Missing: address auto-complete with instant CMA estimate, lead capture gate on full breakdown, seller content guide pages, seller-specific notifications |
| 37 | Home Comparison Tool | **PARTIAL** | Comparison PDF exists (`lib/pdf/comparison-pdf.tsx`). Missing: comparison tray UI (sticky bottom bar), `/compare?ids=` page with side-by-side interactive layout, highlight logic, comparison sharing |

### Open Houses & Broker Tools (Sections 38–41)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 38 | Open Houses | **BUILT** | Open house pages, RSVP with API endpoint, calendar/ICS support, automatic 24h + 1h reminder emails, FUB integration, listing page banners |
| 39 | Broker Tools | **PARTIAL** | CMA report generation exists. Missing: QR code generation, Just Listed/Just Sold automated campaigns, listing presentation generator, configurable templates |
| 40 | Broker Performance Dashboard | **MOSTLY BUILT** | `computeBrokerStats` Inngest function, `broker_stats` table, `BrokerStats.tsx` component. Missing: full leaderboard UI, response time metrics, lead attribution by broker |
| 41 | Print & PDF Export | **PARTIAL** | CMA PDF and comparison PDF exist. Listing PDF endpoint at `/api/pdf/listing`. Market report PDF at `/api/pdf/report`. Missing: branded social card image export, CSV/Excel data export |

### Notifications & Mobile (Sections 42–43)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 42 | Notification Preference Management | **MOSTLY BUILT** | User notification settings in account dashboard, frequency preferences for saved searches, email unsubscribe handling |
| 43 | Mobile & PWA | **MOSTLY BUILT** | manifest.json configured, VAPID push notification infrastructure, responsive design, PWA icons. Missing: service worker file not found (Serwist configured but SW may not be generated), bottom navigation bar on mobile (currently uses hamburger menu), swipe gestures, install prompt banner |

### Performance & SEO (Section 44)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 44 | Performance, Speed & SEO | **MOSTLY BUILT** | Next.js SSR/SSG, image optimization (AVIF/WebP), security headers, sitemap regeneration via Inngest, robots.txt, JSON-LD on listing/community/city pages, breadcrumbs, canonical URLs, SEO redirects. Missing: llms.txt, HTML sitemap page, automated internal linking in AI content, comprehensive image alt text from photo classification, axe-playwright CI testing |

### Neighborhood & Site Pages (Sections 45–46)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 45 | Neighborhood Data Sources | **PARTIAL** | Google Maps/Places API key available. Missing: nearby amenity queries cached per listing, Census demographics integration |
| 46 | Missing Site Pages | **MOSTLY BUILT** | About page, contact page, all legal pages (privacy, terms, DMCA, accessibility, cookie policy), /sell page, 404 page all exist. Missing: HTML sitemap page |

### Quality & Compliance (Sections 47–50)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 47 | Accessibility (WCAG 2.1 AA) | **PARTIAL** | Dedicated accessibility statement page, ARIA labels throughout, semantic HTML, breadcrumbs. Missing: skip-to-content link implementation, focus trap on modals, axe-playwright CI integration, screen reader testing |
| 48 | UX Standards | **MOSTLY BUILT** | Skeleton screens (`.skeleton` class in design system), loading states, empty states in dashboard, custom 404 page. Missing: custom 500 error page, offline banner |
| 49 | Email Deliverability | **MOSTLY BUILT** | Resend configured, webhook handling for delivery events. DNS (SPF/DKIM/DMARC) is an ops task |
| 50 | Security & Compliance | **MOSTLY BUILT** | Security headers (X-Frame-Options, nosniff, strict-origin referrer), Supabase RLS, Sentry error monitoring. Missing: rate limiting (Upstash), input sanitization library recently added (isomorphic-dompurify) |
| 50b | Market Intelligence System | **PARTIAL** | trending_scores and engagement_metrics tables exist, community_engagement_metrics computed. Missing: full market intelligence dashboard in admin, automated alert system |

### Build Order & Open Questions (Sections 51–52)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 51 | Build Order | N/A | Reference section. Priorities 1-8 appear substantially complete |
| 52 | Open Questions | N/A | Decision items for Matt to resolve |

---

## Infrastructure & Backend Summary

| Component | Count | Status |
|-----------|-------|--------|
| App routes (pages) | ~98 | Comprehensive |
| Admin routes | 28 | Full CRUD for all entities |
| API endpoints | 23 | Sync, webhooks, PDFs, tracking, AI |
| Inngest functions | 16 | Sync, notifications, stats, scoring, blog, CMA, analytics |
| Database tables | 86 | Across 95 migrations |
| Integrations | 10 active | Spark API, FUB, Resend, GA4/GTM, Meta Pixel/CAPI, Google Maps, Inngest, Grok AI, OpenAI, Sentry |

---

## Priority Gap Rankings

### Priority 1 — High Impact, Revenue-Affecting

1. **AI Chat Assistant "Ask Ryan" (Sec 11.2)** — Primary engagement and lead capture tool. Missing entirely. Requires: floating button component, chat panel (desktop sidebar + mobile full-screen), Grok API integration with context injection, session storage, broker handoff logic, FUB event push.

2. **Rate Limiting / Upstash (Sec 50)** — Security requirement before launch. No rate limiting on any endpoint. AI search, chat, contact forms, and API routes are all unprotected. Requires: Upstash Redis setup, middleware for IP-based rate limiting.

3. **Home Comparison Tray & Page (Sec 37)** — High-intent buyer feature. PDF generation exists but no interactive UI. Requires: comparison tray (persistent bottom bar with React context + localStorage), `/compare` page with side-by-side layout, highlight logic, sharing.

4. **Seller "What's My Home Worth" Full Flow (Sec 36)** — Primary seller lead funnel. Landing page exists but missing the core value: instant address-based estimate with lead capture gate. Requires: address autocomplete, CMA engine integration, value display page, lead capture gate, FUB push.

### Priority 2 — Differentiators & Competitive Advantage

5. **ARYEO Integration (Sec 9)** — Premium listing enhancement. Missing entirely. Requires: ARYEO download center URL parser, media import to Supabase Storage, `listing_enhancements` table, enhanced listing page display, manual upload fallback in admin.

6. **AI Natural Language Search (Sec 11.1)** — Differentiator feature. No endpoint exists. Requires: `/api/ai/search` route, Grok prompt for filter extraction, fallback to keyword search, Upstash cache for results.

7. **Supabase Realtime for "X People Viewing" (Sec 24)** — Social proof driver. No Realtime subscriptions exist. Requires: presence channel per listing page, viewer count display, ephemeral tracking.

8. **Google Business Profile Integration (Sec 22)** — Local SEO and trust signals. Missing. Requires: GBP API setup, review syncing, NAP consistency verification.

### Priority 3 — Polish & Completions

9. **Mobile Bottom Navigation Bar (Sec 43)** — Currently using hamburger menu. Requirements specify a persistent 5-tab bottom nav (Home, Search, Saved, Video Feed, Profile) for mobile.

10. **Service Worker / Offline Support (Sec 43)** — Serwist is configured but no service worker file was found. PWA offline caching may not be functional.

11. **Microsoft Clarity (Sec 30/44)** — Free heatmap and session recording tool. Just needs a GTM tag.

12. **Third-Party Data APIs (Sec 35/45)** — Walk Score, SchoolDigger, Census demographics. Enriches listing and community pages. All are affordable or free.

13. **Report Scheduling UI (Sec 32)** — Cron-based report delivery exists but no admin UI for brokers to schedule custom recurring reports.

14. **Social Publishing / Content Engine (Sec 15)** — Auto-posting to social platforms. Consider whether this is needed for launch or can be deferred.

15. **Exit Intent Popup (Sec 19 implied in Sec 30)** — GA4 event name exists but no popup component.

16. **Accessibility Improvements (Sec 47)** — Skip-to-content links, focus traps, axe-playwright CI tests.

17. **Web Share API on Mobile (Sec 27)** — Native share sheet instead of custom modal. Small effort, big UX improvement.

---

## What Looks Good

The codebase is impressively comprehensive for a custom real estate platform. Standout implementations:

- **MLS Sync Engine** — Full + delta sync with Inngest orchestration, retry logic, and status tracking is production-grade
- **Lead Scoring** — 16-activity-type scoring with weekly decay and FUB sync is more sophisticated than most platforms
- **Market Reports** — Pre-computed reporting cache with chart rendering on city/community pages
- **Admin Backend** — 28 routes with full CRUD, audit logging, email campaigns, query builder
- **Open Houses** — Complete with RSVP, calendar export, automatic reminder emails
- **Blog Engine** — AI-powered generation with draft/publish workflow
- **Dynamic OG Images** — Edge-generated branded previews for all page types
- **Cookie Consent** — GDPR/CCPA compliant with granular preferences
- **Notification Queue** — Background processing with deduplication and frequency preferences
- **Video Experience** — TikTok/Reels-style mobile feed is a modern touch

---

## Recommended Next Steps

1. **Before launch:** Rate limiting (Upstash), accessibility fixes, service worker verification, security audit
2. **High-value features:** AI Chat "Ask Ryan", full seller valuation flow, comparison tray
3. **Post-launch phase 1:** ARYEO integration, AI natural language search, Google Business Profile
4. **Post-launch phase 2:** Supabase Realtime, social publishing, third-party data APIs, personalization engine
