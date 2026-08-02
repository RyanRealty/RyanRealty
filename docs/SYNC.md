# Full sync: listings, history, photos, videos

## Always-on sync (production)

Sync runs **in the background** with no manual steps:

- **Delta sync (every 2 min)** — Inngest fetches listings changed in the last 2 minutes and upserts them. Keeps active and pending listings up to date.
- **Full sync (every 10 min)** — Vercel cron calls `GET /api/cron/sync-full`. Each run does one chunk: 5 listing pages **or** 30 history listings. Newer listing pages are processed first; then history is backfilled for non-finalized listings. Once a closed listing’s history is finalized, it is never synced again.

**Admin → Sync** is the **status page**: Spark API vs database, last sync times, by-city breakdown. Manual controls (Smart Sync, Refresh active & pending, delta trigger, history buttons) are under **Advanced / override** for one-off runs or troubleshooting. No buttons are required for normal operation.

**Cron is on by default.** The `sync_cursor` row has `cron_enabled = true` (see migration `20260415120000_sync_cron_always_on.sql`). To disable background full sync, set `cron_enabled` to `false` in the database or via the Advanced section.

## What gets synced

1. **Listings** – Fetched from Spark with `expand=Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents`. Each listing is upserted into `listings` with:
   - Core fields (ListPrice, City, StandardStatus, ListDate, CloseDate, etc.)
   - `PhotoURL` = first/primary photo URL
   - `details` (JSONB) = full Spark StandardFields, including **Photos**, **Videos**, FloorPlans, VirtualTours, etc.

2. **History** – For each listing we call Spark’s history (or price history) API and store rows in `listing_history` (event_date, event, price, price_change, raw). Closed listings are marked `history_finalized` after a successful fetch so future syncs skip them.

3. **Photos/videos** – Not in separate tables. They live inside `listings.details` (e.g. `details.Photos`, `details.Videos`). There is no whole-table media count: `get_listing_media_counts()` read `details` with no WHERE clause (~38 minutes of detoast) and was dropped 2026-08-01 — see [`TOAST_READ_DISCIPLINE.md`](TOAST_READ_DISCIPLINE.md). Bounded video reads go through `fetchListingsWithVideos()`.

## How to run sync (override / local)

### Option A: Admin UI (Advanced)

Open **Admin → Sync**, expand **Advanced / override**, and use **Full sync (Smart Sync)**, **Refresh active & pending**, **Trigger delta sync**, or **Sync history** as needed. Use only for troubleshooting or one-off backfills; background sync handles normal updates.

### Option B: Script (local hands-off)

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

### Option C: Cron (production – automatic)

Vercel Cron invokes `GET /api/cron/sync-full` every 10 minutes (`*/10 * * * *` in `vercel.json`). Each run does 5 listing pages or 30 history listings by default; override with `?pages=5&history_limit=30` if needed. Ensure `CRON_SECRET` is set in Vercel env.

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
- **Counts:** Admin Sync page shows total listings and history rows. It does not show photos/videos counts — `get_listing_media_counts()` was dropped 2026-08-01 as an unbounded `details` scan.
