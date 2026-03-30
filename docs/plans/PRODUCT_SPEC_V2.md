# Ryan Realty — Definitive Product Specification v2

**Purpose**: This document replaces the original master plan as the single source of truth for what this product must be. It is derived from competitive research (Zillow, Redfin, Realtor.com, Compass), current AI/real estate industry trends, and a thorough audit of the existing codebase.

**Last Updated**: 2026-03-30

---

## 1. Product Vision

Build the best real estate brokerage website in Central Oregon, designed to scale nationally. Leverage modern technology (Next.js 16, React 19, Supabase, AI) to outperform legacy platforms (Zillow, Redfin, Realtor.com) on speed, intelligence, and user experience.

### Success Metrics
| Metric | Target | How Measured |
|--------|--------|-------------|
| Organic search traffic | Top 3 for "homes for sale [city]" in Central Oregon | Google Search Console |
| AI/LLM citations | Cited by ChatGPT, Perplexity, Gemini for Central Oregon real estate queries | Manual + monitoring |
| Lead generation | 50+ qualified leads/month within 6 months | Follow Up Boss |
| Conversion rate | 3%+ visitor-to-lead | GA4 |
| Page speed | LCP < 2.5s, CLS < 0.1, FID < 100ms | Lighthouse CI |
| SEO score | 90+ on all public pages | Lighthouse CI |
| Accessibility | WCAG 2.0 AA on all pages | pa11y-ci |

### Revenue Streams
1. **Brokerage commissions** — Primary revenue from transactions
2. **Lead referrals** — Partner agent referral fees for areas outside brokerage coverage
3. **Mortgage referrals** — Lender partnership referral fees
4. **Advertising** — AdSense on content pages (guides, market reports)
5. **Vendor marketplace** — Local service provider directory (future)

---

## 2. Competitive Analysis

### What Zillow Does (2026)
- **AI Mode**: Conversational search ("Ask Zillow" chat) for natural language queries
- **Draw-on-map search**: Users draw boundaries to define search areas
- **Zestimate**: Proprietary home valuation on every property
- **Notification center**: Customizable alerts (instant/daily/weekly) for saved searches, price changes, open houses
- **Filter by monthly payment**: Not just list price
- **Magazine-style listing photos**: Wide, immersive layout
- **Price/tax history**: Full historical data with charts
- **Climate risk data**: Flood, fire, wind, heat risk scores
- **Neighborhood data**: Walk Score, transit score, bike score, noise levels
- **School information**: GreatSchools ratings with distance
- **3D tours**: Virtual walkthrough integration
- **Sharing + favorites**: Social features that improve personalization

### What Redfin Does (2026)
- **Conversational search**: Natural language search in app and ChatGPT integration
- **Redfin Estimate**: Their valuation tool
- **Walk/transit/bike/noise scores**: WalkScore integration
- **Climate risk**: Flood, fire, heat, wind risk data
- **Tax history**: Multi-year property tax display
- **School ratings**: GreatSchools integration
- **Sale history**: Previous transaction data
- **Neighborhood insights**: Area-specific data and trends
- **Market trends**: City and neighborhood-level statistics

### What Compass Does (2026)
- **AI-powered agent tools**: Voice-activated assistant, AI writing, predictive analytics
- **Buyer Demand**: Real-time visibility into serious buyer activity
- **CRM automation**: Intelligent contact management
- **Collection sharing**: Curated property collections for clients
- **Luxury Presence**: Premium design and SEO partnership

### Where Incumbents Are Weak (Our Opportunity)
1. **Local market depth** — National portals show generic data. We can show hyperlocal community-specific insights no national site has.
2. **Speed** — Legacy platforms are slow. Next.js 16 with server components is faster.
3. **AI-native from day one** — They're retrofitting AI. We build it in.
4. **Agent relationship** — They commoditize agents. We elevate the brokerage's agents.
5. **Content authority** — They have thin, auto-generated content. We can have deep, data-grounded local expertise content.
6. **Structured data for LLMs** — They're optimizing for Google. We optimize for ChatGPT, Perplexity, Gemini, and Google simultaneously.

---

## 3. Complete Feature Specification

### 3.1 Search & Discovery

| Feature | Status | Details |
|---------|--------|---------|
| Text search with autocomplete | ✅ EXISTS | `SmartSearch.tsx` — searches cities, communities, ZIP codes with debounced suggestions |
| Price range filter | ✅ EXISTS | Preset ranges + custom min/max in `SearchFilters.tsx` |
| Beds/baths filter | ✅ EXISTS | Dropdown selectors |
| Property type filter | ✅ EXISTS | Single/Multi/Condo/Townhouse/Land/Manufactured |
| Sqft range filter | ✅ EXISTS | Min/max in `AdvancedSearchFilters.tsx` |
| Lot size filter | ✅ EXISTS | Acres min/max |
| Year built filter | ✅ EXISTS | Min/max |
| Status filter | ✅ EXISTS | Active, Pending, Sold, All |
| Sort options | ✅ EXISTS | Price, newest, oldest, price/sqft, year built (8 options) |
| Map view with clustering | ✅ EXISTS | `SearchMapClustered.tsx` with Google Maps + MarkerClusterer |
| Map/list split view | ✅ EXISTS | `SearchSplitView.tsx`, `UnifiedMapListingsView.tsx` |
| Pool/view/waterfront filter | ✅ EXISTS | Boolean filters in advanced search |
| Garage filter | ✅ EXISTS | Min garage spaces |
| Open house filter | ✅ EXISTS | `hasOpenHouse` parameter |
| Keywords search | ✅ EXISTS | Free-text keyword filter |
| ZIP code search | ✅ EXISTS | Postal code filter + dedicated `/zip/[zip]` pages |
| Days on market filter | ✅ EXISTS | `daysOnMarket` parameter |
| Save search | ✅ EXISTS | `SaveSearchButton.tsx` component |
| Results pagination | ✅ EXISTS | Page-based pagination |
| **Draw-on-map polygon search** | ❌ MISSING | Zillow/Redfin have this. Need `DrawingManager` from Google Maps API |
| **Filter by monthly payment** | ❌ MISSING | Zillow has this. Calculate from price + estimated rate + taxes |
| **Recent searches** | ❌ MISSING | Show user's recent search queries for quick re-access |
| **Natural language / AI search** | ⚠️ PARTIAL | Chat widget exists (`ChatWidget.tsx`) but not integrated with search. Should be "Ask Ryan Realty" on search page |
| **Search results count** | ✅ EXISTS | Shows count in search toolbar |

### 3.2 Listing Detail Page

| Feature | Status | Details |
|---------|--------|---------|
| Photo gallery with lightbox | ✅ EXISTS | `ListingGallery.tsx` — grid, lightbox, keyboard nav |
| Video tours | ✅ EXISTS | `ShowcaseVideos.tsx` section |
| Key facts bar | ✅ EXISTS | `ShowcaseKeyFacts.tsx` — beds, baths, sqft, price/sqft, lot, year, status |
| Price history chart | ✅ EXISTS | `PriceHistoryChart.tsx` with Recharts |
| Property description | ✅ EXISTS | `ShowcaseDescription.tsx` |
| Property details (expandable) | ✅ EXISTS | `ShowcasePropertyDetails.tsx` — Interior, Exterior, Community, Utilities, HOA, Legal |
| Map with location | ✅ EXISTS | `ShowcaseMap.tsx` with Google Maps |
| Monthly cost breakdown | ✅ EXISTS | `ShowcasePayment.tsx` — mortgage estimate |
| Similar listings | ✅ EXISTS | `ShowcaseSimilar.tsx` with fallback logic |
| Demand indicators | ✅ EXISTS | `DemandIndicators.tsx` — views, saves, trending badge, DOM comparison |
| Area market context | ✅ EXISTS | `AreaMarketContext.tsx` — price/sqft vs median, positioning, inventory |
| Activity feed | ✅ EXISTS | `ActivityFeedSlider.tsx` — nearby activity |
| Recently sold nearby | ✅ EXISTS | `RecentlySoldRow.tsx` |
| Open house banner | ✅ EXISTS | `ShowcaseOpenHouse.tsx` |
| Agent contact (schedule showing) | ✅ EXISTS | `ShowcaseAgent.tsx` — in-page modals for inquiry |
| Save button | ✅ EXISTS | `ListingActions.tsx` |
| Share button | ✅ EXISTS | `ListingActions.tsx` — copy link, email, text, social |
| Breadcrumb navigation | ✅ EXISTS | `BreadcrumbStrip.tsx` |
| Sticky header bar | ✅ EXISTS | `ShowcaseStickyBar.tsx` |
| Ad unit placements | ✅ EXISTS | `AdUnit.tsx` in correct positions per CR-9 |
| Vacation rental potential | ✅ EXISTS | `VacationRentalPotentialCard.tsx` |
| Listing tracker (analytics) | ✅ EXISTS | `ListingTracker.tsx` tracks views |
| JSON-LD structured data | ✅ EXISTS | `ListingJsonLd.tsx` |
| **Walk Score / Transit Score** | ❌ MISSING | Redfin/Zillow show this. Need WalkScore API or similar |
| **School information** | ⚠️ PARTIAL | Referenced in code but no dedicated school section with ratings |
| **Climate/flood risk** | ❌ MISSING | Redfin/Zillow show this. Environmental risk data |
| **Tax history** | ❌ MISSING | Multi-year tax assessment data |
| **Full-screen photo gallery** | ⚠️ PARTIAL | Lightbox exists but needs swipe on mobile, better UX |
| **Print-friendly view** | ❌ MISSING | No @media print styles |
| **3D virtual tour embed** | ⚠️ PARTIAL | Video exists but no Matterport/3D tour embedding |

### 3.3 User Account

| Feature | Status | Details |
|---------|--------|---------|
| Google OAuth sign-in | ✅ EXISTS | Supabase Auth + Google provider |
| Email/password sign-in | ✅ EXISTS | Supabase Auth |
| Saved homes | ✅ EXISTS | `app/account/saved-homes/page.tsx` (69 lines) |
| Saved searches | ✅ EXISTS | `app/account/saved-searches/page.tsx` (52 lines) |
| Saved cities | ✅ EXISTS | `app/account/saved-cities/page.tsx` |
| Saved communities | ✅ EXISTS | `app/account/saved-communities/page.tsx` |
| Viewing history | ✅ EXISTS | `app/dashboard/history/page.tsx` (130 lines) |
| Buying preferences | ✅ EXISTS | `app/account/buying-preferences/page.tsx` |
| Profile management | ✅ EXISTS | `app/account/profile/page.tsx` |
| Data export | ✅ EXISTS | `app/actions/export-my-data.ts` |
| Email alerts for saved searches | ✅ EXISTS | `app/actions/saved-search-alerts.ts` (207 lines) + cron |
| Notification preferences | ✅ EXISTS | `DashboardNotificationPrefs.tsx` |
| **Edit saved search filters** | ⚠️ UNVERIFIED | Page exists but filter editing UX needs verification |
| **Shared collections** | ❌ MISSING | Share a curated set of listings with others (Compass has this) |
| **Notes on saved homes** | ❌ MISSING | Add personal notes to saved listings |
| **Comparison tool from saved** | ⚠️ PARTIAL | Compare page exists but not linked from saved homes |

### 3.4 Market Intelligence

| Feature | Status | Details |
|---------|--------|---------|
| City market reports | ✅ EXISTS | `app/housing-market/` hub + city pages |
| Community market reports | ✅ EXISTS | Subdivision-level data |
| Regional overview | ✅ EXISTS | `app/housing-market/central-oregon/page.tsx` |
| Market pulse (live stats) | ✅ EXISTS | `LivePulseBanner.tsx` on pages |
| Market stats server actions | ✅ EXISTS | `getCachedStats()`, `getLiveMarketPulse()` in `market-stats.ts` |
| Market report generation | ✅ EXISTS | `app/api/cron/market-report/route.ts` |
| PDF/Excel export | ✅ EXISTS | `@react-pdf/renderer` + `xlsx` in dependencies |
| Historical trends | ⚠️ PARTIAL | Data layer exists, chart components may be thin |
| Market health score | ⚠️ PARTIAL | RPC exists in migrations, but `MarketHealthGauge.tsx` component MISSING |
| Community comparison | ✅ EXISTS | `app/compare/page.tsx` |
| Appreciation calculator | ✅ EXISTS | `app/tools/appreciation/page.tsx` |
| **Narrative/AI-generated market commentary** | ⚠️ PARTIAL | `market_narratives` table + RPCs exist, display unverified |

### 3.5 Lead Generation & CRM

| Feature | Status | Details |
|---------|--------|---------|
| Listing inquiry forms | ✅ EXISTS | `ShowcaseAgent.tsx` — schedule showing, ask question |
| Home valuation CTA | ✅ EXISTS | `HomeValuationCta.tsx` + `/sell/valuation` page |
| Exit intent popup | ✅ EXISTS | `ExitIntentPopup.tsx` |
| Email signup | ✅ EXISTS | `EmailSignup.tsx` on homepage |
| FUB integration | ✅ EXISTS | `lib/followupboss.ts` — events, attribution, contact management |
| Agent attribution cookies | ✅ EXISTS | `app/actions/fub-identity-bridge.ts` |
| UTM tracking | ✅ EXISTS | Campaign object in FUB events |
| Contact page | ✅ EXISTS | `app/contact/page.tsx` |
| **Speed-to-lead (sub-5-min response)** | ❌ MISSING | No automated instant response beyond FUB event. Need auto-reply email/SMS |
| **Lead scoring** | ❌ MISSING | Behavior-based scoring (views, saves, time on site) |
| **Chatbot-to-lead handoff** | ⚠️ PARTIAL | Chat widget exists but doesn't capture lead info or hand off to FUB |

### 3.6 Content & SEO

| Feature | Status | Details |
|---------|--------|---------|
| Blog/guides | ✅ EXISTS | `app/guides/` + `app/blog/` with admin CRUD |
| City descriptions | ✅ EXISTS | `lib/city-content.ts` |
| Community descriptions | ✅ EXISTS | `lib/community-content.ts` |
| Programmatic filter pages | ⚠️ PARTIAL | Route handling exists in search page but `lib/filter-pages.ts` config MISSING |
| JSON-LD on all page types | ✅ EXISTS | 33 files with structured data |
| Sitemap | ❌ BROKEN | Returns 404 on production — critical SEO issue |
| robots.txt | ✅ EXISTS | But does NOT allow AI crawlers (GPTBot, PerplexityBot, etc.) |
| OG images | ⚠️ PARTIAL | Some pages have them, many don't |
| Canonical URLs | ✅ EXISTS | Redirects in place for duplicate routes |
| Internal linking | ⚠️ PARTIAL | Some cross-linking but not systematic |
| **AI crawler permissions** | ❌ MISSING | robots.txt must explicitly allow GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot |
| **FAQ schema on content pages** | ⚠️ PARTIAL | Some pages have it, needs systematic coverage |
| **Content hub structure** | ⚠️ PARTIAL | Housing-market hub exists, but topic clustering could be deeper |
| **Author/expertise signals** | ❌ MISSING | No author bylines, no broker credentials on content, weak E-E-A-T |

### 3.7 Admin & Operations

| Feature | Status | Details |
|---------|--------|---------|
| Admin dashboard | ✅ EXISTS | `app/admin/(protected)/page.tsx` with multiple panels |
| Listing sync management | ✅ EXISTS | Extensive sync UI with status, logs, controls |
| Broker management | ✅ EXISTS | Admin broker CRUD |
| Guide/content management | ✅ EXISTS | Admin guide editor |
| Site page editing | ✅ EXISTS | Admin site pages editor |
| Banner management | ✅ EXISTS | Admin banners |
| Email campaigns | ✅ EXISTS | Admin email compose |
| Audit log | ✅ EXISTS | Admin audit log viewer |
| Expired listings management | ✅ EXISTS | Admin expired listings UI |
| Resort community management | ✅ EXISTS | Admin resort community toggles |
| Query builder | ✅ EXISTS | Admin query builder for custom queries |
| GA4 dashboard panel | ✅ EXISTS | `DashboardGA4Panel.tsx` |
| Revenue dashboard | ✅ EXISTS | `DashboardRevenuePanel.tsx` |
| **Broker self-service editing** | ⚠️ PARTIAL | `app/team/[slug]/edit/page.tsx` exists but needs verification |
| **Broker performance dashboard** | ⚠️ PARTIAL | `app/admin/(protected)/broker-dashboard/page.tsx` exists |

### 3.8 Technical Infrastructure

| Feature | Status | Details |
|---------|--------|---------|
| Vercel deployment | ✅ EXISTS | Production deployment active |
| Supabase database | ✅ EXISTS | Live with listing data |
| Spark MLS sync | ✅ EXISTS | Full sync + delta sync pipelines |
| Cron jobs | ✅ EXISTS | 5 crons registered in vercel.json |
| Rate limiting | ✅ EXISTS | Upstash Redis integration (`@upstash/ratelimit`) |
| Error tracking | ⚠️ PARTIAL | Sentry package installed, needs DSN configuration |
| PWA | ✅ EXISTS | Serwist configured, manifest, offline page |
| Cookie consent | ⚠️ PARTIAL | Component exists, needs verification |
| Analytics (GA4) | ✅ EXISTS | GA4 integration + GTM support |
| Meta Pixel | ✅ EXISTS | Code for pixel tracking |
| Google Ads tracking | ✅ EXISTS | Conversion tracking code |

---

## 4. Critical Gaps (Not in Current Plan)

These are features that Zillow/Redfin have and that users expect, but are NOT in the current master plan:

### 4.1 Must-Have for Launch
1. **Fix sitemap.xml** — Returns 404. Without this, Google can't index the site. CRITICAL.
2. **Fix /about and /sell 500 errors** — Two key pages are broken.
3. **Allow AI crawlers in robots.txt** — Add GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended. Without this, LLMs can't cite you.
4. **Draw-on-map polygon search** — Table stakes for a Zillow competitor. Use Google Maps DrawingManager.
5. **Walk Score / Transit Score** — Redfin and Zillow both show these. WalkScore has a free API for low-volume sites.
6. **School information** — GreatSchools ratings near listings. Every major competitor has this.
7. **Filter by monthly payment** — Zillow launched this as a filter type. Differentiate from price-only search.

### 4.2 Should-Have for Competitive Parity
8. **Tax history** — Multi-year property tax data on listing detail
9. **Climate/flood risk** — Environmental risk scores (FEMA flood zones at minimum)
10. **AI-powered natural language search** — "Find me a 3-bedroom with mountain views under $600K in Bend" → search results. The chat widget exists but isn't wired to search.
11. **Print-friendly listing view** — Print/PDF a listing page for offline use
12. **Speed-to-lead auto-response** — Automated email/SMS within 5 minutes of inquiry
13. **Lead scoring** — Score leads based on behavior (page views, saves, time on site, return visits)
14. **Shared collections** — Users can create and share curated listing collections
15. **Notes on saved homes** — Personal notes attached to saved listings
16. **Author/expert bylines on content** — E-E-A-T signals for SEO and LLM citation
17. **Recent searches** — Quick re-access to previous search queries

### 4.3 Differentiators (Leapfrog Incumbents)
18. **AI property comparison** — "Compare these 3 homes" with AI-generated analysis
19. **AI market commentary** — Real-time, data-grounded market narrative updated after every sync
20. **Predictive market insights** — "This area's prices are trending up 8% YoY, faster than the regional average"
21. **Personalized homepage** — Returning users see content based on their browsing history and saved preferences
22. **AI-generated neighborhood guides** — Deep, LLM-optimized content about each community
23. **Instant property alert SMS** — Not just email, push SMS for high-priority matches
24. **Community livability scores** — Custom scoring combining walk score, schools, crime, amenities, outdoor access
25. **Investment analysis** — Cap rate, rental yield estimates, appreciation forecasts for applicable properties

---

## 5. Pages with Errors (Must Fix Immediately)

| Page | Error | Root Cause (To Investigate) |
|------|-------|-----------------------------|
| `/about` | 500 Internal Server Error | Likely missing data in `site_pages` table or env var |
| `/sell` | 500 Internal Server Error | Likely missing dependency or env var |
| `/sitemap.xml` | 404 Not Found | Sitemap generation broken or route misconfigured |

---

## 6. SEO & LLM Optimization Requirements

### robots.txt Updates Needed
```
# Allow AI crawlers for LLM citation
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot  
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /
```

### Content Structure for LLM Extraction
- Every page needs clear H2/H3 hierarchy
- Short paragraphs (3-4 lines max)
- Bullet points and numbered lists for key data
- Tables for comparisons
- FAQ sections with schema markup
- Author bylines with credentials
- "Last updated" timestamps on market content
- Original data/statistics that others can cite

### Structured Data Coverage
- ✅ 33 pages have JSON-LD
- ❌ Need Product + Offer schema on listing pages (for rich results)
- ❌ Need FAQPage schema on all content pages
- ❌ Need BreadcrumbList schema on all pages
- ❌ Need LocalBusiness + RealEstateAgent schema on team/brokerage pages
- ❌ Need Article schema on blog/guide pages with author

---

## 7. User Journey Specifications

See `docs/plans/USER_JOURNEYS.md` (to be created) for the complete set of 80+ testable user scenarios covering:
- Anonymous visitor flows (browse, search, view, save, share, contact)
- Signed-in user flows (save, search, history, preferences, alerts)
- Admin/broker flows (dashboard, sync, manage, report)
- SEO/crawler flows (sitemap, structured data, meta tags)
- System flows (sync, cron, alerts, optimization)

---

## 8. Priority Execution Order

### Tier 1: Critical (Blocks Everything)
1. Fix sitemap.xml (SEO is dead without it)
2. Fix /about and /sell 500 errors
3. Allow AI crawlers in robots.txt
4. Verify all env vars are set in Vercel

### Tier 2: Competitive Baseline (Must-Have for Launch)
5. Draw-on-map polygon search
6. Walk Score integration
7. School information
8. Monthly payment filter
9. AI natural language search integration
10. Missing components (StatCard, FreshnessBadge, MarketHealthGauge, PageCTA)
11. Programmatic filter pages config
12. Author/expertise signals on content

### Tier 3: Competitive Parity
13. Tax history on listings
14. Climate/flood risk data
15. Print-friendly listing view
16. Speed-to-lead auto-response
17. Lead scoring
18. Shared collections
19. Notes on saved homes
20. Recent searches

### Tier 4: Differentiators
21. AI property comparison
22. Personalized homepage
23. AI-generated neighborhood guides (LLM-optimized)
24. Community livability scores
25. Investment analysis tools
26. Predictive market insights
27. SMS instant alerts

---

*This spec is the source of truth. All development work should reference this document. Updated by the product research role on a monthly basis.*
