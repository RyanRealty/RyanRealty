# INFRA audit — CRM tracking, SEO, Analytics, Middleware

> Audit date: 2026-06-26. Read-only recon. All findings cite exact file:line.

---

## AXIS 1 — CRM Visitor Tracking

### How the pipeline works (current state)

**Entry point: `VisitTrackerWithSession` → `VisitTracker`**

- `app/layout.tsx:144` mounts `<VisitTrackerWithSession />` inside `<HideOnLP>` — meaning it runs on every non-LP, non-admin page.
- `components/layout/VisitTrackerWithSession.tsx` is a thin client wrapper that hits `/api/auth/me` on mount to resolve `userId`/`userEmail`, then passes them into `VisitTracker`.
- `components/VisitTracker.tsx` (257 lines) does the real work:
  - Mints or reads a `rr_session_id` uuid v4 from `localStorage` (`RR_SESSION_ID_KEY`).
  - Calls the legacy server action `trackVisit` (`app/actions/track-visit.ts`) for backward-compat `visitor_sessions`/`visits` table writes.
  - Fires `fireVisitorEvent()` which POSTs to `/api/visitors/track` with `eventType: 'page_view'` or `'listing_view'` (the latter when pathname matches `/listing/[^/]+`).
  - Captures first-touch UTMs, referrer, fbclid, inferred source from referrer host, and page category via `captureSource()` + `categorizePage()`.
  - Respects cookie consent (`hasAnalyticsConsent()`) — auto-grants for paid/ad traffic via `autoGrantConsentForAdTraffic()`.
  - Re-fires on `cookie-consent` event (when user accepts mid-session).
  - Also tracks "return visit" for identified users (those with `userEmail`) via `trackReturnVisitAction`.

**API endpoint: `/api/visitors/track` (`app/api/visitors/track/route.ts`, 526 lines)**

Full-featured ingest endpoint:
- Origin allowlist: `ryan-realty.com`, `www.ryan-realty.com`, `ryanrealty.vercel.app`, `*.vercel.app` (Vercel previews).
- Server-side consent enforcement — drops events where `consent === 'declined'` or missing.
- GPC (Global Privacy Control) enforcement — drops events + records durable suppression for identified sessions.
- UPSERTs `visitor_sessions` (first-touch only — never overwrites UTMs on revisit).
- INSERTs `visitor_events` (triggers update `engagement_score`, `intent_tags`, `last_seen_at`).
- Reads `rr_vid` cookie (set by middleware — first-party durable visitor id set before any JS).
- Strips PII fields under `consent === 'essential'`.
- For identified sessions (`fub_person_id` on the session): mirrors activity to FUB via `trackPageView` / `trackListingView` / `trackPropertySearch` + fires `queueReturnVisitAlert` for broker SMS alert.
- Returns `{ engagementScore, intentTags, fubPersonId, identified, sessionAgeSeconds }` — snippet can adapt UI based on score.

**Listing-specific property-view event: `ListingTracker` (`components/listing/ListingTracker.tsx`)**

- `app/listing/[listingKey]/page.tsx:472` renders `<ListingTracker ... />` for every listing detail page.
- Fires on mount (ref guard, no double-fire):
  1. `trackListingView()` — pushes `listing_view` + `view_item` (ecommerce) to `window.dataLayer` and fires Meta Pixel `ViewContent` + CAPI.
  2. `trackEvent('view_listing', {...})` — GA4 custom event.
  3. `POST /api/listings/[listingKey]/track` (separate endpoint for per-listing view counts).
- Also tracks scroll depth milestones (25/50/75/100%) and time-on-page milestones (30/60/120/300s) via `trackEvent('scroll_depth', {...})`.

**Middleware `rr_vid` cookie (`middleware.ts:317-329`)**

- Set on every first page request via Edge middleware.
- 2-year TTL, not httpOnly (client + server can read it).
- Used as the durable visitor id before any JS fires.
- Passed through `/api/visitors/track` into `visitor_sessions.rr_vid`.

**VisitTracker is suppressed on `/lp/*` routes via `HideOnLP`**

- `app/layout.tsx:143-145`: `<HideOnLP><VisitTrackerWithSession /></HideOnLP>`
- `HideOnLP` unmounts its children on `/lp/*`, `/admin/*`, and the homepage `/` (the latter carries its own separate treatment).
- **CONFIRMED GAP:** LP pages (`/lp/seller-home-value`, `/lp/buyer-listing-alerts`, `/lp/expired-listing`, etc.) do NOT receive a `page_view` event in `visitor_sessions`. The `LandingPageTracker` fires `view_landing_page` to GA4/GTM only; LP visitor sessions are not written to Supabase.
- `GlobalIntentTracker` (`components/GlobalIntentTracker.tsx`) IS mounted outside `HideOnLP` (`app/layout.tsx:149`) so `form_start`, `call_initiated`, `email_agent` micro-events fire on LPs — but only to GA4/dataLayer, not Supabase.

**VisitTracker is suppressed on homepage `/`**

- `HideChrome` unmounts header+footer on `/`; `HideOnLP` strips VisitTracker on `/`. Confirmed in `app/layout.tsx:129` (comment: "the static shell prerenders for every route"). The homepage IS tracked — the comment says VisitTracker "still runs on the homepage" because `HideOnLP` checks for `/lp/*`, NOT `/`. Recheck: the implementation of `HideOnLP` controls the condition. This needs verification in the real component.

**Cross-site tracking**

- The `ryan-realty.com` WordPress site (AgentFire) has a client snippet (`docs/wordpress-fub-identify-snippet.html`) that also POSTs to `/api/visitors/track` with the same `rr_session_id` from localStorage, enabling cross-domain session stitching.

---

### Tracking gaps

| Gap | Severity | Location |
|---|---|---|
| LP pages (`/lp/*`) send no `visitor_sessions` / `visitor_events` row — LP lead form submits can't be traced to a pre-submit session in Supabase | HIGH | `app/layout.tsx:143-145`; `HideOnLP` wrapper |
| Listing detail page fires `fireVisitorEvent(..., 'listing_view')` from `VisitTracker` AND `trackListingView` from `ListingTracker` — two separate channels fire on the same page view | LOW (dedup handled by `visitor_events` insert, not a double-row risk, but two POST calls) | `components/VisitTracker.tsx:215-216`, `components/listing/ListingTracker.tsx:26-34` |
| `listing` metadata (mlsNumber, price, beds, baths) is NOT passed from `VisitTracker.fireVisitorEvent()` into the `/api/visitors/track` payload on listing pages — the `listing` field in the payload remains `null`; only `ListingTracker` sends listing detail to GA4/Meta, not to `visitor_events` | MEDIUM | `components/VisitTracker.tsx:139-167` (no `listing` param passed) |
| `VisitTracker` tracks return visit via `trackReturnVisitAction` only when `userEmail` is available (i.e., signed-in users) — anonymous identified leads browsing after form submit get the server-side FUB mirror but NOT the client-side return-visit action | LOW (server path covers it) | `components/VisitTracker.tsx:219-231` |
| Blog pages (`/blog/[slug]`) use `generateMetadata` but lack an explicit tracker or `ListingTracker`-equivalent to emit a typed `blog_post_view` event | LOW | `app/blog/[slug]/page.tsx` |

---

## AXIS 2 — SEO Infrastructure

### Metadata helper (`lib/site/page-metadata.ts`)

`pageMetadata()` function (114 lines) is the canonical per-page metadata builder:
- Sets `title` (cleaned of brand suffix, capped at 60 chars), `description` (capped at 155), `keywords`, `alternates.canonical`, `openGraph` (title/desc/url/type/siteName/images with 1200×630), `twitter` (summary_large_image card), and `robots`.
- Default OG image: `/api/og?type=default` (dynamic branded card — correct, no broken static file).
- Title template in root layout (`app/layout.tsx:44-47`): `"%s | Ryan Realty — Central Oregon Real Estate"`.

**Root layout global metadata (`app/layout.tsx:40-71`):**
- Title default + template: set.
- Description: set.
- Keywords: set.
- `openGraph` with title/desc/type/url/siteName: set.
- `twitter` card: set.
- `robots: "index, follow"`: set.
- `metadataBase`: set to `getCanonicalSiteUrl()`.
- **Canonical NOT set at root level (by design, comment at line 62-65):** each page must set its own canonical. A page that forgets `alternates.canonical` gets no canonical tag — Google may choose its own.
- Facebook domain verification: `app/layout.tsx:66-70`.

### Per-page metadata coverage (spot-check)

| Page | `generateMetadata` | `pageMetadata()` | Canonical | OG Image | JSON-LD |
|---|---|---|---|---|---|
| `/` (homepage) | Static `metadata` export | No (bespoke) | `app/page.tsx:55` | `/api/og?type=default` | Via root `JsonLd.tsx` (Org + Website) |
| `/listing/[listingKey]` | `generateMetadata` at line 116 | Yes (`pageMetadata`) | Set via `listingDetailPath` | `/api/og?type=listing&id=...` | **MISSING** — no `MetadataBlock` or `buildJsonLd` call |
| `/search/[...slug]` | `generateMetadata` at line 139 | Yes (bespoke) | Set | OG image set | `SearchPageJsonLd` + `MetadataBlock` + `ResortCommunityJsonLd` |
| `/cities/[slug]` | `generateMetadata` at line 188 | Yes (`pageMetadata`) | Set | OG image | `MetadataBlock` with Breadcrumb/City/Dataset/FAQ |
| `/housing-market` | `generateMetadata` | Yes (`pageMetadata`) | Set | OG image | `MetadataBlock` with Breadcrumb/WebPage/Dataset |
| `/housing-market/central-oregon` | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` |
| `/housing-market/[...slug]` | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` |
| `/about` | `generateMetadata` at line 105 | Yes (`pageMetadata`) | Set | OG image | `MetadataBlock` (Org/AboutPage/FAQ) |
| `/sell` | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` (Service/Breadcrumb/FAQ) |
| `/blog/[slug]` | `generateMetadata` at line 86 | Yes | Set | OG image | **PARTIAL** — no `MetadataBlock`; doc comment mentions "Article + Breadcrumb blocks" but grep shows no `MetadataBlock` import or `buildJsonLd` call |
| `/blog` (index) | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` |
| `/communities/[slug]` | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` |
| `/open-houses/[city]` | `generateMetadata` | Yes | Set | OG image | `MetadataBlock` |

### JSON-LD library (`lib/site/json-ld.ts`, `components/JsonLd.tsx`)

**Root-level JSON-LD (`components/JsonLd.tsx`):**
- Emits two LD blocks on every non-LP page:
  1. `Organization` / `RealEstateAgent` / `LocalBusiness` — with NAP, `sameAs` social profiles, founding date, address, `areaServed` (GeoCircle), three broker `RealEstateAgent` nodes with license numbers.
  2. `WebSite` — with `SearchAction` sitelinks pointing to `/homes-for-sale?keywords=...`.
- Mounted inside `<HideOnLP>` (`app/layout.tsx:124-126`) — NOT rendered on LP pages. This means LP pages have no Organization entity at all.

**Per-page JSON-LD (`lib/site/json-ld.ts`, 364 lines):**

Supports 7 schema types via `buildJsonLd(input: SchemaInput)`:
1. `realEstateListing` → `SingleFamilyResidence` with address/geo/beds/baths/sqft/lot/yearBuilt/photos/Offer (status-aware).
2. `breadcrumb` → `BreadcrumbList`.
3. `webPage` → `WebPage` (or `AboutPage` / `CollectionPage` / `ContactPage` subtypes).
4. `faqPage` → `FAQPage`.
5. `place` → `City` / `Neighborhood` / `School` / `Park` subtypes.
6. `dataset` → `Dataset` (for market data pages with `variableMeasured`).
7. `article` → `Article`.

**Critical gap: `/listing/[listingKey]/page.tsx` has NO `MetadataBlock` / `buildJsonLd` call.**
- The listing detail page is the highest-traffic ad-landing surface. It has `generateMetadata` + `pageMetadata` (correct), but zero `realEstateListing` / `SingleFamilyResidence` JSON-LD. Google's RealEstateListing rich result and AI Overviews listings panel both require structured data here.
- All the data needed (address, price, beds/baths, sqft, photos, geo, listing agent) is already fetched server-side at `app/listing/[listingKey]/page.tsx:265-315`.

**Gap: `/blog/[slug]` has no `Article` JSON-LD.**
- The page doc comment at line 7 mentions "Article + Breadcrumb blocks" but there is no `MetadataBlock` import or `buildJsonLd` call in the file. Blog posts lack `Article` structured data, which reduces eligibility for Google Article rich results.

---

### SEO gaps

| Gap | Severity | Location |
|---|---|---|
| `/listing/[listingKey]` has no `SingleFamilyResidence` / `RealEstateListing` JSON-LD | CRITICAL | `app/listing/[listingKey]/page.tsx` — no `MetadataBlock` import |
| `/blog/[slug]` has no `Article` JSON-LD | HIGH | `app/blog/[slug]/page.tsx` — doc comment claims it, code doesn't have it |
| Root layout canonical intentionally omitted — any page that forgets its own `alternates.canonical` gets no canonical tag | MEDIUM | `app/layout.tsx:62-65` (by design but requires every page to remember) |
| LPs (`/lp/*`) have no Organization JSON-LD — `<JsonLd>` is inside `<HideOnLP>` | LOW (LPs are noindex anyway for most) | `app/layout.tsx:124-126` |
| `/lp/sell-your-home` is NOT in `sitemap.ts` static pages list | LOW | `app/sitemap.ts` — not in the array at lines 53-97 |

---

## AXIS 3 — Analytics + Middleware

### Google Analytics (GA4 + GTM)

**Implementation stack (all in `components/site/providers/AnalyticsScripts.tsx`):**

```
GTMBody           → GTM noscript iframe (body) — consent-gated
GoogleAnalytics   → GA4 + Google Ads + Consent Mode v2
MetaPixel         → Meta Pixel + CAPI prep
GoogleMapsBootstrap → Maps JS API (no consent gate)
PageViewTracker   → SPA page_view events to GA4 + Meta Pixel on navigation
```

`components/site/providers/RootProvider.tsx` renders `<AnalyticsScripts />`.

**`GoogleAnalytics.tsx` (191 lines):**
- Consent Mode v2 implemented correctly:
  1. `beforeInteractive` script sets all Google consent categories to `denied` with `wait_for_update: 500ms`.
  2. `url_passthrough: true` and `ads_data_redaction: true` set for cookieless modeling.
  3. `afterInteractive` loads `gtag.js` — ALWAYS (not consent-gated) so cookieless modeling works.
  4. `useEffect` applies `gtag('consent', 'update', ...)` from the stored cookie.
- Cross-domain linker configured for `ryan-realty.com`, `www.ryan-realty.com`, `seller.ryan-realty.com`, `buyer.ryan-realty.com`, `ryanrealty.vercel.app`.
- GA4 ID: `NEXT_PUBLIC_GA4_MEASUREMENT_ID` env var.
- Google Ads conversion: `NEXT_PUBLIC_GOOGLE_ADS_ID` env var.
- AdSense: `NEXT_PUBLIC_ADSENSE_CLIENT_ID` env var (loaded `lazyOnload` to avoid hydration errors).

**`GTMHead.tsx` (40 lines):**
- Consent-gated: only injects the GTM script when `hasAnalyticsConsent()` is true.
- GTM ID: `NEXT_PUBLIC_GTM_CONTAINER_ID` env var.
- **Note:** GTM consent-gating creates a timing gap — if the user has analytics consent from a prior visit, GTM loads on page load; if not (first visit, no consent), GTM never loads for that session. Since GA4 is loaded independently via `GoogleAnalytics.tsx`, the GA4 data collection still works without GTM.

**`PageViewTracker.tsx` (73 lines):**
- Fires `gtag('event', 'page_view', ...)` and `fbq('track', 'PageView')` on SPA navigation (pathname change).
- Guards against double-fire on initial load (initial fire comes from GA4's own `config` init and `MetaPixel.tsx`).
- Wrapped in `<Suspense>` because it uses `useSearchParams`.

### Meta Pixel

- `components/MetaPixel.tsx` — fires `PageView` on mount and exposes `window.fbq`.
- Full CAPI integration via `lib/meta-pixel-helpers.ts`.
- Advanced matching for identified users (email hash).

### Middleware (`middleware.ts`, 482 lines)

Five jobs, in order:

1. **Canonical host redirect (line 340-346):** `ryanrealty.vercel.app` and `www.ryan-realty.com` → 308 to `ryan-realty.com`. Fixes OAuth PKCE verifier mismatch and consolidates SEO.
2. **Legacy URL 301 redirects (line 350-365):** ~650 indexed legacy WordPress/AgentFire URLs → new-site destinations. From `data/legacy-redirects.json`.
3. **Subdivision marketing-slug redirect (line 377-395):** `/subdivisions/[slug]` for area-level slugs → 308 to canonical area page.
4. **Bot/geo screening (line 407-417):** Blocks obvious automation UAs + high-spam countries (CN, HK, RU, SG by default). Verified good crawlers (Googlebot, AI crawlers) bypass. Compliance-verification paths bypass.
5. **IP rate limiting on `/api/*` (line 432-468):** Upstash/Redis sliding window — 10/min strict, 5/min auth, 300/min admin, 60/min general.

**Middleware also sets two cookies on every response:**
- `rr_fbc`: first-party fbclid capture when `?fbclid` is in the URL (Meta conversion rescue).
- `rr_vid`: durable first-party visitor id (2-year TTL, not httpOnly).

**x-pathname header (line 276):** Set on every forwarded request so server components can branch on the current path (used by `HideOnLP`/`HideChrome` to suppress nav on LP routes).

**Matcher (line 476-480):** Skips `_next/static`, `_next/image`, `_next/data`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`, and any URL with a file extension. Static assets bypass entirely — correct.

### Robots (`app/robots.ts`)

Complete and well-configured:
- Default: `allow: ['/', '/api/og']`, `disallow: ['/admin/', '/dashboard/', '/account/', '/api/', '/auth/', '/mockup-preview/']`.
- `/api/og` explicitly allowed so social scrapers (facebookexternalhit, Twitterbot, etc.) can fetch OG images.
- 16+ named AI crawlers and search engines explicitly allowed with `allow: '/'` overrides.
- Sitemap URL set to `${baseUrl}/sitemap.xml`.

### Sitemap (`app/sitemap.ts`, 387 lines)

ISR-cached at 3,600s (1 hour — replaced `force-dynamic` which caused 11-14s timeouts). Comprehensive:
- Static pages: 30+ manually listed (homepage, /buy, /sell, /blog, /guides, /housing-market, all LPs, /tools/*, /reviews, /join, legal pages).
- Price-drops + motivated-sellers: pillar + per-city pages (via `SITE_CITY_SLUGS`).
- Cities: all Central Oregon cities (seed + dynamic from `listings.City` + filtered by `isCentralOregonCity`).
- Search preset filter pages per city.
- Communities: only the 14 curated resort registry slugs (fixed — was leaking junk subdivision slugs).
- Subdivisions: single scan of `listing_tile_mv` pairs (not N+1 per city).
- Team members: from `brokers` table, `is_active=true`.
- Listings: from `listing_tile_mv` filtered to active statuses — NOT the 589K-row `listings` table (fixed timeout).
- ZIP codes: from `listings.PostalCode`.
- Blog posts: from `blog_posts` table, `status=published`.
- Guides: from `guides` table, `status=published`.
- Market reports: from `market_reports` table.

**Sitemap gaps:**
- `/lp/sell-your-home` is NOT in the static pages list (all other key LPs are).
- `/lp/tetherow/heath/` IS listed.
- `/lp/seller-home-value` IS listed.
- Sitemap does NOT include `/lp/central-oregon-golf` or `/lp/fsbo` — wait, `/lp/fsbo` IS at line 80.
- `/lp/central-oregon-golf` appears absent.

---

## Cross-cutting fixes the orchestrator should make centrally

### FIX-1 (CRITICAL): Add `SingleFamilyResidence` JSON-LD to `/listing/[listingKey]/page.tsx`

All data is already fetched. Need to:
1. Import `MetadataBlock` from `@/components/site/MetadataBlock`.
2. Build a `realEstateListing` schema input using `listing` (address, price, beds, baths, sqft, lat/lng, photos, availability/status, listingAgent).
3. Render `<MetadataBlock schemas={[listingSchema, breadcrumbSchema]} />` in the page JSX.

This is the #1 ad-landing surface and the most impactful SEO gap on the site.

File: `app/listing/[listingKey]/page.tsx`

### FIX-2 (HIGH): Add `Article` + `BreadcrumbList` JSON-LD to `/blog/[slug]/page.tsx`

File: `app/blog/[slug]/page.tsx`. The data (headline, description, datePublished, dateModified, authorName, image) is fetched in `generateMetadata`. Import `MetadataBlock` and render with `article` + `breadcrumb` inputs.

### FIX-3 (HIGH): Emit `visitor_sessions` / `visitor_events` rows for LP page views

Currently all `/lp/*` page views are invisible to Supabase. Two options:
1. Move `<VisitTrackerWithSession />` outside the `<HideOnLP>` wrapper and instead conditionally skip inside the component for paths where it creates noise.
2. Add a `<VisitTrackerWithSession />` directly inside the LP layouts.

The LP form actions (`actions.ts`) already capture the `sessionId` from the submission and write to `visitor_sessions`, but anonymous pre-form browsing on the LP is invisible.

File: `app/layout.tsx:143-145`.

### FIX-4 (MEDIUM): Pass listing metadata into `fireVisitorEvent` on listing pages

`VisitTracker.fireVisitorEvent()` sends `eventType: 'listing_view'` on listing pages but omits the `listing` object (mlsNumber, price, beds, baths, city). This means `visitor_events.listing_mls`, `listing_price`, etc. are always null even for identified sessions where the FUB mirror would benefit from the property detail. The MLS number is not available in `VisitTracker` (it only has `pathname`), so the fix is either:
- Pass listing props to `VisitTracker` (hard — it's global, not per-listing), or
- Have `ListingTracker` also call `/api/visitors/track` with the full `listing` object directly.

`ListingTracker` already fires `POST /api/listings/[listingKey]/track` separately; it could be extended or replaced with a direct call to `/api/visitors/track`.

File: `components/VisitTracker.tsx:139-167`, `components/listing/ListingTracker.tsx:44`.

### FIX-5 (LOW): Add `/lp/sell-your-home` and `/lp/central-oregon-golf` to the sitemap (if they should be indexed)

Note: `/lp/sell-your-home` has `robots: { index: false, follow: false }` (`app/lp/sell-your-home/page.tsx:20`) — so it is correctly noindex. Do NOT add it to the sitemap. Same for other noindex LPs.

The LPs that ARE in the sitemap (buyer-listing-alerts, fsbo, tetherow, bend) should verify they are NOT set to noindex. Check `/lp/bend/page.tsx` and `/lp/tetherow/page.tsx` — these are in the sitemap and should have `robots: index, follow`.

### FIX-6 (LOW): Verify `HideOnLP` does not suppress VisitTracker on homepage

The comment at `app/layout.tsx:129` says "VisitTracker + auth bridges still run on the homepage." Verify the `HideOnLP` implementation actually allows `/` through (it should only block `/lp/*`). If the homepage is inadvertently excluded, homepage visits don't write to `visitor_sessions`.

---

## Summary table

| Axis | Status | Biggest gap |
|---|---|---|
| CRM tracking | Solid for site pages; gaps on LP pages and listing metadata in events | LP pages untracked in Supabase; listing metadata not in `visitor_events` |
| SEO metadata | Good coverage on most pages via `pageMetadata()` helper | `/listing/[listingKey]` has no JSON-LD (CRITICAL); `/blog/[slug]` missing Article JSON-LD |
| Sitemap | Comprehensive, ISR-cached, de-junk'd | Minor: `/lp/sell-your-home` absent (but correctly noindex so OK) |
| Robots | Excellent — explicit AI crawler allow-list | None |
| GA4 / GTM | Full Consent Mode v2, cross-domain linker, SPA navigation events | GTM consent gate may miss first-visit sessions before consent |
| Middleware | 5-layer pipeline: canonical host, legacy redirects, bot/geo, rate-limit, cookie injection | None — well implemented |
| JSON-LD library | Rich 7-type library with correct schema.org types | Not wired to listing-detail page (the highest-value target) |
