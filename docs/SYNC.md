# Full sync: listings, history, photos, videos

## What gets synced

1. **Listings** – Fetched from Spark with `expand=Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents`. Each listing is upserted into `listings` with:
   - Core fields (ListPrice, City, StandardStatus, ListDate, CloseDate, etc.)
   - `PhotoURL` = first/primary photo URL
   - `details` (JSONB) = full Spark StandardFields, including **Photos**, **Videos**, FloorPlans, VirtualTours, etc.

2. **History** – For each listing we call Spark’s history (or price history) API and store rows in `listing_history` (event_date, event, price, price_change, raw). Closed listings are marked `history_finalized` after a successful fetch so future syncs skip them.

3. **Photos/videos** – Not in separate tables. They live inside `listings.details` (e.g. `details.Photos`, `details.Videos`). Admin counts use `get_listing_media_counts()` (listings with PhotoURL, listings with `details.Videos` array length > 0).

## How to run a full sync

### Option A: Admin UI (Full sync)

1. Open **Admin → Sync**.
2. Use **Full sync (listings + history)**. It will:
   - Run listing sync in chunks (20 pages at a time) until all pages are done.
   - Then run history sync in batches (50 listings at a time) until every listing that needs history has been processed.
3. Keep the tab open until it reports “Full sync complete.”

### Option B: Script (hands-off)

1. **Env** – In `.env.local` set:
   - `CRON_SECRET` (any string, e.g. `local-sync-secret`)
   - `SPARK_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (already required for sync).

2. **Terminal 1** – Start the app:
   ```bash
   npm run dev
   ```

3. **Terminal 2** – Run the sync loop (calls `/api/cron/sync-full` until both phases are done):
   ```bash
   npm run sync:full
   ```
   Uses `?pages=20&history_limit=100` so each request does more work. Run until you see “Full sync complete.”

### Option C: Cron (production)

Call `GET /api/cron/sync-full` with `Authorization: Bearer <CRON_SECRET>` on a schedule (e.g. every 10–15 min). Each run does 5 listing pages or 30 history listings by default; override with `?pages=5&history_limit=30` if needed.

## Spark: Listing History vs Historical Listings

Flexmls/Spark expose two different concepts:

| Concept | Purpose | Endpoint (example) | Docs |
|--------|---------|--------------------|------|
| **Listing History** | Status/event changes on a *specific* listing: status changes, who made them, price change data. | `GET /v1/listings/{id}/history` | [Listings: History](https://sparkplatform.com/docs/api_services/listings/history) |
| **Historical Listings** | Listings that have since gone *off market* — full listing objects for prior MLS records for the same property. | `GET /v1/listings/{id}/historical` (and `/historical/pricehistory` for a price timeline) | [Listings: Historical](https://sparkplatform.com/docs/api_services/listings/historical) |

We use **Listing History** to power the “Price & status history” section on the listing page (and to backfill `listing_history`). We try `/history` first, then `/historical/pricehistory` if the first returns no events. **Historical Listings** (`/historical`) is available via `fetchSparkHistoricalListings` for “previously listed at $X” or full prior listing details.

## Listing history and API key role

**To get any listing history data, your Spark API key must have the Private role.** The [Spark Listings: History](https://sparkplatform.com/docs/api_services/listings/history) docs state:

- **Private** — Only private roles see full listing history.
- **IDX, VOW, Portal, Public** — See a condensed set and **may be completely restricted from access by the MLS**.

If you run a full sync and `listing_history` stays empty, Spark is returning 0 events for every listing; the app only stores what Spark returns. Run `npm run test:history` (or **Admin → Sync → Test listing history API**) to confirm; both show HTTP status and item counts for a few listings. To get history, contact your MLS or Spark to obtain an API key with **Private** role, then re-run the history phase (or reset `history_finalized` and run full sync again).

## What can block or limit sync

| Issue | What to do |
|-------|------------|
| **CRON_SECRET not set** | Add `CRON_SECRET=any-value` to `.env.local` for the script or cron. |
| **Supabase “statement timeout”** | Listing upserts use chunk size 12 and retry in sub-chunks of 5 on timeout. If timeouts persist, reduce load (e.g. fewer `?pages=` per request). |
| **No history from Spark** | Your key must be **Private** role; IDX/VOW/Portal are often restricted to 0 history. See [Listing history and API key role](#listing-history-and-api-key-role) above and [Spark Listings: History](https://sparkplatform.com/docs/api_services/listings/history). Use Admin → Sync → “Test listing history API” to confirm. |
| **Missing photos/videos** | They come from the same listing request (expand). If Spark doesn’t return Photos/Videos for some listings, those rows will have empty arrays in `details`. |

## After sync

- **Refresh report cache:** The Full sync UI (and the cron route) call `refreshListingsBreakdown()` when history phase completes.
- **Counts:** Admin Sync page shows total listings, history rows, and (via `get_listing_media_counts()`) listings with photos and with videos.
