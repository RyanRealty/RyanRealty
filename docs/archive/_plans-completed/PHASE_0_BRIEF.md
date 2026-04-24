# Phase 0 Brief: Critical Fixes

> Active working document. Complete all tasks before advancing to Phase 1.
> Estimated scope: 7 tasks, SEO bugs + sync gaps + broken features.

## Prerequisite

Read `docs/MASTER_PLAN.md` for full context. This brief is Phase 0 only.

---

## Task 0.1: Listing URL Canonical Consistency

**Problem**: Sitemap uses key-only URLs (`/listing/2504654`), ListingTile links to key+slug URLs (`/listing/2504654-56355-twin-rivers...`), canonical tag uses whichever format the user landed on.

**Files to modify**:
- `app/sitemap.ts` -- update listing URL generation
- `components/ListingTile.tsx` -- update `<Link>` href
- `app/listing/[listingKey]/page.tsx` -- hardcode canonical to chosen form

**Decision**: Pick ONE form. Key+slug is better for SEO (descriptive URLs).

**Changes**:
1. In `app/sitemap.ts`, generate listing URLs as `/listing/{key}-{slug}`
2. In `components/ListingTile.tsx`, confirm `<Link>` uses the same `/listing/{key}-{slug}` form
3. In `app/listing/[listingKey]/page.tsx`, set `<link rel="canonical">` via `generateMetadata` to `/listing/{key}-{slug}` regardless of how user arrived

**Verify**:
```bash
npm run build
# Grep for listing URL patterns -- all should match chosen form:
rg '/listing/' app/sitemap.ts components/ListingTile.tsx app/listing/
```

---

## Task 0.2: Add Missing Spark Fields to Bulk Sync

**Problem**: `SPARK_SELECT_FIELDS` in `lib/spark-odata.ts` doesn't include `ListAgentStateLicense` or `ListAgentEmail`. Broker-listing auto-mapping fails for bulk-synced listings.

**Files to modify**:
- `lib/spark-odata.ts`

**Changes**:
1. Add `'ListAgentStateLicense'` and `'ListAgentEmail'` to the `SPARK_SELECT_FIELDS` array

**Verify**:
```bash
rg 'ListAgentStateLicense' lib/spark-odata.ts
rg 'ListAgentEmail' lib/spark-odata.ts
npm run build
```
After next sync cycle, spot-check: `SELECT agent_license, agent_email FROM listing_agents LIMIT 10`

---

## Task 0.3: Fix `listing_videos` Population

**Problem**: `listing_videos` table exists but nothing populates it during sync. `/listings/[listingKey]` reads from this table, so videos may not appear.

**Files to modify**:
- Sync pipeline (likely `app/api/cron/sync-full/route.ts` or `app/actions/sync-spark.ts`)

**Changes**:
1. During listing upsert, extract `Videos` array from `details` JSONB
2. For each video entry, upsert into `listing_videos` with listing_key, video_url, video_type, etc.
3. Handle both YouTube/Vimeo URLs and direct MP4/webm

**Verify**:
```bash
npm run build
```
After sync: `SELECT count(*) FROM listing_videos` should return > 0.
Cross-check: find a listing with `details->'Videos'` populated, confirm matching `listing_videos` rows exist.

---

## Task 0.4: Fix Viewing History

**Problem**: `TrackListingView` sets a cookie and increments `engagement_metrics.view_count`, but `/dashboard/history` reads from `user_activities` table and nothing writes `view_listing` events there. `logActivity` in `lib/activity-tracker.ts` exists but is never called.

**Files to modify**:
- `app/listing/[listingKey]/page.tsx` or the `TrackListingView` component

**Changes**:
1. When a listing is viewed by a signed-in user, call `logActivity('view_listing', { listing_key, ... })` from `lib/activity-tracker.ts`
2. This writes to the `user_activities` table
3. `/dashboard/history` already reads from `user_activities` -- no changes needed there

**Verify**:
```bash
npm run build
```
Manual test: Sign in, view a listing, check `/dashboard/history` shows it. Confirm `user_activities` table has a `view_listing` row.

---

## Task 0.5: Fix OG Images on All Pages

**Problem**: Multiple pages missing `og:image` and `twitter:image`. Blog/broker OG routes exist in `/api/og` but aren't wired.

**Files to modify**:
- `app/sell/page.tsx` -- add `og:image`, `twitter:image` to `generateMetadata()`
- `app/buy/page.tsx` -- same
- `app/blog/page.tsx` -- wire existing `/api/og` blog route
- `app/feed/page.tsx` -- add OG image
- Reports index page -- add OG image
- Reports explore page -- add OG image
- Listings index page -- add OG image
- Community pages (`app/search/[...slug]/page.tsx`) -- add `twitter:image`
- City pages -- add `twitter:image`
- Agent pages -- add `twitter:image`

**Changes**:
1. Add `openGraph.images` and `twitter.images` to `generateMetadata()` on each page
2. Use `/api/og` routes where they exist, fallback to a site-wide default OG image
3. Verify `public/og-home.png` exists; if not, create a branded placeholder

**Verify**:
```bash
npm run build
# Spot-check meta tags:
# curl -s http://localhost:3000/sell | rg 'og:image'
# curl -s http://localhost:3000/buy | rg 'og:image'
ls public/og-home.png
```

---

## Task 0.6: Delete Dead Code -- `HomeHeroMapToggle`

**Problem**: `components/home/HomeHeroMapToggle.tsx` is unused anywhere in the codebase.

**Files to modify**:
- `components/home/HomeHeroMapToggle.tsx` -- DELETE

**Changes**:
1. Delete `components/home/HomeHeroMapToggle.tsx`
2. Grep for any imports of `HomeHeroMapToggle` and remove them

**Verify**:
```bash
rg 'HomeHeroMapToggle' --type ts --type tsx
npm run build
```

---

## Task 0.7: Unify Listing Video Routes

**Problem**: `/listing/[listingKey]` reads videos from `details.Videos` (JSONB). `/listings/[listingKey]` reads from `listing_videos` table. They may show different content.

**Files to modify**:
- `app/listing/[listingKey]/page.tsx`
- `app/listings/[listingKey]/page.tsx` (if it exists as a separate route)

**Changes**:
1. After Task 0.3 (listing_videos is populated), decide canonical source
2. Both routes should read from `listing_videos` table (normalized, populated by sync)
3. Fallback to `details.Videos` JSONB if `listing_videos` is empty for a given listing

**Verify**:
```bash
npm run build
```
Visit same listing via both routes. Video content should be identical.

---

## Phase 0 Completion Checklist

Run the staleness audit (from master plan) scoped to Phase 0 changes:

- [ ] All listing URLs in codebase use chosen canonical form
- [ ] `SPARK_SELECT_FIELDS` includes `ListAgentStateLicense` and `ListAgentEmail`
- [ ] `listing_videos` populated after sync
- [ ] `logActivity('view_listing')` called on listing view
- [ ] All pages have `og:image` and `twitter:image`
- [ ] `og-home.png` exists in `public/`
- [ ] `HomeHeroMapToggle` deleted, no references remain
- [ ] Both listing routes show same video content
- [ ] `npm run build` passes with zero errors
- [ ] No hardcoded URLs reference removed/changed paths

**After completion**: Update `master-plan-protocol.mdc` to set active phase to Phase 1. Create `docs/PHASE_1_BRIEF.md`.
