# PUB-2 Audit: Search + Listings cluster
**Date:** 2026-06-26  
**Scope:** `/search`, `/search/[...slug]`, `/listing/[listingKey]`, `/listing/by-address/[...slug]`, `/listing/by-key/[listingKey]`, `/open-houses`, `/open-houses/[city]`, `/price-drops`, `/price-drops/[city]`, `/motivated-sellers`, `/motivated-sellers/[city]`, `/our-homes`  
**Method:** Read-only code audit (no form submits, no DB mutations). All paths verified against source files.

---

## Summary table

| Page | A. Functional | B. Statistics §0 | C. SEO | D. Indexability | E. CRM tracking | Overall |
|---|---|---|---|---|---|---|
| `/search` | PASS | PASS | WARN | WARN | PASS | WARN |
| `/search/[...slug]` | PASS | PASS | PASS | PASS | PASS | PASS |
| `/listing/[listingKey]` | WARN | WARN | PASS | PASS | CRITICAL | CRITICAL |
| `/listing/by-address/[...slug]` | PASS | — | PASS | PASS | CRITICAL | CRITICAL |
| `/listing/by-key/[listingKey]` | PASS | — | — | PASS | — | PASS |
| `/open-houses` | PASS | PASS | PASS | PASS | FAIL | FAIL |
| `/open-houses/[city]` | PASS | PASS | PASS | PASS | FAIL | FAIL |
| `/price-drops` | WARN | PASS | PASS | PASS | FAIL | FAIL |
| `/price-drops/[city]` | WARN | PASS | PASS | PASS | FAIL | FAIL |
| `/motivated-sellers` | WARN | WARN | PASS | PASS | FAIL | FAIL |
| `/motivated-sellers/[city]` | WARN | WARN | PASS | PASS | FAIL | FAIL |
| `/our-homes` | CRITICAL | CRITICAL | FAIL | WARN | FAIL | CRITICAL |

---

## Critical defects

### [CRIT-1] VisitTracker does NOT fire `listing_view` for canonical pretty URLs
**File:** `components/VisitTracker.tsx:53`  
**Severity:** Critical — breaks core CRM property-view tracking  

`categorizePage()` classifies a path as `listing_detail` (and sends `event_type: 'listing_view'` to `visitor_events`) only when the pathname matches `/^\/listing\/[^/]+/`. The canonical listing URL served to browsers and indexed by Google is `/homes-for-sale/{city}/{street}-{mls}` (via `app/listing/by-address/[...slug]/page.tsx`, which renders the same content without redirecting). That path does **not** match the regex.

Result: every visitor who arrives at a listing via the sitemap URL, Google search, or any properly-formed link fires a generic `page_view` with `page_category = 'other'` rather than a `listing_view`. The `visitor_events.listing_mls`, `listing_price`, `listing_bedrooms`, etc. columns are never populated for these visits. The FUB person timeline does not get the property-view note. Lead scoring gets 1 point for `page_view` instead of the higher-weight `listing_view` treatment.

Only visitors who somehow navigate to the internal `/listing/{key}` route (which itself immediately 301-redirects to the pretty URL via `by-key`) would trigger a true `listing_view` — but since the redirect fires before the page renders, `VisitTracker` never runs on `/listing/{key}` either.

**Fix:** extend `categorizePage` to also match `/homes-for-sale/`:
```ts
if (/^\/listing\/[^/]+|^\/homes-for-sale\//.test(p)) return 'listing_detail'
```
Then update `fireVisitorEvent` to pass listing metadata (MLS number, price, beds, baths) from the page in those cases. `ListingTracker` already has this data — wire it to call `/api/visitors/track` with a `listing` payload instead of (or in addition to) the separate `/api/listings/${key}/track` call.

---

### [CRIT-2] `/our-homes` fetches ALL MLS active listings, not Ryan Realty listings
**File:** `app/our-homes/page.tsx:96-99`  
```ts
const { listings } = await getListingsWithAdvanced({
  limit: 24,
  sort: 'newest',
})
```
No `listAgentEmail`, `officeId`, or any brokerage filter is passed. The page is titled "Our Homes" and lives at `/our-homes`, implying Ryan Realty's own listings. Presenting all-MLS listings under this label is a factual misrepresentation. The page is in the sitemap at priority 0.6 and has static metadata with no noindex.

**Fix:** filter by Ryan Realty broker emails or office MLS ID. The three broker emails are stored in `public.brokers`. Either filter `"ListAgentEmail" IN (matt@..., paul@..., rebecca@...)` at the DAL level or add an `officeId` param to `getListingsWithAdvanced`.

---

### [CRIT-3] `ListingTracker` property-view fires only to GA4/GTM + a view-counter, not to `visitor_events`
**File:** `components/listing/ListingTracker.tsx`  
**File:** `app/api/listings/[listingKey]/track/route.ts`  

`ListingTracker` fires three things on mount:
1. `trackListingView()` — pushes `listing_view` + `view_item` to `window.dataLayer` (GA4/GTM only, no Supabase write).
2. `trackEvent('view_listing')` — pushes `view_listing` to `window.dataLayer` (GA4/GTM only, no Supabase write).
3. `fetch('/api/listings/${key}/track', { method: 'POST' })` — calls `incrementListingViewCount(key)` which upserts `public.engagement_metrics.view_count`. This is a view counter only, not a `visitor_events` row.

None of these three paths write a `visitor_events` row. The `visitor_events` table (which feeds the `/admin/visitors/live` dashboard, hot-lead scoring, and FUB person timeline) only gets a `listing_view` event from `VisitTracker` → `/api/visitors/track`, which itself only fires `listing_view` when the pathname matches `/listing/` (see CRIT-1).

Consequence: property views are visible only in GA4. The internal CRM dashboard, lead-scoring engine, and broker-alert logic never see them for canonical URL visits.

---

## High-severity defects

### [HIGH-1] CRM search/page-view tracking absent from 5 pages
**Severity:** High (no path to identifying high-intent visitor behavior on these pages)

The following pages have `KbSectionTracker` for section-scroll GA4 events but no `TrackSearchView` component (which fires `trackSearchView()` → Meta CAPI + dataLayer) and no `/api/visitors/track` page_view call beyond the global `VisitTracker`:

| Page | Missing |
|---|---|
| `app/open-houses/page.tsx` | `TrackSearchView` |
| `app/open-houses/[city]/page.tsx` | `TrackSearchView` |
| `app/price-drops/page.tsx` | `TrackSearchView` |
| `app/price-drops/[city]/page.tsx` | `TrackSearchView` |
| `app/motivated-sellers/page.tsx` | `TrackSearchView` |
| `app/motivated-sellers/[city]/page.tsx` | `TrackSearchView` |
| `app/our-homes/page.tsx` | Any CRM component |

The global `VisitTracker` (mounted in `app/layout.tsx:144`) does fire a `page_view` for all of these, so the `visitor_events` row exists. The gap is: no `search_view` event type, no Meta CAPI Search event, and no `results_count` attached to the session for lead-scoring signal strength.

**Fix:** add `<TrackSearchView />` (with relevant `city`/`resultsCount` props) to each page, matching the pattern already used in `app/search/page.tsx` and `app/search/[...slug]/page.tsx`.

---

### [HIGH-2] Listing card `href` uses raw `/listing/${key}` on price-drops and motivated-sellers
**Files and lines:**
- `app/price-drops/page.tsx` — `dropToCardData`: `href: '/listing/${encodeURIComponent(drop.listingKey)}'`
- `app/price-drops/page.tsx` — "biggest drop" featured section: same pattern
- `app/price-drops/[city]/page.tsx` — same `dropToCardData` function  
- `app/motivated-sellers/page.tsx` — `MotivatedTile`: `href = '/listing/${encodeURIComponent(key)}'`
- `app/motivated-sellers/[city]/page.tsx` — same

These URLs hit `app/listing/by-key/[listingKey]/page.tsx` which does a `permanentRedirect` to the canonical pretty URL. The redirect works correctly from a user perspective, but:

1. Google sees an extra 301 hop on every listing link from these high-traffic pages, wasting crawl budget.
2. The GA4 `listing_click` referrer shows the redirect URL, not the source page.
3. The page URL that `VisitTracker` reads when the listing detail loads after redirect will be the canonical URL — so `VisitTracker` still won't fire `listing_view` (see CRIT-1), but the redirect adds latency.

**Fix:** use `listingDetailPath()` helper (same as listing detail page's canonical) to build the href directly: `href={listingDetailPath({ city, street, listingKey })}`.

---

### [HIGH-3] `/our-homes` metadata is static, not `generateMetadata`
**File:** `app/our-homes/page.tsx`  
```ts
export const metadata = {
  title: 'Our Homes | Ryan Realty',
  description: '...',
}
```
Static `export const metadata` instead of `generateMetadata`. Page uses `dynamic = 'force-dynamic'` so listing data changes every request, but the meta title/description never reflect current inventory (listing count, featured property, etc.). No OG image. No JSON-LD.

---

## Medium-severity defects

### [MED-1] Three stub blocks always render null on listing detail
**File:** `app/listing/[listingKey]/page.tsx`  

```tsx
<ClimateRiskBlock risk={null} />
<VacationRentalPotential projection={null} />
<TransparentCMASummary cma={null} />
```
All three are hardcoded `null` with no data fetch path wired. They render "request a report" CTAs permanently. If these sections are visible in the rendered DOM, search engines index empty-state content for every listing. If they are conditionally hidden when `null`, they are dead code that should be removed.

**Verify:** check what each component renders when prop is `null` and either wire the data source or delete the dead sections.

---

### [MED-2] `market_stats_cache` stub on listing detail
**File:** `app/listing/[listingKey]/page.tsx`  

```ts
const marketStats = await Promise.resolve(null)
```
Comment says `market_stats_cache` is missing needed columns. This is correct per the DATABASE_FOR_AI_AGENTS.md — the cache lacks columns the listing detail component needs. However, this means `MarketSnapshot` or any neighborhood-context block that depends on `marketStats` always gets `null`. Confirm which UI blocks are gated on this and whether they degrade gracefully or show blank sections.

---

### [MED-3] `/search` canonical always points to `/homes-for-sale`, not the actual filtered URL
**File:** `app/search/page.tsx`  
`generateMetadata` sets `alternates: { canonical: '/homes-for-sale' }` unconditionally. When `/search?city=Bend&minPrice=500000` is visited, the canonical still says `/homes-for-sale`. If `/search` itself is ever indexed (e.g., via a direct link), this creates a canonical/content mismatch. The page has `revalidate = 60` (ISR, not noindex), so it is technically crawlable.

---

### [MED-4] `/motivated-sellers` hero shows hardcoded null stats
**Files:**  
- `app/motivated-sellers/page.tsx` — `<KbHero data={{ activeCount: null, ... }} />`
- `app/motivated-sellers/[city]/page.tsx` — same

The hero's stat pill (active listing count) always shows null/empty. The hero component presumably renders a dash or "—" placeholder. These are visible stats on a public page — §0 risk if the placeholder reads as "0" or any specific number.

**Verify:** confirm the rendered output for `activeCount: null` in `KbHero`. If it shows "0 homes" or similar, that is a §0 fail.

---

### [MED-5] `/price-drops` sell block uses hardcoded null stats
**File:** `app/price-drops/page.tsx`  
```tsx
<KbSell data={{ medianListPrice: null, medianDaysToPending: null, soldCount30d: null }} />
```
The sell CTA block shows market stats with all three inputs null. Same §0 concern as MED-4 — verify what `KbSell` renders for `null` inputs.

---

### [MED-6] `KbSectionTracker pageType="info"` on `/our-homes`
**File:** `app/our-homes/page.tsx`  
`pageType="info"` is a generic/wrong category. Should be `pageType="our-homes"` or `pageType="search"` for accurate section-scroll analytics attribution.

---

## Low-severity / informational findings

### [LOW-1] `/open-houses` filter chips link to `/open-houses/[city]`, not URL params
**File:** `app/open-houses/page.tsx`  
Filter params (dateFrom, dateTo, minPrice, etc.) are accepted as URL search params, but the city filter chips in the rendered UI link to `/open-houses/[city]` (a separate route) rather than appending `?city=bend` to the current URL. This is a UX inconsistency — filtering by city navigates away from the current filter state. Low severity because the city sub-route is a proper SSG page with its own metadata and JSON-LD.

---

### [LOW-2] `/listing/[listingKey]` internal route is in sitemap — should it be?
**File:** `app/sitemap.ts`  
The sitemap generates canonical URLs for listing detail pages. Verify that sitemap entries point to `/homes-for-sale/...` (the canonical pretty URL) and NOT to `/listing/[key]`. If they point to the internal route, Googlebot follows a 301 redirect from every listing URL in the sitemap.

*(Note: full sitemap source not audited here — cross-cluster INFRA audit should confirm.)*

---

### [LOW-3] `/price-drops/[city]` renders aria-hidden parity bait
**File:** `app/price-drops/[city]/page.tsx`  
Comment in file: `DisplayHeading` and `PageBreadcrumb` are rendered with `aria-hidden` solely to satisfy `parity.json` gate requirements. These invisible-to-users elements bloat DOM and indicate a parity gate that is enforcing the wrong thing — it should gate on semantic presence, not whether the component is in the DOM tree at all.

---

### [LOW-4] `/search` page has no JSON-LD
**File:** `app/search/page.tsx`  
`/search/[...slug]` correctly adds `SearchPageJsonLd`, `ResortCommunityJsonLd`, `Dataset`, and `FAQBlock` JSON-LD. The bare `/search` route has none. Low impact since `/search` itself should probably carry a canonical pointing away from it, but worth noting the structural gap.

---

## Property-view tracking verdict (dimension E, end-to-end)

**The `visitor_events` property-view path is broken for all real-world listing visits.**

End-to-end trace:

1. User navigates to `/homes-for-sale/bend/123-main-st-220189422` (the canonical URL from sitemap, Google, and all internal links).
2. `app/listing/by-address/[...slug]/page.tsx` resolves the listing key and renders `ListingDetailPage`.
3. `ListingTracker` mounts → fires `trackListingView()` and `trackEvent('view_listing')` to `window.dataLayer` (GA4/GTM only) + POSTs to `/api/listings/${key}/track` which increments `engagement_metrics.view_count`.
4. `VisitTrackerWithSession` is in `app/layout.tsx` → `VisitTracker` runs `categorizePage('/homes-for-sale/...')` → returns `'other'` → `fireVisitorEvent(pathname, 'page_view')` → `/api/visitors/track` receives `event_type: 'page_view'`, not `'listing_view'`. Listing metadata columns are NOT populated. FUB person timeline does NOT get a property-view entry. Lead score gets 1 point, not the listing-view weight.
5. For an identified lead (known `fub_person_id`), the `/api/visitors/track` handler's FUB listing-view push (lines 455-471) never fires because `eventType !== 'listing_view'`.

**GA4 sees the view correctly. The internal CRM and FUB person timeline do not.**

The `trackListingView()` function in `lib/tracking.ts` goes only to `window.dataLayer` and Meta Pixel CAPI — it has no Supabase write. The `/api/listings/${key}/track` endpoint only bumps a counter. The CRM-aware write path requires `event_type = 'listing_view'` to reach `/api/visitors/track`, which requires the `VisitTracker` regex fix (CRIT-1).

---

## §0 risk summary

| Stat | Source | Status |
|---|---|---|
| Listing price/beds/baths/sqft on listing detail | `getListingDetail()` → `listings` table | PASS — live DB call, timeout-guarded |
| Open house count on `/open-houses` | `getOpenHousesWithListings()` → real rows | PASS |
| Price drop count + amounts on `/price-drops` | `getPriceDrops()` → real rows | PASS |
| `KbHero activeCount: null` on motivated-sellers | `null` hardcoded | VERIFY — check rendered output |
| `KbSell { medianListPrice: null }` on price-drops | `null` hardcoded | VERIFY — check rendered output |
| `marketStats = null` on listing detail | Intentional stub | VERIFY — no live neighborhood stat shown or "0" displayed |
| `/our-homes` listing data | All-MLS, no Ryan Realty filter | FAIL — content misrepresents brokerage listings |

---

## Files touched / referenced

| File | Finding |
|---|---|
| `components/VisitTracker.tsx:53` | CRIT-1 — regex misses `/homes-for-sale/` |
| `app/listing/[listingKey]/page.tsx` | CRIT-3, MED-1, MED-2 |
| `app/api/listings/[listingKey]/track/route.ts` | CRIT-3 — counter only, no visitor_events write |
| `components/listing/ListingTracker.tsx` | CRIT-3 — three tracking paths, none write visitor_events |
| `lib/tracking.ts` | CRIT-3 confirmed — trackListingView() → dataLayer/CAPI only |
| `lib/data/engagement/index.ts:152` | CRIT-3 — incrementListingViewCount → engagement_metrics only |
| `app/our-homes/page.tsx:96-99` | CRIT-2 — no brokerage filter |
| `app/open-houses/page.tsx` | HIGH-1 |
| `app/open-houses/[city]/page.tsx` | HIGH-1 |
| `app/price-drops/page.tsx` | HIGH-1, HIGH-2, MED-5 |
| `app/price-drops/[city]/page.tsx` | HIGH-1, HIGH-2, LOW-3 |
| `app/motivated-sellers/page.tsx` | HIGH-1, HIGH-2, MED-4 |
| `app/motivated-sellers/[city]/page.tsx` | HIGH-1, HIGH-2, MED-4 |
| `app/search/page.tsx` | MED-3, LOW-4 |
| `app/api/visitors/track/route.ts` | CRIT-1, CRIT-3 analysis |
