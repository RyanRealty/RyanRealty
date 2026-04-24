# ClosePrice Coverage Fix — Complete Brief

**Date:** April 14, 2026
**Priority:** High — 85% of closed listings have NULL ClosePrice; blocks every YoY/historical market analysis
**Status:** Ready for execution

---

## Context

`listings.ClosePrice` is supposed to be the typed column for the sale price of closed listings. It's the field that every market snapshot, CMA, YoY comparison, and Bend market stats RPC relies on. Today it is almost entirely empty:

```
Bend SFR only (PropertyType='A', StandardStatus='Closed'):
  2026 YTD: 506 closed,   74 with ClosePrice  (14.6%)
  2025:   2,534 closed,    0 with ClosePrice  (0%)
  2024:   2,343 closed,    0 with ClosePrice  (0%)
  2023:   2,247 closed,    0 with ClosePrice  (0%)
  All history: ~20K closed, 0 with ClosePrice (0%)
```

But the `listing_history` table DOES have the data — via `FieldChange` events on the `ClosePrice` field and `MlsStatus: Pending → Closed` events. Coverage is high for 2024 H2 (~100%), degrades from there, and the history table has ~138K ClosePrice-change events going back to 1996.

So the Spark API is returning the price. It's landing in `listing_history`. It's landing in `listings.details` JSONB. **It is never being written to the typed `listings.ClosePrice` column.**

## Root Cause (Confirmed)

`lib/spark.ts:689` — `sparkListingToSupabaseRow()` — the single transformation function every sync path uses to build a Supabase row from a Spark response. It explicitly maps 22 fields. **ClosePrice is not one of them.** Current return object (lines 713-740):

```typescript
return {
  ListingKey, ListNumber, ListPrice,
  StreetNumber, StreetName, City, State, PostalCode,
  Latitude, Longitude, SubdivisionName,
  BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt,
  StandardStatus, PhotoURL, ModificationTimestamp,
  PropertyType, ListDate, CloseDate,        // <-- date, yes. price, no.
  media_finalized,
  details: f as Record<string, unknown>,     // <-- ClosePrice lives here in JSONB
  ListOfficeName, ListAgentName, OnMarketDate, OpenHouses,
}
```

`f.ClosePrice` is available on the Spark response (it's in `SPARK_SELECT_FIELDS` at `lib/spark-odata.ts:263` and the terminal sync pulls all fields), and it's preserved inside `details`, but it never hits the `ClosePrice` column. Result: every sync writes NULL to `listings.ClosePrice` even though the data was right there.

The secondary gap is that the **delta sync filter is `ACTIVE_PENDING_ODATA_FILTER` only** (`app/actions/sync-spark.ts:275`). A listing that transitions from Pending → Closed is only captured by delta on the one run that sees the transition. Once it's fully Closed, it's outside the delta filter. The terminal refresh path (`TERMINAL_STATUS_OR`, line 1059) is what should be keeping closed records current — but even when it runs, `sparkListingToSupabaseRow` strips out ClosePrice.

Also worth fixing in the same pass: **`OriginalListPrice` is also not mapped to a typed column** (same root cause). `sale_to_list` ratios currently need to dig into `details->>'OriginalListPrice'`, which is both slow and brittle.

## Scope of Work

Three things, in order:

1. **Fix the mapping function** so every future sync populates `ClosePrice` (and `OriginalListPrice`) as typed columns.
2. **Backfill the historical gap** from `listing_history`, so we don't wait years for the fixed sync to rebuild what we already have.
3. **Fill remaining coverage gap** from Spark API for listings where neither the typed column nor history has a price — full terminal re-sync for pre-2024 closes.

## Files to Change

### 1. `lib/spark.ts` — `sparkListingToSupabaseRow` (line 689)

Add `ClosePrice` and `OriginalListPrice` to the returned row. Use the existing `toNum()` helper.

```typescript
// In the return block (after ListPrice: toNum(f.ListPrice),)
ClosePrice: toNum(f.ClosePrice),
OriginalListPrice: toNum(f.OriginalListPrice),
```

Place them near `ListPrice` and `CloseDate` for readability. Both fields are already on the Spark `StandardFields` interface — check `lib/spark-odata.ts:34` which has `ClosePrice?: number` already typed. If `OriginalListPrice` is not on the interface yet, add it.

Verify the Supabase `listings` table has both columns (it does — `ClosePrice` is queryable today; verify `OriginalListPrice` exists and add it via migration if not).

### 2. New script: `scripts/backfill-close-price-from-history.mjs`

One-time backfill. Does not need to be committed as a recurring script — run once, verify, keep the file for reference.

Logic:

```js
// Pseudocode — implement in node against Supabase service role
// For each distinct listing_key in listings where StandardStatus ILIKE '%Closed%' and ClosePrice IS NULL:
//   1. Pull the latest ClosePrice FieldChange event from listing_history
//      WHERE listing_key = X
//        AND event = 'FieldChange'
//        AND description ILIKE 'ClosePrice%'
//        AND price > 0
//      ORDER BY event_date DESC LIMIT 1
//   2. If no ClosePrice event: fall back to the MlsStatus → Closed event with price > 0
//      WHERE listing_key = X
//        AND event = 'FieldChange'
//        AND description ILIKE 'MlsStatus:%→ Closed'
//        AND price > 0
//      ORDER BY event_date DESC LIMIT 1
//   3. If found: UPDATE listings SET ClosePrice = <price> WHERE ListingKey = X
//   4. Log the match to console (key, price, source: closeprice_event | status_event | missing)
//   5. At end, write summary: {matched_via_closeprice, matched_via_status, no_history, total}
```

Batch in chunks of 500 updates. Use `.in('ListingKey', chunk)` + a loop rather than row-by-row. Expected yield from history alone (based on Apr 14, 2026 data): ~2,100 rows for 2024 closes, ~500 for 2025, ~75 for 2026.

Also backfill `OriginalListPrice` from `details->>'OriginalListPrice'` in the same script:

```sql
UPDATE listings
SET "OriginalListPrice" = (details->>'OriginalListPrice')::numeric
WHERE "OriginalListPrice" IS NULL
  AND details ? 'OriginalListPrice'
  AND (details->>'OriginalListPrice') ~ '^[0-9]+(\.[0-9]+)?$';
```

### 3. Full terminal re-sync for pre-2024 closes

After the mapping fix is deployed AND the history-based backfill has run, identify listings where ClosePrice is still NULL and re-fetch them from Spark. Use the existing terminal sync path in `syncSparkListingsTerminal` (or whichever function handles `TERMINAL_STATUS_OR`). Scope to `StandardStatus ILIKE '%Closed%' AND ClosePrice IS NULL`.

This is the slow path but it's the only way to recover closes older than listing_history's effective coverage window (pre-2023). Expected volume: ~15K-17K listings once 1-2 are deducted. Page at 100/call, run overnight, throttle to avoid Spark rate limits.

There is already a `scripts/run-full-sync.mjs` — extend it or clone into `scripts/backfill-close-price-from-spark.mjs` scoped to the remaining gap.

## Verification

After each step, run these queries against Supabase (`ryan-realty-platform`, ref `dwvlophlbvvygjfxcrhm`):

```sql
-- Step 1 (mapping fix deployed, before backfill): coverage unchanged, but NEW closes start populating
-- Re-run daily for a week. Should see 2026 YTD climb.
SELECT EXTRACT(YEAR FROM "CloseDate") AS yr,
       COUNT(*) AS closed,
       COUNT("ClosePrice") AS with_price,
       ROUND(100.0*COUNT("ClosePrice")/COUNT(*), 1) AS pct
FROM listings
WHERE "StandardStatus" ILIKE '%Closed%' AND "CloseDate" IS NOT NULL
GROUP BY EXTRACT(YEAR FROM "CloseDate")
ORDER BY yr DESC;

-- Step 2 (history backfill complete): expect 70-100% coverage for 2024, 15-30% for 2025
-- Exact targets depend on listing_history coverage at time of backfill

-- Step 3 (Spark re-sync complete): expect >95% for all years 2023 onward
-- Some closes genuinely have no ClosePrice in the MLS (private deals, data entry gaps) — <5% residual is acceptable

-- Same-shape check for OriginalListPrice:
SELECT COUNT(*) AS total_closed,
       COUNT("OriginalListPrice") AS with_olp,
       ROUND(100.0*COUNT("OriginalListPrice")/COUNT(*), 1) AS pct_olp
FROM listings
WHERE "StandardStatus" ILIKE '%Closed%';
```

## Acceptance Criteria

- `npm run build` passes.
- `npm run test` passes. Add or update a test that confirms `sparkListingToSupabaseRow` surfaces `ClosePrice` on a Closed fixture.
- The daily delta sync, after deployment, starts populating `ClosePrice` on any listing that transitions Pending → Closed.
- Backfill script ran successfully with logged summary (matched / no-match counts).
- Post-backfill coverage for 2024 Bend SFR closes is ≥70% of total closed rows.
- Post-terminal-resync coverage for all years 2023+ is ≥95%.

## Rules

- Push directly to `main`. No feature branches.
- `npm run build` and `npm run test` must pass before pushing.
- Use conventional commits: `fix: populate ClosePrice in sparkListingToSupabaseRow`, `chore: backfill ClosePrice from listing_history`.
- Do NOT ask for permission. Diagnose, fix, test, push.
- Never skip hooks (`--no-verify`) or bypass signing.
- After pushing, verify the next scheduled sync run in production actually populates `ClosePrice` (tail Vercel logs or run a manual delta sync and check a recently-closed listing).

## Notes for Future Brand-side Content Work

Once this lands, `getCachedStats()` / `getLiveMarketPulse()` in `app/actions/market-stats.ts` and the `lib/cma.ts` resolveClosePrice chain should both stop needing the `details->>'ClosePrice'` fallback. Clean up the fallback after verifying coverage.

Also, every market snapshot I generate for social content will be blocked on at least the backfill step of this work — YoY price comparisons ("Bend median down X% vs. last spring") are impossible without historical ClosePrice. Prioritize step 2 even if step 3 is deferred.

## Related

- `docs/briefs/sync-data-completeness-fix.md` — companion fix, photos/videos coverage
- `docs/SYNC.md`, `docs/SYNC_SYSTEM_AUDIT.md` — sync architecture reference
- `lib/cma.ts:213` — `resolveClosePrice()` fallback chain (can simplify once this is fixed)
- `app/actions/market-stats.ts` — consumer of `ClosePrice`; runs all the Bend median/average calculations
