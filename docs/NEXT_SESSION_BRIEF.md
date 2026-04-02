# Next Session Brief

**Date:** April 2, 2026
**PR:** #15 — 21 commits, ready to merge
**Branch:** `cursor/launch-readiness-audit-14c9`

---

## DONE (this session)

### Critical Fixes
- **Sitemap:** Was showing 74 listings. Now shows all 6,580. Root cause: Supabase caps queries at 1,000 rows. Created `lib/supabase/paginate.ts` helper and paginated every query in the sitemap.
- **Data truncation everywhere:** The same 1,000-row cap was silently truncating listing counts, median prices, community stats, subdivision counts, and status breakdowns across 15+ server actions. All fixed with pagination or count queries.
- **Property type "A":** Was showing raw MLS code. Now shows "Single Family Residence" from `details.PropertySubType`.
- **Listing agent card:** Was prominently featuring competitor agents. Now shows "Interested in this home?" CTA as primary, listing agent as small attribution line.
- **Listing history:** `price_history` and `status_history` tables were empty. Wired fallback to `listing_history` table (2M rows) for price/status history on listing detail.

### SEO Fixes
- Sitemap returns 200 with 25,125 URLs (was 3,709, actually missing most listings)
- OG images added to 22 pages that were missing them
- Canonical URLs fixed on `/open-houses`, `/about`
- sr-only h1 added to search/listings page
- All 6 redirect routes working (sign-in, search, agents, reports, home-valuation, listings)

### UX Fixes
- Reports page wrapped in Suspense (hero renders instantly)
- Loading skeletons for search, listing detail, buy, reviews pages
- ListingHero thumbnail strip scrollbar hidden
- "Other homes in [subdivision]" section added to listing detail
- Open house section wired to city search pages (renders when data exists)

### Infrastructure
- `@tailwindcss/typography` installed for blog content
- FUB API calls wrapped in try/catch (was crashing on network errors)
- CMA PDF and listing inquiry FUB tracking made fire-and-forget
- Sitemap contract test updated
- TypeScript strict mode passes clean

---

## NOT DONE (for next session)

### Data Pipeline Issues
- `open_houses` table: 0 rows. MLS sync doesn't populate open house data. Component is wired but no data to show.
- `listing_agents` table: 0 rows. Agent data comes from listing row columns, not separate table.
- `listing_videos` table: 0 rows. Video data comes from `details` JSON, not separate table.
- `listing_history`: Has 2M rows but only for older/closed listings. Recent active listings have 0 history rows (expected — they haven't changed yet).

### Feature Gaps vs Zillow
- No school information section on listing detail
- No walkability/transit/bike scores
- No climate/flood risk data
- No tax history section (component exists at `components/listing/TaxHistory.tsx` but not wired — needs tax data)
- No "Our listings" slider showing Ryan Realty's own listings with status badges
- Community pages need content audit — verify each has unique description
- No neighborhood-level data beyond what's in `communities` table

### Performance
- Homepage: FCP 112ms (good), total stream 10s (many Supabase queries)
- Reports page: FCP fast with Suspense, total stream 16s
- City pages: 5-10s total (pagination queries make it slower but data is correct now)
- On Vercel (closer to Supabase), these will be 2-4x faster than on this VM

### Cron Schedule
- `vercel.json` has `sync-full` weekly, `sync-delta` daily
- Owner needs to increase frequency for a live site (daily full sync minimum)

### Owner Actions (in docs/LAUNCH_CHECKLIST.md)
1. Set `NEXT_PUBLIC_SITE_URL` to production domain
2. Confirm domain: `ryan-realty.com` (with hyphen) vs `ryanrealty.com` (no hyphen)
3. Update Supabase Auth redirect URLs
4. Set `ADMIN_EMAIL`, `CRON_SECRET`, GA4 ID, Maps API key
5. Increase MLS sync frequency

---

## KEY FILES CHANGED

```
app/sitemap.ts                              — Pagination for all queries
lib/supabase/paginate.ts                     — Shared fetchAllRows helper
lib/followupboss.ts                          — try/catch on all fetch calls
lib/property-type-labels.ts                  — MLS code A→Residential mapping
app/actions/listings.ts                      — 6 queries paginated
app/actions/cities.ts                        — 3 queries paginated
app/actions/communities.ts                   — 1 query paginated
app/actions/market-stats.ts                  — 1 query paginated
app/actions/listing-detail.ts                — History fallback + nav optimization
app/actions/track-contact-agent.ts           — Fire-and-forget FUB
app/api/pdf/cma/route.ts                     — Fire-and-forget FUB
app/listing/[listingKey]/page.tsx             — PropertySubType, subdivision section
app/search/[...slug]/page.tsx                — Open houses section
app/reports/page.tsx                         — Suspense wrapping
components/listing/showcase/ShowcaseAgent.tsx — Redesigned CTA
components/listing/showcase/ShowcaseKeyFacts.tsx — Property type label
components/listing/showcase/ShowcaseSimilar.tsx  — Title prop
components/listing/ListingHero.tsx           — no-scrollbar
next.config.ts                               — /sign-in redirect
app/robots.ts                                — getCanonicalSiteUrl()
22 page files                                — OG images + twitter cards
4 page files                                 — Loading skeletons
docs/LAUNCH_CHECKLIST.md                     — New
docs/audits/lead-capture-tracking-audit.md   — New
```
