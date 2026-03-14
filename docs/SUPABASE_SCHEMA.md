# Supabase Listings Schema

The site **reads all listing data from Supabase**. Spark (and future MLS APIs) are used only to **ingest** data into this table.

## Required columns

After the first sync, the `listings` table should have at least these columns (sync creates them on upsert if your project allows). If you created the table manually or see errors, add any missing columns:

```sql
-- Run in Supabase SQL Editor if columns are missing.

-- Add full listing payload (Photos, remarks, etc.) for detail pages
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS details jsonb;

-- For prev/next navigation by date
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS "ModificationTimestamp" timestamptz;

-- Unique constraint for upsert (sync uses ListNumber)
-- If not already set:
-- ALTER TABLE listings ADD CONSTRAINT listings_listnumber_key UNIQUE ("ListNumber");
```

## Flow

1. **Ingest**: Spark sync (`/admin/sync` or `POST /api/sync-spark`) calls the Spark API and upserts into `listings`. Same pattern can be used for other MLS APIs — add a sync job that maps their response to the same row shape and upserts by a unique key (e.g. `ListNumber` or `ListingKey`).
2. **Read**: Home, search, map, and listing detail all read from Supabase. No direct Spark calls for display.
3. **Multiple MLS sources**: Use a single `listings` table. Add an optional `source` column (e.g. `'spark'`, `'mls2'`) and ensure unique keys per source (e.g. `source + ListingKey`). Sync jobs from each API upsert into the same table; the site stays unchanged.

## Listing history table

The `listing_history` table stores price/status history per listing for **CMAs and market analytics** (list date, price changes, last sale, etc.). Populated by “Sync history” on `/admin/sync` (calls Spark `GET /listings/:key/history` in batches and upserts). Listing pages and reports read from this table so the app does not query the Spark API for history.

- **Columns**: `listing_key`, `event_date`, `event`, `description`, `price`, `price_change`, `raw` (jsonb with full Spark item).
- **Migration**: `supabase/migrations/20250303120000_listing_history.sql`

## Sync cursor (cron full sync)

The `sync_cursor` table stores progress for the **cron-driven full sync** (`GET /api/cron/sync-full`). Each cron run (e.g. every 15 min) does one chunk of listings or one batch of history; the cursor is updated so the next run continues. When both are complete, phase is set to `idle`; the next run starts a new cycle (listings from page 1).

- **Migration**: `supabase/migrations/20250303230000_sync_cursor.sql`
- **Required for**: Vercel Cron job that runs full sync (listings + history) without keeping the browser open. Run `npx supabase db push` or apply the migration in Supabase SQL Editor before relying on the cron.

## Listings breakdown (admin)

The function `get_listings_breakdown()` returns total listing count and counts by status and by city (active/pending/closed/other) for the admin sync page. Without it, the breakdown is limited to the first 1,000 rows.

- **Migration**: `supabase/migrations/20250303240000_listings_breakdown_function.sql`
