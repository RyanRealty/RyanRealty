# Market reports and sharing

## Share button (site-wide)

- **Component**: `components/ShareButton.tsx`
- **Where it appears**: Listing pages, city/subdivision search pages, and market report pages.
- **Behavior**:
  - Click the **Share** button (icon + label) to open the share menu.
  - On supported devices, **“More options…”** uses the native share sheet (e.g. Instagram, Messages, other apps).
  - Otherwise you get: **Copy link**, **Email**, **X (Twitter)**, **Facebook**, **LinkedIn**.
- **Format**: Each page sets its own `title` and `text` (and optional `url`) so when someone shares to a platform, the link shows the right Open Graph / Twitter Card (image, title, description). No extra formatting step—share uses the same metadata that search and social crawlers see.

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

- **Pending / closed**: From `listing_history`: events whose `event` contains “Pending” or “Closed” and `event_date` in the report range.
- **City**: Resolved via `listings` (join on `listing_key` → `ListingKey` or `ListNumber`). Make sure listing sync and history sync run so `listing_history` and `listings` are up to date before generating the report.

## Optional: daily reports

The `market_reports` table supports `period_type: 'daily'` as well. You can add a separate job (e.g. nightly) that generates a “yesterday” report and a separate API route or action if you want daily summaries later.
