# Reporting and analytics architecture

Reports use **100% of listing data** and stay **fast** by reading from pre-aggregated cache tables that are updated after each sync.

## Report branding

All reports (PDF and web) are **branded consistently**:

- **Logo** — When a brokerage logo is configured (Admin → Site pages), it appears in report PDFs and anywhere the report is identified. When no logo is set, the business name is used as text.
- **Fonts** — Brand typography from `app/globals.css`: **Amboqia Boriango** (display/headings) and **AzoSans** (body). PDFs register these fonts and use them; report web pages use `font-[family-name:var(--font-display)]` and `font-[family-name:var(--font-body)]`.
- **Colors** — Brand palette only: navy (`#102742` / `--brand-navy`), cream (`#F0EEEC` / `--brand-cream`), accent (`#D4A853` / `--accent`), and design tokens for text/surfaces (`--text-primary`, `--text-secondary`, `--gray-border`, `--surface`, etc.). No one-off zinc or gray hex values in report UI.
- **Tone** — Professional, confident, and aligned with the luxury real estate brand: clear headings, concise copy, and a trustworthy, expert voice. Report copy and CTAs should feel consistent with the rest of the site (align with the rest of the site).

## How it works

1. **Source of truth**  
   `listings` and `listing_history` hold the full dataset (all listings, all history rows). Sync writes here.

2. **Report cache**  
   `report_listings_breakdown` is a single-row table with pre-computed totals and breakdowns (by status, by city with Active/Pending/Closed).  
   - **Refreshed** by `refresh_listings_breakdown()` after every **listings** or **full** sync.  
   - **Read** by `get_listings_breakdown()` and by the browse-cities logic. No full table scan at request time.

3. **Indexes**  
   Indexes on `listings` (City, StandardStatus, ModificationTimestamp) and `listing_history` (price_change, listing_key + event_date) keep ad-hoc and future report queries fast when they do hit the raw tables.

## Flow

- **Sync completes** → app calls `refreshListingsBreakdown()` → `refresh_listings_breakdown()` runs in DB (full scan of `listings`, one time) → cache row updated.  
- **User opens sync page or any report** → `get_listings_breakdown()` runs → reads one row from `report_listings_breakdown` → response is instant and reflects all listings.

## Adding new reports (price drops, market trends, etc.)

- **Pre-aggregate when possible**  
  For heavy metrics (e.g. price drops by city, new listings by week), add a **report_*** table or materialized view that is updated after sync (or on a cron). The site then queries that table instead of scanning 200k+ rows.

- **Keep using indexes**  
  For one-off or parameterized reports (e.g. “history for this listing”), query `listings` / `listing_history` with filters that use the existing indexes (city, status, event_date, listing_key, price_change).

- **Cron (optional)**  
  You can run `refresh_listings_breakdown()` on a schedule (e.g. hourly) in addition to after sync, so the cache stays fresh even if syncs are rare.

## Reports by city and period

Metrics (sold count, median price, median DOM, median $/sqft, current listings, 12mo sales, inventory, price bands) are available on demand via:

- **RPCs:** `get_city_period_metrics(p_city, p_period_start, p_period_end, p_as_of)` and `get_city_price_bands(p_city, p_period_start, p_period_end, p_sales_12mo)`.
- **Data:** `listings."CloseDate"` and `listings."ListDate"` are populated by sync from Spark; indexes on `(City, CloseDate)` keep these queries fast.
- **Filter:** SFR only (exclude condo, townhouse, manufactured, acreage via `PropertyType`).
- **UI:** Admin → Reports → “Report by city & period” (city, month/quarter, generate).

## Finalized sync (closed listings)

Once a **closed** listing has full history and media synced, it is marked `history_finalized` and `media_finalized` so future syncs skip re-fetching (keeps sync fast). History sync only processes rows where `history_finalized = false` or status is not closed; after a successful history fetch for a closed listing, that row is set `history_finalized = true`. Listings sync sets `media_finalized = true` for closed listings when upserting.

## Migrations

- `20250305100000_reporting_cache_and_indexes.sql`: report cache table, `refresh_listings_breakdown()`, `get_listings_breakdown()` reading from cache, and indexes for listings and listing_history.
- `20250304100000_sync_history_and_media_counts.sql`: `get_listing_media_counts()` for admin photos/videos counts.
- `20250305110000_finalized_sync_and_beacon.sql`: `CloseDate`, `ListDate`, `history_finalized`, `media_finalized` on listings; indexes; report RPC implementation.
- `20250305120000_rename_report_functions.sql`: `get_city_period_metrics()`, `get_city_price_bands()` (generic names used by the app).

Run: `npx supabase db push`
