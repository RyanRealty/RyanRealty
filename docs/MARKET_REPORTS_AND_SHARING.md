# Market reports and sharing

## Share button (site-wide)

- **Component**: `components/ShareButton.tsx`
- **Where it appears**: Listing pages, city/subdivision search pages, and market report pages.
- **Behavior**:
  - Click the **Share** button (icon + label) to open the share menu.
  - On supported devices, **“More options…”** uses the native share sheet (e.g. Instagram, Messages, other apps).
  - Otherwise you get: **Copy link**, **Email**, **X (Twitter)**, **Facebook**, **LinkedIn**.
- **Format**: Each page sets its own `title` and `text` (and optional `url`) so when someone shares to a platform, the link shows the right Open Graph / Twitter Card (image, title, description). No extra formatting step—share uses the same metadata that search and social crawlers see.

## Explore market data

- **URL**: `/reports/explore`
- **What it is**: An interactive tool to explore all market data with no constraints: filter by **city** and **date range** (presets: last 7/30/90 days, this/last month, quarter, YTD, or custom), then view:
  - **Key metrics**: sales in period, median price, median DOM, median $/sqft, current listings, 12‑month sales, inventory (months).
  - **Monthly trend chart**: last 12 months of sales and median price (Recharts line chart).
  - **Price bands chart**: sales vs current listings by price band (Recharts bar chart).
- **Sharing**: The **Share** button uses the **current URL including query params** (`?city=...&start=...&end=...`). Anyone opening the link sees the same city and date range and can run the same view. Copy link, Email, X, Facebook, and LinkedIn all share this URL.
- **Data**: Same RPCs as admin reports: `get_city_period_metrics`, `get_city_price_bands`, plus `get_city_metrics_timeseries` for the trend (monthly sold count and median price). Default: single-family residential only. You can include **condos & townhomes**, **manufactured**, or **acreage/land** via the Property type checkboxes; optional min/max price filters apply. Report period and location are shown at the top of the results and in chart subtitles. **Commercial** is supported: use the “Commercial” checkbox in the Property type section (or `?commercial=1` in the URL). Multi-family would require an additional RPC parameter and `PropertyType` matching if needed.

## Market reports (weekly)

- **What it is**: A weekly, auto-generated “blog” post: **“Here’s what happened in the market last week.”** It lists homes that **went pending** and **closed**, broken down **by city** (from `listing_history` + `listings`).
- **URLs**:
  - Index: `/reports`
  - One report: `/reports/weekly-YYYY-MM-DD` (e.g. `/reports/weekly-2025-03-02` for the week starting that Sunday).
- **Report content**:
  - Title: e.g. “Central Oregon Market Report: March 2 – March 8, 2025”.
  - AI-generated header image (Grok), stored in the same Storage bucket as banners (`reports/weekly-YYYY-MM-DD.jpg`).
  - HTML sections per city: “Went pending (N)” and “Closed (N)” with short listing details (price/description).
- **Sharing**: Each report page has a **Share** button; the report URL is set up with Open Graph and Twitter Card (image, title, description) so sharing to X, Facebook, LinkedIn, or email shows the right preview.

## Generating the weekly report

1. **Manually**: Go to **Admin → Market report** (`/admin/reports`) and click **“Generate weekly report”**. This builds the report for **last week** (Sunday–Saturday).
2. **Cron (e.g. Saturday morning)**:
   - Call `GET /api/cron/market-report` with header `Authorization: Bearer <CRON_SECRET>` (same secret as sync).
   - Suggested schedule: Saturday 6:00 AM PT (so “last week” is fully in the past).

## Data source

- **Sales report cards and detail pages** (`/reports`, `/reports/sales/[city]/[period]`):
  - **Closed sales**: From the **listings** table: `StandardStatus` ilike '%closed%' and `CloseDate` in the period. This is the same source as the report RPCs (`get_city_period_metrics`). Data appears as long as Spark sync populates **CloseDate** and **StandardStatus** on closed listings.
  - **Pending (went pending in period)**: From **listing_history**: events with `event` ilike '%Pending%' and `event_date` in the period; city resolved via `listings` (match on `ListingKey` or `ListNumber`). Requires **Sync listing history** to have been run (Admin → Sync).
- **Weekly market report** (generated report): Uses the same logic — closed from `listings` (CloseDate), pending from `listing_history`. City and listing details come from `listings`.
- **If reports show no data**: Ensure (1) Spark listing sync runs and returns `CloseDate` and `StandardStatus` for closed listings, and (2) for “pending” counts, run **Sync listing history** (and optionally run it with “Include closed listings” to backfill history for closed listings too).

## External data: HousingWire / Altos Research

**HousingWire Data** (formerly Altos Research) offers national and local real estate data that could complement local MLS/sales data:

- **Listings data** – Weekly active listing counts, inventory, property-level detail (ZIP/city).
- **Pending data** – Contract activity (30–90 day lead on closings).
- **Sold data** – Closed sale insights, pricing trends, market velocity.
- **Rental data** – Single-family and multifamily rental supply and pricing.
- **Trends** – Weekly housing indicators; median list price; 30-year fixed mortgage rates (hourly); 10-year treasury.

Coverage is broad (110M+ properties, 99% U.S., weekly refresh). Delivery is API or bulk files; they offer 4-week sample files for evaluation.

**Integration status: none. Never contracted, and the scaffold is deleted (2026-08-17).**

The prospect above was scaffolded as a `'use server'` action (`app/actions/housingwire.ts`) plus a types
module (`lib/housingwire-types.ts`), rendered by a card on `/reports/explore`. That card and its client were
deleted when the explore route was retired, leaving the action with zero callers — a server action that
fetched a third party on the request path and that nothing could reach. Both files were deleted; the
`HOUSINGWIRE_API_KEY` / `HOUSINGWIRE_API_BASE_URL` env slots are gone from `.env.example` with them.

**What supplies national rate context today**: `/api/cron/market-history-snapshot` (Mondays 13:00 UTC) writes
the 30-yr fixed mortgage rate, the 10Y treasury, and the computed spread into `public.market_history_weekly`
under `geo_type='national', geo_slug='us'`. Sources are FRED (`MORTGAGE30US`, `DGS10`, needs `FRED_API_KEY`)
with the keyless Freddie Mac PMMS history CSV as the 30-yr fallback — see `lib/market-national-series.ts`.
Read it through the DAL (`getMarketHistoryWeekly`), never by refetching a vendor at request time. Each row
carries `source` and `captured_at`, plus `observation_date` — the provider's own vintage — once migration
`20260817120000_market_history_weekly_observation_date.sql` is applied.

State as of 2026-08-17: `FRED_API_KEY` is not set in production, so only `mortgage_rate_30yr` is landing
(4 weekly rows, `source=freddie:pmms30`, newest 6.67 for week 2026-08-17). `treasury_10yr` and
`mortgage_treasury_spread` have no rows until the key is added.

If HousingWire is ever contracted, it belongs in that cron as another ingest source writing dated rows to
`market_history_weekly` — not as a request-path fetch.

## Optional: daily reports

The `market_reports` table supports `period_type: 'daily'` as well. You can add a separate job (e.g. nightly) that generates a “yesterday” report and a separate API route or action if you want daily summaries later.
