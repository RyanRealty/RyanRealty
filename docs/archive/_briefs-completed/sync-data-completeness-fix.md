# Sync Data Completeness Fix — Complete Brief

**Date:** April 2, 2026
**Priority:** Critical — 68% of active listings have no photos
**Status:** Ready for execution

---

## Context

The MLS data sync from Spark API to Supabase is broken — it's only pulling ~7% of available fields and is actively destroying photo/video/media data on active listings. This needs to be fixed permanently so every sync path pulls ALL available data.

## The Problem

There are 5 sync functions in `app/actions/sync-spark.ts`. Three of them work correctly. Two are broken:

### BROKEN: `syncSparkListingsActiveAndPending` (line ~504)

This is the function that refreshes active and pending listings. It has two bugs:

1. Uses `select: SPARK_SELECT_FIELDS` which only requests 57 of 821 available fields
2. Uses `expand: 'Media'` instead of `expand: SYNC_EXPAND` (`'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'`)

When this function runs, it upserts listings with only 57 fields in `details` — **overwriting** the full 821-field `details` that the initial full sync put there. This is why 68% of active listings (4,427 of 6,537) and 72% of pending listings (1,191 of 1,660) are missing photos, videos, and virtual tours.

### BROKEN: `processActivePendingRecords` → `processSparkListing` code path

The `syncSparkListingsActiveAndPending` v1 fallback path maps results as `{ ...sf, ListingKey: listingKey }` which loses the expand data structure. The `sparkListingToSupabaseRow` function expects `result.StandardFields.Photos` but the v1 fallback passes `StandardFields` directly as the root object.

### WORKING CORRECTLY:

- `syncSparkListings` (full sync) — uses `SYNC_EXPAND`, no `$select` restriction ✅
- `syncSparkListingsDelta` (15-min delta) — uses `SYNC_EXPAND`, no `$select` restriction ✅
- `syncPhotosOnly` (backfill) — uses `SYNC_EXPAND`, no `$select` restriction ✅

## Current Data Quality

```
Active listings missing photos:  4,427 / 6,537  (68%)
Pending listings missing photos: 1,191 / 1,660  (72%)
Active listings with Photos array in details: 91 / 1,000  (9%)
Active listings with Videos array in details: 40 / 1,000  (4%)
Active listings with VirtualTours array:      8  / 1,000  (1%)
Active listings with OpenHouses array:        10 / 1,000  (1%)
listing_photos table: 0 rows
listing_videos table: 0 rows
```

The non-expand fields (ArchitecturalStyle, Roof, Flooring, etc.) are present at 87-96% because they come through the `$select` — but the expand arrays (Photos, Videos, VirtualTours, OpenHouses) are nearly empty because `expand: 'Media'` doesn't return them in the same structure as `expand: 'Photos,Videos,VirtualTours,OpenHouses'`.

## Files to Change

### 1. `app/actions/sync-spark.ts`

**Fix `syncSparkListingsActiveAndPending` (line ~524-530):**

```typescript
// CURRENT (BROKEN):
let result = await fetchListings({
  top: REFRESH_ACTIVE_PENDING_PAGE_SIZE,
  filter: ACTIVE_PENDING_ODATA_FILTER,
  select: SPARK_SELECT_FIELDS,        // ← PROBLEM: only 57 fields
  expand: 'Media',                     // ← PROBLEM: wrong expand
  orderby: 'ModificationTimestamp asc',
})

// FIXED:
let result = await fetchListings({
  top: REFRESH_ACTIVE_PENDING_PAGE_SIZE,
  filter: ACTIVE_PENDING_ODATA_FILTER,
  // No $select — pull ALL available fields (821 fields)
  expand: SYNC_EXPAND,                 // ← 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'
  orderby: 'ModificationTimestamp asc',
})
```

**Also fix the v1 fallback paths in the same function and in `runOnePageActivePendingSync`.** Every call to `fetchSparkListingsPage` for active/pending refresh that doesn't pass `expand: SYNC_EXPAND` needs to be fixed. Search for all instances of:

- `expand: 'Media'` → change to `expand: SYNC_EXPAND`
- `select: SPARK_SELECT_FIELDS` in sync contexts → remove the select parameter

There are multiple code paths (OData path, v1 fallback path, `runOnePageActivePendingSync` chunked path). Fix ALL of them. Grep for `ACTIVE_PENDING` and `'Media'` to find them all.

### 2. `lib/spark-odata.ts`

**Fix `fetchListings` (line ~194):**

When `select` is not provided, don't pass `$select` to the API at all. Currently `SPARK_SELECT_FIELDS` may be used as a default. Ensure that when no select is specified, ALL fields are returned.

### 3. `lib/spark.ts`

**Verify `sparkListingToSupabaseRow` (line ~640):**

This function maps `result.StandardFields` to the Supabase row. Verify that:

- `result.StandardFields.Photos` is where the expand data lands (it should be for v1 API)
- The `details` field captures ALL of `StandardFields` (it currently does: `details: f` where `f = result.StandardFields`)
- `PhotoURL` is extracted from `Photos[0]` with the resolution fallback chain (Uri1600 → Uri1280 → ... → Uri300)

## After Code Fixes — Run Backfill

After deploying the fixed code, run `syncPhotosOnly()` ONE TIME to backfill the ~5,600 active+pending listings that are already missing data. This can be triggered from:

- Admin dashboard → Sync page → Photos sync button
- Or via API: `POST /api/admin/sync/photos` (if endpoint exists)
- Or programmatically by calling the function

This will page through ALL Spark listings with full expand and update `PhotoURL` + `details` for each one. At 100 listings/page, active+pending = ~56 pages = ~56 API calls. For ALL 586K listings it's ~5,861 pages — run in chunks if needed.

**After the backfill, you never need to run `syncPhotosOnly` again.** The fixed `syncSparkListingsActiveAndPending` will keep everything current going forward.

## Verification

After fixes + backfill, run this query to verify:

```sql
-- Should return 0 (no active listings missing photos)
SELECT COUNT(*) FROM listings 
WHERE "StandardStatus" = 'Active' 
AND "PhotoURL" IS NULL;

-- Should show Photos array for active listings
SELECT "ListingKey", 
  details->'PhotosCount' as photos_count,
  jsonb_array_length(COALESCE(details->'Photos', '[]'::jsonb)) as photos_in_details
FROM listings 
WHERE "StandardStatus" = 'Active' 
LIMIT 10;
```

## Key Constants

```typescript
// In app/actions/sync-spark.ts — this is the CORRECT expand:
const SYNC_EXPAND = 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'

// In lib/spark-odata.ts — this should NOT be used as $select in sync:
export const SPARK_SELECT_FIELDS = 'ListingKey,ListingId,StandardStatus,...' // 57 fields
// Keep this constant for non-sync uses (e.g. search queries that don't need full details)
// but NEVER pass it as $select during any sync operation
```

## Rules

- Push directly to `main`. No feature branches.
- `npm run build` must pass before pushing.
- `npm run test` must pass before pushing.
- Use conventional commit messages: `fix: ...`
- After pushing, verify the fix by checking that the next sync run produces listings with `PhotoURL` populated and `details.Photos` array present.
- Do NOT ask for permission. Make the fix, test it, push it.

## Database Indexes (Bonus)

While you're at it, these indexes need to be applied to speed up the site. Run this SQL in the Supabase dashboard SQL Editor:

```sql
CREATE INDEX IF NOT EXISTS idx_listings_list_office_name ON listings ("ListOfficeName");
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings ("City");
CREATE INDEX IF NOT EXISTS idx_listings_standard_status_btree ON listings ("StandardStatus");
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings ("City", "StandardStatus");
CREATE INDEX IF NOT EXISTS idx_listing_history_listing_key ON listing_history (listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_history_event_date ON listing_history (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_listing_history_key_date ON listing_history (listing_key, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_listings_list_number ON listings ("ListNumber");
CREATE INDEX IF NOT EXISTS idx_listings_mod_ts_desc ON listings ("ModificationTimestamp" DESC NULLS LAST);
```

The migration file also exists at `supabase/migrations/20260402120000_performance_indexes.sql`.
