> **This brief is a historical work artifact.** It describes what was specified for this phase; it does not track live status. Authoritative status is in `docs/plans/task-registry.json`. Do not update this file to reflect later code changes — create a new brief or update the registry.

# Phase 0: Critical Fixes

**Status**: Complete
**Prerequisite for**: All subsequent phases
**Estimated scope**: 6 tasks, ~2-3 working days

This is the working document for Phase 0. Complete every task, verify each one, then update the master plan and Tier 1 rule to activate Phase 1.

---

## Task 0.1: Listing URL Canonical Consistency

**Requirement**: R1 (SEO gate)

**Status**: Superseded by Data Architecture Optimization plan, Phase 3.

**Updated Decision (2026-04-05)**: Canonical listing URLs use MLS number (ListNumber) + full address slug: `/homes-for-sale/{city}/[{neighborhood}/]{community}/{address-slug}-{mlsNumber}`. Fallback: `/homes-for-sale/listing/{mlsNumber}`. This replaces the earlier `/listing/{key}-{slug}` spec. See `docs/plans/data-architecture-plan.md` for the full 16-file atomic URL change unit and execution safety protocol.

Old ListingKey-based URLs 301-redirect to canonical MLS-based URLs.

---

## Task 0.2: Add Missing Spark Select Fields

**Requirement**: R9 (Broker-Listing Auto-Mapping)

**Problem**: `SPARK_SELECT_FIELDS` omits `ListAgentStateLicense` and `ListAgentEmail`, so `listing_agents` rows have null values and broker matching fails for bulk-synced listings.

**Files to modify**:
- `lib/spark-odata.ts` -- add fields to `SPARK_SELECT_FIELDS`

**Changes**:
1. Add `'ListAgentStateLicense'` and `'ListAgentEmail'` to the `SPARK_SELECT_FIELDS` array
2. If the sync pipeline destructures or maps these fields, ensure they flow through to `listing_agents` insert/upsert

**Verification**:
```bash
npm run build
# After next sync cycle, verify in Supabase:
# SELECT agent_license, agent_email FROM listing_agents WHERE agent_license IS NOT NULL LIMIT 5;
```

---

## Task 0.3: Fix `listing_videos` Population

**Requirement**: R4 (Video first-class)

**Problem**: `listing_videos` table exists but no sync code populates it. `/listings/[listingKey]` reads from this table, so videos may not appear.

**Files to modify**:
- Sync pipeline (likely `app/actions/sync-spark.ts` or related sync handler)
- Verify: `app/listing/[listingKey]/page.tsx` vs `app/listings/[listingKey]/page.tsx` video reading

**Changes**:
1. In the sync pipeline, after processing a listing's `details` JSONB, extract the `Videos` array
2. For each video, upsert a row into `listing_videos` with listing_key, video_url, video_type, etc.
3. Confirm both `/listing/` and `/listings/` routes read video from the same source (prefer `listing_videos` table)

**Verification**:
```bash
npm run build
# After sync, check:
# SELECT count(*) FROM listing_videos;
# Should be > 0 if any listings have videos in their details JSONB
```

---

## Task 0.4: Fix Viewing History

**Requirement**: R3 (Engagement completeness)

**Problem**: `TrackListingView` sets a cookie and increments `engagement_metrics.view_count`, but `/dashboard/history` reads from `user_activities` table. `logActivity` in `lib/activity-tracker.ts` exists but is never called for listing views.

**Files to modify**:
- `lib/activity-tracker.ts` -- confirm `logActivity` function signature
- The component or server action that handles listing view tracking -- call `logActivity('view_listing', { listingKey, ... })`

**Changes**:
1. Find where listing view tracking fires (likely `TrackListingView` component or a server action)
2. Add a call to `logActivity('view_listing', { listing_key: listingKey })` for authenticated users
3. Ensure `user_activities` table receives the row with correct `activity_type` and `metadata`

**Verification**:
```bash
npm run build
# Manual test: sign in, view a listing, navigate to /dashboard/history
# The viewed listing should appear in the history list
```

---

## Task 0.5: Fix OG Images and Twitter Tags

**Requirement**: R1 (SEO gate), R2 (Social sharing)

**Problem**: Multiple pages missing `og:image` and `twitter:image`. Existing OG routes for blog/broker exist at `/api/og` but aren't wired to their pages. `og-home.png` may not exist.

**Files to modify** (add/fix `generateMetadata` in each):
- `app/sell/page.tsx`
- `app/buy/page.tsx`
- `app/blog/page.tsx`
- `app/feed/page.tsx`
- `app/reports/page.tsx`
- `app/reports/explore/page.tsx`
- `app/listings/page.tsx`
- Community and city page metadata in `app/search/[...slug]/page.tsx`
- Agent pages in `app/team/[slug]/page.tsx`
- `public/og-home.png` -- create if missing

**Changes**:
1. Create `public/og-home.png` (1200x630) if it doesn't exist -- use a branded fallback image
2. For each page listed above, add `openGraph.images` and `twitter.images` to `generateMetadata`
3. Wire existing `/api/og/blog` and `/api/og/broker` routes to blog and broker page metadata
4. Use `og-home.png` as fallback for pages without dynamic OG generation

**Verification**:
```bash
npm run build
# For each page type, check OG tags:
curl -s http://localhost:3000/sell | grep -E 'og:image|twitter:image'
curl -s http://localhost:3000/buy | grep -E 'og:image|twitter:image'
curl -s http://localhost:3000/blog | grep -E 'og:image|twitter:image'
curl -s http://localhost:3000/feed | grep -E 'og:image|twitter:image'
# All should return valid image URLs
```

---

## Task 0.6: Sitemap Index Splitting

**Requirement**: Gap 9 (Sitemap scaling)

**Problem**: Current sitemap has a 5,000 listing cap. Google's limit is 50,000 URLs or 50MB per sitemap file. With programmatic pages coming in Phase 3, this will be exceeded.

**Files to modify**:
- `app/sitemap.ts` (refactor to sitemap index pattern, or create `app/sitemap/[id]/route.ts`)

**Changes**:
1. Refactor `app/sitemap.ts` to generate a sitemap index when total URL count exceeds 5,000
2. Split into logical groups: listings (chunked by 5,000), communities, cities, static pages
3. Each sub-sitemap has proper `lastmod` dates

**Verification**:
```bash
npm run build
curl -s http://localhost:3000/sitemap.xml | head -20
# Should show <sitemapindex> with multiple <sitemap> entries if listings > 5,000
# Or a single sitemap if under the limit (acceptable for now, structure must support splitting)
```

---

## Completion Checklist

- [x] Task 0.1: Canonical URLs consistent across sitemap, internal links, and canonical tags
- [x] Task 0.2: `SPARK_SELECT_FIELDS` includes `ListAgentStateLicense` and `ListAgentEmail`
- [x] Task 0.3: `listing_videos` populated during sync
- [x] Task 0.4: Viewing history writes to `user_activities`
- [x] Task 0.5: All page types have `og:image` and `twitter:image`
- [x] Task 0.6: Sitemap supports index splitting
- [x] `npm run build` passes with zero errors
- [x] No SEO regressions (run SEO checklist from master plan)

**When complete**: Update `master-plan-protocol.mdc` to set `activePhase: 1`. Create `docs/plans/phase-1-brief.md`.
